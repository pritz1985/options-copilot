"use client";
import { useState, useRef, useCallback, useEffect } from "react";

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  bg: "#05050e", surface: "#0a0a18", card: "#0f0f1f",
  border: "#1a1a32", accent: "#ff5b1f", accentDim: "rgba(255,91,31,0.12)",
  cyan: "#00c8f0", cyanDim: "rgba(0,200,240,0.12)",
  bull: "#00e87a", bullDim: "rgba(0,232,122,0.12)",
  bear: "#ff2d55", bearDim: "rgba(255,45,85,0.12)",
  amber: "#ffb300", amberDim: "rgba(255,179,0,0.12)",
  purple: "#c084fc", text: "#dde0f5", textDim: "#8888b0",
  muted: "#4a4a70", dim: "#1e1e3a",
};

const LOG_COLOR = {
  info: C.text, system: C.cyan, success: C.bull,
  error: C.bear, warning: C.amber, market: C.purple,
  trade: C.accent, dim: C.muted, search: C.purple,
};

const ts = () => new Date().toLocaleTimeString("en-US", { hour12: false });
const convColor = (s) => (s >= 85 ? C.bull : s >= 70 ? C.amber : C.textDim);
const riskColor = (r) => ({ low: C.bull, medium: C.amber, high: C.bear }[r] || C.textDim);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const fmt$ = (n) => n != null && !isNaN(n) ? Number(n).toLocaleString("en-US", { style: "currency", currency: "USD" }) : "—";

const fmtExpiry = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "2-digit" });
};

const buildOrderText = (o) => {
  const cost = (o.quantity * o.limitPrice * 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
  return `${o.ticker} ${fmtExpiry(o.expiry)} $${o.strike} ${o.instrument.toUpperCase()}
BUY ${o.quantity} @ LMT $${o.limitPrice.toFixed(2)} (DAY)
Cost: ${cost}
Target: $${o.target}  |  Stop: $${o.stop}
Conviction: ${o.conviction}%`;
};

export default function OptionsCopilot() {
  const [tab, setTab] = useState("scan");
  const [mode, setMode] = useState("manual");
  const [scanning, setScanning] = useState(false);
  const [ideas, setIdeas] = useState([]);
  const [trades, setTrades] = useState([]);
  const [history, setHistory] = useState([]);
  const [notification, setNotification] = useState(null);

  const [logs, setLogs] = useState([
    { msg: "⚡ Options Co-Pilot v4.0 — Live AI", type: "system", ts: ts() },
    { msg: "Real-time market scanning powered by Claude + web search", type: "info", ts: ts() },
    { msg: "Press RUN MARKET SCAN to begin", type: "info", ts: ts() },
  ]);
  const [scanConfig, setScanConfig] = useState({ focus: "all", minConviction: 70, maxIdeas: 5 });
  const [settings, setSettings] = useState({
    maxPosition: 5000, maxDailyLoss: 2000,
    expressThreshold: 85, accountSize: 25000,
  });

  const logRef = useRef(null);
  const addLog = useCallback((msg, type = "info") => {
    setLogs((prev) => [...prev.slice(-300), { msg, type, ts: ts() }]);
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const notify = (msg, color = C.accent) => {
    setNotification({ msg, color });
    setTimeout(() => setNotification(null), 3500);
  };

  const queueTrade = useCallback((idea, express = false) => {
    const mid = parseFloat(((idea.entryLow + idea.entryHigh) / 2).toFixed(2));
    const trade = {
      id: `trd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ticker: idea.ticker, company: idea.company || idea.ticker,
      direction: idea.direction, instrument: idea.instrument,
      strike: idea.strike, expiry: idea.expiry, dte: idea.dte,
      quantity: idea.quantity || 1, limitPrice: mid,
      target: idea.target, stop: idea.stop,
      conviction: idea.conviction, thesis: idea.thesis,
      catalysts: idea.catalysts, ivPercentile: idea.ivPercentile,
      sector: idea.sector, status: "ready", express,
      createdAt: new Date().toISOString(),
    };
    setTrades((prev) => [trade, ...prev]);
    setIdeas((prev) => prev.map((i) => (i.id === idea.id ? { ...i, status: "approved" } : i)));
    addLog(`📋 Trade ticket: ${trade.ticker} ${trade.instrument.toUpperCase()} $${trade.strike}${express ? " [EXPRESS]" : ""}`, "trade");
    return trade;
  }, [addLog]);

  const approveIdea = (idea) => {
    addLog(`✅ APPROVED: ${idea.ticker} ${idea.instrument.toUpperCase()} $${idea.strike}`, "success");
    queueTrade(idea, false);
    setTab("trades");
  };

  const rejectIdea = (id) => {
    setIdeas((prev) => prev.map((i) => (i.id === id ? { ...i, status: "rejected" } : i)));
    addLog("🚫 Idea rejected", "dim");
  };

  const markLogged = (id) => {
    const t = trades.find((x) => x.id === id);
    if (!t) return;
    setTrades((prev) => prev.filter((x) => x.id !== id));
    setHistory((h) => [{ ...t, status: "logged", loggedAt: new Date().toISOString() }, ...h]);
    addLog(`✅ Logged in IBKR: ${t.ticker}`, "success");
    notify(`Logged: ${t.ticker}`, C.bull);
  };

  const skipTrade = (id) => {
    const t = trades.find((x) => x.id === id);
    if (!t) return;
    setTrades((prev) => prev.filter((x) => x.id !== id));
    setHistory((h) => [{ ...t, status: "skipped", skippedAt: new Date().toISOString() }, ...h]);
    addLog(`🚫 Skipped: ${t.ticker}`, "dim");
  };

  // ─── REAL AI MARKET SCAN — calls /api/scan on the server ──────────────────
  const runScan = async () => {
    if (scanning) return;
    setScanning(true);
    setIdeas([]);
    addLog("━━━━━━━━━ NEW SCAN ━━━━━━━━━", "system");
    addLog(`Focus: ${scanConfig.focus.toUpperCase()} | Min: ${scanConfig.minConviction}% | Max: ${scanConfig.maxIdeas}`, "info");
    addLog("🌐 Deploying intelligence agents (this takes ~30 seconds)...", "info");

    try {
      const resp = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scanConfig),
      });

      const data = await resp.json();

      if (!resp.ok || data.error) {
        addLog(`❌ API: ${data.error || resp.statusText}`, "error");
        if (data.rawText) addLog(`Raw: ${data.rawText.slice(0, 200)}`, "dim");
        throw new Error(data.error || `HTTP ${resp.status}`);
      }

      // Show what the AI searched for
      (data.searches || []).forEach((q) => addLog(`🔍 Searched: "${q}"`, "search"));

      addLog(`📊 ${data.marketContext}`, "market");
      addLog(`VIX: ${data.vix || "?"} | SPY: ${(data.spyBias || "neutral").toUpperCase()}`, "info");
      (data.warnings || []).forEach((w) => addLog(`⚠️  ${w}`, "warning"));

      const filtered = (data.ideas || []).filter((i) => i.conviction >= scanConfig.minConviction);
      addLog(`✅ ${filtered.length}/${data.ideas?.length || 0} ideas passed threshold`, "success");

      const processed = filtered.map((idea, idx) => ({
        ...idea, id: `idea-${Date.now()}-${idx}`,
        scannedAt: new Date().toISOString(), status: "pending",
      }));
      setIdeas(processed);

      if (mode === "express") {
        const express = processed.filter((i) => i.conviction >= settings.expressThreshold);
        if (express.length) {
          addLog(`⚡ EXPRESS: ${express.length} ideas auto-promoted to tickets`, "trade");
          express.forEach((i) => queueTrade(i, true));
          setTab("trades");
        } else {
          setTab("ideas");
        }
      } else {
        if (processed.length > 0) notify(`${processed.length} new ideas ready`, C.bull);
        setTab("ideas");
      }
    } catch (err) {
      addLog(`❌ SCAN FAILED: ${err.message}`, "error");
      notify("Scan failed — see LOG", C.bear);
    } finally {
      setScanning(false);
    }
  };

  const pendingTrades = trades.length;
  const pendingIdeas = ideas.filter((i) => i.status === "pending").length;

  const TABS = [
    { key: "scan", label: "SCAN" },
    { key: "ideas", label: pendingIdeas > 0 ? `IDEAS ●${pendingIdeas}` : "IDEAS" },
    { key: "trades", label: pendingTrades > 0 ? `TRADES ●${pendingTrades}` : "TRADES" },
    { key: "history", label: "HISTORY" },
    { key: "log", label: "LOG" },
    { key: "settings", label: "⚙" },
  ];

  return (
    <div style={{
      background: C.bg, minHeight: "100vh",
      fontFamily: "'IBM Plex Mono', monospace",
      color: C.text, display: "flex", flexDirection: "column",
      fontSize: 13, lineHeight: 1.5,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600;700&family=Barlow+Condensed:wght@400;600;700;800;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:3px;height:3px;}
        ::-webkit-scrollbar-track{background:${C.surface};}
        ::-webkit-scrollbar-thumb{background:${C.dim};border-radius:2px;}
        input,select,textarea,button{outline:none;font-family:inherit;}
        button{cursor:pointer;user-select:none;-webkit-tap-highlight-color:transparent;}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes fadeSlide{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes glow{0%,100%{box-shadow:0 0 6px ${C.accent}}50%{box-shadow:0 0 18px ${C.accent},0 0 30px ${C.accent}60}}
      `}</style>

      {notification && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 1000,
          background: notification.color + "18",
          border: `1px solid ${notification.color}60`,
          color: notification.color, padding: "10px 18px", borderRadius: 8,
          fontSize: 12, fontWeight: 600, backdropFilter: "blur(12px)",
          animation: "fadeSlide 0.25s ease", maxWidth: 320,
        }}>{notification.msg}</div>
      )}

      <header style={{
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        padding: "0 14px", height: 54, display: "flex",
        alignItems: "center", gap: 10, flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 9, height: 9, borderRadius: "50%",
            background: scanning ? C.amber : C.accent,
            animation: scanning ? "pulse 1s infinite" : "glow 2.5s infinite",
          }} />
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 18, fontWeight: 900, letterSpacing: "0.1em",
          }}>OPTIONS CO-PILOT</span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{
          display: "flex", alignItems: "center", gap: 5,
          background: C.card, border: `1px solid ${C.accent}40`,
          borderRadius: 6, padding: "5px 9px",
          fontSize: 10, fontWeight: 700, color: C.accent,
        }}>🦅 IBKR</div>

        <button onClick={() => {
          const next = mode === "manual" ? "express" : "manual";
          setMode(next);
          addLog(`⚙️  Mode → ${next.toUpperCase()}`, "system");
          notify(`${next === "express" ? "⚡ EXPRESS" : "👤 MANUAL"}`, next === "express" ? C.amber : C.cyan);
        }} style={{
          background: mode === "express"
            ? `linear-gradient(135deg, ${C.accent}, ${C.amber})`
            : `linear-gradient(135deg, ${C.cyan}, #0088cc)`,
          color: "#000", border: "none", borderRadius: 5,
          padding: "6px 11px", fontSize: 10.5, fontWeight: 700,
          letterSpacing: "0.04em", minWidth: 88,
        }}>{mode === "express" ? "⚡ EXPRESS" : "👤 MANUAL"}</button>
      </header>

      <nav style={{
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        padding: "0 10px", display: "flex", gap: 2,
        overflowX: "auto", flexShrink: 0, alignItems: "center", height: 42,
      }}>
        {TABS.map(({ key, label }) => {
          const active = tab === key;
          const hasBadge = label.includes("●");
          return (
            <button key={key} onClick={() => setTab(key)} style={{
              padding: "7px 12px", fontSize: 11, fontWeight: 600,
              letterSpacing: "0.04em", border: "none", borderRadius: 5,
              background: active ? C.accent : "transparent",
              color: active ? "#000" : hasBadge ? C.amber : C.muted,
              transition: "all 0.2s", whiteSpace: "nowrap", flexShrink: 0,
            }}>{label}</button>
          );
        })}
      </nav>

      <main style={{ flex: 1, overflow: "auto", padding: "16px 12px" }}>
        {tab === "scan" && <ScanTab {...{ scanning, runScan, scanConfig, setScanConfig, logs, logRef, mode, expressThreshold: settings.expressThreshold }} />}
        {tab === "ideas" && <IdeasTab ideas={ideas} onApprove={approveIdea} onReject={rejectIdea} />}
        {tab === "trades" && <TradesTab trades={trades} onLog={markLogged} onSkip={skipTrade} notify={notify} addLog={addLog} />}
        {tab === "history" && <HistoryTab history={history} />}
        {tab === "log" && <LogTab logs={logs} logRef={logRef} />}
        {tab === "settings" && <SettingsTab settings={settings} setSettings={setSettings} />}
      </main>
    </div>
  );
}

function ScanTab({ scanning, runScan, scanConfig, setScanConfig, logs, logRef, mode, expressThreshold }) {
  const inputSt = {
    background: C.card, border: `1px solid ${C.border}`, color: C.text,
    borderRadius: 6, padding: "10px 12px", fontSize: 12, width: "100%",
    appearance: "none", WebkitAppearance: "none",
  };
  const recent = logs.slice(-30);

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      {mode === "express" && (
        <div style={{
          background: C.accentDim, border: `1px solid ${C.accent}50`,
          borderRadius: 8, padding: "10px 14px", marginBottom: 14,
          color: C.accent, fontSize: 11, lineHeight: 1.7,
        }}>⚡ EXPRESS — Ideas ≥ {expressThreshold}% auto-create tickets, ready for IBKR</div>
      )}

      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: C.cyan, fontWeight: 600, letterSpacing: "0.12em", marginBottom: 10 }}>SCAN PARAMETERS</div>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
          <div>
            <label style={{ fontSize: 9, color: C.muted, display: "block", marginBottom: 5, letterSpacing: "0.08em" }}>FOCUS</label>
            <select value={scanConfig.focus} onChange={(e) => setScanConfig((s) => ({ ...s, focus: e.target.value }))} style={{ ...inputSt, cursor: "pointer" }}>
              <option value="all">ALL SIGNALS</option>
              <option value="unusual">UNUSUAL FLOW</option>
              <option value="earnings">EARNINGS</option>
              <option value="technical">TECHNICAL</option>
              <option value="macro">MACRO</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 9, color: C.muted, display: "block", marginBottom: 5, letterSpacing: "0.08em" }}>MIN CONV</label>
            <input type="number" min={50} max={99} value={scanConfig.minConviction}
              onChange={(e) => setScanConfig((s) => ({ ...s, minConviction: clamp(+e.target.value, 50, 99) }))} style={inputSt} />
          </div>
          <div>
            <label style={{ fontSize: 9, color: C.muted, display: "block", marginBottom: 5, letterSpacing: "0.08em" }}>MAX</label>
            <input type="number" min={1} max={10} value={scanConfig.maxIdeas}
              onChange={(e) => setScanConfig((s) => ({ ...s, maxIdeas: clamp(+e.target.value, 1, 10) }))} style={inputSt} />
          </div>
        </div>
      </div>

      <button onClick={runScan} disabled={scanning} style={{
        width: "100%", padding: "16px 0", fontSize: 14,
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 800, letterSpacing: "0.16em",
        border: "none", borderRadius: 10,
        cursor: scanning ? "not-allowed" : "pointer",
        background: scanning ? C.dim : `linear-gradient(135deg, ${C.accent}, #cc4818)`,
        color: scanning ? C.muted : "#fff",
        marginBottom: 12, boxShadow: scanning ? "none" : `0 0 40px ${C.accent}45`,
      }}>
        {scanning ? (
          <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span>
            SCANNING MARKETS LIVE...
          </span>
        ) : "⚡  RUN MARKET SCAN"}
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 12 }}>
        {[
          { label: "Web Search", icon: "🌐" }, { label: "Unusual Flow", icon: "🐋" },
          { label: "Price Action", icon: "📈" }, { label: "News", icon: "📰" },
          { label: "IV Analysis", icon: "⚡" }, { label: "Sector Flow", icon: "🔄" },
        ].map((s) => (
          <div key={s.label} style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 7, padding: "8px 10px",
            display: "flex", alignItems: "center", gap: 7,
          }}>
            <span style={{ fontSize: 13 }}>{s.icon}</span>
            <span style={{ fontSize: 10, color: C.textDim, fontWeight: 600 }}>{s.label}</span>
            <div style={{
              marginLeft: "auto", width: 5, height: 5, borderRadius: "50%",
              background: scanning ? C.amber : C.bull,
              animation: scanning ? "pulse 1s infinite" : undefined,
            }} />
          </div>
        ))}
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
        <div style={{
          padding: "8px 14px", borderBottom: `1px solid ${C.border}`,
          fontSize: 9, color: C.cyan, fontWeight: 600, letterSpacing: "0.12em",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          AGENT LOG {scanning && <span style={{ color: C.amber, animation: "pulse 1s infinite" }}>● LIVE</span>}
        </div>
        <div ref={logRef} style={{ maxHeight: 240, overflow: "auto", padding: "10px 14px" }}>
          {recent.map((l, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 3, fontSize: 10.5, lineHeight: 1.65 }}>
              <span style={{ color: C.dim, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{l.ts}</span>
              <span style={{ color: LOG_COLOR[l.type] || C.text, wordBreak: "break-word" }}>{l.msg}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function IdeasTab({ ideas, onApprove, onReject }) {
  if (!ideas.length) return <EmptyState icon="🔍" title="No Ideas Yet" sub="Run a market scan to generate trade ideas" />;
  const pending = ideas.filter((i) => i.status === "pending");
  const others = ideas.filter((i) => i.status !== "pending");
  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      {pending.length > 0 && (
        <div style={{ fontSize: 10, color: C.cyan, fontWeight: 600, letterSpacing: "0.1em", marginBottom: 10 }}>
          AWAITING REVIEW — {pending.length}
        </div>
      )}
      {pending.map((i) => <IdeaCard key={i.id} idea={i} onApprove={onApprove} onReject={onReject} />)}
      {others.length > 0 && (
        <>
          <div style={{
            fontSize: 10, color: C.muted, fontWeight: 600, letterSpacing: "0.1em",
            marginTop: 16, marginBottom: 10, borderTop: `1px solid ${C.border}`, paddingTop: 14,
          }}>PROCESSED</div>
          {others.map((i) => <IdeaCard key={i.id} idea={i} onApprove={onApprove} onReject={onReject} />)}
        </>
      )}
    </div>
  );
}

function IdeaCard({ idea, onApprove, onReject }) {
  const [open, setOpen] = useState(idea.status === "pending");
  const isBull = idea.direction === "bullish";
  const dirColor = isBull ? C.bull : C.bear;
  const stopDiff = idea.entryHigh - idea.stop;
  const profitDiff = idea.target - idea.entryHigh;
  const rr = stopDiff > 0 ? (profitDiff / stopDiff).toFixed(1) : "∞";
  const maxProfit = ((idea.target - idea.entryHigh) / idea.entryHigh * 100).toFixed(0);
  const ss = {
    pending: { borderColor: C.border, opacity: 1 },
    approved: { borderColor: C.bull + "60", opacity: 1 },
    rejected: { borderColor: C.dim, opacity: 0.45 },
  }[idea.status] || { borderColor: C.border, opacity: 1 };

  return (
    <div style={{
      background: C.card, border: `1px solid ${ss.borderColor}`,
      borderLeft: `3px solid ${idea.status === "rejected" ? C.muted : dirColor}`,
      borderRadius: 10, marginBottom: 10, overflow: "hidden",
      opacity: ss.opacity, transition: "all 0.3s", animation: "fadeSlide 0.3s ease",
    }}>
      <div style={{ padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
        onClick={() => setOpen((o) => !o)}>
        <div style={{
          width: 30, height: 30, borderRadius: 6, background: dirColor + "20",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, flexShrink: 0,
        }}>{isBull ? "▲" : "▼"}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 18 }}>{idea.ticker}</span>
            <span style={{ color: dirColor, fontSize: 10, fontWeight: 600 }}>{idea.direction.toUpperCase()}</span>
            {idea.unusualActivity && <Tag text="🐋 UNUSUAL" color={C.purple} />}
          </div>
          <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>
            {idea.instrument.toUpperCase()} ${idea.strike} • {fmtExpiry(idea.expiry)} • {idea.dte}DTE
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{
            fontSize: 24, fontWeight: 900, lineHeight: 1,
            fontFamily: "'Barlow Condensed', sans-serif",
            color: convColor(idea.conviction),
          }}>{idea.conviction}%</div>
          <div style={{ fontSize: 8, color: C.muted, letterSpacing: "0.06em" }}>CONVICTION</div>
        </div>
      </div>
      {open && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: "12px 14px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 12 }}>
            <MetricBox label="ENTRY" value={`$${idea.entryLow}-${idea.entryHigh}`} />
            <MetricBox label="TARGET" value={`$${idea.target}`} sub={`+${maxProfit}%`} color={C.bull} />
            <MetricBox label="STOP" value={`$${idea.stop}`} color={C.bear} />
            <MetricBox label="R:R" value={`${rr}:1`} color={C.cyan} />
          </div>
          <div style={{
            background: C.surface, borderRadius: 7, padding: "10px 12px",
            marginBottom: 10, fontSize: 11, lineHeight: 1.7,
            borderLeft: `2px solid ${dirColor}40`,
          }}>{idea.thesis}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
            {idea.catalysts?.map((c) => <Tag key={c} text={`📌 ${c}`} color={C.cyan} />)}
            <Tag text={`RISK: ${(idea.risk || "med").toUpperCase()}`} color={riskColor(idea.risk)} />
            {idea.ivPercentile != null && <Tag text={`IV%: ${idea.ivPercentile}`} color={C.muted} />}
          </div>
          {idea.status === "pending" && (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => onReject(idea.id)} style={{
                flex: 1, padding: "12px 0", background: C.bearDim,
                border: `1px solid ${C.bear}50`, color: C.bear,
                borderRadius: 8, fontSize: 12, fontWeight: 700,
              }}>✗ REJECT</button>
              <button onClick={() => onApprove(idea)} style={{
                flex: 3, padding: "12px 0",
                background: `linear-gradient(135deg, ${C.bull}25, ${C.bull}45)`,
                border: `1px solid ${C.bull}80`, color: C.bull,
                borderRadius: 8, fontSize: 12, fontWeight: 700,
                boxShadow: `0 0 20px ${C.bull}25`,
              }}>✓ APPROVE → CREATE TICKET</button>
            </div>
          )}
          {idea.status === "approved" && <StatusBar color={C.bull} text="✅ Trade ticket created — see TRADES tab" />}
          {idea.status === "rejected" && <StatusBar color={C.muted} text="🚫 Rejected" />}
        </div>
      )}
    </div>
  );
}

function TradesTab({ trades, onLog, onSkip, notify, addLog }) {
  if (!trades.length) {
    return <EmptyState icon="📋" title="No Pending Trades" sub="Approved ideas become trade tickets ready for IBKR" />;
  }
  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <div style={{
        background: C.accentDim, border: `1px solid ${C.accent}50`,
        borderRadius: 8, padding: "12px 14px", marginBottom: 14,
        fontSize: 11, color: C.accent, lineHeight: 1.7,
      }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>🦅 IBKR HANDOFF</div>
        <div style={{ color: C.text, fontSize: 11 }}>
          1. Tap COPY DETAILS · 2. Tap OPEN IBKR · 3. Place order in IBKR app · 4. Tap LOGGED ✓ when filled
        </div>
      </div>
      {trades.map((trade) => (
        <TradeTicket key={trade.id} trade={trade} onLog={onLog} onSkip={onSkip} notify={notify} addLog={addLog} />
      ))}
    </div>
  );
}

function TradeTicket({ trade, onLog, onSkip, notify, addLog }) {
  const [copied, setCopied] = useState(false);
  const isBull = trade.direction === "bullish";
  const dirColor = isBull ? C.bull : C.bear;
  const cost = trade.quantity * trade.limitPrice * 100;
  const profitDollar = (trade.target - trade.limitPrice) * trade.quantity * 100;
  const lossDollar = (trade.limitPrice - trade.stop) * trade.quantity * 100;

  const orderText = buildOrderText(trade);

  const copyOrder = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(orderText).then(() => {
        setCopied(true);
        notify(`Copied ${trade.ticker}`, C.bull);
        addLog(`📋 Copied: ${trade.ticker}`, "trade");
        setTimeout(() => setCopied(false), 2500);
      }).catch(() => notify("Long-press text below to copy", C.amber));
    }
  };

  const openIBKR = () => {
    addLog(`🦅 Opening IBKR: ${trade.ticker}`, "trade");
    const start = Date.now();
    window.location.href = "ibkr://";
    setTimeout(() => {
      if (Date.now() - start < 2000) {
        window.location.href = "https://apps.apple.com/app/ibkr-mobile/id1469341272";
      }
    }, 1500);
  };

  return (
    <div style={{
      background: C.card, border: `1px solid ${C.accent}30`,
      borderLeft: `3px solid ${dirColor}`, borderRadius: 10,
      padding: 14, marginBottom: 12, animation: "fadeSlide 0.3s ease",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 7, background: dirColor + "20",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 17, flexShrink: 0,
        }}>{isBull ? "▲" : "▼"}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 900, fontSize: 22, lineHeight: 1,
          }}>
            {trade.ticker} <span style={{ color: dirColor }}>{trade.instrument.toUpperCase()}</span>
          </div>
          <div style={{ fontSize: 10.5, color: C.textDim, marginTop: 4 }}>
            ${trade.strike} • {fmtExpiry(trade.expiry)} • {trade.dte}DTE
            {trade.express && <span style={{ color: C.accent, marginLeft: 8 }}>⚡ EXPRESS</span>}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{
            fontSize: 22, fontWeight: 900, lineHeight: 1,
            fontFamily: "'Barlow Condensed', sans-serif",
            color: convColor(trade.conviction),
          }}>{trade.conviction}%</div>
          <div style={{ fontSize: 8, color: C.muted, letterSpacing: "0.06em" }}>CONV</div>
        </div>
      </div>

      <div style={{
        background: "#000", border: `1px solid ${C.accent}40`,
        borderRadius: 8, padding: "12px 14px", marginBottom: 12,
      }}>
        <div style={{
          fontSize: 9, color: C.accent, fontWeight: 700, letterSpacing: "0.1em",
          marginBottom: 8, display: "flex", alignItems: "center", gap: 8,
        }}>
          ORDER TICKET
          {copied && <span style={{ color: C.bull }}>● COPIED</span>}
        </div>
        <div style={{ fontSize: 12, lineHeight: 1.9 }}>
          <div><span style={{ color: C.muted }}>Symbol: </span>
            <span style={{ color: C.accent, fontWeight: 700 }}>{trade.ticker}</span></div>
          <div><span style={{ color: C.muted }}>Contract: </span>
            <span style={{ fontWeight: 600 }}>${trade.strike} {trade.instrument.toUpperCase()} {fmtExpiry(trade.expiry)}</span></div>
          <div><span style={{ color: C.muted }}>Action: </span>
            <span style={{ color: C.bull, fontWeight: 700 }}>BUY {trade.quantity}</span></div>
          <div><span style={{ color: C.muted }}>Order: </span>
            <span style={{ fontWeight: 600 }}>LIMIT @ ${trade.limitPrice.toFixed(2)} (DAY)</span></div>
          <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 6, paddingTop: 6 }}>
            <span style={{ color: C.muted }}>Total Cost: </span>
            <span style={{ color: C.cyan, fontWeight: 700 }}>{fmt$(cost)}</span>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        <div style={{ background: C.bullDim, border: `1px solid ${C.bull}30`, borderRadius: 7, padding: "10px 12px" }}>
          <div style={{ fontSize: 9, color: C.bull, fontWeight: 700 }}>🎯 TARGET</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>${trade.target}</div>
          <div style={{ fontSize: 10, color: C.bull, marginTop: 2 }}>+{fmt$(profitDollar)}</div>
        </div>
        <div style={{ background: C.bearDim, border: `1px solid ${C.bear}30`, borderRadius: 7, padding: "10px 12px" }}>
          <div style={{ fontSize: 9, color: C.bear, fontWeight: 700 }}>🛑 STOP</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>${trade.stop}</div>
          <div style={{ fontSize: 10, color: C.bear, marginTop: 2 }}>-{fmt$(lossDollar)}</div>
        </div>
      </div>

      <div style={{
        background: C.surface, borderRadius: 7, padding: "10px 12px", marginBottom: 12,
        fontSize: 11, lineHeight: 1.7, borderLeft: `2px solid ${dirColor}40`,
      }}>{trade.thesis}</div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
        <button onClick={copyOrder} style={{
          padding: "13px 0",
          background: copied ? C.bullDim : `linear-gradient(135deg, ${C.cyan}25, ${C.cyan}45)`,
          border: `1px solid ${copied ? C.bull : C.cyan}80`,
          color: copied ? C.bull : C.cyan,
          borderRadius: 8, fontSize: 12, fontWeight: 700,
        }}>{copied ? "✓ COPIED" : "📋 COPY DETAILS"}</button>
        <button onClick={openIBKR} style={{
          padding: "13px 0",
          background: `linear-gradient(135deg, ${C.accent}, #cc4818)`,
          border: "none", color: "#fff",
          borderRadius: 8, fontSize: 12, fontWeight: 700,
          boxShadow: `0 0 20px ${C.accent}40`,
        }}>🦅 OPEN IBKR</button>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => onSkip(trade.id)} style={{
          flex: 1, padding: "11px 0", background: C.bearDim,
          border: `1px solid ${C.bear}40`, color: C.bear,
          borderRadius: 8, fontSize: 11, fontWeight: 700,
        }}>SKIP</button>
        <button onClick={() => onLog(trade.id)} style={{
          flex: 3, padding: "11px 0",
          background: `linear-gradient(135deg, ${C.bull}30, ${C.bull}50)`,
          border: `1px solid ${C.bull}80`, color: C.bull,
          borderRadius: 8, fontSize: 12, fontWeight: 700,
        }}>✓ LOGGED IN IBKR</button>
      </div>
    </div>
  );
}

function HistoryTab({ history }) {
  if (!history.length) return <EmptyState icon="📜" title="No History" sub="Logged trades appear here" />;
  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <div style={{ fontSize: 10, color: C.cyan, fontWeight: 600, letterSpacing: "0.12em", marginBottom: 10 }}>
        TRADE HISTORY — {history.length}
      </div>
      {history.map((h, i) => {
        const isLogged = h.status === "logged";
        const dirColor = h.direction === "bullish" ? C.bull : C.bear;
        return (
          <div key={h.id || i} style={{
            background: C.card, border: `1px solid ${C.border}`,
            borderLeft: `3px solid ${dirColor}`, borderRadius: 8,
            padding: "11px 14px", marginBottom: 8,
            display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
            opacity: isLogged ? 1 : 0.55,
          }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 16 }}>{h.ticker}</span>
            <span style={{ fontSize: 10, color: C.textDim }}>
              {h.instrument?.toUpperCase()} ${h.strike} × {h.quantity} @ ${h.limitPrice}
            </span>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 9, color: C.muted }}>
                {new Date(h.loggedAt || h.skippedAt || h.createdAt).toLocaleTimeString()}
              </span>
              <Tag text={isLogged ? "✓ LOGGED" : "SKIPPED"} color={isLogged ? C.bull : C.muted} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LogTab({ logs, logRef }) {
  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
        <div style={{
          padding: "9px 14px", borderBottom: `1px solid ${C.border}`,
          fontSize: 9, color: C.cyan, fontWeight: 600, letterSpacing: "0.12em",
        }}>SYSTEM LOG — {logs.length}</div>
        <div ref={logRef} style={{ maxHeight: "calc(100vh - 200px)", overflow: "auto", padding: "10px 14px" }}>
          {logs.map((l, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 4, fontSize: 10.5, lineHeight: 1.6 }}>
              <span style={{ color: C.dim, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", minWidth: 64 }}>{l.ts}</span>
              <span style={{ color: LOG_COLOR[l.type] || C.text, wordBreak: "break-word" }}>{l.msg}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SettingsTab({ settings, setSettings }) {
  const inp = {
    background: C.card, border: `1px solid ${C.border}`, color: C.text,
    borderRadius: 6, padding: "10px 12px", fontSize: 12, width: "100%", appearance: "none",
  };
  const lbl = { fontSize: 9, color: C.muted, display: "block", marginBottom: 6, letterSpacing: "0.08em" };

  const Section = ({ title, children, accent = C.cyan }) => (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
      <div style={{ fontSize: 10, color: accent, fontWeight: 600, letterSpacing: "0.12em", marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );

  return (
    <div style={{ maxWidth: 600, margin: "0 auto" }}>
      <Section title="🦅 IBKR HANDOFF" accent={C.accent}>
        <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.9, marginBottom: 12 }}>
          Real-time AI scans markets and produces ready-to-trade tickets. You handle execution in IBKR Mobile — about 15 seconds per trade.
        </div>
        <a href="https://apps.apple.com/app/ibkr-mobile/id1469341272" target="_blank" rel="noopener noreferrer" style={{
          display: "block", marginTop: 12, padding: "11px 0",
          background: `linear-gradient(135deg, ${C.accent}, #cc4818)`,
          color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 700,
          textDecoration: "none", textAlign: "center", letterSpacing: "0.04em",
        }}>📲 INSTALL IBKR MOBILE</a>
      </Section>

      <Section title="🛡  RISK MANAGEMENT">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={lbl}>ACCOUNT SIZE ($)</label>
            <input type="number" value={settings.accountSize}
              onChange={(e) => setSettings((s) => ({ ...s, accountSize: +e.target.value }))} style={inp} />
          </div>
          <div>
            <label style={lbl}>MAX POSITION ($)</label>
            <input type="number" value={settings.maxPosition}
              onChange={(e) => setSettings((s) => ({ ...s, maxPosition: +e.target.value }))} style={inp} />
          </div>
          <div>
            <label style={lbl}>MAX DAILY LOSS ($)</label>
            <input type="number" value={settings.maxDailyLoss}
              onChange={(e) => setSettings((s) => ({ ...s, maxDailyLoss: +e.target.value }))} style={inp} />
          </div>
          <div>
            <label style={lbl}>EXPRESS THRESHOLD (%)</label>
            <input type="number" min={70} max={99} value={settings.expressThreshold}
              onChange={(e) => setSettings((s) => ({ ...s, expressThreshold: +e.target.value }))} style={inp} />
          </div>
        </div>
      </Section>

      <Section title="⚖  DISCLAIMER" accent={C.amber}>
        <div style={{ fontSize: 10, color: C.textDim, lineHeight: 1.8 }}>
          AI-generated ideas are NOT financial advice. Options trading involves substantial risk of loss including total premium loss. Always do your own due diligence and size positions according to your risk tolerance.
        </div>
      </Section>
    </div>
  );
}

function Tag({ text, color }) {
  return <span style={{
    background: color + "18", color, border: `1px solid ${color}35`,
    borderRadius: 4, padding: "2px 7px", fontSize: 9, fontWeight: 600,
    letterSpacing: "0.04em", whiteSpace: "nowrap",
  }}>{text}</span>;
}

function MetricBox({ label, value, sub, color = C.textDim }) {
  return (
    <div style={{ background: C.surface, borderRadius: 7, padding: "8px 10px", textAlign: "center" }}>
      <div style={{ fontSize: 8.5, color: C.muted, marginBottom: 4, letterSpacing: "0.07em" }}>{label}</div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: C.bull, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function StatusBar({ text, color }) {
  return <div style={{
    textAlign: "center", padding: "10px", color, fontSize: 11, fontWeight: 600,
    background: color + "10", borderRadius: 6,
  }}>{text}</div>;
}

function EmptyState({ icon, title, sub }) {
  return (
    <div style={{ textAlign: "center", color: C.muted, paddingTop: 80, maxWidth: 320, margin: "0 auto" }}>
      <div style={{ fontSize: 52, marginBottom: 16 }}>{icon}</div>
      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800,
        fontSize: 20, color: C.dim, marginBottom: 8, letterSpacing: "0.06em",
      }}>{title}</div>
      <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.7 }}>{sub}</div>
    </div>
  );
}

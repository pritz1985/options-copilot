import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const maxDuration = 60; // Vercel: allow up to 60s for AI + web search

const FOCUS_QUERIES = {
  all: "unusual options flow today, earnings catalyst options plays, technical breakout stocks, dark pool prints, momentum options",
  unusual: "unusual options activity today, whale options flow, large block options trades, options volume spikes",
  earnings: "options earnings plays today, pre-earnings IV crush, post-earnings reactions options",
  technical: "technical breakout stocks options, oversold overbought options setups, support resistance options",
  macro: "macro options plays, sector rotation today, Fed policy options trades, commodity ETF options",
};

export async function POST(request) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Server missing ANTHROPIC_API_KEY env var" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const focus = body.focus || "all";
    const minConviction = body.minConviction || 70;
    const maxIdeas = Math.min(body.maxIdeas || 5, 10);

    const client = new Anthropic({ apiKey });

    const today = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const systemPrompt = `You are a legendary options trader — 25 years on Goldman Sachs prop desk, Citadel, then your own macro hedge fund. You identify high-probability directional options trades with surgical precision.

Your edge: synthesizing unusual flow + price action + news catalysts + IV regime analysis + sector rotation signals.

Today is ${today}. Use web search aggressively — search MULTIPLE queries to gather current market intelligence. Search for unusual options activity, market movers, earnings, technicals, and macro flows.

After your research, return ONLY valid JSON. Zero markdown. Zero preamble. Start with { and end with }.

Schema:
{
  "marketContext": "2-3 sentence current market overview with key levels/sentiment/regime",
  "vix": "current VIX level (e.g. 18.2)",
  "spyBias": "bullish|bearish|neutral",
  "ideas": [
    {
      "ticker": "NVDA",
      "company": "NVIDIA Corporation",
      "sector": "Technology",
      "direction": "bullish",
      "instrument": "call",
      "strike": 145,
      "expiry": "YYYY-MM-DD",
      "dte": 30,
      "entryLow": 4.20,
      "entryHigh": 4.80,
      "target": 9.50,
      "stop": 2.40,
      "conviction": 87,
      "thesis": "3-4 sentence sharp trade thesis citing specific data points (flow, levels, catalyst).",
      "catalysts": ["Catalyst 1", "Catalyst 2"],
      "risk": "low|medium|high",
      "unusualActivity": true,
      "ivPercentile": 42,
      "quantity": 2,
      "tags": ["unusual_flow","breakout","earnings_catalyst"]
    }
  ],
  "warnings": ["Risk warning 1", "Risk warning 2"]
}`;

    const userMessage = `Search the web for: ${FOCUS_QUERIES[focus]}. Also search "options market today ${new Date().toLocaleDateString()}", "stock options unusual activity", "market moving catalysts today". Find top ${maxIdeas} options plays with conviction >= ${minConviction}%. Return JSON only — no text before or after the JSON object.`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      system: systemPrompt,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 8,
        },
      ],
      messages: [{ role: "user", content: userMessage }],
    });

    // Collect text blocks from response
    const textBlocks = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    // Collect search queries used (for transparency)
    const searches = response.content
      .filter((b) => b.type === "server_tool_use" || b.type === "tool_use")
      .map((b) => b.input?.query)
      .filter(Boolean);

    // Extract JSON
    const jsonMatch = textBlocks.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        {
          error: "Agent returned no JSON",
          rawText: textBlocks.slice(0, 500),
          searches,
        },
        { status: 500 }
      );
    }

    let result;
    try {
      result = JSON.parse(jsonMatch[0]);
    } catch (e) {
      return NextResponse.json(
        {
          error: "Agent returned malformed JSON",
          rawText: jsonMatch[0].slice(0, 500),
          searches,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ...result, searches });
  } catch (err) {
    console.error("Scan error:", err);
    return NextResponse.json(
      { error: err.message || String(err) },
      { status: 500 }
    );
  }
}

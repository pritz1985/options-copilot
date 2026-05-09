"use client";
import { Component } from "react";
import OptionsCopilot from "../components/OptionsCopilot";

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("Caught:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: 20, background: "#0f0f1f", color: "#dde0f5",
          fontFamily: "monospace", minHeight: "100vh",
          fontSize: 12, lineHeight: 1.6,
        }}>
          <h2 style={{ color: "#ff2d55", marginBottom: 12 }}>App crashed</h2>
          <div style={{ marginBottom: 16, color: "#ffb300" }}>
            Send this error back so Claude can fix it:
          </div>
          <div style={{
            background: "#000", padding: 12, borderRadius: 6,
            border: "1px solid #28285a", marginBottom: 16,
            wordBreak: "break-word", whiteSpace: "pre-wrap",
          }}>
            <strong>Message:</strong> {String(this.state.error && this.state.error.message ? this.state.error.message : this.state.error)}
          </div>
          <div style={{
            background: "#000", padding: 12, borderRadius: 6,
            border: "1px solid #28285a",
            wordBreak: "break-word", whiteSpace: "pre-wrap",
            fontSize: 10, color: "#8888b0",
          }}>
            <strong>Stack:</strong>{"\n"}
            {String(this.state.error && this.state.error.stack ? this.state.error.stack : "no stack").slice(0, 1500)}
          </div>
          <button onClick={() => window.location.reload()} style={{
            marginTop: 16, background: "#00c8f0", color: "#000",
            border: "none", borderRadius: 6, padding: "10px 20px",
            fontWeight: 700, cursor: "pointer",
          }}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Page() {
  return (
    <ErrorBoundary>
      <OptionsCopilot />
    </ErrorBoundary>
  );
}

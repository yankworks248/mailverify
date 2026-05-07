"use client";
import { useState } from "react";
import { api } from "@/lib/api";

const VERDICT_STYLES = {
  valid: {
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    label: "Valid",
  },
  invalid: {
    dot: "bg-red-500",
    text: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
    label: "Invalid",
  },
  risky: {
    dot: "bg-amber-500",
    text: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    label: "Risky",
  },
  unknown: {
    dot: "bg-zinc-400",
    text: "text-zinc-700",
    bg: "bg-zinc-50",
    border: "border-zinc-200",
    label: "Unknown",
  },
};

export default function SingleVerify({ onVerified }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function submit(e) {
    e?.preventDefault?.();
    if (!email.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await api.verifySingle(email.trim());
      setResult(r);
      onVerified?.(r);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const style = result
    ? VERDICT_STYLES[result.verdict] || VERDICT_STYLES.unknown
    : null;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white shadow-card p-6">
      <header className="mb-4">
        <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">
          Single email
        </h2>
        <p className="text-[13px] text-zinc-500 mt-0.5">
          Verify one email instantly.
        </p>
      </header>

      <form onSubmit={submit} className="space-y-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@company.com"
          className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-200
                     text-[14px] font-mono placeholder-zinc-400
                     focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent
                     transition-base"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="w-full py-2.5 rounded-lg bg-accent text-white text-[14px] font-medium
                     hover:bg-accent-hover disabled:bg-zinc-200 disabled:text-zinc-500
                     disabled:cursor-not-allowed transition-base"
        >
          {loading ? "Verifying…" : "Verify"}
        </button>
      </form>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-red-700">
          {error}
        </div>
      )}

      {result && style && (
        <div
          className={`mt-4 rounded-lg border ${style.border} ${style.bg} p-3.5`}
        >
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${style.dot}`} />
            <span className={`text-[13px] font-semibold ${style.text}`}>
              {style.label}
            </span>
            <span className="ml-auto text-[11px] text-zinc-500 font-mono">
              {result.durationMs}ms
            </span>
          </div>
          <div className="mt-2 text-[12px] font-mono text-zinc-700 break-all">
            {result.email}
          </div>
          {result.reason && (
            <div className="mt-1.5 text-[11px] text-zinc-500">
              {result.reason.split(",").map((r) => (
                <span
                  key={r}
                  className="inline-block mr-1.5 mt-1 px-1.5 py-0.5 rounded bg-white border border-zinc-200 text-zinc-600 font-mono"
                >
                  {r}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

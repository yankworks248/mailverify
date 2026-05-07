"use client";

export default function StatsBar({ health }) {
  if (!health) {
    return (
      <section className="rounded-2xl border border-zinc-200 bg-white shadow-card p-6">
        <div className="text-[13px] text-zinc-400">Loading credits…</div>
      </section>
    );
  }

  const cap = health.capacity || {};
  const usedToday = (cap.totalCap || 0) - (cap.totalRemaining || 0);
  const usedPct = cap.totalCap ? (usedToday / cap.totalCap) * 100 : 0;
  const remaining = cap.totalRemaining || 0;
  const total = cap.totalCap || 0;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white shadow-card p-6">
      <header className="flex items-baseline justify-between mb-5">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">
            Verification credits
          </h2>
          <p className="text-[13px] text-zinc-500 mt-0.5">
            Daily allowance · resets at 00:00 UTC
          </p>
        </div>
        {health.mockMode && (
          <span
            className="text-[10px] font-medium uppercase tracking-wider
                           text-amber-700 bg-amber-50 border border-amber-200
                           px-2 py-0.5 rounded"
          >
            Mock mode
          </span>
        )}
      </header>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-lg border border-zinc-200 bg-zinc-50/40 px-4 py-3">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">
            Used today
          </div>
          <div className="text-[28px] font-semibold mt-0.5 tabular-nums text-zinc-900">
            {usedToday.toLocaleString()}
          </div>
        </div>
        <div className="rounded-lg border border-accent-border bg-accent-soft px-4 py-3">
          <div className="text-[10px] uppercase tracking-wider text-accent-hover">
            Remaining
          </div>
          <div className="text-[28px] font-semibold mt-0.5 tabular-nums text-accent">
            {remaining.toLocaleString()}
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">
            of {total.toLocaleString()}
          </div>
        </div>
      </div>

      <div>
        <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
          <div
            className={`h-full transition-all duration-700
                        ${usedPct > 90 ? "bg-red-400" : usedPct > 70 ? "bg-amber-400" : "bg-accent"}`}
            style={{ width: `${Math.max(2, usedPct)}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-zinc-400 mt-1.5 font-mono tabular-nums">
          <span>{usedPct.toFixed(1)}% used</span>
          <span>System operational</span>
        </div>
      </div>
    </section>
  );
}

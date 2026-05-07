'use client';

export default function StatsBar({ health }) {
  if (!health) {
    return (
      <section className="rounded-2xl border border-zinc-200 bg-white shadow-card p-6">
        <div className="text-[13px] text-zinc-400">Loading capacity…</div>
      </section>
    );
  }

  const cap = health.capacity || {};
  const ips = health.ipPool || [];
  const usedToday = (cap.totalCap || 0) - (cap.totalRemaining || 0);
  const usedPct   = cap.totalCap ? Math.round((usedToday / cap.totalCap) * 100) : 0;

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white shadow-card p-6">
      <header className="flex items-baseline justify-between mb-5">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">IP capacity</h2>
          <p className="text-[13px] text-zinc-500 mt-0.5">
            Daily verification budget across {ips.length} dedicated IPs.
          </p>
        </div>
        {health.mockMode && (
          <span className="text-[10px] font-medium uppercase tracking-wider
                           text-amber-700 bg-amber-50 border border-amber-200
                           px-2 py-0.5 rounded">
            Mock mode
          </span>
        )}
      </header>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <Metric label="Used today" value={usedToday.toLocaleString()} sub={`${usedPct}%`} />
        <Metric label="Remaining"  value={(cap.totalRemaining || 0).toLocaleString()} tone="accent" />
        <Metric label="Active IPs" value={`${cap.activeIps || 0} / ${ips.length}`}
                sub={cap.exhaustedIps ? `${cap.exhaustedIps} exhausted` : 'all healthy'} />
      </div>

      <div className="space-y-2">
        {ips.map((ip) => {
          const pct = ip.daily_cap > 0 ? (ip.used_today / ip.daily_cap) * 100 : 0;
          const exhausted = ip.used_today >= ip.daily_cap;
          return (
            <div key={ip.id} className="flex items-center gap-3 text-[11px]">
              <div className="w-28 shrink-0 font-mono text-zinc-600 truncate">
                {ip.hostname.replace('.inboxaxis.net', '')}
              </div>
              <div className="flex-1 h-2 rounded-full bg-zinc-100 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500
                              ${exhausted ? 'bg-red-400' : pct > 80 ? 'bg-amber-400' : 'bg-accent'}`}
                  style={{ width: `${Math.max(2, pct)}%` }}
                />
              </div>
              <div className="w-24 shrink-0 text-right font-mono text-zinc-500">
                {ip.used_today.toLocaleString()}
                <span className="text-zinc-400"> / {ip.daily_cap.toLocaleString()}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Metric({ label, value, sub, tone = 'default' }) {
  const valueClass = tone === 'accent' ? 'text-accent' : 'text-zinc-900';
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/40 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`text-[20px] font-semibold mt-0.5 tabular-nums ${valueClass}`}>{value}</div>
      {sub && <div className="text-[10px] text-zinc-400 mt-0.5">{sub}</div>}
    </div>
  );
}

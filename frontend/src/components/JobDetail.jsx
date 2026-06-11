'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import DonutChart from './DonutChart';

const VERDICT_DOTS = {
  valid:   '#10b981', invalid: '#ef4444',
  risky:   '#f59e0b', unknown: '#a1a1aa',
};

const VERDICT_PILL = {
  valid:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  invalid: 'bg-red-50     text-red-700     border-red-200',
  risky:   'bg-amber-50   text-amber-700   border-amber-200',
  unknown: 'bg-zinc-50    text-zinc-600    border-zinc-200',
};

export default function JobDetail({ job, onBack, refreshTick }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState('all');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getJobResults(job.jobUuid, 1000)
      .then((d) => { if (!cancelled) setResults(d.results || []); })
      .catch((e) => console.error('results fetch:', e.message))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [job.jobUuid, refreshTick]);

  const donutData = [
    { value: job.validCount,   color: VERDICT_DOTS.valid,   label: 'Valid' },
    { value: job.riskyCount,   color: VERDICT_DOTS.risky,   label: 'Risky' },
    { value: job.invalidCount, color: VERDICT_DOTS.invalid, label: 'Invalid' },
    { value: job.unknownCount, color: VERDICT_DOTS.unknown, label: 'Unknown' },
  ];

  const filtered = filter === 'all'
    ? results
    : results.filter((r) => r.verdict === filter);

  const isDone = job.status === 'completed';

  const hasNames = results.some((r) => r.first_name || r.last_name);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white shadow-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <button onClick={onBack}
              className="text-[12px] text-zinc-500 hover:text-zinc-900 transition-base
                         flex items-center gap-1 mb-2">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
              Back to all jobs
            </button>
            <h2 className="text-[18px] font-semibold tracking-tight text-zinc-900 truncate" title={job.filename}>
              {job.filename || 'untitled.csv'}
            </h2>
            <div className="text-[12px] text-zinc-500 mt-1 font-mono">
              {new Date(job.uploadedAt).toLocaleString()}
              {' · '}{job.processedCount.toLocaleString()} / {job.totalCount.toLocaleString()} processed
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-[10px] font-medium uppercase tracking-wider px-2 py-1 rounded border
                              ${job.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                job.status === 'processing' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                'bg-zinc-50 text-zinc-600 border-zinc-200'}`}>
              {job.status}
            </span>
            {isDone && (
              <a href={api.resultsCsvUrl(job.jobUuid)} download
                className="px-3 py-1.5 rounded-lg bg-accent text-white text-[12px] font-medium
                           hover:bg-accent-hover transition-base">
                Download All CSV
              </a>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white shadow-card p-6">
        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-center">
          <div className="flex justify-center">
            <DonutChart data={donutData} size={200} centerLabel="verified" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <BreakdownRow color={VERDICT_DOTS.valid}   label="Valid"
              count={job.validCount}   total={job.processedCount} active={filter==='valid'}
              onClick={() => setFilter(filter==='valid'?'all':'valid')}
              downloadUrl={isDone ? api.resultsCsvUrl(job.jobUuid, 'valid') : null} />
            <BreakdownRow color={VERDICT_DOTS.risky}   label="Risky"
              count={job.riskyCount}   total={job.processedCount} active={filter==='risky'}
              onClick={() => setFilter(filter==='risky'?'all':'risky')}
              downloadUrl={isDone ? api.resultsCsvUrl(job.jobUuid, 'risky') : null} />
            <BreakdownRow color={VERDICT_DOTS.invalid} label="Invalid"
              count={job.invalidCount} total={job.processedCount} active={filter==='invalid'}
              onClick={() => setFilter(filter==='invalid'?'all':'invalid')}
              downloadUrl={isDone ? api.resultsCsvUrl(job.jobUuid, 'invalid') : null} />
            <BreakdownRow color={VERDICT_DOTS.unknown} label="Unknown"
              count={job.unknownCount} total={job.processedCount} active={filter==='unknown'}
              onClick={() => setFilter(filter==='unknown'?'all':'unknown')}
              downloadUrl={isDone ? api.resultsCsvUrl(job.jobUuid, 'unknown') : null} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white shadow-card overflow-hidden">
        <header className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-semibold tracking-tight text-zinc-900">
              Results
              {filter !== 'all' && (
                <span className="ml-2 text-[12px] font-normal text-zinc-500">
                  · filtered by {filter} ({filtered.length})
                </span>
              )}
            </h3>
            <p className="text-[12px] text-zinc-500 mt-0.5">
              Click any verdict above to filter. Showing first {results.length.toLocaleString()} of {job.totalCount.toLocaleString()}.
            </p>
          </div>
          {filter !== 'all' && (
            <button onClick={() => setFilter('all')}
              className="text-[12px] text-zinc-500 hover:text-zinc-900 transition-base">
              Clear filter
            </button>
          )}
        </header>

        {loading ? (
          <div className="px-6 py-12 text-center text-[13px] text-zinc-400">Loading results…</div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-[13px] text-zinc-400">
            {results.length === 0 ? 'No results yet — verifier is still working.' : 'No rows match this filter.'}
          </div>
        ) : (
          <div className="max-h-[520px] overflow-y-auto">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-white border-b border-zinc-100">
                <tr className="text-left text-[10px] uppercase tracking-wider text-zinc-500">
                  {hasNames && <th className="px-6 py-2.5 font-medium">Name</th>}
                  <th className={`${hasNames ? 'px-3' : 'px-6'} py-2.5 font-medium`}>Email</th>
                  <th className="px-3 py-2.5 font-medium">Verdict</th>
                  <th className="px-3 py-2.5 font-medium">Reason</th>
                  <th className="px-3 py-2.5 font-medium text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {filtered.map((r) => {
                  const fullName = [r.first_name, r.last_name].filter(Boolean).join(' ');
                  return (
                    <tr key={r.id} className="hover:bg-zinc-50/50">
                      {hasNames && (
                        <td className="px-6 py-2 text-zinc-700 truncate max-w-[160px]" title={fullName}>
                          {fullName || <span className="text-zinc-300">—</span>}
                        </td>
                      )}
                      <td className={`${hasNames ? 'px-3' : 'px-6'} py-2 font-mono text-zinc-800 truncate max-w-[280px]`} title={r.email}>
                        {r.email}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-medium
                                         ${VERDICT_PILL[r.verdict] || VERDICT_PILL.unknown}`}>
                          {r.verdict || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-zinc-500 font-mono text-[11px] truncate max-w-[260px]" title={r.reason || ''}>
                        {r.reason || <span className="text-zinc-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-zinc-400 tabular-nums">
                        {r.duration_ms != null ? `${r.duration_ms}ms` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function BreakdownRow({ color, label, count, total, active, onClick, downloadUrl }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className={`flex items-center rounded-lg border transition-base
                  ${active ? 'border-zinc-300 bg-zinc-50' : 'border-zinc-200 bg-white hover:bg-zinc-50/50'}`}>
      <button type="button" onClick={onClick}
        className="flex items-center gap-3 px-3 py-2.5 text-left flex-1 min-w-0">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-zinc-500 uppercase tracking-wider">{label}</div>
          <div className="text-[16px] font-semibold text-zinc-900 tabular-nums">
            {count.toLocaleString()}
            <span className="text-[11px] font-normal text-zinc-400 ml-1.5">{pct.toFixed(1)}%</span>
          </div>
        </div>
      </button>
      {downloadUrl && count > 0 && (
        <a href={downloadUrl} download title={`Download ${label} CSV`}
          className="shrink-0 self-stretch flex items-center px-3 text-zinc-400
                     hover:text-accent border-l border-zinc-100 transition-base">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
        </a>
      )}
    </div>
  );
}

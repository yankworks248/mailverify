'use client';

const STATUS_PILL = {
  pending:    'bg-zinc-50  text-zinc-600   border-zinc-200',
  processing: 'bg-blue-50  text-blue-700   border-blue-200',
  completed:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  failed:     'bg-red-50   text-red-700    border-red-200',
  cancelled:  'bg-zinc-50  text-zinc-500   border-zinc-200',
};

export default function JobsList({ jobs, selectedUuid, onSelect }) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white shadow-card overflow-hidden">
      <header className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">Recent jobs</h2>
          <p className="text-[13px] text-zinc-500 mt-0.5">Click any job to see its full results.</p>
        </div>
        <div className="text-[11px] font-mono text-zinc-400 tabular-nums">
          {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'}
        </div>
      </header>

      {jobs.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <div className="text-[13px] text-zinc-500">No jobs yet.</div>
          <div className="text-[12px] text-zinc-400 mt-1">Upload a CSV from the left to get started.</div>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-100">
          {jobs.map((j) => (
            <JobRow key={j.jobUuid} job={j}
              selected={j.jobUuid === selectedUuid}
              onClick={() => onSelect?.(j)} />
          ))}
        </ul>
      )}
    </section>
  );
}

function JobRow({ job, selected, onClick }) {
  const pct = job.progressPct;
  const pillClass = STATUS_PILL[job.status] || STATUS_PILL.pending;
  const isDone = job.status === 'completed';

  return (
    <li onClick={onClick}
      className={`px-6 py-4 cursor-pointer transition-base
                  ${selected ? 'bg-accent-soft' : 'hover:bg-zinc-50/50'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="text-[13px] font-medium text-zinc-900 truncate" title={job.filename}>
              {job.filename || 'untitled.csv'}
            </span>
            <span className={`text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded border ${pillClass}`}>
              {job.status}
            </span>
          </div>
          <div className="text-[11px] text-zinc-500 font-mono">
            {job.processedCount.toLocaleString()} / {job.totalCount.toLocaleString()} processed
            {' · '}{new Date(job.uploadedAt).toLocaleString()}
          </div>
        </div>

        <svg className="w-4 h-4 text-zinc-300 shrink-0 mt-0.5"
             fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </div>

      {!isDone ? (
        <div className="mt-2.5 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
          <div className={`h-full transition-all duration-700
                           ${job.status === 'failed' ? 'bg-red-400' : 'bg-accent'}`}
               style={{ width: `${Math.max(2, pct)}%` }} />
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-4 gap-2">
          <CountChip label="Valid"   count={job.validCount}   color="emerald" />
          <CountChip label="Invalid" count={job.invalidCount} color="red" />
          <CountChip label="Risky"   count={job.riskyCount}   color="amber" />
          <CountChip label="Unknown" count={job.unknownCount} color="zinc" />
        </div>
      )}

      {job.error && (<div className="mt-2 text-[11px] text-red-600">{job.error}</div>)}
    </li>
  );
}

const CHIP_COLORS = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  red:     'bg-red-50     text-red-700     border-red-200',
  amber:   'bg-amber-50   text-amber-700   border-amber-200',
  zinc:    'bg-zinc-50    text-zinc-600    border-zinc-200',
};

function CountChip({ label, count, color }) {
  return (
    <div className={`rounded-md border px-2 py-1.5 ${CHIP_COLORS[color]}`}>
      <div className="text-[9px] uppercase tracking-wider opacity-70">{label}</div>
      <div className="text-[14px] font-semibold tabular-nums">{count.toLocaleString()}</div>
    </div>
  );
}

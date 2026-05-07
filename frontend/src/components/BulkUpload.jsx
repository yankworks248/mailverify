'use client';
import { useState, useRef } from 'react';
import { api } from '@/lib/api';

export default function BulkUpload({ onJobCreated }) {
  const [file, setFile]       = useState(null);
  const [peek, setPeek]       = useState(null);
  const [mapping, setMapping] = useState({ email: '', first_name: '', last_name: '' });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  async function handleFile(f) {
    setError(null); setPeek(null); setFile(f);
    setMapping({ email: '', first_name: '', last_name: '' });
    if (!f) return;
    setLoading(true);
    try {
      const p = await api.bulkPeek(f);
      setPeek(p);
      setMapping({
        email:      p.suggested?.email      || (p.headers[0] || ''),
        first_name: p.suggested?.first_name || '',
        last_name:  p.suggested?.last_name  || '',
      });
    } catch (err) {
      setError(err.message);
      setFile(null);
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    if (!file || !mapping.email || submitting) return;
    setSubmitting(true); setError(null);
    try {
      const job = await api.bulkSubmit(file, {
        email:      mapping.email,
        first_name: mapping.first_name || null,
        last_name:  mapping.last_name  || null,
      });
      onJobCreated?.(job);
      reset();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setFile(null); setPeek(null); setError(null);
    setMapping({ email: '', first_name: '', last_name: '' });
    if (inputRef.current) inputRef.current.value = '';
  }

  function onDrop(e) {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white shadow-card p-6">
      <header className="mb-4">
        <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">
          Bulk upload
        </h2>
        <p className="text-[13px] text-zinc-500 mt-0.5">
          Drop a CSV — map the columns to verify.
        </p>
      </header>

      {!file && (
        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`block cursor-pointer rounded-xl border-2 border-dashed
                      transition-base px-4 py-10 text-center
                      ${dragOver
                        ? 'border-accent bg-accent-soft'
                        : 'border-zinc-200 bg-zinc-50/50 hover:border-zinc-300 hover:bg-zinc-50'}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <svg className="mx-auto h-7 w-7 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          <p className="mt-2.5 text-[13px] text-zinc-600">
            <span className="font-medium text-zinc-900">Click to upload</span> or drag and drop
          </p>
          <p className="mt-1 text-[11px] text-zinc-400">CSV file, up to 50 MB</p>
        </label>
      )}

      {file && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 py-2.5">
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-zinc-900 truncate" title={file.name}>
                {file.name}
              </div>
              <div className="text-[11px] text-zinc-500 font-mono">
                {(file.size / 1024).toFixed(1)} KB
                {peek && ` · ${peek.sampleSize.toLocaleString()} rows`}
              </div>
            </div>
            <button type="button" onClick={reset}
              className="text-[12px] text-zinc-500 hover:text-red-600 transition-base shrink-0">
              Remove
            </button>
          </div>

          {loading && (
            <div className="text-[12px] text-zinc-500 py-2 text-center">Reading file…</div>
          )}

          {peek && (
            <>
              <div className="space-y-2.5">
                <ColumnMap label="Email"
                  required
                  value={mapping.email}
                  headers={peek.headers}
                  autoDetected={peek.suggested?.email === mapping.email && !!peek.suggested?.email}
                  onChange={(v) => setMapping({ ...mapping, email: v })}
                  preview={peek.preview}
                />
                <ColumnMap label="First name"
                  value={mapping.first_name}
                  headers={peek.headers}
                  autoDetected={peek.suggested?.first_name === mapping.first_name && !!peek.suggested?.first_name}
                  onChange={(v) => setMapping({ ...mapping, first_name: v })}
                  preview={peek.preview}
                  optional
                />
                <ColumnMap label="Last name"
                  value={mapping.last_name}
                  headers={peek.headers}
                  autoDetected={peek.suggested?.last_name === mapping.last_name && !!peek.suggested?.last_name}
                  onChange={(v) => setMapping({ ...mapping, last_name: v })}
                  preview={peek.preview}
                  optional
                />
              </div>
            </>
          )}

          <button type="button" onClick={submit}
            disabled={!peek || !mapping.email || submitting}
            className="w-full py-2.5 rounded-lg bg-accent text-white text-[14px] font-medium
                       hover:bg-accent-hover disabled:bg-zinc-200 disabled:text-zinc-500
                       disabled:cursor-not-allowed transition-base">
            {submitting ? 'Queueing…' : 'Start verification'}
          </button>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-[12px] text-red-700">
          {error}
        </div>
      )}
    </section>
  );
}

function ColumnMap({ label, value, headers, onChange, preview, optional, required, autoDetected }) {
  const samplePreview = value && preview?.length
    ? preview.slice(0, 2).map((r) => String(r[value] ?? '').trim()).filter(Boolean).join(' · ')
    : '';

  return (
    <div className="grid grid-cols-[110px_1fr] gap-3 items-start">
      <div className="pt-2">
        <div className="text-[12px] font-medium text-zinc-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </div>
        {optional && (
          <div className="text-[10px] text-zinc-400">optional</div>
        )}
      </div>
      <div className="min-w-0">
        <div className="relative">
          <select value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white
                       text-[13px] font-mono
                       focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent
                       transition-base appearance-none pr-8">
            {optional && <option value="">— none —</option>}
            {headers.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
          <svg className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
               fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
        {(autoDetected || samplePreview) && (
          <div className="mt-1 text-[10px] flex items-center gap-1.5 px-1">
            {autoDetected && (
              <span className="text-accent uppercase tracking-wider font-medium">Auto</span>
            )}
            {samplePreview && (
              <span className="text-zinc-400 font-mono truncate">{samplePreview}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

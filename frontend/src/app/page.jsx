'use client';
import { useEffect, useState, useCallback } from 'react';
import SingleVerify from '@/components/SingleVerify';
import BulkUpload   from '@/components/BulkUpload';
import StatsBar     from '@/components/StatsBar';
import JobsList     from '@/components/JobsList';
import JobDetail    from '@/components/JobDetail';
import { api } from '@/lib/api';

export default function Home() {
  const [health, setHealth] = useState(null);
  const [jobs,   setJobs]   = useState([]);
  const [selectedUuid, setSelectedUuid] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const [h, j] = await Promise.all([api.health(), api.listJobs(20)]);
      setHealth(h);
      setJobs(j);
      setRefreshTick((t) => t + 1);
    } catch (err) {
      console.error('refresh failed:', err.message);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 4000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleVerified   = useCallback(() => refresh(), [refresh]);
  const handleJobCreated = useCallback((job) => {
    refresh();
    if (job?.jobUuid) setSelectedUuid(job.jobUuid);
  }, [refresh]);

  const selectedJob = selectedUuid ? jobs.find((j) => j.jobUuid === selectedUuid) : null;

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-zinc-100 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-[1400px] mx-auto px-8 py-4 flex items-center justify-between">
          <span className="text-[15px] font-semibold tracking-tight text-zinc-900">
            Email Verifier
          </span>
          <div className="text-[11px] text-zinc-400 font-mono">
            {health ? new Date(health.time).toLocaleTimeString() : '—'}
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-8 py-8">
        <div className="grid grid-cols-12 gap-6">
          <aside className="col-span-12 lg:col-span-4 space-y-6">
            <SingleVerify onVerified={handleVerified} />
            <BulkUpload onJobCreated={handleJobCreated} />
          </aside>

          <section className="col-span-12 lg:col-span-8 space-y-6">
            {selectedJob ? (
              <JobDetail
                job={selectedJob}
                onBack={() => setSelectedUuid(null)}
                refreshTick={refreshTick}
              />
            ) : (
              <>
                <StatsBar health={health} />
                <JobsList
                  jobs={jobs}
                  selectedUuid={selectedUuid}
                  onSelect={(j) => setSelectedUuid(j.jobUuid)}
                />
              </>
            )}
          </section>
        </div>
      </main>

      <footer className="max-w-[1400px] mx-auto px-8 py-6 text-[11px] text-zinc-400 font-mono">
        verify.inboxaxis.net · 4-level verification · Address → Domain → Mailbox → Risk
      </footer>
    </div>
  );
}

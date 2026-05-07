"use client";
import { useEffect, useState, useCallback } from "react";
import SingleVerify from "@/components/SingleVerify";
import BulkUpload from "@/components/BulkUpload";
import StatsBar from "@/components/StatsBar";
import JobsList from "@/components/JobsList";
import JobDetail from "@/components/JobDetail";
import { api } from "@/lib/api";

export default function Home() {
  const [authed, setAuthed] = useState(null);
  const [user, setUser] = useState(null);
  const [health, setHealth] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [selectedUuid, setSelectedUuid] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const [h, j] = await Promise.all([api.health(), api.listJobs(20)]);
      setHealth(h);
      setJobs(j);
      setRefreshTick((t) => t + 1);
    } catch (err) {
      console.error("refresh failed:", err.message);
    }
  }, []);

  useEffect(() => {
    api
      .me()
      .then((u) => {
        setUser(u);
        setAuthed(true);
        refresh();
      })
      .catch(() => {
        window.location.href = "/login";
      });
  }, [refresh]);

  useEffect(() => {
    if (!authed) return;
    const hasActive = jobs.some(
      (j) => j.status === "processing" || j.status === "pending",
    );
    if (!hasActive) return;
    const interval = setInterval(refresh, 4000);
    return () => clearInterval(interval);
  }, [authed, jobs, refresh]);

  const handleVerified = useCallback(() => refresh(), [refresh]);
  const handleJobCreated = useCallback(
    (job) => {
      refresh();
      if (job?.jobUuid) setSelectedUuid(job.jobUuid);
    },
    [refresh],
  );

  async function handleLogout() {
    try {
      await api.logout();
    } catch (_) {}
    window.location.href = "/login";
  }

  if (authed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[13px] text-zinc-400">
        Loading…
      </div>
    );
  }

  const selectedJob = selectedUuid
    ? jobs.find((j) => j.jobUuid === selectedUuid)
    : null;

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-zinc-100 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-[1400px] mx-auto px-8 py-4 flex items-center justify-between">
          <span className="text-[15px] font-semibold tracking-tight text-zinc-900">
            Email Verifier
          </span>
          <div className="flex items-center gap-4">
            {user?.username && (
              <span className="text-[12px] text-zinc-500 font-mono">
                {user.username}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="text-[12px] text-zinc-500 hover:text-zinc-900 transition-base"
            >
              Sign out
            </button>
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
        verify.inboxaxis.net · 4-level verification · Address → Domain → Mailbox
        → Risk
      </footer>
    </div>
  );
}

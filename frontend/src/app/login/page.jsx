"use client";
import { useState } from "react";
import { api } from "@/lib/api";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!username || !password || loading) return;
    setLoading(true);
    setError(null);
    try {
      await api.login(username, password);
      window.location.href = "/";
    } catch (err) {
      setError("Invalid username or password");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-block w-12 h-12 rounded-2xl bg-accent flex items-center justify-center mb-3">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
              />
            </svg>
          </div>
          <h1 className="text-[20px] font-semibold tracking-tight text-zinc-900">
            Email Verifier
          </h1>
          <p className="text-[13px] text-zinc-500 mt-1">Sign in to continue</p>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200 shadow-card p-7">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-[12px] font-medium text-zinc-700 mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-200 text-[14px] font-mono
                           focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-base"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-[12px] font-medium text-zinc-700 mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full px-3.5 py-2.5 rounded-lg border border-zinc-200 text-[14px] font-mono
                           focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-base"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full py-2.5 rounded-lg bg-accent text-white text-[14px] font-medium
                         hover:bg-accent-hover disabled:bg-zinc-200 disabled:text-zinc-500
                         disabled:cursor-not-allowed transition-base"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

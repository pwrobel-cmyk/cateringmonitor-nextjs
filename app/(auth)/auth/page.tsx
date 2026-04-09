"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { clsx } from "clsx";

type Mode = "login" | "register";

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push(next);
        router.refresh();
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage("Sprawdź skrzynkę e-mail i potwierdź rejestrację.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Wystąpił błąd");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="flex rounded-lg bg-slate-100 p-1 mb-6">
        {(["login", "register"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setError(null); setMessage(null); }}
            className={clsx(
              "flex-1 py-1.5 text-sm font-medium rounded-md transition-colors",
              mode === m
                ? "bg-white text-[#1e3a5f] shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            {m === "login" ? "Logowanie" : "Rejestracja"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">E-mail</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/40 focus:border-[#0ea5e9]"
            placeholder="twoj@email.com"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Hasło</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0ea5e9]/40 focus:border-[#0ea5e9]"
            placeholder="••••••••"
          />
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        {message && (
          <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-[#1e3a5f] hover:bg-[#162d4a] disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {loading ? "Ładowanie..." : mode === "login" ? "Zaloguj się" : "Zarejestruj się"}
        </button>
      </form>
    </div>
  );
}

export default function AuthPage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-[#1e3a5f] flex items-center justify-center mx-auto mb-3">
            <span className="text-white text-lg font-bold">CM</span>
          </div>
          <h1 className="text-xl font-semibold text-[#1e3a5f]">CateringMonitor</h1>
          <p className="text-sm text-slate-500 mt-1">Monitoring rynku cateringowego</p>
        </div>

        <Suspense fallback={<div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 h-48" />}>
          <AuthForm />
        </Suspense>

        <p className="text-center text-xs text-slate-400 mt-4">
          &copy; {new Date().getFullYear()} CateringMonitor &mdash; Enterprise
        </p>
      </div>
    </div>
  );
}

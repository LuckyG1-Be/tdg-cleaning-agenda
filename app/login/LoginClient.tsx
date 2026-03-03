"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/agenda";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "Login mislukt");
      router.replace(next);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message || "Login mislukt");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
        <div className="mb-4">
          <div className="text-xl font-semibold">TDG Cleaning</div>
          <div className="text-sm text-zinc-500">Log in om je agenda te beheren</div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-sm font-medium">Gebruikersnaam</label>
            <input
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900/10"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Wachtwoord</label>
            <input
              type="password"
              className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-900/10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {err ? <div className="text-sm text-red-600">{err}</div> : null}

          <button
            disabled={busy}
            className="w-full rounded-xl bg-zinc-900 text-white py-2 font-medium hover:bg-zinc-800 disabled:opacity-60"
          >
            {busy ? "Bezig..." : "Inloggen"}
          </button>

          <div className="text-xs text-zinc-500">
            Tip: login is enkel voor de eigenaar (geen registratie).
          </div>
        </form>
      </div>
    </main>
  );
}
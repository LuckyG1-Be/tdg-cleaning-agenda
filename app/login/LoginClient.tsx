"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const rawNext = sp.get("next") || "/agenda";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/agenda";

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
      if (!r.ok || !j.ok) throw new Error(j.error || "Aanmelden mislukt");
      router.replace(next);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message || "Aanmelden mislukt");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center p-5 bg-[radial-gradient(circle_at_top_left,_#eef8fc,_#f7f9fa_44%,_#eef2f4)]">
      <div className="w-full max-w-md">
        <div className="mb-4 flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-[#0a3148] text-white grid place-items-center font-black tracking-[-.04em] shadow-sm">TDG</div>
          <div>
            <div className="font-semibold text-zinc-900">TDG Cleaning</div>
            <div className="text-xs text-zinc-500">Planning & klanten</div>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-zinc-200 shadow-[0_24px_80px_rgba(10,49,72,.10)] p-6 md:p-7">
          <div className="mb-5">
            <div className="tdg-kicker">Beveiligde omgeving</div>
            <h1 className="text-3xl font-semibold tracking-tight mt-1">Welkom terug.</h1>
            <p className="text-sm text-zinc-500 mt-2">Meld je aan om de agenda en klantendatabase te beheren.</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span>Gebruikersnaam</span>
              <input
                className="tdg-input mt-1"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                required
              />
            </label>

            <label className="block">
              <span>Wachtwoord</span>
              <input
                type="password"
                className="tdg-input mt-1"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>

            {err ? <div className="tdg-alert tdg-alert-error">{err}</div> : null}

            <button disabled={busy} className="tdg-btn-primary w-full py-3">
              {busy ? "Aanmelden…" : "Aanmelden"}
            </button>

            <p className="text-xs text-zinc-400 text-center">
              Alleen toegankelijk voor geautoriseerde beheerders.
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}

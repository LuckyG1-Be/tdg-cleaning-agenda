"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function Topbar() {
  const p = usePathname();
  const tab = (href: string) =>
    cls(
      "px-3 py-2 rounded-lg text-sm font-medium",
      p === href ? "bg-white shadow-sm border border-zinc-200" : "text-zinc-600 hover:text-zinc-900"
    );

  return (
    <header className="sticky top-0 z-20 bg-zinc-50/80 backdrop-blur border-b border-zinc-200">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-zinc-900 text-white grid place-items-center font-semibold">TDG</div>
          <div className="leading-tight">
            <div className="font-semibold">TDG Cleaning</div>
            <div className="text-xs text-zinc-500">Klanten & agenda</div>
          </div>
        </div>
        <nav className="flex items-center gap-2">
          <Link className={tab("/agenda")} href="/agenda">Agenda</Link>
          <Link className={tab("/klanten")} href="/klanten">Klanten</Link>
          <form action="/api/auth/logout" method="post">
            <button className="px-3 py-2 rounded-lg text-sm font-medium text-zinc-600 hover:text-zinc-900">
              Uitloggen
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}

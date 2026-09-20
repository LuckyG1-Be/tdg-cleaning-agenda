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
      "px-3 py-2 rounded-lg text-sm font-semibold transition",
      p === href
        ? "bg-sky-50 text-sky-800 ring-1 ring-sky-200"
        : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
    );

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto max-w-[1480px] px-4 md:px-6 py-3 flex items-center justify-between gap-3">
        <Link href="/agenda" className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 shrink-0 rounded-xl bg-[#0a3148] text-white grid place-items-center font-black tracking-[-.04em] shadow-sm">
            TDG
          </div>
          <div className="leading-tight min-w-0">
            <div className="font-semibold text-zinc-900 truncate">TDG Cleaning</div>
            <div className="text-xs text-zinc-500 truncate">Planning & klanten</div>
          </div>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <Link className={tab("/agenda")} href="/agenda">Agenda</Link>
          <Link className={tab("/klanten")} href="/klanten">Klanten</Link>
          <form action="/api/auth/logout" method="post">
            <button className="px-2 sm:px-3 py-2 rounded-lg text-sm font-medium text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100">
              <span className="hidden sm:inline">Uitloggen</span><span className="sm:hidden">↗</span>
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}

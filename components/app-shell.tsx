"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { navFor, ROLES, type RoleKey } from "@/lib/roles";
import { useRole } from "./role-provider";
import { DemoBadge } from "./demo-badge";
import { ResetDemo } from "./reset-demo";
import { DEMO_TODAY } from "@/lib/constants";
import { dateLong } from "@/lib/format";

const SCHOOL_NAME = "Framtidsskolan mellan";

export function AppShell({ children }: { children: ReactNode }) {
  const { role, setRole } = useRole();
  const pathname = usePathname();
  const nav = navFor(role);
  const [menuOpen, setMenuOpen] = useState(false);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  // Lås bakgrundsscroll och stäng på Escape när mobilmenyn är öppen.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const brand = (
    <div className="flex items-center gap-3 px-5 pb-2 pt-6">
      <span
        aria-hidden
        className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--gbg-green)] font-display text-xl text-white shadow-sm"
      >
        {SCHOOL_NAME.charAt(0)}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--chrome-muted)]">Göteborgs Stad</p>
        <p className="truncate font-display text-xl leading-tight">{SCHOOL_NAME}</p>
      </div>
    </div>
  );

  const navLinks = (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pt-2" aria-label="Huvudnavigation">
      {nav.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.view}
            href={item.href}
            onClick={() => setMenuOpen(false)}
            aria-current={active ? "page" : undefined}
            className={`relative block rounded-lg px-3.5 py-2.5 text-[15px] font-medium transition-colors ${
              active
                ? "bg-[var(--surface-card)] text-[var(--text-strong)] shadow-sm"
                : "text-[var(--chrome-muted)] hover:bg-white/[0.06] hover:text-[var(--chrome-text)]"
            }`}
          >
            {active && (
              <span aria-hidden className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[var(--gbg-orange)]" />
            )}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <div className="space-y-3 border-t border-[var(--chrome-border)] px-3 py-4">
      <ResetDemo />
      <p className="px-2 text-xs text-[var(--chrome-muted)]">Demo · {dateLong(DEMO_TODAY)}</p>
    </div>
  );

  return (
    <div className="flex min-h-dvh">
      {/* Sidonavigation (desktop) */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-[var(--chrome-border)] bg-[var(--chrome)] text-[var(--chrome-text)] md:flex">
        {brand}
        <p className="mb-2 px-5 text-xs text-[var(--chrome-muted)]">Datainformerat arbete</p>
        {navLinks}
        {footer}
      </aside>

      {/* Mobilmeny (overlay + panel) */}
      <div className="md:hidden" role="dialog" aria-modal={menuOpen} aria-label="Huvudmeny" hidden={!menuOpen}>
        <button
          type="button"
          aria-label="Stäng meny"
          onClick={() => setMenuOpen(false)}
          className={`fixed inset-0 z-40 bg-black/45 transition-opacity ${menuOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
        />
        <div
          className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[82vw] flex-col bg-[var(--chrome)] text-[var(--chrome-text)] shadow-2xl transition-transform duration-200 ${
            menuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <button
            type="button"
            aria-label="Stäng meny"
            onClick={() => setMenuOpen(false)}
            className="absolute right-3 top-5 grid size-8 place-items-center rounded-lg text-[var(--chrome-muted)] hover:bg-white/[0.08] hover:text-[var(--chrome-text)]"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
          {brand}
          <p className="mb-2 px-5 text-xs text-[var(--chrome-muted)]">Datainformerat arbete</p>
          {navLinks}
          {footer}
        </div>
      </div>

      {/* Innehåll */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-card)]/80 px-4 py-3 backdrop-blur-md sm:px-5">
          <button
            type="button"
            aria-label="Öppna meny"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            className="grid size-9 place-items-center rounded-lg border border-[var(--border-strong)] bg-white text-[var(--text-strong)] shadow-sm md:hidden"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            </svg>
          </button>

          {/* Kompakt skolnamn på mobil (sidopanelen är dold) */}
          <span className="font-display text-lg leading-none md:hidden">{SCHOOL_NAME}</span>

          <DemoBadge />
          <span className="hidden text-sm text-[var(--text-muted)] sm:inline">Fiktiv grundskola · läsåret 2025/2026</span>
          <div className="ml-auto flex items-center gap-2">
            <label htmlFor="role-select" className="text-sm font-medium text-[var(--text-muted)]">Roll</label>
            <select
              id="role-select"
              value={role}
              onChange={(e) => setRole(e.target.value as RoleKey)}
              className="rounded-lg border border-[var(--border-strong)] bg-white px-3 py-1.5 text-sm font-semibold text-[var(--text-strong)] shadow-sm"
            >
              {ROLES.map((r) => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </select>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-7 sm:px-5 sm:py-8">
          <div key={pathname} className="animate-rise">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

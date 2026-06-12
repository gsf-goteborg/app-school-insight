"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Card, Pill } from "./ui/primitives";
import { ActionStatusPill } from "./student-action";
import { pct, num } from "@/lib/format";

// Lärarens "Mina klasser": välj egna klasser (sparas i webbläsaren, som rollvalet)
// och se det viktigaste per klass – läget, vilka elever som behöver stöd eller
// utmaning och förslag på nästa steg. All klassdata bakas in av RSC-sidan;
// komponenten filtrerar bara till valda klasser (statisk export, ingen backend).

export interface MinaFlaggedStudent {
  id: string;
  name: string;
  level: string;     // "Hög" | "Förhöjd"
  action: string;
}

export interface MinaClassData {
  class_id: string;
  grade: number;
  mentor: string | null;
  attendanceRate: number;
  avgTrygghet: number;
  attention: string; // "Prioritera" | "Bevaka" | "Stabilt"
  flagged: MinaFlaggedStudent[];
  stretch: { id: string; name: string }[];
  tappar: { id: string; name: string }[];
}

// --- Klassval i localStorage (useSyncExternalStore – SSR-säkert) ---
const KEY = "skolinsikt-mina-klasser";
const DEFAULT_SELECTION = ["8A"];
const listeners = new Set<() => void>();
let cache: { raw: string | null; data: string[] } = { raw: null, data: DEFAULT_SELECTION };

function readSelection(): string[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    /* ignore */
  }
  if (raw === cache.raw) return cache.data;
  let data = DEFAULT_SELECTION;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) data = parsed.filter((x) => typeof x === "string");
    } catch {
      /* ignore */
    }
  }
  cache = { raw, data };
  return data;
}

function writeSelection(ids: string[]) {
  const raw = JSON.stringify(ids);
  try {
    window.localStorage.setItem(KEY, raw);
  } catch {
    /* ignore */
  }
  cache = { raw, data: ids };
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

const ATTENTION_TONE: Record<string, "kritisk" | "uppmarksam" | "positiv"> = {
  Prioritera: "kritisk",
  Bevaka: "uppmarksam",
  Stabilt: "positiv",
};

export function MyClasses({ classes }: { classes: MinaClassData[] }) {
  const selected = useSyncExternalStore(subscribe, readSelection, () => DEFAULT_SELECTION);
  const toggle = (id: string) =>
    writeSelection(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const mine = classes.filter((c) => selected.includes(c.class_id));

  return (
    <div>
      <Card className="mb-6 p-4">
        <p className="mb-2 text-sm font-medium text-[var(--text-muted)]">
          Välj dina klasser (sparas i din webbläsare):
        </p>
        <div className="flex flex-wrap gap-1.5">
          {classes.map((c) => (
            <button
              key={c.class_id}
              type="button"
              aria-pressed={selected.includes(c.class_id)}
              onClick={() => toggle(c.class_id)}
              className={`rounded-lg px-2.5 py-1 text-sm font-medium transition-colors ${
                selected.includes(c.class_id)
                  ? "bg-[var(--gbg-blue)] text-white"
                  : "bg-[var(--surface-muted)] text-[var(--text-default)] hover:bg-[var(--border-subtle)]"
              }`}
            >
              {c.class_id}
            </button>
          ))}
        </div>
      </Card>

      {mine.length === 0 ? (
        <Card className="p-8 text-center text-[var(--text-muted)]">
          Välj minst en klass ovan för att se dina elever.
        </Card>
      ) : (
        <div className="space-y-6">
          {mine.map((c) => (
            <Card key={c.class_id} className="p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <Link href={`/klass/${c.class_id}`} className="font-display text-xl hover:text-[var(--gbg-blue)] hover:underline">
                    Klass {c.class_id}
                  </Link>
                  <Pill tone={ATTENTION_TONE[c.attention] ?? "neutral"}>{c.attention}</Pill>
                  <span className="text-sm text-[var(--text-muted)]">
                    Närvaro {pct(c.attendanceRate, 1)} · trygghet {num(c.avgTrygghet, 1)}/4
                    {c.mentor ? ` · mentor ${c.mentor}` : ""}
                  </span>
                </div>
                <Link href={`/klass/${c.class_id}`} className="text-sm font-semibold text-[var(--gbg-blue)] hover:underline">
                  Hela klassbilden →
                </Link>
              </div>

              <p className="mb-2 text-sm font-semibold text-[var(--text-muted)]">
                Att prata med den här veckan ({num(c.flagged.length)})
              </p>
              {c.flagged.length === 0 ? (
                <p className="mb-3 text-sm text-[var(--text-muted)]">
                  Inga elever med hög eller förhöjd signal just nu.
                </p>
              ) : (
                <ul className="mb-3 space-y-2">
                  {c.flagged.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] px-3 py-2">
                      <span className="flex min-w-0 flex-wrap items-center gap-2">
                        <Link href={`/elev/${s.id}`} className="font-medium hover:text-[var(--gbg-blue)] hover:underline">
                          {s.name}
                        </Link>
                        <Pill tone={s.level === "Hög" ? "kritisk" : "uppmarksam"}>{s.level}</Pill>
                        <ActionStatusPill studentId={s.id} />
                      </span>
                      <span className="text-sm text-[var(--text-muted)]">{s.action}</span>
                    </li>
                  ))}
                </ul>
              )}

              {(c.stretch.length > 0 || c.tappar.length > 0) && (
                <p className="border-t border-[var(--border-subtle)] pt-3 text-sm text-[var(--text-muted)]">
                  {c.stretch.length > 0 && (
                    <>
                      <span className="font-medium text-[var(--text-default)]">Kan utmanas mer: </span>
                      {c.stretch.map((s, i) => (
                        <span key={s.id}>
                          {i > 0 && ", "}
                          <Link href={`/elev/${s.id}`} className="hover:text-[var(--gbg-blue)] hover:underline">{s.name}</Link>
                        </span>
                      ))}
                      {c.tappar.length > 0 && " · "}
                    </>
                  )}
                  {c.tappar.length > 0 && (
                    <>
                      <span className="font-medium text-[var(--text-default)]">Tappar mark: </span>
                      {c.tappar.map((s, i) => (
                        <span key={s.id}>
                          {i > 0 && ", "}
                          <Link href={`/elev/${s.id}`} className="hover:text-[var(--gbg-blue)] hover:underline">{s.name}</Link>
                        </span>
                      ))}
                    </>
                  )}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

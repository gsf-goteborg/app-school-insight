import Link from "next/link";
import type { ReactNode } from "react";
import { LEVELS, type Level } from "@/lib/constants";

type Tone = "neutral" | "positiv" | "uppmarksam" | "kritisk" | "info";

const TONE_BG: Record<Tone, string> = {
  neutral: "bg-[var(--surface-muted)] text-[var(--text-default)]",
  positiv: "bg-[var(--gbg-green-light)] text-[var(--gbg-green-dark)]",
  uppmarksam: "bg-[var(--gbg-orange-light)] text-[var(--gbg-orange-dark)]",
  kritisk: "bg-[var(--gbg-red-light)] text-[var(--gbg-red-dark)]",
  info: "bg-[var(--gbg-purple-light)] text-[var(--gbg-purple-dark)]",
};

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--shadow-card)] ${className}`}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  kicker,
  title,
  description,
  right,
  breadcrumb,
}: {
  kicker?: string;
  title: string;
  description?: string;
  right?: ReactNode;
  breadcrumb?: { label: string; href?: string }[];
}) {
  return (
    <div className="mb-6">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav className="mb-2 flex flex-wrap items-center gap-1 text-sm text-[var(--text-muted)]" aria-label="Brödsmulor">
          {breadcrumb.map((b, i) => (
            <span key={i} className="flex items-center gap-1">
              {b.href ? (
                <Link href={b.href} className="hover:text-[var(--gbg-blue)] hover:underline">
                  {b.label}
                </Link>
              ) : (
                <span>{b.label}</span>
              )}
              {i < breadcrumb.length - 1 && <span aria-hidden>/</span>}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {kicker && (
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              <span aria-hidden className="inline-block h-px w-6 bg-[var(--gbg-orange)]" />
              {kicker}
            </p>
          )}
          <h1 className="font-display text-[2rem] font-medium leading-[1.15] tracking-[-0.01em]">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-[var(--text-muted)]">{description}</p>}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
    </div>
  );
}

export function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          {description && <p className="text-sm text-[var(--text-muted)]">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
  delta,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  delta?: { text: string; tone: Tone };
  tone?: Tone;
}) {
  const accent: Record<Tone, string> = {
    neutral: "text-[var(--text-strong)]",
    positiv: "text-[var(--gbg-green-dark)]",
    uppmarksam: "text-[var(--gbg-orange-dark)]",
    kritisk: "text-[var(--gbg-red-dark)]",
    info: "text-[var(--gbg-purple-dark)]",
  };
  return (
    <Card className="p-5">
      <p className="text-sm font-medium text-[var(--text-muted)]">{label}</p>
      <p className={`mt-1 font-display text-4xl tabular ${accent[tone]}`}>{value}</p>
      <div className="mt-1 flex items-center gap-2">
        {delta && <Pill tone={delta.tone}>{delta.text}</Pill>}
        {hint && <span className="text-sm text-[var(--text-muted)]">{hint}</span>}
      </div>
    </Card>
  );
}

const HIGHLIGHT_BOX: Record<Tone, string> = {
  neutral: "bg-[var(--surface-muted)] text-[var(--text-strong)] ring-[var(--border-strong)]",
  positiv: "bg-[var(--gbg-green-light)] text-[var(--gbg-green-dark)] ring-[var(--gbg-green)]/30",
  uppmarksam: "bg-[var(--gbg-orange-light)] text-[var(--gbg-orange-dark)] ring-[var(--gbg-orange)]/30",
  kritisk: "bg-[var(--gbg-red-light)] text-[var(--gbg-red-dark)] ring-[var(--gbg-red)]/30",
  info: "bg-[var(--gbg-purple-light)] text-[var(--gbg-purple-dark)] ring-[var(--gbg-purple)]/30",
};

/** Nyckeltal i text inramat i en liten färgad ruta, tonad efter läget. */
export function Highlight({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={`mx-0.5 inline-block rounded-[3px] px-1.5 py-0.5 text-[0.92em] font-bold leading-none tabular ring-1 ${HIGHLIGHT_BOX[tone]}`}
    >
      {children}
    </span>
  );
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-semibold ${TONE_BG[tone]}`}>
      {children}
    </span>
  );
}

export function LevelBadge({ level }: { level: Level }) {
  const tone: Record<Level, Tone> = {
    over: "positiv",
    i_linje: "info",
    uppmarksam: "uppmarksam",
    stort_behov: "kritisk",
  };
  const def = LEVELS.find((l) => l.key === level)!;
  return <Pill tone={tone[level]}>{def.short}</Pill>;
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <Card className="p-8 text-center text-[var(--text-muted)]">{children}</Card>
  );
}

/**
 * Hopfällbar fördjupning (details/summary, ingen JS). För modellredovisningar
 * och metodnoter: transparensen finns kvar ett klick bort utan att tynga vyn.
 */
export function Disclosure({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <details className="group mb-8 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--shadow-card)]">
      <summary className="cursor-pointer select-none px-5 py-4 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-base font-semibold">{title}</span>
            {description && <span className="mt-0.5 block text-sm text-[var(--text-muted)]">{description}</span>}
          </span>
          <span
            aria-hidden
            className="shrink-0 text-sm font-semibold text-[var(--gbg-blue)] group-open:hidden"
          >
            Visa +
          </span>
          <span aria-hidden className="hidden shrink-0 text-sm font-semibold text-[var(--gbg-blue)] group-open:inline">
            Dölj −
          </span>
        </span>
      </summary>
      <div className="border-t border-[var(--border-subtle)] px-5 py-4">{children}</div>
    </details>
  );
}

/** Liten förklarande not, t.ex. försiktighetsmarkering (§4/§15). */
export function Note({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <div className={`rounded-lg px-4 py-3 text-sm ${TONE_BG[tone]}`}>{children}</div>
  );
}

import Link from "next/link";
import { Card, Pill } from "./ui/primitives";
import { pct, num, deltaPct } from "@/lib/format";
import type { OverviewMetrics, AttentionLevel } from "@/lib/db/queries-overview";

type Tone = "positiv" | "uppmarksam" | "kritisk" | "neutral";

const TONE_TEXT: Record<Tone, string> = {
  positiv: "text-[var(--gbg-green-dark)]",
  uppmarksam: "text-[var(--gbg-orange-dark)]",
  kritisk: "text-[var(--gbg-red-dark)]",
  neutral: "text-[var(--text-default)]",
};

const ATTENTION_TONE: Record<AttentionLevel, Tone> = {
  Prioritera: "kritisk",
  Bevaka: "uppmarksam",
  Stabilt: "positiv",
};

export interface OverviewRow {
  id: string;
  href: string;
  label: string;
  sublabel?: string;
  m: OverviewMetrics;
}

function Num({ children, tone = "neutral" }: { children: React.ReactNode; tone?: Tone }) {
  return <span className={`tabular font-medium ${TONE_TEXT[tone]}`}>{children}</span>;
}

export function OverviewTable({ rows, firstColLabel }: { rows: OverviewRow[]; firstColLabel: string }) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-[15px]">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] text-left text-sm text-[var(--text-muted)]">
              <th className="px-4 py-2.5 font-medium">{firstColLabel}</th>
              <th className="px-4 py-2.5 text-right font-medium">Elever</th>
              <th className="px-4 py-2.5 text-right font-medium">Närvaro</th>
              <th className="px-4 py-2.5 text-right font-medium">Frånvarotrend</th>
              <th className="px-4 py-2.5 text-right font-medium">≥15 % frånvaro</th>
              <th className="px-4 py-2.5 text-right font-medium">Flaggade</th>
              <th className="px-4 py-2.5 text-right font-medium">Hög risk</th>
              <th className="px-4 py-2.5 text-right font-medium">Trygghet</th>
              <th className="px-4 py-2.5 text-right font-medium">Stödbehov</th>
              <th className="px-4 py-2.5 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ id, href, label, sublabel, m }) => {
              const attnTone: Tone = m.attendanceRate >= 0.95 ? "positiv" : m.attendanceRate >= 0.92 ? "neutral" : m.attendanceRate >= 0.9 ? "uppmarksam" : "kritisk";
              const riseTone: Tone = m.absenceRise > 0.02 ? "uppmarksam" : m.absenceRise < -0.01 ? "positiv" : "neutral";
              const over15Tone: Tone = m.over15Share >= 0.1 ? "kritisk" : m.over15Share >= 0.05 ? "uppmarksam" : "neutral";
              const flagTone: Tone = m.flaggedShare >= 0.55 ? "uppmarksam" : "neutral";
              const hogTone: Tone = m.hog >= 6 ? "kritisk" : m.hog >= 3 ? "uppmarksam" : "neutral";
              const tryggTone: Tone = m.avgTrygghet < 2.4 ? "kritisk" : m.avgTrygghet < 2.8 ? "uppmarksam" : m.avgTrygghet >= 3.2 ? "positiv" : "neutral";
              const supportTone: Tone = m.supportShare >= 0.3 ? "uppmarksam" : "neutral";
              return (
                <tr
                  key={id}
                  className={`border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--surface-muted)] ${m.attention === "Prioritera" ? "bg-[var(--gbg-red-light)]/30" : ""}`}
                >
                  <td className="px-4 py-2.5">
                    <Link href={href} className="font-semibold hover:text-[var(--gbg-blue)] hover:underline">{label}</Link>
                    {sublabel && <span className="block text-xs text-[var(--text-muted)]">{sublabel}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right"><Num>{num(m.students)}</Num></td>
                  <td className="px-4 py-2.5 text-right"><Num tone={attnTone}>{pct(m.attendanceRate, 1)}</Num></td>
                  <td className="px-4 py-2.5 text-right"><Num tone={riseTone}>{deltaPct(m.absenceRise)}</Num></td>
                  <td className="px-4 py-2.5 text-right"><Num tone={over15Tone}>{pct(m.over15Share, 0)}</Num></td>
                  <td className="px-4 py-2.5 text-right"><Num tone={flagTone}>{num(m.flagged)} <span className="text-[var(--text-muted)]">({pct(m.flaggedShare, 0)})</span></Num></td>
                  <td className="px-4 py-2.5 text-right"><Num tone={hogTone}>{num(m.hog)}</Num></td>
                  <td className="px-4 py-2.5 text-right"><Num tone={tryggTone}>{num(m.avgTrygghet, 1)}</Num></td>
                  <td className="px-4 py-2.5 text-right"><Num tone={supportTone}>{pct(m.supportShare, 0)}</Num></td>
                  <td className="px-4 py-2.5 text-right"><Pill tone={ATTENTION_TONE[m.attention]}>{m.attention}</Pill></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

import { LEVELS, type Level } from "@/lib/constants";
import { pct } from "@/lib/format";

export type LevelCounts = Partial<Record<Level, number>>;

const COLOR: Record<Level, string> = {
  over: "var(--gbg-green)",
  i_linje: "var(--gbg-blue)",
  uppmarksam: "var(--gbg-orange)",
  stort_behov: "var(--gbg-red)",
};

/** En horisontell, staplad fördelningsstapel över de fyra bedömningsnivåerna. */
export function LevelBar({ counts, height = 14 }: { counts: LevelCounts; height?: number }) {
  const total = LEVELS.reduce((s, l) => s + (counts[l.key] ?? 0), 0) || 1;
  return (
    <div
      className="flex w-full overflow-hidden rounded-full bg-[var(--surface-muted)]"
      style={{ height }}
      role="img"
      aria-label={LEVELS.map((l) => `${l.short}: ${counts[l.key] ?? 0}`).join(", ")}
    >
      {LEVELS.map((l) => {
        const n = counts[l.key] ?? 0;
        if (n === 0) return null;
        return (
          <div
            key={l.key}
            style={{ width: `${(n / total) * 100}%`, background: COLOR[l.key] }}
            title={`${l.label}: ${n} (${pct(n / total)})`}
          />
        );
      })}
    </div>
  );
}

/** Rad med etikett + fördelningsstapel + nyckeltal "andel att uppmärksamma". */
export function LevelDistributionRow({ label, counts }: { label: string; counts: LevelCounts }) {
  const total = LEVELS.reduce((s, l) => s + (counts[l.key] ?? 0), 0);
  const attention = (counts.uppmarksam ?? 0) + (counts.stort_behov ?? 0);
  return (
    <div className="grid grid-cols-[10rem_1fr_5rem] items-center gap-3 py-1.5">
      <span className="truncate text-sm font-medium">{label}</span>
      <LevelBar counts={counts} />
      <span className="text-right text-sm tabular text-[var(--text-muted)]" title="Andel som behöver uppmärksammas">
        {total ? pct(attention / total) : "–"}
      </span>
    </div>
  );
}

export function LevelLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
      {LEVELS.map((l) => (
        <span key={l.key} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: COLOR[l.key] }} aria-hidden />
          {l.label}
        </span>
      ))}
    </div>
  );
}

/** Hjälpare: gör om rader {key, level, n} till en map per nyckel. */
export function groupLevels<T extends { level: Level; n: number }>(
  rows: T[],
  keyOf: (r: T) => string,
): Map<string, LevelCounts> {
  const map = new Map<string, LevelCounts>();
  for (const r of rows) {
    const k = keyOf(r);
    const cur = map.get(k) ?? {};
    cur[r.level] = (cur[r.level] ?? 0) + r.n;
    map.set(k, cur);
  }
  return map;
}

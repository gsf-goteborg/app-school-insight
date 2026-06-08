// Svensk formatering för UI-text och datatabeller.

const sv = "sv-SE";

export function pct(value: number, digits = 0): string {
  return new Intl.NumberFormat(sv, {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function num(value: number, digits = 0): string {
  return new Intl.NumberFormat(sv, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function sek(value: number): string {
  return new Intl.NumberFormat(sv, {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Belopp i tusental kronor (tkr). Förväntar värde i kronor och delar med 1000. */
export function tkr(value: number, digits = 0): string {
  return (
    new Intl.NumberFormat(sv, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value / 1000) + " tkr"
  );
}

export function dateLong(iso: string): string {
  return new Intl.DateTimeFormat(sv, { dateStyle: "long" }).format(new Date(iso));
}

export function dateShort(iso: string): string {
  return new Intl.DateTimeFormat(sv, { dateStyle: "short" }).format(new Date(iso));
}

/** Signerat tal med +/- för förändringsindikatorer. */
export function delta(value: number, digits = 0): string {
  const s = num(Math.abs(value), digits);
  if (value > 0) return `+${s}`;
  if (value < 0) return `−${s}`;
  return s;
}

export function deltaPct(value: number, digits = 1): string {
  const s = pct(Math.abs(value), digits);
  if (value > 0) return `+${s}`;
  if (value < 0) return `−${s}`;
  return s;
}

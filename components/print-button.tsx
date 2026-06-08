"use client";

export function PrintButton({ label = "Skriv ut / spara som PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-white px-3.5 py-2 text-sm font-semibold text-[var(--text-strong)] shadow-sm transition-colors hover:bg-[var(--surface-muted)]"
    >
      <span aria-hidden>🖨</span>
      {label}
    </button>
  );
}

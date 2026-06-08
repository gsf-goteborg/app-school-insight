/** Global märkning som tydliggör att allt innehåll är fiktiv demodata (§14). */
export function DemoBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-[var(--gbg-yellow-light)] px-3 py-1 text-sm font-semibold text-[var(--gbg-orange-dark)] ${className}`}
      title="All data i appen är fiktiv och endast för demonstration."
    >
      <span aria-hidden className="size-2 rounded-full bg-[var(--gbg-orange)]" />
      Demodata
    </span>
  );
}

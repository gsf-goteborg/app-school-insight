"use client";

import { useState } from "react";
import { useDemoStore } from "./demo-store";

export function ResetDemo() {
  const { reset } = useDemoStore();
  const [done, setDone] = useState<string | null>(null);

  function handleReset() {
    if (!confirm("Återställ demodata? Insatser och kommentarer som du skapat i demon tas bort.")) return;
    const n = reset();
    setDone(n > 0 ? `${n} egna poster togs bort` : "Redan i ursprungsläge");
    setTimeout(() => setDone(null), 4000);
  }

  return (
    <div>
      <button
        onClick={handleReset}
        className="w-full rounded-lg border border-white/25 px-3 py-2 text-sm font-medium text-white/85 transition-colors hover:bg-white/10"
      >
        Återställ demodata
      </button>
      {done && <p className="mt-1 text-xs text-[var(--gbg-blue-light)]" aria-live="polite">{done}</p>}
    </div>
  );
}

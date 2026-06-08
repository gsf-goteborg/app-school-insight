import { Card } from "./primitives";

const DEFAULT_QUESTIONS = [
  "Vad ser vi i underlaget?",
  "Vad behöver vi förstå mer om?",
  "Vilka elever eller grupper behöver uppmärksammas?",
  "Vilka undervisningsinsatser kan prövas?",
  "Hur följer vi upp om insatsen gör skillnad?",
];

/** Frågebank / rekommenderade frågor (§6.2, §6.5, §11). Föreslår frågor – inte svar. */
export function Fragebank({
  title = "Frågor för kollegial analys",
  questions = DEFAULT_QUESTIONS,
}: {
  title?: string;
  questions?: string[];
}) {
  return (
    <Card className="p-5">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-0.5 text-sm text-[var(--text-muted)]">
        Appen föreslår frågor att ta vidare i analysen – inte färdiga slutsatser.
      </p>
      <ul className="mt-3 space-y-2">
        {questions.map((q, i) => (
          <li key={i} className="flex gap-2 text-[15px]">
            <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--gbg-purple)]" />
            <span>{q}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

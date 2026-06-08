"use client";

import { useRef, useState } from "react";
import { Card } from "./ui/primitives";
import { useDemoStore } from "./demo-store";
import { useRole } from "./role-provider";
import { roleLabel } from "@/lib/roles";
import { INTERVENTION_LEVEL_LABEL, INTERVENTION_STATUS_LABEL, DEMO_TODAY } from "@/lib/constants";

const field = "mt-1 w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 py-2 text-[15px] focus:border-[var(--gbg-blue)] focus:outline-none";
const label = "text-sm font-medium";
const btn = "rounded-lg bg-[var(--gbg-blue)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--gbg-blue-dark)]";

export function NewInterventionForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const { addIntervention } = useDemoStore();
  const { role } = useRole();

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className={btn}>
        + Skapa ny insats
      </button>
    );
  }

  return (
    <Card className="p-5">
      <h3 className="mb-3 font-semibold">Ny insats</h3>
      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const str = (k: string) => {
            const v = (fd.get(k) as string)?.trim();
            return v || null;
          };
          const title = (fd.get("title") as string)?.trim();
          if (!title) return;
          addIntervention({
            title,
            level: String(fd.get("level") || "grade"),
            target_grade: fd.get("target_grade") ? Number(fd.get("target_grade")) : null,
            target_class_id: str("target_class_id"),
            target_student_id: null,
            subject: str("subject"),
            follow_up_date: str("follow_up_date"),
            status: String(fd.get("status") || "planerad"),
            hypothesis: str("hypothesis"),
            planned_action: str("planned_action"),
            expected_effect: str("expected_effect"),
            owner_role: roleLabel(role),
          });
          formRef.current?.reset();
          setOpen(false);
        }}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        <div className="sm:col-span-2">
          <label className={label} htmlFor="i-title">Titel</label>
          <input id="i-title" name="title" required className={field} placeholder="t.ex. Lästräning i mindre grupp" />
        </div>
        <div>
          <label className={label} htmlFor="i-level">Nivå</label>
          <select id="i-level" name="level" className={field} defaultValue="grade">
            {Object.entries(INTERVENTION_LEVEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="i-status">Status</label>
          <select id="i-status" name="status" className={field} defaultValue="planerad">
            {Object.entries(INTERVENTION_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className={label} htmlFor="i-grade">Årskurs (valfritt)</label>
          <input id="i-grade" name="target_grade" type="number" min={1} max={10} className={field} />
        </div>
        <div>
          <label className={label} htmlFor="i-class">Klass (valfritt)</label>
          <input id="i-class" name="target_class_id" className={field} placeholder="t.ex. 2A" />
        </div>
        <div>
          <label className={label} htmlFor="i-subject">Ämne (valfritt)</label>
          <input id="i-subject" name="subject" className={field} placeholder="t.ex. Matematik" />
        </div>
        <div>
          <label className={label} htmlFor="i-follow">Uppföljningsdatum</label>
          <input id="i-follow" name="follow_up_date" type="date" defaultValue={DEMO_TODAY} className={field} />
        </div>
        <div className="sm:col-span-2">
          <label className={label} htmlFor="i-hyp">Hypotes</label>
          <textarea id="i-hyp" name="hypothesis" rows={2} className={field} placeholder="Vad tror vi ligger bakom mönstret?" />
        </div>
        <div className="sm:col-span-2">
          <label className={label} htmlFor="i-act">Planerad åtgärd</label>
          <textarea id="i-act" name="planned_action" rows={2} className={field} />
        </div>
        <div className="sm:col-span-2">
          <label className={label} htmlFor="i-exp">Förväntad effekt</label>
          <textarea id="i-exp" name="expected_effect" rows={2} className={field} />
        </div>
        <div className="flex gap-2 sm:col-span-2">
          <button type="submit" className={btn}>Spara insats</button>
          <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-[var(--border-strong)] px-4 py-2 text-sm font-semibold">
            Avbryt
          </button>
        </div>
      </form>
    </Card>
  );
}

/** Klientlista över egna (tillagda) insatser, visas under de inbakade. */
export function UserInterventions() {
  const { interventions } = useDemoStore();
  if (interventions.length === 0) return null;
  return (
    <div className="space-y-3">
      {interventions.map((i) => (
        <Card key={i.id} className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-[var(--surface-muted)] px-2.5 py-0.5 text-sm font-semibold">
              {INTERVENTION_STATUS_LABEL[i.status as keyof typeof INTERVENTION_STATUS_LABEL] ?? i.status}
            </span>
            <span className="font-semibold">{i.title}</span>
            <span className="inline-flex items-center rounded-full bg-[var(--gbg-blue-light)] px-2.5 py-0.5 text-sm font-semibold text-[var(--gbg-blue-dark)]">Egen</span>
          </div>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {i.target_class_id ? `Klass ${i.target_class_id}` : i.target_grade ? `Årskurs ${i.target_grade}` : INTERVENTION_LEVEL_LABEL[i.level as keyof typeof INTERVENTION_LEVEL_LABEL] ?? i.level}
            {i.subject ? ` · ${i.subject}` : ""}
            {i.follow_up_date ? ` · uppföljning ${i.follow_up_date}` : ""}
          </p>
          {i.hypothesis && <p className="mt-1 text-sm">{i.hypothesis}</p>}
        </Card>
      ))}
    </div>
  );
}

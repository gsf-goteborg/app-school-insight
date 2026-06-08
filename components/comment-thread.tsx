"use client";

import { useRef } from "react";
import { Card, Empty } from "./ui/primitives";
import { useDemoStore } from "./demo-store";
import { useRole } from "./role-provider";
import { roleLabel } from "@/lib/roles";
import type { Comment } from "@/lib/db/queries-resources";
import type { CommentScope } from "@/lib/constants";

export function CommentThread({
  scope, scopeRef, comments,
}: {
  scope: CommentScope;
  scopeRef: string;
  comments: Comment[]; // inbakade demokommentarer
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const { comments: userComments, addComment } = useDemoStore();
  const { role } = useRole();

  const mine = userComments.filter((c) => c.scope === scope && c.ref === scopeRef);
  const all = [
    ...mine.map((c) => ({ key: c.id, author: c.author, created: c.created, body: c.body, own: true })),
    ...comments.map((c) => ({ key: String(c.comment_id), author: c.author_role, created: c.created_at.slice(0, 10), body: c.body, own: false })),
  ];

  return (
    <div className="space-y-4">
      {all.length === 0 ? (
        <Empty>Inga kommentarer ännu. Skriv den första nedan.</Empty>
      ) : (
        <ul className="space-y-3">
          {all.map((c) => (
            <li key={c.key}>
              <Card className="p-4">
                <div className="flex items-center justify-between text-sm text-[var(--text-muted)]">
                  <span className="font-semibold text-[var(--text-default)]">
                    {c.author}
                    {c.own && <span className="ml-2 text-xs font-normal text-[var(--gbg-blue)]">(egen)</span>}
                  </span>
                  <span>{c.created}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Card className="p-4">
        <form
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault();
            const body = (new FormData(e.currentTarget).get("body") as string)?.trim();
            if (!body) return;
            addComment({ scope, ref: scopeRef, author: roleLabel(role), body });
            formRef.current?.reset();
          }}
        >
          <label htmlFor={`comment-${scopeRef}`} className="text-sm font-medium">
            Ny kommentar från arbetslag eller elevhälsa
          </label>
          <textarea
            id={`comment-${scopeRef}`}
            name="body"
            required
            rows={3}
            placeholder="Observation, tolkning eller planerad uppföljning…"
            className="mt-1 w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 py-2 text-[15px] focus:border-[var(--gbg-blue)] focus:outline-none"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="submit"
              className="rounded-lg bg-[var(--gbg-blue)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--gbg-blue-dark)]"
            >
              Spara kommentar
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}

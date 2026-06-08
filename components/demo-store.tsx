"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";

// Klientlagrad demodata (insatser/kommentarer som användaren skapar i demon).
// Sparas i localStorage så de överlever omladdning, men finns bara i webbläsaren.
// "Återställ demodata" tömmer detta. Ersätter serveractioner i den statiska bygget.
//
// Läses via useSyncExternalStore (SSR-säkert: servern ser tom lista, klienten
// synkar localStorage utan hydreringsglapp). getSnapshot cachar det parsade värdet
// så att referensen är stabil mellan renderingar tills råsträngen ändras.

export interface UserComment {
  id: string;
  scope: string;
  ref: string;
  author: string;
  body: string;
  created: string;
}

export interface UserIntervention {
  id: string;
  title: string;
  level: string;
  target_grade: number | null;
  target_class_id: string | null;
  target_student_id: string | null;
  subject: string | null;
  follow_up_date: string | null;
  status: string;
  hypothesis: string | null;
  planned_action: string | null;
  expected_effect: string | null;
  owner_role: string;
}

interface StoreData {
  comments: UserComment[];
  interventions: UserIntervention[];
}

interface StoreValue extends StoreData {
  addComment: (c: Omit<UserComment, "id" | "created">) => void;
  addIntervention: (i: Omit<UserIntervention, "id">) => void;
  reset: () => number;
  ready: boolean;
}

const KEY = "skolinsikt-demo-store";
const EMPTY: StoreData = { comments: [], interventions: [] };
const Ctx = createContext<StoreValue | null>(null);

const listeners = new Set<() => void>();
// Cache så att getSnapshot returnerar samma objektreferens tills råsträngen ändras
// (krav från useSyncExternalStore för att undvika oändliga omrenderingar).
let cache: { raw: string | null; data: StoreData } = { raw: null, data: EMPTY };

function read(): StoreData {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    /* ignore */
  }
  if (raw === cache.raw) return cache.data;
  let data: StoreData = EMPTY;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<StoreData>;
      data = {
        comments: parsed.comments ?? [],
        interventions: parsed.interventions ?? [],
      };
    } catch {
      data = EMPTY;
    }
  }
  cache = { raw, data };
  return data;
}

function write(data: StoreData) {
  const raw = JSON.stringify(data);
  try {
    window.localStorage.setItem(KEY, raw);
  } catch {
    /* ignore */
  }
  cache = { raw, data };
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function DemoStoreProvider({ children }: { children: ReactNode }) {
  const data = useSyncExternalStore(subscribe, read, () => EMPTY);
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const value: StoreValue = {
    comments: data.comments,
    interventions: data.interventions,
    ready,
    addComment: (c) =>
      write({
        ...read(),
        comments: [
          { ...c, id: crypto.randomUUID(), created: new Date().toISOString().slice(0, 10) },
          ...read().comments,
        ],
      }),
    addIntervention: (i) =>
      write({
        ...read(),
        interventions: [{ ...i, id: crypto.randomUUID() }, ...read().interventions],
      }),
    reset: () => {
      const current = read();
      const n = current.comments.length + current.interventions.length;
      write(EMPTY);
      return n;
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDemoStore(): StoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDemoStore måste användas inom DemoStoreProvider");
  return v;
}

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { DEFAULT_ROLE, parseRole, type RoleKey } from "@/lib/roles";

interface RoleContextValue {
  role: RoleKey;
  setRole: (role: RoleKey) => void;
}

const RoleContext = createContext<RoleContextValue>({
  role: DEFAULT_ROLE,
  setRole: () => {},
});

const KEY = "skolinsikt-role";

// Rollen lagras i localStorage (statisk sajt – ingen server att fråga) och läses
// via useSyncExternalStore, vilket är SSR-säkert: servern och första klientrendern
// använder DEFAULT_ROLE, sedan synkas den sparade rollen utan hydreringsglapp.
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot(): RoleKey {
  try {
    return parseRole(window.localStorage.getItem(KEY));
  } catch {
    return DEFAULT_ROLE;
  }
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const role = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_ROLE);

  const setRole = useCallback((next: RoleKey) => {
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      /* ignore */
    }
    listeners.forEach((l) => l());
  }, []);

  return <RoleContext.Provider value={{ role, setRole }}>{children}</RoleContext.Provider>;
}

export function useRole() {
  return useContext(RoleContext);
}

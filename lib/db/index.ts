import "server-only";
import Database from "better-sqlite3";
import { join } from "node:path";

/**
 * Dataåtkomstlager (repository). Hela appen läser och skriver via detta lager,
 * vilket gör en framtida växling till Supabase/Postgres inkapslad – endast
 * denna fil och lib/db/queries.ts behöver då bytas ut.
 */

declare global {
  // Singleton över hot-reload i dev.
  var __skolinsiktDb: Database.Database | undefined;
}

function open(): Database.Database {
  const file = join(process.cwd(), "data", "skolinsikt.db");
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export function getDb(): Database.Database {
  if (!globalThis.__skolinsiktDb) {
    globalThis.__skolinsiktDb = open();
  }
  return globalThis.__skolinsiktDb;
}

/** Bekvämlighet: hämta flera rader, typade. */
export function all<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T[] {
  return getDb().prepare(sql).all(...params) as T[];
}

/** Bekvämlighet: hämta en rad, typad. */
export function one<T = Record<string, unknown>>(sql: string, ...params: unknown[]): T | undefined {
  return getDb().prepare(sql).get(...params) as T | undefined;
}

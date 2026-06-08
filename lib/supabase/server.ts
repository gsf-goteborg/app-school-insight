import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase-klient för serverkomponenter (läsning).
 * Demon saknar skarp inloggning, så ingen session/cookie hanteras – tabellerna
 * är publikt läsbara. Behörighet styrs i UI-lagret (se lib/roles.ts). I en skarp
 * lösning skulle RLS ersätta detta.
 */
export function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}

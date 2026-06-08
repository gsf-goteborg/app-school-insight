import "server-only";
import { all, one } from "./index";

// ---------------------------------------------------------------------------
// HR-nyckeltal och sjukfrånvaro (Personalplanering)
// ---------------------------------------------------------------------------

export interface HrSummary {
  total_sick_share: number; // fte-viktad total sjukfrånvaro
  long_term_count: number; // antal långtidssjukskrivna (sick_share >= 0.12)
  headcount: number; // antal medarbetare
  total_fte: number; // totalt antal tjänster
  tillsvidare_share: number; // andel tillsvidareanställda (headcount)
  avg_years_employed: number; // medelanställningstid (år)
  new_share: number; // personalomsättnings-proxy: andel med < 1 års anställning
}

export function getHrSummary(): HrSummary {
  const r = one<{
    total_sick_share: number;
    long_term_count: number;
    headcount: number;
    total_fte: number;
    tillsvidare_share: number;
    avg_years_employed: number;
    new_share: number;
  }>(
    `select
       coalesce(sum(sick_share * fte) / nullif(sum(fte), 0), 0) total_sick_share,
       sum(case when sick_share >= 0.12 then 1 else 0 end) long_term_count,
       count(*) headcount,
       coalesce(sum(fte), 0) total_fte,
       avg(case when employment_type = 'tillsvidare' then 1.0 else 0 end) tillsvidare_share,
       avg(years_employed) avg_years_employed,
       avg(case when years_employed < 1 then 1.0 else 0 end) new_share
     from staff`,
  )!;
  return r;
}

export interface HrMonth {
  month: string;
  sick_short_rate: number;
  sick_long_rate: number;
}

export function getHrMonthly(): HrMonth[] {
  return all<HrMonth>(
    `select month, sick_short_rate, sick_long_rate from hr_monthly order by month`,
  );
}

export interface SickByArbetslag {
  arbetslag: string;
  headcount: number;
  fte: number;
  sick_share: number; // fte-viktad sjukfrånvaro
}

export function getSickByArbetslag(): SickByArbetslag[] {
  return all<SickByArbetslag>(
    `select arbetslag,
       count(*) headcount,
       coalesce(sum(fte), 0) fte,
       coalesce(sum(sick_share * fte) / nullif(sum(fte), 0), 0) sick_share
     from staff
     where arbetslag is not null
     group by arbetslag
     order by sick_share desc`,
  );
}

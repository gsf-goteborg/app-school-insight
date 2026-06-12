# Vision-progress

## ⛔ LOOP STOPPED (user said "stop" 2026-06-12 after 7 iterations + idle-QA) — do not self-schedule.
## A stray ScheduleWakeup may still fire: HALT immediately, do not reschedule, do not build.
## Only resume if the user explicitly types `/loop …` again.

**✅ ALL 8 COMMITS PUSHED & DEPLOYED 2026-06-12** (7 loop-iterations + review-fix pass) after the
user's review. Live for the test group. Open: "Till testgruppen"-notis (awaits feedback channel),
joblib-authorization decision, testgroup round 2.

## 🔁 HANDOFF — current state (read this first)

**🚀 SHIPPED & LIVE:** Deployed to GitHub Pages at **https://gsf-goteborg.github.io/app-school-insight/**
(repo `gsf-goteborg/app-school-insight`, **public**, SSH remote). Deploy is automatic: any
`commit → push origin main` re-runs `.github/workflows/deploy.yml` (npm ci → seed → build → deploy,
~3 min). Pages source = "GitHub Actions". Build basePath is set by the workflow to `/app-school-insight`.
Status when last left: **green, site verified working** by the user. Ready for the first test group.

**Status:** ✅ **PUSHED & DEPLOYED** (2026-06-11, after the user's local review) — the multi-school/
utbildningschef + actionability iteration is live. Schools renamed at review: **Framtidsskolan
liten/mellan/stor** (ids ALV/FRA/BJO unchanged).

**Testgroup feedback (first round, 2026-06-11):** positive overall; wants more överskådlighet, less
överflödighet. Skolledare quote (now a design principle): *"Jag vill inte ha mer data – jag vill veta
vad jag ska göra och varför det ser ut som det gör."* → answered by "Veckans fokus" + caps + disclosures.

**SHIPPED IN THE LOCAL ITERATION (multi-school + utbildningschef + actionability):**
- **Schema rework:** physical tables renamed `*_all` with `school_id` (default 'FRA') + a `schools`
  table; **views named as the old tables scope to Framtidsskolan** → the entire existing query layer
  (18 modules) and all pages stayed untouched and FRA-scoped. Huvudman level reads `_all` tables via
  `queries-huvudman.ts` only. Seed inserts into `_all` names (FRA rows rely on the column default).
- **Seed: 3 schools** (`SCHOOLS` in constants — FRA 400, ALV "Älvkantens skola" 200 (stark men
  småskole-ekonomi i obalans), BJO "Björkhöjdsskolan" 800 (pressad: frånvaro 6,0 %, trygghet 3,1,
  sjukfrånvaro 9,1 %, vikariekostnader)). New-school block runs AFTER all FRA generation with own RNG
  per school → **FRA byte-identical, verified** (merit 251,4 / utredningsskuld 136 / tidig signal 213).
  Non-FRA: full assessments + 4-läsår history + term-attendance (no dailies), wellbeing, staff,
  economy/HR per school. BJO doubles as the planned stor-skola scale test.
- **Utbildningschef role + huvudmannavy:** role sees ONLY "Mina skolor" (`/huvudman`) + skolkort
  (`/huvudman/[schoolId]`, SSG for FRA/ALV/BJO). Per school: fokuspunkter (vad+nästa steg i rektors-
  dialogen, derived from worst indicators), KPI table, frånvaro/merit per termin över fyra läsår,
  per-årskurs aggregat. Direct indicators only (not the schools' internal models). Dataminimering
  enforced via role gating — utbildningschef gets "Behörighet saknas" on all student-level views (verified).
- **Actionability (the quote):** `/ledning` opens with **"Veckans fokus"** — 3 prioriterade åtgärder
  med VAD/DÄRFÖR/NÄSTA STEG (`getVeckansFokus()` i queries-ledning, severity-scored candidates).
  **Worklist caps:** /prioritera + /tidig-upptackt show topp 25 (ranked) + "Visa alla N"; matrix
  corner lists cap at 10. **`Disclosure` primitive** (details/summary, no JS) — model explanations on
  tidig-upptackt/behorighet/prioritera are now collapsed by default (transparency one click away).
- Verified: tsc+eslint clean, `next build` green (+/huvudman +3 skolkort), preview-tested (role
  gating, fokus cards, caps 25/112, collapsed disclosures, FRA start page identical), 0 console errors.

## 🎯 VIKTIGAST KVAR MOT VISIONEN (gap-analys 2026-06-12, viktigast först)

Fresh gap analysis of `docs/vision.md` vs the live app. The app is now strong on success measures
1–2 (understanding + early identification: fem linser, fyra läsårs historik, resultatmatris,
huvudmannanivå). The remaining gaps cluster around measures **3–5** (allocation, outcomes, potential)
and the **teacher persona**. Prioritized order below — implement top-down unless testgroup feedback
reorders. *Analysis only — nothing below is built.*

1. ~~**Från insikt till handling: åtgärdsloop per prioriterad elev**~~ ✅ _done, loop-iter 1 (2026-06-12,
   committed locally)_ — see changelog. (vision: "Actionable Insights",
   success measures 3+4; skolledare-criterion "whether interventions are producing measurable results").
   THE systemic gap: the app identifies and suggests, but **acting leaves no trace**. A demo-store
   workflow (like insatser/kommentarer, localStorage): per flaggad/prioriterad elev record status,
   ansvarig and nästa steg — for frånvaro along the escalation process (registrerad → vårdnadshavare
   kontaktad → kartläggning → elevhälsa → fördjupad utredning/samverkan). Then /prioritera shows
   "hanteras / ej påbörjad", and /ledning can answer the killer question "har varje prioriterad elev
   en pågående åtgärd?" (today only insatser have uppföljning). Absorbs old follow-up #6. NOTE: the
   "frånvarotrappa med procentnivåer" framing remains REJECTED (Skolverket promotes systematiskt
   närvaroarbete, not fixed tiers) — the process steps are a workflow, never displayed as nivåer.
   This single feature converts the identification machinery into outcomes — highest leverage left.

2. ~~**Lärarens ingång: "Mina klasser"**~~ ✅ _done, loop-iter 2 (2026-06-12, committed locally)_ —
   see changelog. (vision: the entire "For Teachers" success section — the least
   served of the four personas; elevhälsa has /prioritera+/tidig, skolledare /ledning, utbildningschef
   /huvudman, läraren has only generic views). Mentor identity exists in data
   (`classes.mentor_staff_id`). Demo shape: lärare role gets a mentor-scoped landing ("Mina klasser":
   own classes' elevlista, who needs support/challenge, frånvaro grid, what changed since last week)
   instead of whole-school views. Also closes the remaining scale-pass items (lärare defaults to own
   classes; scope picker stadium/arbetslag on the worklists for the big-school case).

3. ~~**Tidigast möjliga upptäckt i basfärdigheter: milstolpevy + garanti-inramning**~~ ✅ _done,
   loop-iter 3 (2026-06-12, committed locally)_ — see changelog. (vision: "Early
   Identification" at maximum leverage + the user's stated deepest priority — läsa/skriva/räkna rätt
   från början, matematikens kumulativitet). Merge of old follow-ups #7+#8:
   - **Milstolpar/grindar för matematik**: flag MISSED critical gates rather than average level —
     taluppfattning (åk 1–3), automatiserade tabeller (åk 3–4), bråk/rationella tal (åk 4–6, strongest
     research predictor for algebra), pre-algebra (åk 6–7). Same datapoints read smarter, zero new
     assessments (a student can look "i linje" on average while missing a gate that breaks them two
     years later). Reading equivalent: avkodningsfönstret åk 1–2 — respond with intensity, don't add
     measurement.
   - **Rama in LSR-ytorna som stöd för läsa-skriva-räkna-garantin** (skollagen 3 kap): garantin
     mandates exactly what the app does (kartläggning → tidig upptäckt → insats direkt → uppföljning →
     överlämning). Use that language on start-kortet, Analys and årskurs 1–4. Honors the "No New
     Reporting Burden" principle added to vision.md 2026-06.

4. ~~**Frånvaroprognos — migration fas B**~~ ✅ _done som PLAN B, loop-iter 4 (2026-06-12, committed
   locally)_ — see changelog. ⚠️ Joblib-spåret är BLOCKERAT tills användaren uttryckligen godkänner
   pickle-avserialisering från syskonrepot (säkerhetsklassificeraren stoppade det, korrekt — pickle
   kör godtycklig kod). UX:en är byggd; modellerna kan bytas in senare. (Original: vision: "Early Identification";
   surveyed 2026-06-10: ~500 students/8 schools, trained joblib models daily+chronic+lesson, SHAP
   top-5, Vklass lesson data, Skola24 schedules; FastAPI is thin — all scoring is batch). **Fas B** =
   Frånvaroprognos view via a Python scoring step in the build (features.py on our attendance →
   predictions + SHAP into baked SQLite; behörighetsprognos-style UX with disclosure; SHAP waterfall
   on elev page; retrain on our data in-build if calibration matters — labels like "Låg 29 %" must be
   calibrated or expressed as expected days). **Fas C** (later) = port class_schedules + lesson-level
   attendance into the seed → schema-risk view (note F–9 vs our åk 1–10 mapping). Their Recharts
   frontend is NOT ported. Ranked below 1–3 because prediction adds marginal *earliness* on top of
   five existing lenses, while 1–3 convert existing identification into action.

5. ~~**Resurssimulering — "vad händer om"**~~ ✅ _done, loop-iter 5 (2026-06-12, committed locally)_ —
   see changelog. (vision: success measure 3 "more effective allocation of
   resources and support"; skolledare-criterion "how resources and staffing align with needs").
   Behov↔resurser is descriptive today; the decision it should support is t.ex. "flytta 0,5
   speciallärartjänst från mellan- till högstadiet" or "vad kostar att täcka åk 10:s saknade
   spec-resurs". A light client-side simulering (sliders over FTE per arbetslag → recomputed
   flaggade-per-spec.tjänst + elevpeng-konsekvens) = spec §19's "simuleringsläge", scoped small.

6. ~~**Trygghet över tid**~~ ✅ _done, loop-iter 6 (2026-06-12, committed locally)_ — see changelog.
   (Original: vision: "Trends in … wellbeing"): wellbeing är det ENDA måttet utan
   longitudinell linje (2 terminer; allt annat har 8). Small seed addition (wellbeing history per
   termin, samma backward-walk-mönster) + trygghet line in befintliga över-tid-sektioner (elev,
   ledning, skolkort). Cheap, completes the longitudinal story.

7. **Smått / medvetna beslut:** _mostly done, loop-iter 7 (2026-06-12)_
   - ⏳ "Till testgruppen"-notis på startsidan — ENDA ÖPPNA PUNKTEN, blocked on the user's choice of
     feedback channel (e-post? Forms?).
   - ~~Flerårig frånvarotrend som extra /prioritera-lins~~ ✅ lens 6 "Växande frånvaro" (see changelog).
   - ~~Vårdnadshavar-/elevperspektivet~~ ✅ conscious scope decision documented in README Avgränsningar.

**GAP-LISTAN ÄR DÄRMED UTTÖMD** (utom testgruppsnotisen, blocked on user input). Loop idles awaiting
testgroup round 2 / user direction. **SJU lokala commits väntar på granskning + push.**

**App:** Skolinsikt, a Swedish school-data demo (Next.js 16 / React 19 / Tailwind v4 / ECharts,
SQLite baked at build time → static site). Fictional Göteborg grundskola **Framtidsskolan**, åk 1–10,
20 klasser, 400 elever. Fixed demo "today" = **2026-05-15**. All copy Swedish; demodata only.
**Grade model:** förskoleklass = åk 1, so betyg **åk 7–10** and leaving/exam year = **åk 10**.

**Latest views (post-original-backlog, all shipped + live):** `/behorighet` (Behörighetsprognos —
illustrative logistic model, åk 4–10, Risk 0–3, `queries-behorighet.ts`); Utredningsskuld
(`getUtredningsskuld` in `queries-summary.ts`, on start + Analys); Utveckling & potential
(`queries-development.ts` — tappar mark / stretch / positiv, on start + Analys); **`/prioritera`**
(cross-lens consolidation, `queries-priority.ts`) and **`/ledning`** (skolledare control view,
`queries-ledning.ts`) — see changelog "testgroup feedback iteration". `next build` = **451 pages**.

**Conventions:** RSC pages read via the repository layer (`lib/db/queries*.ts`, `all`/`one`, every
module `import "server-only"`). UI in `components/ui/primitives.tsx` (Card, PageHeader, Section, Stat,
Pill, Highlight, Note) + `components/charts.tsx`. Student names anonymised to `name1`…`name460`.
**Stadium grouping (custom boundaries):** Lågstadium åk 1–4, Mellanstadium 5–7, Högstadium 8–10 —
single source `STADIA`/`stadiumForGrade` in `lib/constants.ts`; stored in `classes.arbetslag` /
`staff.arbetslag`; elevpeng has 3 tiers.

**Built this session (all shipped + verified, `next build` green = 448 pages):**
- `/tidig-upptackt` early-warning view (`queries-risk.ts`, filterable `early-warning-list.tsx`)
- Intervention effect (`queries-effect.ts`), wellbeing (`queries-wellbeing.ts` + `wellbeing_surveys`
  table), need↔resource (`queries-alignment.ts`), insight cards (`queries-insights.ts` +
  `components/ui/insight-cards.tsx`), term trends (`queries-trend.ts`)
- **Årskurser/Klasser rebuilt as comparison views** (`queries-overview.ts` + `components/overview-table.tsx`)
- New schema since first build: `wellbeing_surveys`, `funding_parameters`, `hr_monthly`, students
  support flags (`extra_anpassning`/`atgardsprogram`/`utredning_pagaende`), `classes.socioeconomic_index`,
  staff HR fields (`sick_share`/`employment_type`/`years_employed`)
- **Visual redesign:** warm ink chrome (not navy), greige surfaces, orange/green accents, boxed
  highlighted figures, per-page fade-in (`globals.css`, `app-shell.tsx`, `primitives.tsx`)

**Workflow gotchas:** dev server holds a write lock on `data/skolinsikt.db` → **stop the preview
server before `npm run seed`, then restart** (preview_stop → seed → preview_start). Seed uses two RNG
streams (curated scenarios untouched by demographic fields). Verify with `npx tsc --noEmit`,
`npx eslint <files>`, and `npm run build`.

**Loop status:** STOPPED. The ORIGINAL backlog (below) is fulfilled; the current prioritized gap
analysis against `docs/vision.md` lives in the "🎯 VIKTIGAST KVAR MOT VISIONEN" section above —
that list (not this old note) is the source of truth for what to build next.

---

Living backlog + changelog for fulfilling `docs/vision.md`. Each `/loop` iteration:
read `vision.md` + this file, pick the highest-leverage open item, implement & verify it,
then update the changelog. Priority follows the North Star: *does this help educators make
better decisions that improve student outcomes?* — weighted toward **early identification**,
**actionable/explainable** insight, and **student-centric** value.

## Backlog (prioritized)

1. ~~**Tidig upptäckt – early-warning risk view**~~ ✅ _done, iter 1_
   New view `/tidig-upptackt` (`lib/db/queries-risk.ts` + `app/tidig-upptackt/page.tsx`, nav in
   `lib/roles.ts`). Explainable per-student risk model combining absence (high/rising), knowledge
   (core F/streck, åk1–6 levels), national-test deviation and support-gap into a score → Hög/
   Förhöjd/Bevaka, each with visible reason-chips and a suggested next step. Tuned to stay focused
   (179 flagged / 9 Hög / 84 Förhöjd; list shows the 93 actionable, Bevaka only counted).

2. ~~**Intervention effectiveness / outcome tracking**~~ ✅ _done, iter 2_
   `lib/db/queries-effect.ts` + "Uppmätt effekt" section on `app/insatser/[id]/page.tsx`. Each insats
   is tied to the metric it targets (LSR level / omdöme / betyg / närvarograd), framed so higher =
   better, and shown before→after with a delta and a comparison bar. Honest: åk 8 närvaroteam shows
   −9 p.e. ("intensifiera"), the åk 2 läsintervention +65 p.e. Carries a "not proven causation" caveat.

3. ~~**Wellbeing / trivsel signal**~~ ✅ _done, iter 3_
   Added `wellbeing_surveys` (trivsel/trygghet/arbetsro, 1–4, HT+VT) to schema+seed with an åk 8 VT
   dip tied to the absence scenario. New `lib/db/queries-wellbeing.ts`; folded a low-trygghet/trivsel
   signal into the Tidig upptäckt risk model (now also catches åk 8 — Hög 9→18) and added a "Trivsel
   och trygghet" section + narrative paragraph on the student page.

4. ~~**Need ↔ resource alignment**~~ ✅ _done, iter 4_
   `lib/db/queries-alignment.ts` + "Behov och resurser per arbetslag" section on Personalplanering.
   Per arbetslag: flagged/hög + stödbehov + snitt trygghet (need) vs teacher/special FTE (resource),
   with flaggade-per-speciallärartjänst as the mismatch metric, a horizontal bar, and an actionable
   note (åk 1–3 highest pressure; åk 10 has no own special-ed resource).

5. ~~**"Vad / Varför / Vad göra" explainability**~~ ✅ _done, iter 5_
   `lib/db/queries-insights.ts` (`getGradeInsights`) + rebuilt the årskurs page's "Styrkor och
   riskområden" into "Analys och nästa steg": each risk is now a card with what / möjlig förklaring /
   nästa steg, drawing on absence pattern, trygghet, LSR/omdöme/betyg and åk 9 prov-vs-betyg. Connects
   signals (åk 8: rising absence + low trygghet) into coherent action.

6. ~~**Trust pass**~~ ✅ _done, iter 6_
   Exposed the risk model's rules as single-source metadata (`RISK_SIGNALS`, `RISK_LEVELS`,
   `RISK_MIN_FLAG` in `queries-risk.ts`) and added a "Så beräknas signalerna" disclosure on Tidig
   upptäckt (signals+thresholds+points, level cutoffs, no-single-verdict caveat). Each row already
   shows its underlying figures and links to the elev's full data. Cleaned a dead variable too.

7. ~~**Wellbeing/risk at school + class level**~~ ✅ _done, iter 7_
   `getClassWellbeing` + start-page school KPI strip (närvarograd, elever med tidig signal → Tidig
   upptäckt, snitt trygghet, meritvärde) and class-page snitt-trygghet KPI + per-elev Trygghet column
   (low flagged, folded into "Att följa upp"). New signals now read at school → årskurs → klass → elev.

8. ~~**Class-level "next step" insights**~~ ✅ _done, iter 8_
   Added `getClassInsights` (class-scoped absence/trygghet/LSR/omdöme/betyg) and extracted a shared
   `components/ui/insight-cards.tsx`; both årskurs and klass now render the same what/why/next cards.
   8A shows absence +5,1 % and trygghet 2,1/4 as actionable cards.

9. ~~**Wellbeing in the correlation/Analys view**~~ ✅ _done, iter 9_
   `getAbsenceByTrygghet` + "Samband: trygghet och frånvaro" section on the Analys page — snittfrånvaro
   per trygghetsnivå (1/4 ≈ 7,5 % → 4/4 ≈ 4,1 %) with an interpretive caption, visually grounding why
   low trygghet is an early signal. Carries the "mönster, inte orsak" caveat.

10. ~~**Filterable triage worklist on Tidig upptäckt**~~ ✅ _done, iter 10_
   Tagged each flagged student with concern `categories` (Frånvaro/Kunskap/Trivsel/Stöd) and made the
   ranked list an interactive client component (`components/early-warning-list.tsx`) with category +
   årskurs filters and live counts. Turns the list into a working triage tool for elevhälsa.

11. ~~**Production build / QA verification**~~ ✅ _done, iter 11_
    `next build` passes clean — 448 static pages generate (400 elever, 20 klasser, 10 årskurs,
    insatser, + /tidig-upptackt). The whole app with all 10 feature iterations is production-shippable.

12. ~~**Export / printable summary**~~ ✅ _done, iter 12_
    `@media print` styling in globals.css (hides nav/chrome, avoids card page-breaks) + a `PrintButton`
    ("Skriv ut sammanfattning") on the start page and a print-only dateline. Browser print-to-PDF
    turns the school-summary start page into an exportable report (spec §7).
13. ~~**Trend-over-time (HT → VT)**~~ ✅ _done, iter 13_
    `lib/db/queries-trend.ts` (`getSchoolTermTrends`) + "Utveckling under läsåret" section on the
    Analys page — terminsjämförelse of LSR, omdömen, meritvärde, trygghet, närvarograd with signed
    deltas. Honest mixed picture (LSR +6,0 p.e., merit +1,4; trygghet −0,1, närvaro −0,6 p.e.).

14. ~~**Re-verification after manual changes**~~ ✅ _done, iter 14_
    After the (user-driven) Framtidsskolan rename, the stadium regrouping (Lågstadium 1–4 /
    Mellanstadium 5–7 / Högstadium 8–10, 3-tier elevpeng), the highlighted-figure narrative (`.tsx`
    + `Highlight` primitive) and the LSR summary card, re-ran `next build` → clean, 448 pages.

> The backlog is complete and the vision is fulfilled. Remaining ideas are low-value polish; the
> loop should only continue if the user has a specific new direction. Candidate polish if asked:
> printable variants per role, an elevhälsa case-note workflow, or richer per-subject trends.

## Changelog

- _review feedback pass_ ✅ (2026-06-12, user's granskning of the 7 loop commits):
  - **"Linser" → "underlag"** in ALL user-facing copy (user: begreppet är inte vedertaget i skolvärlden) —
    prioritera page/stats/filters/pills ("Flaggas i flera underlag"), ledning cards + Veckans fokus,
    ActionCoverage, milestones, behörighet/elev/matrix descriptions. Code-internal names (LensKey etc.)
    unchanged. NOTE: substring checks for "lins" false-positive on "Sko**lins**ikt".
  - **Ledningsöversikt tightened** (the quote, again): 6 sections → 4. Åtgärdstäckning folded into
    Veckans fokus; "Att agera på" (7 cards) collapsed into a Disclosure "Hela åtgärdskön";
    insatsuppföljning = ONE card (overdue list + "N kommande, närmast {datum}"-rad); "Utveckling över
    tid" (4 charts + HT→VT-strip) replaced by **"Riktning över fyra läsår"** — 4 klartext-deltas with
    tone + charts behind Disclosure "Visa kurvorna"; HT→VT-strip dropped (getSchoolTermTrends no longer
    used on ledning).
  - ⚠️ **Honesty fix found during the pass:** merit in the riktningsrad showed "−26,8 sedan HT 2022" —
    a COHORT-COMPOSITION ARTIFACT (HT2022 has betyg for only 40 elever vs 160 now). Merit deliberately
    EXCLUDED from the riktningsrad (comment in code); lives only in the curves where the kullskifte-
    caveat stands. Riktningsraden = omdömen/LSR/frånvaro/trygghet (stable population definitions).
  - Verified live (4 sections, 2 disclosures, honest riktning), tsc+eslint clean, build green.
    **Committed locally, NOT pushed** (user still reviewing).
- _loop-iter 7_ ✅ (2026-06-12): **gap-list #7 (smått)** — (a) **lens 6 "Växande frånvaro"** i
  /prioritera: `getGrowingAbsence()` i queries-history (regressionslutning ≥ +0,8 p.e./termin över ≥5
  terminer ur TERM_ABSENCE_SQL OCH ≥ 8 % nu → 20 elever; multi-lens 112→116, utan-stödprocess 89→92);
  LENS_META + filter chip + "sex linser" i sidtexten. (b) **Vårdnadshavarbeslutet** dokumenterat i
  README Avgränsningar (medvetet utanför demo-scope, eget spår vid skarp lösning). (c)
  Testgruppsnotisen kvarstår — blocked on user's feedback channel. Verified live (chip 20, inga
  konsolfel), tsc+eslint clean, build green. **Committed locally, NOT pushed.** Gap-listan uttömd →
  loop idles.
- _loop-iter 6_ ✅ (2026-06-12): **trygghet över tid** (gap-list #6) — wellbeing was the only measure
  without a longitudinal line. Seed: FRA wellbeing history for 6 terms via NEW stream `rng5`
  (66663333) — current-year survey incl. åk 8-dippen byte-identical (verified: VT2026 3,20, åk 8 2,15,
  merit 251,4; history flat ~3,3 = dip is a this-year phenomenon, by design); non-FRA schools'
  wellbeing moved INTO their allTerms loop (ALV/BJO reshuffled — fine, not yet public). ⚠️ Real bug
  found & fixed: `getStudentWellbeing` picked "previous" as first non-current row → would have been
  HT2022 with history; now explicitly HT2025. New `getStudentWellbeingHistory()`. Surfaces: **elev**
  Trivsel-section's HT/VT-BarChart replaced with a per-termin LineChart (3 dimensioner, 8 terminer);
  **/ledning** 4th chart "Snitt trygghet" (grid 2×2); **skolkort** 3rd chart (trygghet per termin,
  `trygghet` added to getSchoolTermSeriesAll + avgTrygghet to getSchoolTermSeries). Verified live
  (elev line, ledning 4 charts), tsc+eslint clean, build green, 0 console errors.
  **Committed locally, NOT pushed.**
- _loop-iter 5_ ✅ (2026-06-12): **resurssimulering "vad händer om"** (gap-list #5, spec §19
  simuleringsläge scoped small). `components/resource-sim.tsx` (client, ändrar/sparar inget) on
  **Personalplanering** after behov↔resurser: sliders för speciallärar-FTE per stadium (0–4, steg
  0,25) → live flaggade/tjänst per stadium, total-FTE-delta med kostnad (antagande 760 tkr/år per
  tjänst, redovisat), spridningsmått, "Fördela efter behov"-knapp (proportionellt mot flaggade,
  samma totala FTE) + Återställ. Demo proof: behovsfördelning med oförändrad bemanning tar
  spridningen 49 → 4 (82/40/33 → 52/48/50 flaggade/tjänst). Ärlighetsnot: statisk belastningsmodell,
  inte elevutfall. Verified live (sliders, knappar, pills), tsc+eslint clean, build green,
  0 console errors. **Committed locally, NOT pushed.**
- _loop-iter 4_ ✅ (2026-06-12): **frånvaroprognos** (gap-list #4, shipped as PLAN B — transparent
  additiv modell i stället för joblib-migrering; security classifier blocked pickle-deserialization
  from the sibling repo, rightly — needs explicit user authorization, UX is model-swappable later).
  `lib/db/queries-prognos.ts`: per elev (FRA) **förväntade frånvarodagar nästa vecka** (0–5; additivt:
  bas = rullande 4-veckorsandel + veckodagsmönster ×0,5 + trend ×0,6 + pågående frånvaro +15 p.e. på
  måndag + låg trygghet) och **kronisk risk** (logistisk, exponerade vikter: nivå ×16, trend ×8,
  flerårsdrift ×20 från terminshistoriken, ogiltig-andel, trygghet; Hög ≥50 %, Förhöjd ≥25 %).
  Kalibreringsbeslutet från mockup-diskussionen inbyggt: visar DAGAR, inte rå procent. Exakta
  faktorbidrag (additiv modell → ingen SHAP-approximation behövs). Ytor: **Tidig upptäckt** topplista
  "kommande vecka" (topp 10 + summary-pills 39 Hög/16 ≥1,5 dagar + Disclosure med alla vikter);
  **elevsidan** prognoskort i Närvaro-sektionen (dagar + kronisk pill + faktorstaplar). Verified live
  (S8B18: 37 % → 2,6 av 5 dagar, kronisk 99 %, 5 faktorstaplar), tsc+eslint clean, build green,
  0 console errors. **Committed locally, NOT pushed.**
- _loop-iter 3_ ✅ (2026-06-12): **milstolpar i basfärdigheter + garanti-inramning** (gap-list #3).
  `lib/db/queries-milestones.ts`: 5 gates (avkodning åk 2 / taluppfattning åk 3 / räknefärdighet åk 4 /
  bråk åk 6 / pre-algebra åk 7) read from EXISTING measurements at VT of the year the student was in
  the gate's årskurs (4-läsår history; older → "okänd"; in gate's årskurs now + stort behov → "riskzon").
  No new assessments (No New Reporting Burden). `components/milestones.tsx` on **Analys**: per-gate
  klarad/missad/riskzon bars (demo: bråk-grinden worst, 59 % klarade — consistent with matte-scenariot),
  worklist cap 12 sorted "utan stödprocess + flest missade först" (140 missad-utan-stödprocess pill),
  "Så avläses grindarna"-Disclosure + garanti-Note. **Start-page LSR card** got the garanti framing
  (skollagen 3 kap, tidig upptäckt → insats → uppföljning → överlämning + pointer to Analys).
  ⚠️ Verify-gotcha: /analys looked empty in preview because the browser profile still had role=Lärare
  from iter 2 (gating working as intended) — switch role before checking. tsc+eslint clean, build
  green, 0 console errors. **Committed locally, NOT pushed.**
- _loop-iter 2_ ✅ (2026-06-12): **lärarens "Mina klasser"** (gap-list #2) — the teacher persona's own
  entry point. New view `/mina-klasser` (nav for larare+forstelarare, view key "mina", placed right
  after start). RSC bakes a compact payload for ALL 20 classes (`getClassOverview` + flagged from
  `getEarlyWarnings` + stretch/tappar from `getDevelopment`); client `components/my-classes.tsx`
  filters to the teacher's own selection — class picker chips persisted in localStorage
  (`skolinsikt-mina-klasser`, default ["8A"], useSyncExternalStore pattern like role-provider). Per
  class: attention pill + närvaro/trygghet/mentor, "Att prata med den här veckan" (flagged students
  w/ risk level + **ActionStatusPill from loop-iter 1** + suggested action, links to elev), and a
  compact "Kan utmanas mer / Tappar mark" name row. Demo note explains tjänstefördelning would drive
  this in production. Verified live: default 8A (6 flagged), toggle 2B (11 flagged incl. Hög-elev),
  selection survives reload, nav shows for Lärare; tsc+eslint clean, build green, 0 console errors.
  **Committed locally, NOT pushed.** NOTE: scope-picker remainder from the scale pass is largely
  superseded for teachers by this view (they now have a natural narrow default).
- _loop-iter 1_ ✅ (2026-06-12): **åtgärdsloop per prioriterad elev** (gap-list #1) — closes the
  identify→act loop. Demo-store extended with `actions: StudentAction[]` (student_id, step, ansvarig,
  updated; upsert via `setAction`/`removeAction`, cleared by Återställ demodata). Process steps in
  `lib/constants.ts` (`ATGARD_STEPS`: kontakt → kartläggning → elevhälsa → utredning → avslutad — a
  WORKFLOW, never displayed as nivåer per the rejected-trappa decision). New
  `components/student-action.tsx`: `ActionStatusPill` ("Åtgärd ej påbörjad" / step), `ActionEditor`
  (select + ansvarig, Spara/Ta bort), `StudentActionPanel` (elev page section "Pågående åtgärd"),
  `ActionCoverage` (ledning section "Åtgärdstäckning": "X av 112 prioriterade elever har en påbörjad
  åtgärd" + bar). /prioritera cards got status pill + editor + new filter chip "Utan påbörjad åtgärd".
  Verified end-to-end in preview: starta åtgärd på /prioritera (S8B16, Kartläggning/Kurator) → syns på
  elevsidan + räknas på /ledning (1 av 112) → filter exkluderar (112→111) → Återställ demodata rensar
  (1→0; ⚠️ reset uses window.confirm — stub it in automated tests). tsc+eslint clean, build green,
  0 console errors. **Committed locally, NOT pushed.**

- _iter 1_ ✅: gap analysis written; shipped the **Tidig upptäckt** early-warning view (explainable
  per-student risk model + ranked, actionable list + per-årskurs concentration chart). tsc clean,
  no console errors, verified in preview.
- _iter 2_ ✅: shipped **intervention effectiveness** — per-insats measured before→after tied to its
  target metric, with honest deltas (åk8 närvaro −9 p.e., åk2 läsning +65 p.e.) and a causation caveat.
  tsc clean, no console errors, verified in preview.
- _iter 3_ ✅: shipped **wellbeing/trivsel** — `wellbeing_surveys` seed+schema (åk 8 VT dip),
  `queries-wellbeing.ts`, a low-trygghet signal in the risk model, and a trivsel section + narrative
  on the student page. tsc clean, no console errors, verified (åk 8 trygghet 3,7→2,3 in preview).
- _iter 4_ ✅: shipped **need↔resource alignment** — per-arbetslag need (flagged/hög/stödbehov/trygghet)
  vs resources (teacher/special FTE) with flaggade-per-speciallärartjänst, bar + actionable note on
  Personalplanering. tsc clean, no console errors, verified (åk 1–3 ≈ 62 flaggade/spec.tjänst).
- _iter 5_ ✅: shipped **explainability** — årskurs "Analys och nästa steg" cards (what / why / next
  step) from `getGradeInsights`. Connects absence + trygghet into coherent action. lint+tsc clean,
  no console errors, verified on åk 8 in preview.
- _iter 6_ ✅: shipped **trust pass** — model rules exposed as metadata + "Så beräknas signalerna"
  disclosure on Tidig upptäckt (granskningsbar thresholds/points/cutoffs). tsc+lint clean, verified.
- _iter 7_ ✅: surfaced **wellbeing + risk at school & class altitude** — start-page KPI strip (incl.
  flagged→Tidig upptäckt + snitt trygghet) and class-page trygghet KPI + per-elev Trygghet column.
  tsc+lint clean, no console errors, verified (8A trygghet 2,1/4).
- _iter 8_ ✅: shipped **class-level insights** — `getClassInsights` + shared `InsightCards`
  component; årskurs & klass both render what/why/next. tsc+lint clean, verified (8A cards).
- _iter 9_ ✅: shipped **wellbeing in the Analys view** — snittfrånvaro per trygghetsnivå bar +
  caption (trygghet 1/4 ≈ 7,5 % vs 4/4 ≈ 4,1 % frånvaro). tsc+lint clean, verified in preview.
- _iter 10_ ✅: shipped **filterable triage worklist** — concern categories + interactive filters on
  Tidig upptäckt (Trivsel→26, Stöd→68, by årskurs). tsc+lint clean, no console errors, verified.
- _iter 11_ ✅: **production build verified** — `next build` clean, 448 static pages generate. Demo is
  shippable. Restarted dev server.
- _iter 12_ ✅: shipped **printable/exportable summary** — print CSS + PrintButton on the start page.
  tsc+lint clean, no console errors, verified (button renders, print-only dateline gated).
- _iter 13_ ✅: shipped **term-trend view** — "Utveckling under läsåret (HT → VT)" on the Analys page.
  tsc+lint clean, no console errors, verified.
- _iter 13_ ✅ (backlog complete at this point).
- _post-loop manual edits_: Framtidsskolan rename; stadium regrouping 1–4/5–7/8–10 + 3-tier elevpeng;
  highlighted color-coded figures on the start-page cards + LSR moved to a leading card.
- _iter 14_ ✅: **re-verified** the above with `next build` (clean, 448 pages). Vision fulfilled;
  no open high-value work.
- _manual edit_: start-page highlighted figures restyled as small tinted square boxes (`Highlight`).
- _manual edits_: Årskurser/Klasser rebuilt as comparison views (`queries-overview.ts` +
  `overview-table.tsx`, toned metrics + "needs attention" status); start-page boxed highlights;
  full **visual redesign** (warm ink chrome instead of navy, greige surfaces, orange/green accents,
  softer depth, per-page fade-in) via the theme layer.
- _iter (resume)_ ✅: re-verified everything with `next build` (clean, 448 pages) and spot-checked the
  new theme across start / årskurs / tidig-upptäckt / elev — cohesive, no console errors.

> Vision fulfilled; recent work has been UX/visual polish at the user's direction.

- _iter (resume)_ ✅: **responsive mobile navigation** — `app-shell.tsx` sidebar was `hidden md:flex`
  with no mobile fallback (no nav on phones). Added a header hamburger + slide-in drawer (same nav),
  with scroll-lock, Escape/overlay/link close, and aria-modal/aria-expanded. tsc+lint clean, verified
  end-to-end via DOM at 375px (drawer opens with 9 links, locks scroll, closes cleanly); desktop
  sidebar intact. (Screenshot tool was glitching at mobile viewport — app itself healthy, no console
  errors.)
- _iter (resume)_ ✅: **responsive data tables** — `.table-card` rule in `globals.css` (clips on
  desktop, `overflow-x:auto` + `min-width:620px` below 720px) applied to wide tables (klass elevlista,
  ekonomi kostnadsavvikelser + elevpeng, personal staffing/sjukfrånvaro/stadium-alignment). Wide
  tables scroll horizontally on phones instead of cramping; desktop unchanged. Verified at 375px
  (scrolls) and 1280px (clipped). tsc clean, no console errors.
- _testgroup-readiness pass_ ✅: hardened the app for the first test group.
  - **Lint now fully clean** (was 2 errors + 2 warnings): refactored `role-provider.tsx` and
    `demo-store.tsx` from the effect+setState localStorage-hydration pattern to **`useSyncExternalStore`**
    (SSR-safe, idiomatic React 19, no cascading-render warning); removed a dead `eslint-disable` in
    `lib/db/index.ts`; cleaned the unused-param / redundant-ternary in `lib/roles.ts` `CAN` (still unused
    but documents §7 intent).
  - **Date consistency:** `getStudentAttendanceTimeline` (`queries.ts`) hardcoded `'2026-05-15'` and
    `queries-trend.ts` redefined `DEMO_TODAY` locally — both now import `DEMO_TODAY` from `lib/constants.ts`.
  - **A11y:** Tidig upptäckt filter chips (`early-warning-list.tsx`) now carry `aria-pressed` +
    `type="button"` (toggle state announced to AT — matters for Göteborg Stad / EN 301 549).
  - **README** corrected: school name Älvstrandsskolan→Framtidsskolan, added Tidig upptäckt to Vyer,
    fixed the project-structure section (no server actions in the static export; client demo-store +
    localStorage explained), noted that print/PDF export exists.
  - **Full QA:** verified the demo-store lifecycle end-to-end (create insats → persists to localStorage →
    survives reload → Återställ demodata clears it), role gating (Lärare→`/ekonomi` shows "Behörighet
    saknas"; nav narrows per role), filters, and every major route (start, tidig-upptäckt, analys, elev,
    ekonomi, personal, årskurs/klass list+detail) on **both** the dev server **and the static `out/`
    export** that GitHub Pages ships. `next build` green (448 pages), tsc + eslint clean, zero console
    errors anywhere. No seed re-run needed (DEMO_TODAY value unchanged).
  - **Start-page card links fixed** (user-reported): the four knowledge/support summary cards (Läsa-
    skriva-räkna, Skriftliga omdömen, Betyg, Stödinsatser) now all link to `/analys` with a consistent
    "Till analys →" label. The Stödinsatser card previously linked to `/insatser` — wrong, since
    stödinsatser (anpassningar/åtgärdsprogram) is a data category, not the Insatser interventions
    feature. (Närvaro-kortet lämnades mot `/elev` – ej flaggat, drillar till per-elev-närvaro.)
  - _follow-up_: Närvaro-kortet flyttat till `/analys` också (på användarens begäran) – nu pekar alla
    fem kunskaps-/stödkort konsekvent till Analys; ekonomi/personal behåller sina egna mål.
- _utredningsskuld_ ✅ (user-requested): new metric surfacing the **gap between persistent learning
  difficulties and the formal support process**. `getUtredningsskuld()` (`queries-summary.ts`):
  students who lack a godtagbart omdöme (åk 2–6) or godkänt betyg A–E (åk 7–10) in ≥1 subject in
  **both** terms (HT+VT — "under två terminer", a chronic gap, not a one-term dip), cross-referenced
  with åtgärdsprogram (JA) / utredning_pagaende (UTREDNING) / neither (NEJ = the *utredningsskuld*).
  Demo: 134 persistent / 19 JA / 7 UTREDNING / **108 NEJ = 81 %**. Surfaced on **two pages**:
  (1) start-page **Stödinsatser** card — a tinted "Utredningsskuld" block under the existing stöd
  narrative (`utredningsskuldNarrative` in `summary-narrative.tsx`); (2) **Analys** — a dedicated
  "Utredningsskuld: ihållande svårigheter utan stödprocess" section with 4 stats, a JA/UTREDNING/NEJ
  proportion bar (aria-labelled), legend, and a toned note carrying the "bekräfta mot elevens hela
  bild" caveat. Mirrors the school's "Rapport – Utredning" worklist. tsc + eslint clean, `next build`
  green, verified live (start card 134/19/7/81 %, Analys section + bar render, 0 console errors).
- _grade-shift to åk 7–10_ ✅ (user-requested): the school numbers grades 1–10 (förskoleklass = åk 1),
  so betyg = old åk 6–9 → **åk 7–10** and the leaving/exam year = old åk 9 → **åk 10**. Applied
  consistently:
  - **Betyg range 7→10** everywhere: `getBehorighetRisk`, `getUtredningsskuld`, the merit term-trend
    (`queries-trend.ts`), the Betyg-card subtitle + analysstöd text (`page.tsx`), `betygNarrative`, and
    the Utredningsskuld section description (`analys`). Behörighet now spans 160 elever (åk 7–10).
  - **Leaving year 9→10**: start-page KPI "Snittmeritvärde åk 10" (`getAverageMerit(10)` = 251,4;
    var `merit9`→`meritLeaving`, narrative param `meritAk9`→`meritLeaving`), and the "nationella prov
    vs betyg" view moved to åk 10 (`queries-insights.ts`, `arskurs/[grade]/page.tsx`).
  - **Re-seed** (`scripts/seed.ts`): slutbetyg/`is_final` → åk 10; curated Scenario 3 (matematik
    prov < betyg) → åk 10 (gap nu 2,7 p. vid åk 10, 0,5 vid åk 9); tied insats "Kollegialt
    ämnesarbete i matematik" → åk 10. Re-seeded DB (stop dev → seed → restart).
  - Docs updated (README scenario 3, spec §scenario 3). tsc + eslint clean, verified live across start /
    arskurs 9 (no nat-prov) / arskurs 10 (nat-prov + insight) / analys; 0 console errors.
- _behörighetsprognos_ ✅ (user-requested, complementary to Tidig upptäckt): a second risk lens that
  estimates each elev's **sannolikhet för behörighet till yrkesprogram** (åk 4–10), bucketed Risk 0–3
  (0–40 / 40–80 / 80–90 / >90 %), mirroring the school's own Qlik "Utredning/Risk" report.
  - **Model** (`lib/db/queries-behorighet.ts`): illustrative LOGISTIC model with hand-set, exposed
    coefficients (no training data in a demo snapshot — labelled as such). Strongest factors: betyg/
    omdömen i sv/en/ma + närvaro; **tidsdiskontering** per årskurs (åk 10 = full vikt … åk 4 = 18 %) so
    weak results in lower grades weigh less (more time to recover). Slutåret (åk 10) uses the **faktiska**
    behörighetskraven (godkänt sv/en/ma + ≥8 ämnen). Demo spread: 9 / 47 / 90 / 134; Risk 3 concentrates
    in åk 8–10, zero in åk 4–7 (the time-discount working as intended).
  - **Decision:** keep the rule-based early-warning model as the all-grades, multi-dimensional triage;
    behörighetsprognos is a *separate, complementary* outcome lens (not a replacement, no cross-feed) —
    chosen via AskUserQuestion (both / illustrative coefficients / åk 4–10).
  - **Surfaced on 4 places:** new **`/behorighet`** view (nav entry, `behorighet-list.tsx` filterable by
    Risk-bucket + årskursband with aria-pressed, summary stats + proportion bar + per-årskurs riskzon
    chart + model disclosure); **elev** page section (probability + bucket + factors, + "uppfyller
    behörighetskraven" for åk 10); **klass** elevlista column (åk 4–10); **årskurs** callout (riskzon
    count + link). tsc + eslint clean, `next build` green (now 449 pages incl. /behorighet), verified
    live on all four surfaces; 0 real console errors (a transient duplicate-import HMR error was fixed).
- _tightening pass before testgroup push_ ✅ (user: "go through everything, don't flood users"):
  removed redundancy accumulated over the five iterations — **elev**: 3 frånvaro-sections (veckolinje +
  månadslinje + månadstabell + terminssection) merged into ONE "Närvaro och frånvaro" with två charts
  (månad + termin); **analys**: 25-elev tappar-mark list dropped (stats kept, pointer to resultatmatrisen
  which lists the actionable corners); **ledning**: "Fallande flerårstrend"-card dropped (redundant with
  /prioritera lens) → 7 action cards; **klass**: Frånvarotrend column dropped (month grid below shows it
  better); **prioritera**: 4th stat dropped (chip count duplicate) → 3 stats. README Vyer updated
  (+ledning/prioritera/behörighet + fyra-läsår note). Verified live + build green. **COMMITTED & PUSHED.**
- _matris som klickbar fyrfältare_ ✅ (user sketch: 4 boxes, dashed crosshair, dot = elev, hover =
  name only, click → elevsida): `GroupedScatter` rewritten with own ReactECharts instance —
  `linkPrefix` prop + point `id` → router.push on click (cursor pointer), tooltip = label only,
  markLine crosshair. X-axis recentered per scale on the midpoint between hög/låg-gränserna
  (`NIVA_BOUNDS` exported) so 0/0 splits the quadrants despite two scales. Verified live: click on
  orange dot → /elev/S7A11, hover shows name, build green, 0 console errors.
- _resultatmatris nivå × trend_ ✅ (user idea: PCA-categorize students into "låga på väg uppåt / låga
  står stilla / höga håller i / höga börjar tappa"; user shared R prcomp code):
  - **Decision: explicit axes instead of PCA** — with these features PC1≈nivå, PC2≈trend anyway, and
    explicit axes are explainable (Trust). Disclosed in the method note ("PCA-inspirerad").
  - `getResultMatrix()` in `queries-history.ts` (+ `slope` field added to `StudentLongTrend`): nivå =
    snittresultat VT2026 normalized per scale (betyg /20 åk 7–10, nivåer /3 åk 1–6; hög ≥0,75/0,78,
    låg <0,625/0,60), trend = SAME flerterminsklassning as the Fallande trend lens (so matrix and lens
    never disagree). Six categories incl. mitten + okänd (<4 terminer, mest åk 1). `MATRIX_CATEGORIES` meta.
  - **Analys**: new "Resultatmatris: nivå × trend" section (`components/result-matrix.tsx` +
    new `GroupedScatter` in charts.tsx with markLine support): 4 category stats (demo: 39 lag-upp /
    132 lag-still / 7 hog-tappar / 79 hog-håller), colored quadrant scatter (360 plottable), full lists
    for the two action corners (hog-tappar = easy to miss; lag-upp = "håll i det som funkar"),
    lag-still cross-links to /prioritera (already covered by lenses). Method note with thresholds.
  - Verified: tsc + eslint clean, `next build` green, scatter + lists live-checked, 0 console errors.
    **Still not pushed** (all four iterations pending user go-ahead).
- _frånvaro över tid_ ✅ (user feedback with Qlik screenshots: "frånvaro month-for-month innevarande
  läsår AND per termin for last three läsår"):
  - **Schema + seed**: new `attendance_term_history` table (student, term, days_total, days_absent) —
    historical frånvaro is TERM AGGREGATES for the 6 history terms (daily rows only for current läsår;
    same resolution as the school's own multi-year report). New `rng4` stream, per-student absence
    drift (~15 % growing, ~10 % improving). 1920 rows. Supabase truncate list updated.
  - **`queries-history.ts`**: shared `TERM_ABSENCE_SQL` (history table UNION current year split at
    2026-01-07 from attendance_records) → `getClassMonthlyAbsence`, `getClassTermAbsence`,
    `getStudentTermAbsence`, and `absenceRate` added to `getSchoolTermSeries`.
  - **Klass page**: "Frånvaro över tid" section — `components/absence-grid.tsx`, a Qlik-style colored
    per-elev grid with toggle "Per månad · innevarande läsår" / "Per termin · fyra läsår" + legend
    (<10 grön / 10–15 gul / 15–25 orange / ≥25 röd). **Elev page**: "Frånvaro över tid" line chart per
    termin. **/ledning**: 3rd chart card "Frånvaro (hela skolan) – lägre är bättre" (charts now lg:grid-cols-3).
  - **CSS fix**: new `.table-card--scroll` (overflow-x auto at ALL widths) — dense grids (absence grid,
    trajectory table) were clipped on desktop by `.table-card`'s overflow:hidden.
  - Verified: seed + tsc + eslint clean, `next build` green, live-checked klass 9A (both grid modes,
    aug–maj + HT22–VT26), elev chart, ledning 3 charts, scroll works; 0 console errors. **Still not pushed.**
- _longitudinal trends iteration_ ✅ (user feedback: "trend is just HT→VT — should be over time like
  our Qlik progression report, but skolledare must not drown in data"):
  - **Seed: 3 prior läsår of assessment history** (`scripts/seed.ts`, new `rng3` stream — current-year
    data + curated scenarios stay byte-identical, verified: merit åk10 251,4, utredningsskuld 136).
    Terms HT2022…VT2025 added to `ALL_TERMS`/`TERM_SEQUENCE`/`gradeAtTerm()` in `lib/constants.ts`
    (TermKey widened). Backwards-walk from each student's current level with a per-student slope:
    ~16 % genuinely improving, ~16 % declining, rest stable. Betyg history for grades 7–9-then,
    omdömen 2–6-then, LSR 1–4-then; **no** attendance/wellbeing/nat-prov history. ⚠️ Gotcha fixed:
    utredningsskuld CTEs needed `term in ('HT2025','VT2026')` (count(distinct term)=2 broke with 8 terms).
  - **`lib/db/queries-history.ts`**: `getStudentTrajectory` (ämne × termin grid + per-subject trend,
    first-2 vs last-2 avg, ≥3 terms), `getLongTermTrends` (per-student class: least-squares slope of
    per-term MEAN within one scale — betyg preferred, never mixed with nivåer across the åk-7 scale
    switch — ±0,012/termin + 0,0625 end-diff confirm, ≥4 terms → exactly the **64** seeded decliners,
    noise-free; first attempt with per-subject head/tail voting gave 104→85, rejected), `getSchoolTermSeries`.
  - **Elev page**: "Kunskapsutveckling över tid" — `components/trajectory-table.tsx` Qlik-style grid
    (colored cells, åk + termin headers, trend pill per ämne, nat-prov col) replaced the old two-term
    tables (TwoTermTable/SkillTable/WrittenTable/GradeTable deleted).
  - **Skolledare altitude (not drowning)**: /ledning got "Utveckling över tid" (2 line charts over 8
    terminer: snittmeritvärde + andel godtagbara, with cohort-shift caveat; HT→VT deltas condensed to
    one compact strip) + 8th action card "Fallande flerårstrend (64)" → /prioritera. **/prioritera got
    a 5th lens** "Fallande trend" (2 p). Klass elevlista Utveckling column shows "↘ över tid" marker.
  - Verified: tsc + eslint clean, `next build` green (451 pages), live-checked elev åk10 (8-term grid)
    / åk5 (nivågrid åk2–5), ledning (charts + 8 cards), prioritera (223/112/89, trend-lens 64), klass 8B
    markers; 0 console errors. **Still not committed/pushed** (together with the prior iteration).
- _testgroup feedback iteration_ ✅ (user-relayed feedback: "still missing highlight of students
  needing more help" + "better overview/control for skolledare"):
  - **`/prioritera` – Elever att prioritera** (nav for ALL roles, after start): `lib/db/queries-priority.ts`
    crosses the four existing lenses per student — Tidig upptäckt (Hög/Förhöjd), Behörighetsprognos
    (Risk 2–3), utredningsskuldens underlag (new per-student `getUtredningsskuldStudents()` in
    `queries-summary.ts`) and Tappar mark — with stödstatus (åtgärdsprogram/utredning/anpassning/ingen).
    No new model: it only intersects existing ones. Demo: 192 in ≥1 lens, **98 in ≥2 lenses, 76 of
    those without formal support process**. Filterable client list (`components/priority-list.tsx`,
    default = multi-lens view; filters: urval/lins/stödgap/årskursband, aria-pressed) + "Så fungerar
    prioriteringen" disclosure (LENS_META). Sorting: lens count → severity points (+1 if formal gap).
  - **`/ledning` – Ledningsöversikt** (skolledare-only nav, right after start): `lib/db/queries-ledning.ts` +
    `app/ledning/page.tsx`. (1) **Att agera på** — 7 clickable action cards w/ live numbers (hög risk 18,
    flera-linser-utan-stöd 76, utredningsskuld 108, Risk 3 = 9, insatser m. passerad uppföljning 1,
    prognosavvikelse +1245 tkr, sjukfrånvaro 5,7 %), each linking to its underlag; green = nothing to act on.
    (2) **Läget per stadium** — need-vs-resource matrix (elever, närvaro, trygghet, signaler, riskzon
    behörighet, tappar mark, flaggade/spec.tjänst, status = worst årskurs attention). (3) **Insatsuppföljning** —
    overdue vs upcoming follow-ups (`getInsatsUppfoljning`, vs DEMO_TODAY). (4) HT→VT term-trend strip.
  - **Klass elevlista: Utveckling column** (open follow-up #2 done): `DevBadge` in `klass/[classId]/page.tsx`
    via `getDevelopment()` — "Kan utmanas mer" (stretch), "Tappar mark", "↗ förbättras", "–".
  - Verified: tsc + eslint clean, `next build` green (**451 pages**, +/ledning +/prioritera), live-tested
    in preview (filters, role gating — Lärare blocked from /ledning, 0 console errors).
- _utveckling & potential_ ✅ (user-prompted balance pass — "fulfill potential, not just fix problems"):
  the app was deficit-heavy (3 risk lenses). Added a development lens that follows **every** student's
  trajectory HT→VT, surfacing two easy-to-miss groups the risk models can't see:
  - **Tappar mark** – students still performing godtagbart but with a *sharp* decline from a good base
    (betyg ≥2 steg ned från A–C, or ≥2 nivåer ned from över/i linje) AND a net-downward term — gated hard
    so demo noise doesn't inflate it (130 → 25). • **Kan utmanas mer (stretch)** – consistently high
    performers (54). • **Utvecklats positivt** – meaningful net improvers (161).
  - `lib/db/queries-development.ts` (`getDevelopmentSummary` / `getLosingGround` / `getStretchCandidates`).
    Surfaced on the **start page** (a balancing "Utveckling och potential" card next to the risk KPIs) and
    **Analys** (summary + the clickable 25-student "tappar mark" list). No new nav item (kept focus per the
    user's "don't overwhelm" steer). tsc + eslint clean, `next build` green (449 pages), verified live.

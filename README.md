# Skolinsikt – demoapp för datainformerat arbete i grundskolan

Demoapp som visar hur en grundskola i Göteborg kan arbeta datainformerat med
elevresultat, närvaro, elevhälsa, ekonomi och personalplanering. **All data är
fiktiv demodata** – inga riktiga personuppgifter.

Bygger på specifikationen i [`docs/spec.md`](docs/spec.md).

## Teknik

- **Next.js 16** (App Router, TypeScript, Turbopack), React 19
- **SQLite** via `better-sqlite3` – lokal, snabb och projektorvänlig. Ingen
  nätverksberoende vid demo. Hela dataåtkomsten ligger bakom ett repository-lager
  (`lib/db/`), så en framtida växling till **Supabase/Postgres** är inkapslad.
- **ECharts** för diagram (linje, stapel, heatmap, sankey, punkt)
- **Tailwind v4** med Göteborgs Stads officiella färgprofil
- Språk: **svenska** genomgående

## Kom igång

```bash
npm install
npm run seed     # bygger data/skolinsikt.db (deterministisk demodata)
npm run dev      # http://localhost:3000
```

`npm run seed` är deterministisk (fast RNG-frö) och bygger om databasen från
grunden – kör den för en hård återställning. I appen finns även knappen
**Återställ demodata** som tar bort allt användarskapat (insatser/kommentarer).

## Demoorganisation

Fiktiva *Framtidsskolan*: årskurs 1–10, 2 klasser per årskurs, 20 elever per
klass = 400 elever. Läsåret HT2025 + VT2026, med fast "idag" **2026-05-15** så
trender och scenarier alltid ser likadana ut. Stadieindelning (egna gränser):
Lågstadium åk 1–4, Mellanstadium åk 5–7, Högstadium åk 8–10.

## Roller

Klientstyrd rollväljare (uppe till höger): **Skolledare**, **Elevhälsa**,
**Förstelärare**, **Lärare**. Rollen styr vilka vyer och sektioner som visas
(§7 i spec). I demon är detta UI-styrt; motsvarande regler finns förberedda som
RLS-policyer i `supabase/migrations/` inför en skarp lösning.

## Vyer

Skolans nuläge (start) · Tidig upptäckt · Årskurser · Klasser · Elev · Analys ·
Insatser · Ekonomi & resurser · Personalplanering.

## Inbyggda demoscenarier (§16)

1. **Tidig läsintervention** – åk 2 (2A): svag läsning HT → tydlig förbättring VT.
2. **Ökande frånvaro åk 8** – tydligast måndagar och fredagar.
3. **Nationella prov vs betyg** – åk 10 matematik visar skillnad.
4. **Ekonomi & bemanning** – ökande vikariekostnader spränger budget.
5. **Skriftliga omdömen** – åk 5 matematik: återkommande problemlösning.

## Projektstruktur

```
app/                 Vyer (App Router, RSC – läser via repository-lagret)
components/          UI-primitiver, diagram, formulär, appskal
components/demo-store.tsx  Klientlagrad demodata (insatser/kommentarer i localStorage)
lib/constants.ts     Domänkonstanter (terminer, ämnen, nivåer, stadier, roller)
lib/db/              Repository-lager: schema.sql + queries*.ts (read-only vid drift)
scripts/seed.ts      Deterministisk seed-generator (bygger SQLite + seed.sql)
supabase/migrations/ Postgres-schema/vyer/RLS – framtida Supabase-mål
docs/spec.md         Specifikation
```

> Statisk export: SQLite läses endast vid bygget och bakas in i sidorna. Insatser
> och kommentarer som skapas i demon sparas i webbläsarens localStorage (det finns
> ingen backend vid drift) och nollställs med **Återställ demodata**.

## Avgränsningar (denna version)

Simuleringsläge, demoassistent och skarp autentisering ingår inte ännu – se
backlogg i `docs/spec.md` §19. Utskrift/PDF finns för startsidans sammanfattning
(**Skriv ut sammanfattning** → skriv ut/spara som PDF i webbläsaren).

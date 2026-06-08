# Specifikation: Demoapp för datainformerat arbete i grundskola

## 1. Syfte

Appen ska demonstrera hur en grundskola i Göteborg kan arbeta datadrivet och datainformerat med elevresultat, närvaro, elevhälsa, ekonomi och personalplanering. Fokus är inte att ersätta befintliga verksamhetssystem, utan att visa hur samlad och begriplig demodata kan stödja analys, dialog och prioritering.

Appen ska kunna användas i demo, workshop och utvecklingsarbete med skolledare, elevhälsa, förstelärare och lärare.

## 2. Målgrupper

### Skolledare
- Följa skolans samlade utveckling.
- Identifiera risker, trender och behov av insatser.
- Följa ekonomi, personalplanering och resursfördelning.
- Förbereda underlag till kvalitetsdialog, arbetslagsmöten och huvudmannadialog.

### Elevhälsa
- Följa närvaro, oroande mönster och behov av tidiga insatser.
- Se samband mellan frånvaro, resultat, skriftliga omdömen och stödinsatser.
- Arbeta med elevgrupper, klasser och årskurser utan att fastna i enbart individärenden.

### Förstelärare och lärare
- Följa progression i läsa, skriva och räkna i årskurs 1-4.
- Analysera resultat och omdömen på klass-, grupp- och ämnesnivå.
- Identifiera behov av undervisningsutveckling.
- Jämföra insatser och progression över tid.

## 3. Demoorganisation

Demoappen ska innehålla en fiktiv grundskola med årskurs 1-10.

- Årskurser: 1-10
- Klasser per årskurs: 2
- Elever per klass: 20
- Totalt antal klasser: 20
- Totalt antal elever: 400

Exempel på klassnamn:
- 1A, 1B
- 2A, 2B
- ...
- 10A, 10B

All data i första versionen ska vara demodata. Inga riktiga personuppgifter ska användas.

## 4. Grundprinciper

Appen ska bygga på datainformerat arbete snarare än automatisk styrning. Det betyder att appen ska hjälpa användaren att se mönster och ställa bättre frågor, men inte fatta beslut åt verksamheten.

Viktiga principer:
- Visa trender över tid, inte bara nuläge.
- Visa både styrkor och riskområden.
- Undvik förenklade rankinglistor över elever eller lärare.
- Gör det möjligt att borra från skolnivå till årskurs, klass, ämne, grupp och elev.
- Markera när data är ofullständig, preliminär eller behöver tolkas varsamt.
- Tydliggör att demodata är fiktiv.

## 5. Datamoduler

### 5.1 Läsa, skriva och räkna, årskurs 1-4

Syfte: följa tidig progression i grundläggande färdigheter.

Dataområden:
- Läsning
- Skrivning
- Räkning/matematiska grundfärdigheter

Exempel på indikatorer:
- Uppnådd nivå enligt lokal bedömningsmatris
- Progression sedan föregående mätning
- Andel elever som ligger i fas
- Andel elever som behöver uppmärksammas
- Klassens spridning
- Jämförelse mellan klasser i samma årskurs

Möjliga nivåer:
- Över förväntad progression
- I linje med förväntad progression
- Behöver uppmärksammas
- Stort behov av stöd

### 5.2 Skriftliga omdömen, årskurs 2-6

Syfte: ge en samlad bild av elevernas kunskapsutveckling innan betyg införs.

Dataområden:
- Svenska/svenska som andraspråk
- Matematik
- Engelska, från relevant årskurs
- SO
- NO
- Praktisk-estetiska ämnen

Exempel på indikatorer:
- Bedömd kunskapsutveckling per ämne
- Progression från föregående termin
- Återkommande formuleringar eller teman i omdömen
- Andel elever med risk för att inte nå kommande kunskapskrav
- Ämnen där många elever behöver stöd

Omdömen kan representeras som strukturerad demodata med nivåer och korta fiktiva kommentarstexter.

### 5.3 Betyg, årskurs 7-10

Syfte: följa betygsutveckling och identifiera behov av stöd och undervisningsutveckling.

Dataområden:
- Terminsbetyg
- Slutbetyg
- Meritvärde
- Behörighet till gymnasiet, för årskurs 9-10 enligt vald demomodell
- Ämnesvisa resultat

Exempel på indikatorer:
- Betygsfördelning per ämne
- Andel elever med F eller streck
- Genomsnittligt meritvärde
- Skillnader mellan ämnen
- Skillnader mellan klasser
- Progression mellan terminer
- Prognos för gymnasiebehörighet

### 5.4 Nationella prov, årskurs 7-10

Syfte: jämföra provresultat med betyg och identifiera mönster.

Dataområden:
- Svenska/svenska som andraspråk
- Matematik
- Engelska
- Eventuella ämnesprov i NO/SO beroende på demoscenario

Exempel på indikatorer:
- Provbetyg per delprov och ämne
- Skillnad mellan provbetyg och terminsbetyg
- Andel elever som når godkänd nivå
- Områden där många elever har svårigheter
- Jämförelse mellan klasser och årskurser

### 5.5 Närvaro, årskurs 1-10

Syfte: ge en tidig och tydlig bild av närvaro, frånvaro och riskmönster.

Dataområden:
- Total närvaro
- Giltig frånvaro
- Ogiltig frånvaro
- Sen ankomst
- Frånvaromönster över tid

Exempel på indikatorer:
- Närvarograd per elev, klass, årskurs och skola
- Elever över valda frånvarotrösklar, exempelvis 10 %, 15 % och 20 %
- Frånvaro per veckodag och lektionstid
- Förändring senaste 4, 8 och 12 veckorna
- Samband mellan frånvaro och kunskapsresultat

### 5.6 Ekonomi för skolledare

Syfte: ge skolledare ett enkelt ekonomiskt beslutsstöd kopplat till verksamhetens behov.

Dataområden:
- Budget
- Utfall
- Prognos
- Personalkostnader
- Läromedel
- Elevstöd och särskilda insatser
- Vikariekostnader

Exempel på indikatorer:
- Budgetavvikelse per kostnadskategori
- Prognos helår
- Kostnad per elev
- Vikariekostnad per månad
- Resursfördelning per årskurs eller arbetslag
- Koppling mellan planerade insatser och ekonomiskt utrymme

### 5.7 Personalplanering för skolledare

Syfte: stödja planering av bemanning och kompetens utifrån elevernas behov.

Dataområden:
- Tjänstefördelning
- Behörigheter
- Arbetslag
- Mentorskap
- Frånvaro/vakans
- Planerade stödinsatser
- Resursbehov per årskurs

Exempel på indikatorer:
- Lärartäthet
- Andel undervisning med behörig lärare
- Bemanning per ämne och årskurs
- Risk för överbelastning i arbetslag
- Behov av specialpedagogisk kompetens
- Planerad kontra faktisk bemanning

## 6. Föreslagna vyer

### 6.1 Startsida: Skolans nuläge

En översikt för hela skolan.

Innehåll:
- Samlad närvarograd
- Antal elever med ökande frånvaro
- Översikt över läsa, skriva och räkna i årskurs 1-4
- Översikt över omdömen i årskurs 2-6
- Betygsöversikt i årskurs 7-10
- Ekonomiskt nuläge
- Bemanningsläge
- Viktiga förändringar sedan föregående månad

### 6.2 Årskursvy

Visar en årskurs i taget.

Innehåll:
- Två klasser per årskurs
- Närvaro
- Kunskapsresultat enligt relevant årskursmodul
- Identifierade styrkor
- Riskområden
- Pågående insatser
- Rekommenderade frågor till arbetslagets analys

### 6.3 Klassvy

Visar en klass i taget.

Innehåll:
- Elevlista med fiktiva elever
- Närvaro och progression
- Resultat per ämne eller färdighetsområde
- Gruppnivåanalys
- Markering av elever som behöver följas upp
- Kommentarer från arbetslag eller elevhälsa

### 6.4 Elevvy

Visar en samlad bild av en fiktiv elev.

Innehåll:
- Närvaroutveckling
- Resultatutveckling
- Omdömen eller betyg beroende på årskurs
- Eventuella stödinsatser
- Viktiga händelser i tidslinje
- Nästa planerade uppföljning

Elevvyn ska vara försiktig i sin utformning och undvika stigmatiserande etiketter.

### 6.5 Analysvy

En vy för förstelärare, skolledare och elevhälsa.

Innehåll:
- Filter på årskurs, klass, ämne, kön, frånvaronivå och insats
- Diagram över progression
- Sambandsanalyser, exempelvis frånvaro och resultat
- Jämförelse mellan terminer
- Export av underlag till möten
- Frågebank för kollegial analys

### 6.6 Insatsvy

Visar planerade, pågående och avslutade insatser.

Innehåll:
- Typ av insats
- Målgrupp
- Startdatum och uppföljningsdatum
- Ansvarig roll
- Förväntad effekt
- Uppföljd effekt
- Koppling till data som låg bakom insatsen

Exempel på insatser:
- Läsintervention i årskurs 2
- Intensivträning i matematik i årskurs 4
- Närvaroteam för elever med ökande frånvaro
- Kollegialt ämnesarbete i matematik årskurs 8
- Stärkt mentorskap i årskurs 7

### 6.7 Ekonomi- och resursvy

För skolledare.

Innehåll:
- Budget och prognos
- Kostnadsavvikelser
- Personalresurser
- Stödresurser
- Simulering: vad händer om skolan omfördelar resurser?
- Koppling mellan behov och resursplanering

## 7. Roller och behörigheter

### Skolledare
- Se all demodata.
- Se ekonomi och personalplanering.
- Skapa och följa upp insatser.
- Exportera aggregerade rapporter.

### Elevhälsa
- Se elev-, klass- och årskursdata.
- Se närvaro och stödinsatser.
- Skapa och följa upp elevhälsoinsatser.
- Inte se detaljerad ekonomidata om det inte behövs för demo.

### Förstelärare
- Se ämnes-, klass- och årskursdata.
- Se aggregerade elevresultat.
- Skapa analysunderlag och undervisningsinsatser.
- Begränsad eller ingen åtkomst till individkänslig elevhälsodata.

### Lärare
- Se egna klasser och undervisningsgrupper.
- Följa progression och närvaro.
- Dokumentera reflektioner och planerade undervisningsinsatser.

## 8. Demodata

Demodata ska vara realistisk men fiktiv.

### Elevdata
Varje elev ska ha:
- Fiktivt elev-id
- Fiktivt namn
- Årskurs
- Klass
- Eventuella demografiska attribut, om de behövs för analysdemo
- Närvarodata
- Resultatdata beroende på årskurs
- Eventuella fiktiva insatser

### Klass- och årskursdata
Varje klass ska ha:
- 20 elever
- Mentor eller ansvarig lärare
- Arbetslag
- Närvarosammanställning
- Resultatsammanställning
- Pågående insatser

### Exempel på datavariation
Demodata bör innehålla tydliga men rimliga mönster:
- En klass med stark progression i läsning efter insats
- En årskurs med ökande frånvaro under vårterminen
- Ett ämne där många elever riskerar F
- Skillnad mellan nationella prov och betyg i något ämne
- Ekonomisk avvikelse kopplad till vikariekostnader
- Bemanningsutmaning i ett ämne
- Positiv effekt av riktad undervisningsinsats

## 9. Datamodell, första version

Föreslagna tabeller eller collections:

- students
- classes
- grades
- school_terms
- attendance_records
- literacy_numeracy_assessments
- written_assessments
- subject_grades
- national_tests
- interventions
- staff
- staff_assignments
- budget_items
- financial_forecasts
- user_roles

### Exempel: students
- student_id
- first_name
- last_name
- grade_level
- class_id
- active

### Exempel: attendance_records
- attendance_id
- student_id
- date
- lesson_or_day
- status: present, valid_absence, invalid_absence, late
- minutes_absent

### Exempel: literacy_numeracy_assessments
- assessment_id
- student_id
- term
- area: reading, writing, numeracy
- level
- progression_score
- comment

### Exempel: interventions
- intervention_id
- title
- level: school, grade, class, group, student
- target_group_id
- start_date
- follow_up_date
- owner_role
- hypothesis
- planned_action
- outcome
- status

## 10. Nyckelfunktioner i MVP

Första versionen bör innehålla:

1. Inloggning med rollval för demo.
2. Startsida med skolövergripande dashboard.
3. Årskursvy för årskurs 1-10.
4. Klassvy med elevlista och indikatorer.
5. Närvaromodul för alla årskurser.
6. Läsa/skriva/räkna-modul för årskurs 1-4.
7. Skriftliga omdömen för årskurs 2-6.
8. Betyg och nationella prov för årskurs 7-10.
9. Ekonomivy för skolledare.
10. Personalplaneringsvy för skolledare.
11. Insatsvy där användaren kan koppla analys till åtgärd.
12. Export av enkel rapport som PDF eller markdown.

## 11. Extra funktioner att överväga

### Analysfrågor direkt i appen
Appen kan föreslå frågor snarare än färdiga svar, till exempel:
- Vad ser vi?
- Vad behöver vi förstå mer om?
- Vilka elever eller grupper behöver uppmärksammas?
- Vilka undervisningsinsatser kan prövas?
- Hur följer vi upp om insatsen gör skillnad?

### Tidslinje för kvalitetsarbete
Visa skolans analys- och uppföljningscykel över läsåret:
- Terminsstart
- Tidig avstämning
- Mitterminsanalys
- Betygs-/omdömesanalys
- Närvarouppföljning
- Insatsuppföljning
- Planering inför nästa termin

### Simuleringsläge
Skolledare kan testa hypotetiska scenarier:
- Om vi lägger mer speciallärartid i årskurs 3, vilka grupper påverkas?
- Om frånvaron minskar med 5 procentenheter i årskurs 8, hur förändras riskbilden?
- Om vikariekostnader fortsätter öka, hur påverkas prognosen?

### Kollegial analysyta
Lärare och förstelärare kan dokumentera gemensamma slutsatser:
- Observation
- Tolkning
- Hypotes
- Planerad undervisningsförändring
- Uppföljningsdatum
- Resultat efter uppföljning

### Demoassistent
En inbyggd assistent kan hjälpa användaren att tolka vyer med formuleringar som:
- "Det här är ett mönster att undersöka vidare."
- "Denna förändring sammanfaller med en registrerad insats."
- "Dataunderlaget är begränsat, tolka försiktigt."

Assistenten ska inte fatta beslut, sätta etiketter på elever eller föreslå ingripande åtgärder utan mänsklig bedömning.

## 12. Visualiseringar

Föreslagna diagram:
- Linjediagram för progression över tid
- Stapeldiagram för betygsfördelning
- Heatmap för frånvaro per veckodag
- Matris för läsa, skriva och räkna
- Sankey eller flödesvy för elever mellan risknivåer över tid
- Budget mot utfall
- Bemanningsöversikt per ämne

Alla diagram ska kunna filtreras på:
- Årskurs
- Klass
- Termin
- Ämne
- Indikator
- Insatsstatus

## 13. Tekniska krav, första version

För demo räcker en enkel webbapp.

Rekommenderad struktur:
- Frontend: React, Next.js eller liknande
- Backend/API: Node.js, Python FastAPI eller serverless API
- Databas: SQLite, PostgreSQL eller JSON-baserad demodata för enklare demo
- Diagram: Recharts, ECharts eller liknande
- Autentisering: enkel rollväljare i demo, inte riktig inloggning i första versionen

## 14. Icke-funktionella krav

- Appen ska vara tydlig nog att användas i workshop utan instruktion.
- Alla vyer ska märkas med "Demodata".
- Det ska gå snabbt att växla mellan skol-, årskurs-, klass- och elevnivå.
- Gränssnittet ska fungera på projektor.
- Appen ska kunna återställas till ursprunglig demodata.
- Språk: svenska.
- Design: enkel, tillgänglig och kommunal verksamhetsnära.

## 15. Etik, juridik och integritet

Även om första versionen använder demodata bör appen designas med försiktighet.

Principer:
- Minimera individfokus i översiktsvyer.
- Undvik automatiska risketiketter som kan uppfattas som definitiva.
- Visa förklaringar av indikatorer.
- Skilj på faktisk data, tolkning och hypotes.
- Säkerställ att framtida riktig data hanteras enligt gällande dataskyddskrav.
- Bygg in behörighetsstyrning från början även om demo använder förenklad inloggning.

## 16. Förslag på demo-scenarier

### Scenario 1: Tidig läsintervention
Årskurs 2 visar svag progression i läsning i början av höstterminen. En riktad insats startas. Efter åtta veckor visar appen förbättrad progression för majoriteten av eleverna.

### Scenario 2: Ökande frånvaro i årskurs 8
Närvarovyn visar ökande frånvaro i årskurs 8, särskilt på måndagar och fredagar. Elevhälsan skapar en gruppinsats tillsammans med mentorerna.

### Scenario 3: Skillnad mellan nationella prov och betyg
I årskurs 10 (sista året) visar appen skillnad mellan provresultat och betyg i matematik. Skolledare och förstelärare använder analysvyn för att diskutera bedömning, undervisning och stöd.

### Scenario 4: Ekonomi och bemanning
Skolledare ser att vikariekostnaderna ökar samtidigt som ett arbetslag har hög belastning. Personalplaneringsvyn används för att analysera bemanning och planera om resurser.

### Scenario 5: Skriftliga omdömen visar ämnesmönster
I årskurs 5 visar skriftliga omdömen återkommande utmaningar i problemlösning i matematik. Förstelärare planerar en undervisningsinsats och följer upp progression nästa termin.

## 17. Avgränsningar för första version

MVP ska inte innehålla:
- Integration med riktiga verksamhetssystem
- Riktiga personuppgifter
- Avancerad AI-baserad prediktion
- Automatisk beslutsrekommendation
- Fullständig elevakt eller elevhälsodokumentation
- Skarp autentisering mot kommunal identitetshantering

## 18. Framgångskriterier för demo

Appen är lyckad om den hjälper målgruppen att:
- Förstå hur samlad skoldata kan användas i dialog.
- Se samband mellan resultat, närvaro, resurser och insatser.
- Formulera bättre analysfrågor.
- Diskutera prioriteringar på skol-, årskurs- och klassnivå.
- Se skillnaden mellan datadrivet och datainformerat arbete.
- Identifiera vilka krav som skulle behövas inför en framtida skarp lösning.

## 19. Möjlig backlogg efter MVP

- Import av CSV-demodata
- Redigerbar datagenerator
- Fler skolor för huvudmannaperspektiv
- Jämförelser mellan skolor med tydliga försiktighetsprinciper
- Export till PowerPoint eller rapportmall
- Kommentarer och mötesanteckningar kopplade till vyer
- Stöd för kvalitetsdialoger
- Rollbaserade startsidor
- Mer avancerad simuleringsfunktion
- Tillgänglighetsgranskning enligt WCAG
- Flerspråkigt stöd vid behov

# Asistent AI

Asistentul este accesibil din meniul „Spațiul meu → Asistent AI”, pentru rolurile cu `invoice.read`. Nu este activ în modul demo sau offline.

## Activare

1. Copiază `.env.example` în `.env` și configurează baza de date și celelalte variabile existente.
2. Setează `OPENAI_API_KEY` pe server. Opțional, schimbă `SOCOT_AI_MODEL` (implicit `gpt-4.1-mini`); modelul trebuie să accepte Chat Completions cu Structured Outputs.
3. Rulează `npm ci`, `npm run db:generate`, `npm run db:migrate`, `npm run build`, apoi `npm start`.

Cheia nu se pune în cod, în browser sau într-o variabilă `NEXT_PUBLIC_*`. Nu sunt necesare migrări noi pentru AI. Serviciul folosește API-ul OpenAI, cu facturare separată; configurează bugetul în contul furnizorului. Această versiune limitează căutările la 10/minut/utilizator, fără cote lunare de abonament.

## Utilizare

Exemple: „Arată facturile de vânzare neachitate din septembrie 2026”, „Caută cheltuielile pentru partenerul Atelier”, „Găsește documentul cu referința ABC-123”.

Modelul transformă întrebarea în filtre validate: partener, referință, vânzare/cheltuială, sold neachitat și interval. Serverul execută interogarea în firma utilizatorului conectat. Interfața afișează filtrele pentru verificare și până la 50 de documente, în ordine descrescătoare a datei. Rezultatele nu sunt un raport exhaustiv dacă există mai mult de 50 de potriviri. Ciornele și operațiunile locale nesincronizate nu sunt incluse.

Pentru rolurile cu `journal.read`, butonul de pe document afișează documentul-sursă, propunerea Dt/Ct determinată de regula aprobată aplicabilă datei și articolele existente. Propunerea se referă la valoarea inițială a documentului, fără plăți și fără TVA separat. Sumele sunt calculate de motorul contabil în bani întregi, inclusiv repartizările. Regulile demo, lipsa unei reguli sau suprapunerile blochează propunerea.

Previzualizarea nu creează articole. Verificarea și aprobarea articolelor existente continuă în secțiunea Contabilitate, prin fluxul existent, cu drepturile și verificările perioadei existente. Nu există postare automată sau aprobare directă din AI. Nu sunt incluse consultanță legislativă, OCR sau modificări ale documentelor.

## Date și securitate

Doar întrebarea și instrucțiunile de interpretare sunt trimise către OpenAI, cu `store: false`. Documentele, soldurile și regulile găsite nu sunt trimise modelului. Întrebarea poate conține date introduse de utilizator, inclusiv numele unui partener; interfața explică acest lucru înainte de trimitere. `store: false` nu înlocuiește verificarea condițiilor furnizorului privind prelucrarea și retenția datelor.

Nu se execută SQL, cod sau instrumente generate de model. Schema nu acceptă companyId, conturi, sume sau comenzi de scriere. CompanyId este luat exclusiv din sesiunea autentificată. Răspunsurile AI invalide sau indisponibilitatea serviciului produc erori explicite. Timeout furnizor: 8 secunde. Cheile și erorile brute ale furnizorului nu sunt returnate clientului.

Căutările și previzualizările reușite sunt înregistrate în `ComplianceAudit`, fără textul întrebării. Verificare: `npm test`, `npm run typecheck`, `npm run build`. Testele AI folosesc un furnizor și o bază de date simulate; un test real necesită cheia și un server PostgreSQL configurat.

## API

- `GET /api/ai/status`: disponibilitatea configurației, fără cheie.
- `POST /api/ai/search`: `{ "question": "..." }`, 3–1000 caractere. Returnează filtre, documente și `hasMore`.
- `POST /api/ai/proposal`: `{ "id": "UUID-document" }`. Returnează documentul, regula, propunerea și articolele existente. Necesită `journal.read`.

Toate rutele folosesc autentificarea, verificarea originii și limitele API existente.

## Integrare în proiect — 16 octombrie 2026

Preluare selectivă din arhiva socot-cu-ai.zip; îmbunătățirile recente ale documentelor și reducerilor sunt păstrate. Desktopul permite explicit cele trei rute AI prin adaptorul autentificat existent. Intervalele relative folosesc data din Europe/Chisinau. Schimbarea companiei sau a rolului resetează panoul. Filtrele sunt validate și la intrarea în router, înaintea oricărei interogări.

În mediul local verificat nu există OPENAI_API_KEY configurată. Testele automate înlocuiesc furnizorul și baza de date; nu constituie un test real OpenAI/PostgreSQL și nu activează serviciul. Instalatoarele existente nu sunt regenerate prin această integrare.

Verificări efectuate: 75 de teste automate trecute; TypeScript și build Next.js reușite în copia curată /tmp/socot-check-20261013; cargo check --locked --offline reușit pentru Tauri. Browser: meniul Asistent AI, informarea despre transmiterea întrebării și blocarea căutării în demo verificate. Verificările inițiale direct pe Desktop au întâmpinat module indisponibile; copia curată cu dependențele instalate a trecut. Nu a fost efectuat un apel OpenAI real.

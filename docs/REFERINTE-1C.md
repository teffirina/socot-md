# Analiza celor opt capturi furnizate

Capturile au fost inspectate la 18 septembrie 2026. Sunt repere de funcționalitate, nu surse de reguli fiscale și nu autorizează reutilizarea datelor firmei din imagini ca date demo. Nu includem fotografiile sau datele lor comerciale în repository.

| Captură | Funcții observabile | Echivalent simplificat urmărit în Socot |
|---|---|---|
| 1 și 5 — Cumpărări | Recepție bunuri, cheltuieli suplimentare de achiziție, factură fiscală, retur furnizor; jurnal cumpărări, reconciliere, decontări, închidere lună; parteneri, produse, plăți vamale, grupe bunuri; rapoarte pe conturi și cartea cumpărărilor | Un flux Achiziție → Recepție → Datorie → Plată, cu retur și costuri suplimentare legate de documentul inițial |
| 2 — Întreprindere | Utilizatori, asistent inițial, parametri, organizații, solduri inițiale, subdiviziuni; operațiuni manuale, jurnal contabil, plan de conturi; balanță, balanță pe cont, analiză și fișă cont, raportare reglementată | Configurare ghidată; registre accesibile separat; din sold se deschid mișcările și documentul sursă |
| 3 — Bancă | Ordin de plată, extras, client-bancă; jurnal bancă; mișcări numerar, parteneri, bănci; fișă pe zile, balanță și analiză cont | Import extras → asociere documente → confirmare, fără a pretinde conexiune bancară existentă |
| 4 — Casă | Încasare, plată, decont de avans; registru casă, persoane și parteneri; carte de casă, fișă pe zile, balanță și analiză | Operațiune de încasare/plată clară, document tipăribil și sold casierie |
| 6 — Vânzare | Număr, dată, organizație, depozit, cumpărător, contract, cont, avans; tabel cu bunuri/servicii, unitate, cantitate, preț, TVA și total; salvare, postare, imprimare | Antet compact, tabel de poziții, total vizibil; contabilitatea și opțiunile speciale în secțiunea avansată |
| 7 — Inventariere | Depozit, filtre pe produse/grupe, cantități și valori contabile versus faptice, surplus, lipsă, cont și explicație; imprimare și postare | Precompletare stoc → numărare efectivă → diferențe explicate → aprobare distinctă |
| 8 — Nomenclatoare și jurnal transferuri | Plan de conturi, parteneri, bănci, valute, structură firmă, prețuri, active, obiecte de mică valoare, formulare, produse, import, personal, clasificatoare; transferuri între locații | Cataloage comune reutilizate în formulare; transfer cu sursă, destinație, poziții și istoric |

În bara de module sunt vizibile și Producție, active pe termen lung, anvelope/acumulatori, obiecte de mică valoare, personal, salarii, formulare cu regim special, monitor și conducere. Capturile nu arată interiorul acestor module: nu deducem formule sau câmpuri nevizibile. Funcționalitatea lor este cerută în specificația scrisă și rămâne în plan.

## Ce înseamnă „ușurat”

- aceleași date se introduc o singură dată și se reutilizează;
- câmpurile frecvente sunt vizibile, cele avansate se deschid la nevoie;
- termenii sunt în română, acțiunile descriu efectul;
- salvarea documentului, verificarea și postarea sunt distincte;
- dintr-un total se ajunge la rândurile și documentele care îl formează;
- registrele au perioadă, căutare și export;
- permisiunile și validările se păstrează, chiar dacă interfața devine mai simplă;
- funcțiile neimplementate nu apar ca butoane aparent funcționale.

## Implementat după analiză

Balanță din jurnalul postat, sold inițial din istoricul anterior perioadei, rulaje și sold final debit/credit, fișa contului cu sold progresiv, document sursă și export CSV. Calcul comun demo/API; API-ul interoghează istoricul companiei pe server, nu cache-ul local limitat la 200 facturi. Peste limita explicită de 100.000 articole raportul este refuzat, nu trunchiat. Articolele nepostate sau fără dată sunt excluse și numărate. Nu este raport fiscal și nu suplinește soldurile inițiale încă neimplementate.

Funcțiile rămase sunt urmărite în PLAN.md; aceste capturi nu fac din fundația curentă un echivalent complet al 1C.

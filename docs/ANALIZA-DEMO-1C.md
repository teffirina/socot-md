# Socot — analiză directă a demo-ului 1C pentru Moldova

Data: 7 octombrie 2026. Analiză prin interfața web; nu prin codul sau baza internă a furnizorului.

## Acces și limite

- https://onefresh.md/a/buh-demo/6072/ru/ — acces reușit fără introducerea unor credențiale, sesiune Demo, configurație „Бухгалтерия для Молдовы, редакция 3.0”.
- http://md.demo.1c.eu/accounting/prof/30/ru_RU/ — inițial formular de autentificare; la reluarea din 7 octombrie acces reușit în sesiunea existentă „Contabil Sef (ro)”. Baza se identifică drept copie. Protecțiile pentru sincronizări externe nu au fost schimbate.
- Inspectate meniurile celor 13 secțiuni principale, registrul recepțiilor, o recepție de servicii, registrul vânzărilor, o vânzare mixtă și meniul documentelor derivate din aceasta.
- Nu s-au verificat toate formularele, calculele, permisiunile, opțiunile ascunse, tipăriturile și integrările. Vizibilitatea unui meniu nu dovedește implementarea identică în Socot și nici conformitatea fiscală actuală.
- Demo-ul conține exemple din 2025. Cotele și conturile afișate sunt observații despre exemplu, nu reguli fiscale adoptate pentru Socot.
- Nu s-au salvat, postat, șters, trimis sau exportat documente în demo. Nu s-au copiat identitatea vizuală, codul, modelele de document oficial ori baza de date.
- Observații locale: `artifacts/onefresh-review/`. Acestea sunt dovezi de inspecție, nu corpus de date pentru aplicație.

## Inventarul observat în meniuri

| Secțiune | Funcții observate |
|---|---|
| Principal | Organizații, politică contabilă, parametri, funcționalitate, plan de conturi, solduri inițiale, introducere operațiune |
| Conducere | Indicatori, vânzări pe partener/articol/grupă, profit brut, numerar, stocuri, venituri/cheltuieli, datorii pe contract și vechime |
| Bancă și casă | Ordine de plată, extrase, documente bănești, documente de casă, deconturi de avans, carduri, ture de casă, inventariere, registru de casă, schimb cu banca |
| Vânzări | Conturi spre plată, realizări, servicii, retururi, facturi fiscale emise, reconciliere/inventariere decontări/corectare datorii, prețuri, retail, rapoarte de retail, reevaluare, cartea vânzărilor, export în registrul electronic |
| Cumpărări | Procuri, conturi spre plată primite, recepții, cheltuieli suplimentare, declarație vamală de import, retururi, facturi fiscale primite, reconciliere și corectare datorii, raport import, cartea cumpărărilor |
| Depozit | Consumuri, transferuri, completări, OMVSD, inventariere, surplusuri/lipsuri, prețuri, formulare cu regim special, anvelope/acumulatoare, foi de parcurs, combustibil, control stoc negativ |
| Producție | Repartizare costuri indirecte, rapoarte de producție, servicii productive, producție neterminată, prelucrarea materiilor clienților și prelucrare la terți |
| Active | Recepție echipamente/active/leasing/terenuri, montaj, punere în funcțiune, transfer, modernizare, inventariere, răscumpărare leasing, casare/vânzare, amortizare contabilă/fiscală, active necorporale, rapoarte |
| Personal și salarii | Angajări/transferuri/încetări, scutiri, tichete, rețineri, concedii și indemnizații, calendare/pontaj, calcul salarial, premii/ajutoare, plăți bancă/casă, rapoarte și documente de personal |
| Operațiuni | Jurnal operațiuni, operațiuni manuale/tipice, articole contabile, închidere lună, operațiuni periodice, TVA/pro-rata, închidere conturi/avansuri, taxe locale/imobiliare, repostare |
| Rapoarte | Balanță generală și pe cont, analiză/fișă/rulaje cont, analitice, articole sintetizate, cartea mare, raport universal, rapoarte reglementate |
| Nomenclatoare | Parteneri, contracte, valute, articole, prețuri, depozite, active, personal, venituri/cheltuieli, subdiviziuni, formulare speciale și condiții de încărcare e-Factura |
| Administrare | Funcționalitate, utilizatori/drepturi, interfață, fișiere, sincronizare, lucru autonom, tipărituri, registre, documente electronice, echipamente, setări de postare |

## Formulare inspectate în detaliu

Recepția de servicii: număr și dată, furnizor, contract, cont spre plată, subdiviziune, decontări/avans, tip de document, prețuri și tratament TVA; rânduri cu articol, cantitate, preț, sumă, cotă/valoare TVA, total și conturi; document fiscal asociat, comentariu. Acțiuni separate de salvare, postare, tipărire și creare pe baza documentului.

Vânzarea mixtă: client, contract, cont spre plată, depozit, cont bancar, subdiviziune, decontări/avans, tip document; taburi pentru bunuri, servicii și refacturare/comision; rânduri cu cantitate, preț, sume, TVA și analitice; semnături/livrare/document fiscal. Meniul „Creează pe baza” permite retur, plată cu cardul, încasare bancară, încasare în numerar și cont către client. Nu s-au executat aceste operațiuni.

## Adaptare implementată acum în Socot

- Navigare originală grupată: spațiu personal, activitate, evidență/rapoarte, organizare; căutare fără diacritice în meniu și meniu compact pe ecrane mici.
- Spații distincte Cumpărări și Vânzări: registru filtrat pe tip, încasări/plăți, Excel, parteneri, contracte și articole; verificarea contabilă respectă dreptul de citire jurnal.
- Legături directe către nomenclatorul corespunzător, cu filtrarea accesului la angajați.
- Ciorne și operațiuni în așteptare separate de indicatorii documentelor confirmate; limita de 200 de documente online afișată explicit.
- Copiere în ciornă nouă: identificator nou, data curentă, fără copierea plății sau postare; urmează verificarea și confirmarea obișnuită.
- Avertizare la părăsirea editorului deschis cu date nesalvate și la reîncărcare/închiderea paginii. Nu înlocuiește salvarea explicită.
- Bancă/casă, depozit, producție, active, personal: acces la funcțiile deja existente; operațiunile lipsă sunt enumerate separat într-o secțiune retractabilă. NU sunt module operaționale complete.
- Legislația nu a fost readăugată în Administrare; nu s-au modificat formule, cote sau reguli aprobate.

## Următoarea implementare funcțională necesară

1. Model document și rânduri (cantitate/precizie/preț/reducere/TVA), instantanee de date partener/articol, document intern separat de identificator fiscal.
2. Calcul determinist comun web/desktop/server, verificare fiscală oficială a tratamentelor și rotunjirilor; motorul actual are un singur debit/credit per operațiune și trebuie extins.
3. Plăți independente și alocări, avansuri, compensări; separarea stării documentului de livrare și achitare.
4. Recepții/livrări legate, cantități parțiale, stocuri/costuri și controale concurente; servicii fără stoc.
5. Retururi și corecții urmărite până la sursă, perioade închise, audit.
6. Documente tipăribile validate, rapoarte de cumpărări/vânzări și reconciliere; transmiterea oficială este integrare separată.
7. Migrații compatibile cu datele existente, istoric server paginat, sincronizare și conflicte pentru noile entități, verificare SQLite/PostgreSQL.
8. Test de lună completă, validare contabilă și builduri desktop noi. Instalatoarele 0.6.0 anterioare nu includ reorganizarea.

Nu declarăm paritate integrală cu 1C prin această etapă de reorganizare.

## Verificare a reorganizării

- Compilare web Next.js și verificare TypeScript reușite, din copia curată cu aceleași surse și dependențe.
- 55 de teste existente trecute; nu reprezintă acoperire pentru operațiunile din 1C încă neimplementate.
- Browser: registru de cumpărări filtrat, copiere din document existent în ciornă, selectarea directă a nomenclatorului de articole.
- Profil izolat pe portul 3002: ciornă de 123,45 MDL, anularea navigării prin dialogul Socot, salvare, copiere și reîncărcare. Două ciorne persistente, zero documente de cumpărare confirmate și zero datorie; fără postare.
- Dialogul nativ window.confirm a blocat temporar controlul filei principale. A fost înlocuit cu un dialog accesibil în interfața Socot și retestat în profilul izolat. Avertizarea nativă la închiderea/reîncărcarea unei pagini cu editor deschis rămâne gestionată de browser.
- Verificare vizuală la lățime desktop și ecran îngust. Niciun installer nou generat în această etapă.


## Verificarea directă Dt/Ct — 7 octombrie, etapa următoare

Exemple din demo, **nu reguli fiscale curente și nu configurare aprobată pentru Socot**:

| Document verificat | Mișcări observate | Consecința pentru proiectare |
|---|---|---|
| Intrare 0000-00000024, 20.12.2025, refacturare energie, 3 585 MDL | D 836 / C 521.1, 3 585; analitice separate pe debit și credit: subdiviziune, serviciu, comitent, furnizor, contract | Nu orice cumpărare este o cheltuială; nu se aplică automat regula generală 713/521 |
| Comercializare 0000-00000001, 29.09.2025, mărfuri, 1 157 856 MDL | Fila indică 15 articole și 6 mișcări în registrul vânzărilor. Observate D 711.2 / C 217.1 pe lot/cantitate; D 221.1 / C 611.2 pe articol; D 221.1 / C 534.4, TVA 192 976 MDL | Costul de ieșire, venitul și TVA sunt distincte. Un singur articol pentru valoarea totală nu reproduce acest flux |

Nu au fost citite toate cele 15 rânduri; primele cinci și ultimele rânduri au fost examinate. Pentru contorul electric costul este separat pe două intrări (cantități 7 și 2). Formula de evaluare a loturilor nu poate fi dedusă doar din acest exemplu. Nici cele șase rânduri ale registrului vânzărilor nu au fost inspectate individual.

### Modificări Socot efectuate în această etapă

- Detaliile documentului au secțiune dedicată Debit și credit, cu data, sumă, regulă/versiune și stare; disponibilă și online, cu citire distinctă a tuturor mișcărilor acelui document, nu filtrarea ultimelor 200 de articole generale.
- Endpointul de citire verifică dreptul journal.read și firma atât la document cât și la mișcări; refuză explicit liste peste 10 000 de rânduri, fără trunchiere ascunsă.
- Erorile de conexiune nu sunt afișate ca listă goală. Schimbarea documentului nu lasă răspunsul întârziat al documentului precedent pe ecran. Datele online nu sunt adăugate în cache local.
- Regulile și nomenclatorul acceptă subconturi cu punct; codurile existente rămân neschimbate. Nu s-au convertit automat conturile și nu s-au înlocuit regulile aprobate.

### Lucru rămas pentru echivalența contabilă

Modelul operațional actual rămâne pentru servicii simplificate fără TVA. Sunt necesare: linii cu cantități/prețuri și tratament TVA; tranzacții cu mai multe articole per operațiune; analitice debit/credit; stocuri și evaluarea loturilor; avansuri și compensări; retururi/stornări; valute/diferențe de curs; registre TVA și documente derivate. Fiecare flux trebuie verificat separat în demo, validat contabil și testat înainte de activare. Nu sunt implementate integral prin modificările de mai sus.

## Registrul vânzărilor și poziții — continuare 7 octombrie

Redeschis demo-ul md.demo.1c.eu în sesiunea Contabil Sef (ro), fără modificarea documentelor. Inspectată fila „Vînzări (6)” a Comercializării 0000-00000001 din 29.09.2025: partener, contract, nomenclator, depozit, subdiviziune, grupă, cotă TVA, net, TVA, cantitate, cost și ajustări de cost separate. Exemple: Mănuși 4 buc., net 2 000, TVA 400, cost 100; Motor electric 10 buc., net 300 000, TVA 60 000, cost 158 333,33 și ajustare −0,03. Sunt exemple din 2025, nu reguli fiscale actuale.

Socot: ciornele pot conține până la 200 de poziții (produse/servicii), denumire, unitate, cantitate, preț, procent TVA introdus de utilizator, mod preț net/brut. Calcul cu întregi, rotunjire pe rând la bani, cantități până la trei zecimale. Nu se preia automat nicio cotă fiscală din demo. Ciornele incomplete se păstrează, iar totalul invalid nu este reutilizat. Copierea unei ciorne păstrează pozițiile cu identificatori noi. Nicio poziție nu actualizează stocurile.

LIMITĂ EXPLICITĂ: aceasta este pregătire locală, nu contabilizare TVA. invoiceFromDraft respinge ciornele cu poziții până la implementarea înregistrării pe linii, analiticelor și bazelor net/TVA/cost. Nu se elimină liniile la confirmare și nu se înregistrează totalul drept cheltuială/venit simplu. Nu există încă emitere de factură fiscală din aceste ciorne.

Verificare: 66 teste trecute. UI: ciornă separată de test „Socot Test poziții TVA”, 2 × 1 250 MDL cu TVA inclusă 20% introdusă explicit; net 2 083,33, TVA 416,67, total 2 500. Salvare reușită, zero operațiuni în coadă; confirmarea contabilă este blocată explicit. Testele verifică și redeschiderea datelor incomplete, fără total vechi.

## 13 octombrie 2026 — pregătirea pozițiilor de cumpărare/vânzare

- Selector de articole active din nomenclator: copiază denumirea, tipul și codul unității de măsură; referința articolului și valorile afișate se păstrează în ciornă. Modificarea manuală a denumirii/tipului/unității detașează referința. Modificările ulterioare din nomenclator nu rescriu documentul.
- Reducere procentuală pe rând, 0–100%, cu cel mult două zecimale. Valoarea cantitate × preț se rotunjește la bani, apoi reducerea se rotunjește și se scade în modul de preț selectat; ulterior se calculează/extrage TVA. Ciornele vechi fără reducere păstrează calculul anterior. Aceasta este convenția de calcul a ciornei, nu o regulă fiscală certificată.
- Copierea poziției produce identificator nou și păstrează datele editabile; maximum 200 de poziții. Articolele/unitățile arhivate nu sunt selectabile pentru rânduri noi.
- TVA rămâne explicită pentru articolul ales; nu se deduce o cotă din nomenclator. Prețul se introduce manual.
- Limita existentă rămâne: documentele cu poziții nu se postează încă, nu produc stocuri, articole TVA sau declarații. Nu s-a generat un installer nou pentru aceste modificări.
- Verificare: 69 de teste trecute și TypeScript fără erori în copia curată a proiectului; include reduceri net/brut, rotunjire la bani, input invalid, compatibilitate ciorne vechi și referințe la articole.
- Compilare web reușită. Verificare în browser la 127.0.0.1:3002: două rânduri de 100 MDL, reducere 10%, TVA introdusă 20% → net 180, TVA 36, total 216 MDL; copiere, salvare și reîncărcare confirmate. Captură: `artifacts/document-lines-20261013/reduceri.png`. Datele de test rămân numai în profilul demo de pe portul 3002.

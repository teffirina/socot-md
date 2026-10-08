# Verificări reale — 18 septembrie 2026

## Instalatoare 0.1.0 confirmate

Commit `08af0eea76a4f1b24abc3fa12608e306141c9b98`, [Actions 35305164936](https://github.com/teffirina/socot-md/actions/runs/35305164936): toate joburile de test/build au trecut.

- Windows x64: EXE NSIS și MSI reale; verificat antetul PE, extragerea administrativă MSI, instalarea silențioasă NSIS și pornirea executabilului instalat timp de 12 secunde pe runner Windows. Nu este un test manual exhaustiv al interfeței Windows.
- macOS ARM64: DMG real; `hdiutil verify` și `codesign --verify --deep --strict` reușite. Pornire locală și utilizare SQLite demonstrate. Identificator `md.socot.desktop`, executabil `Socot`.
- Pachetele updater Windows/macOS au semnături verificate criptografic; un pachet alterat a fost respins.
- Cele șapte fișiere au fost încărcate în release-ul privat **draft v0.1.0**. Repo-ul rămâne privat. Niciun site sau domeniu nu a fost publicat.
- Copii locale: `artifacts/ci-08af0ee/`.

## Versiunea 0.2.0 verificată

Profil companie cu control de versiune, conturi configurabile, opt roluri și permisiuni explicite, migrarea cache-ului web vechi, imprimare nativă și avertisment contabil. Instalatoarele 0.1.0 nu includ aceste modificări. Pentru 0.2.0, commit `e06324c7d2457ba52e0ba821a621a9634e62a20b`, [Actions 35343138362](https://github.com/teffirina/socot-md/actions/runs/35343138362) a trecut complet: API PostgreSQL 17 în Docker și ambele builduri native cu verificările de instalare/pornire Windows, DMG și semnături updater. Artefactele descărcate sunt în `artifacts/ci-e06324c/`.

Verificate local: 21 teste unitare/sincronizare, TypeScript și export Next.js. Testele API au rulat pe PostgreSQL temporar 18.4 cu trei migrații: izolare companii, autorizare, profil cu conflict 409, creare cont, idempotency concurentă, încasare, audit/jurnal nemodificabile, reguli versionate, închidere/redeschidere perioadă și export raport fără recipisă inventată. Testul folosește numai baza dedicată `socot_test`, eliminată la final.

Verificare UI web: datele vechi au fost recuperate la migrare; profilul demonstrativ a fost salvat în web și desktop SQLite. Pe macOS, 0.2.0 a pornit și a păstrat cele două facturi locale existente, inclusiv documentul de 0,05 MDL. DMG-ul local a trecut verificarea checksum și semnătura ad-hoc; pachetul updater a trecut verificarea criptografică și testul de alterare. Comanda nativă de imprimare a deschis dialogul real de imprimare/PDF; exportul unui PDF final nu a fost încă verificat.

## Erori reale întâlnite

- Semnătură macOS incompletă în primul build: remediată prin semnare ad-hoc și rebuild; verificarea strictă a trecut.
- `window.prompt` indisponibil în browserul de test: înlocuit cu formular React pentru încasări.
- Tip Prisma JSON nullable în auditul profilului: corectat cu `Prisma.JsonNull`.
- Testul nou de creare cont aștepta 201, ruta întorcea 200: testul a fost aliniat contractului; rerularea a trecut.
- Accesul refuzat era afișat ca offline: mesaj separat pentru HTTP 403 și ecran de acces limitat pentru rolurile fără module implementate.
- Semnarea locală updater 0.2.0 a cerut parolă într-un proces neinteractiv: remediată prin furnizarea explicită a parolei goale pentru cheia fără parolă; semnarea și verificarea ulterioară au trecut.
- `npx` nu există în PATH-ul local: comenzile de formatare folosesc direct executabilul Node al pachetului.

## Limite rămase

- macOS este semnat ad-hoc, fără notarizare Apple; Windows fără certificat Authenticode. Acestea sunt distincte de semnăturile updater.
- Nu există API public ori canal HTTPS updater activ. Instalarea unei actualizări complete între două versiuni nu a fost testată.
- Docker lipsește local; configurația Docker PostgreSQL 17 a fost însă executată în Actions. Testul local PostgreSQL nu este prezentat ca test Docker.
- macOS Intel necompilat; Windows UI verificat numai prin smoke test de pornire.
- Operațiunile offline acoperă facturile/încasările. Configurarea firmei, conturilor și operațiunile administrative API necesită conexiune; formularele păstrează valorile la eșec, dar nu sunt în coada persistentă.
- Backup/restaurare completă, achiziții/stocuri/salarii, integrare guvernamentală și conformitate fiscală nu sunt validate sau finalizate.
- Planul de conturi inițial are trei conturi demonstrative, nu planul național complet.

Sarcina extinsă nu este finalizată. Logurile și instalatoarele locale se găsesc în directorul ignorat `artifacts/`; nu conțin credențiale de producție.

## Rapoarte după analiza capturilor — 0.3 în dezvoltare

24 teste unitare/sincronizare au trecut, inclusiv sold inițial/rulaje/sold final, limite de perioadă, excluderea propunerilor și refuzul sumelor invalide. TypeScript și exportul web au trecut. API PostgreSQL: balanța după încasare parțială, acces refuzat operatorului, acces la sursă și izolare față de auditorul altei companii au trecut. UI web: balanță → cont 221 → document sursă verificat efectiv. Datele demo vechi fără metadate contabile sunt excluse explicit, nu postate automat.

Instalatoarele 0.2.0 nu includ rapoartele noi. Buildurile desktop au fost ulterior verificate în rulările menționate mai jos. Analiza celor opt capturi se află în REFERINTE-1C.md.

## Reorganizarea interfeței 0.3

Commit `29fbb1b`: navigare grupată, ecran Acasă cu cinci documente recente, alegere distinctă Creanțe/Balanță, formular companie în cinci secțiuni și acțiuni contextuale. TypeScript și export web reușite. Verificare vizuală în browser la dimensiunea normală și 620 px; revenire la dimensiunea inițială. Pornire nativă macOS 0.3.0 confirmată, cu trei documente locale existente păstrate. DMG-ul local, semnătura ad-hoc și semnătura updater au trecut verificările; un payload alterat a fost respins.

Buildul anterior, numai cu rapoarte (`a060cb6`), a trecut pe Windows și macOS în Actions 35344477065. Interfața reorganizată a trecut separat în Actions 35344988074 pe Windows și macOS.

## Eliminarea ecranului Plan de conturi — 19 septembrie 2026

Commit `188d1e2`: ecranul, formularul și încărcarea conturilor eliminate din Întreprindere, fără ștergerea datelor contabile. TypeScript/export web reușite. Confirmare vizuală web și macOS: formularul firmei este prezent, Plan de conturi absent. Cele trei documente SQLite existente și totalul 29.223,05 MDL au rămas intacte. Pornirea macOS a avut un timeout al instrumentului de accesibilitate; verificarea următoare a confirmat încărcarea și navigarea funcțională.

DMG local verificat cu hdiutil; semnătura ad-hoc validă; semnătura updater validă și pachet modificat respins. Lipsa notarizării Apple rămâne un avertisment real.

Actions [35425578844](https://github.com/teffirina/socot-md/actions/runs/35425578844) a încheiat cu succes pentru `188d1e2`: API/PostgreSQL, macOS și Windows. EXE instalat silențios și proces pornit 12 secunde; MSI extras administrativ și Socot.exe identificat. Semnăturile updater verificate criptografic, inclusiv respingerea pachetelor alterate. Avertismente CI: acțiunile v4 folosesc un runtime Node 20 depreciat, rulat de platformă pe Node 24; migrarea viitoare ubuntu-latest a fost anunțată. Aceste avertismente nu au făcut buildurile să eșueze.

## Cheltuieli — Socot 0.4.0

Commit `cae691d`: 26 teste unitare/sincronizare trecute, TypeScript și export web reușite. Test nou: cheltuiala are articol distinct de vânzare, plata parțială reduce datoria, tipul documentului nu poate fi schimbat, conflictul de versiune și depășirea totalului sunt refuzate. Coada cheltuielilor supraviețuiește restartului și păstrează profilul la sincronizare.

Verificare web efectivă: cheltuială demonstrativă 1.500 MDL, plată 500 MDL, sold 1.000 MDL, stare Parțial achitată, păstrate după reîncărcare; vânzările rămân 55.400 MDL. Noul document test rămâne în demo și este identificat explicit prin nume. API/PostgreSQL în Actions 35493089979: idempotency, plată parțială, conflict, drepturi, izolare între companii și excluderea cheltuielilor din raportul de creanțe au trecut.

macOS local 0.4.0: pornire și navigare la Cheltuieli confirmate; cele trei facturi SQLite existente, total 29.223,05 MDL, păstrate. DMG verificat, semnătură ad-hoc validă, semnătură updater validă și pachet alterat respins. Fără notarizare Apple.

Salvare SQLite suplimentară: documentul „Socot — test cheltuială SQLite”, 100 MDL, a fost păstrat după închiderea și repornirea aplicației. Repornirea a prezentat temporar o fereastră goală și erori AXError.cannotComplete ale instrumentului de accesibilitate; interfața s-a încărcat ulterior și documentul a fost confirmat. Cauza întârzierii nu este determinată; nu este prezentată ca pornire instantanee.

Actions [35493089979](https://github.com/teffirina/socot-md/actions/runs/35493089979) a trecut integral pentru `cae691d`: API/PostgreSQL, Windows și macOS. Windows: instalare EXE NSIS, pornire 12 secunde și extragere MSI; macOS: DMG și bundle verificate. Semnăturile updater și respingerea pachetelor alterate au trecut pe ambele platforme. Avertismentele de runtime Actions, lipsa notarizării Apple/Authenticode și lipsa canalului public updater rămân valabile.

## Nomenclatoare — Socot 0.5.0

29 teste trecute, TypeScript și export web reușite. Run 35507822532 a trecut API/PostgreSQL și ambele builduri native pentru 31e4e6c. Browser: partener TEST-CAT salvat, păstrat după reîncărcare, selectat în formularul facturii; nu a fost emisă factură suplimentară.

Desktop 0.5.0: cele trei facturi anterioare, total 29.223,05 MDL, au fost confirmate după pornire. Formularul nou s-a blocat în verificarea automată. Eșantionarea procesului a confirmat acces Keychain pe firul principal, în SecKeychainFindGenericPassword. Corecția e28f533 mută local_read/local_write în spawn_blocking, cu serializarea accesului la cheia de criptare. Nu schimbă cheia sau formatul datelor. Verificarea manuală completă după corecție rămâne necesară; nu atribuim toate erorile instrumentului de accesibilitate aplicației.

Limite: 212 cerințe în matrice, majoritatea încă deschise; registrele de referință nu implementează salarizare, stocuri, amortizare sau producție. Semnarea updater nu echivalează cu notarizare Apple ori Authenticode.

## Spațiu de lucru — Socot 0.6.0 (22.09.2026)

Commit aplicație `8bda39d`: 36 teste trecute, TypeScript și export web reușite. PostgreSQL temporar: migrarea provenienței și integrarea API trecute. Importul XLSX real în browser a ignorat rezultatul memorat 999 și a calculat 25 MDL; duplicatul a fost semnalat, editarea a supraviețuit reîncărcării, iar confirmarea a creat o cheltuială demonstrativă de 25 MDL cu sursa păstrată. Datele anterioare nu au fost șterse.

DMG local final 0.6.0: checksum verificat de hdiutil, semnătură ad-hoc verificată, semnătură updater validă și pachet alterat respins. SHA256: `cdcf3191706d90913d813d192ca959d4891d661a3eccd72a2d439614f9860e3d`. Instrucțiuni și limite: [Spațiu de lucru](SPATIU-DE-LUCRU.md).

Importul nu finalizează cele 212 cerințe ale platformei. Originalele sunt locale; arhivarea comună, pozițiile de produse, corecțiile/storno și generarea completă a documentelor fiscale sunt încă de implementat. Testarea manuală completă a interfeței Windows și macOS pentru acest flux rămâne distinctă de verificarea instalatoarelor în CI.

Actions [35757583357](https://github.com/teffirina/socot-md/actions/runs/35757583357) a trecut integral pentru `8bda39d`: API/PostgreSQL și builduri Windows/macOS. EXE NSIS instalat și proces pornit 12 secunde pe Windows; MSI extras cu Socot.exe prezent; DMG și bundle macOS verificate. Semnăturile updater au trecut inclusiv testul de alterare, apoi EXE și MSI descărcate au fost reverificate local. Arhiva pentru coleg, fără cont GitHub: `artifacts/Socot-0.6.0-Testare-Windows.zip` (copie și pe Desktop), cu EXE, semnătură, instrucțiuni, CSV fictiv și checksumuri. Nu conține datele firmei.

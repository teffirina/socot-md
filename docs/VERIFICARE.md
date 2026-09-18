# Verificări reale — 18 septembrie 2026

## Instalatoare 0.1.0 confirmate

Commit `08af0eea76a4f1b24abc3fa12608e306141c9b98`, [Actions 35305164936](https://github.com/teffirina/socot-md/actions/runs/35305164936): toate joburile de test/build au trecut.

- Windows x64: EXE NSIS și MSI reale; verificat antetul PE, extragerea administrativă MSI, instalarea silențioasă NSIS și pornirea executabilului instalat timp de 12 secunde pe runner Windows. Nu este un test manual exhaustiv al interfeței Windows.
- macOS ARM64: DMG real; `hdiutil verify` și `codesign --verify --deep --strict` reușite. Pornire locală și utilizare SQLite demonstrate. Identificator `md.socot.desktop`, executabil `Socot`.
- Pachetele updater Windows/macOS au semnături verificate criptografic; un pachet alterat a fost respins.
- Cele șapte fișiere au fost încărcate în release-ul privat **draft v0.1.0**. Repo-ul rămâne privat. Niciun site sau domeniu nu a fost publicat.
- Copii locale: `artifacts/ci-08af0ee/`.

## Modificări 0.2.0

Profil companie cu control de versiune, conturi configurabile, opt roluri și permisiuni explicite, migrarea cache-ului web vechi, imprimare nativă și avertisment contabil. Instalatoarele 0.1.0 nu includ aceste modificări.

Verificate local: 21 teste unitare/sincronizare, TypeScript și export Next.js. Testele API au rulat pe PostgreSQL temporar 18.4 cu trei migrații: izolare companii, autorizare, profil cu conflict 409, creare cont, idempotency concurentă, încasare, audit/jurnal nemodificabile, reguli versionate, închidere/redeschidere perioadă și export raport fără recipisă inventată. Testul folosește numai baza dedicată `socot_test`, eliminată la final.

Verificare UI web: datele vechi au fost recuperate la migrare; profilul demonstrativ a fost salvat. Pe macOS, comanda nativă de imprimare a deschis dialogul real de imprimare/PDF; exportul unui PDF final nu a fost încă verificat.

## Erori reale întâlnite

- Semnătură macOS incompletă în primul build: remediată prin semnare ad-hoc și rebuild; verificarea strictă a trecut.
- `window.prompt` indisponibil în browserul de test: înlocuit cu formular React pentru încasări.
- Tip Prisma JSON nullable în auditul profilului: corectat cu `Prisma.JsonNull`.
- Testul nou de creare cont aștepta 201, ruta întorcea 200: testul a fost aliniat contractului; rerularea a trecut.
- Accesul refuzat era afișat ca offline: mesaj separat pentru HTTP 403 și ecran de acces limitat pentru rolurile fără module implementate.
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

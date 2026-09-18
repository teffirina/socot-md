# Socot

Aplicație financiară originală, în română, cu aceeași interfață Next.js pentru web și Tauri 2 pentru desktop. Identificator: `md.socot.desktop`. Executabil: `Socot` / `Socot.exe`.

**Stadiu:** fundație funcțională și flux simplificat de facturare, nu platformă contabilă completă. Consultați [raportul verificărilor](docs/VERIFICARE.md) pentru artefactele reale și limitările curente. Repository privat: https://github.com/teffirina/socot-md. Domeniile `app.socot.md` și `api.socot.md` sunt doar adrese propuse, nu servicii publicate.

## Rulare web și API local

Necesită Node.js 22+, npm, Docker cu Compose; desktop: Rust stable, Xcode Command Line Tools pe macOS / Microsoft C++ Build Tools și WebView2 pe Windows.

```sh
npm ci
cp .env.example .env
# Completează în .env POSTGRES_PASSWORD și DATABASE_URL, folosind un secret local.
# DATABASE_URL=postgresql://socot:<parola-locală>@localhost:5432/socot
chmod 600 .env
docker compose up -d
npm run db:generate
npm run db:migrate
npm run build
node --env-file=.env --import tsx server/index.ts
```

Deschide `http://localhost:3000`. API-ul este la `http://localhost:3000/api`. Web este export static în `out/`; serverul Express servește fișierele și API-ul. Pentru editarea interfeței, rulează `npm run dev -- --port 3001`; setează originea permisă a API-ului la `http://localhost:3001` în timpul dezvoltării.

Inițializare conturi demonstrative: setează temporar variabila `SOCOT_DEMO_PASSWORD` la o valoare de minimum 12 caractere și execută `npm run db:seed` cu `DATABASE_URL` disponibil. Nu salva parola de autentificare în repository. Conturile sunt `admin@demo.socot.local`, `director@demo.socot.local`, `accountant@demo.socot.local`, `operator@demo.socot.local`. Parolele sunt hash-uite bcrypt pe server. Directorul are acces de citire; celelalte roluri pot emite facturi și înregistra încasări.

## Desktop și demonstrație SQLite

```sh
npm run desktop
# Native dev accepts loopback HTTP; production releases require HTTPS.
SOCOT_API_URL=https://api-serverul-tau.example/api npm run desktop:build
```

Pe Windows setează variabila prin PowerShell: `$env:SOCOT_API_URL='https://api-serverul-tau.example/api'`.

Butonul „Deschide demonstrația SQLite” funcționează fără PostgreSQL și fără internet. Datele se păstrează în baza SQLite din directorul de date al aplicației. Payload-urile sunt criptate AES-256-GCM; cheia este în macOS Keychain / Windows Credential Manager. Demo în browser folosește IndexedDB, nu SQLite. Cele două moduri sunt etichetate separat. Datele demonstrative nu se trimit niciodată API-ului.

În demo se inițializează șase facturi fictive, încasări și jurnal pentru trei luni, numai dacă baza este nouă. Datele deja existente sunt păstrate. Articolele contabile sunt un model configurabil în cod, fără TVA și fără validare fiscală.

## Instalare

- macOS: deschide DMG-ul și copiază `Socot.app` în Applications. Buildurile curente sunt semnate ad-hoc; nu sunt notarizate Apple și nu reprezintă o distribuție publică aprobată Gatekeeper.
- Windows: rulează `Socot_…-setup.exe` (NSIS) sau `.msi`. Nu instala simultan ambele variante. Executabilul instalat este `Socot.exe`. WebView2 este necesar. Certificatul Authenticode nu este configurat în această etapă.
- Dezinstalarea aplicației nu este o comandă de ștergere a datelor. Sincronizează operațiunile și exportă documentele înainte de eliminarea datelor aplicației sau a cheilor OS.

## Offline și conflicte

Operațiunea este salvată durabil înainte de trimitere. Se trimite cu UUID de idempotency și versiunea documentului. Serverul efectuează actualizarea, jurnalul și auditul într-o singură tranzacție PostgreSQL. Un răspuns pierdut poate fi retrimis cu același UUID fără dublare. Cheile idempotency sunt păstrate pe server fără expirare în acest MVP.

Sincronizarea rulează la revenirea conexiunii și la 15 secunde. HTTP 409 oprește operațiunea și cere alegerea utilizatorului. Confirmarea locală generează un UUID nou și folosește noua versiune; nu suprascrie în tăcere modificările altuia. O sesiune expirată cere reautentificare; coada rămâne pe disc. Nu sunt acceptate operațiuni noi pentru aceeași factură până la rezolvarea celei în așteptare.

Desktopul rulează într-o singură instanță; web folosește Web Locks pentru a evita concurența între file. Cache-ul se limitează la 200 de facturi în modul API, plus operațiunile nesincronizate. Deconectarea este blocată când există operațiuni în așteptare; după deconectarea reușită cache-ul contului este golit. La repornire offline se recuperează ultimul profil local; acesta nu acordă permisiuni suplimentare pe server.

## Actualizări semnate și builduri CI

Cheia publică de verificare este în `src-tauri/updater.pub`. Cheia privată nu intră în Git și este necesară în secretul Actions `TAURI_SIGNING_PRIVATE_KEY`. Parola sa, dacă există, intră în `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

```sh
npm run tauri signer generate -w /cale/privata/socot.key
# Păstrează cheia și parola în seiful organizației, în afara proiectului.
# Copiază NUMAI cheia publică în src-tauri/updater.pub.
node scripts/release-config.mjs
npm run desktop:build -- --config src-tauri/tauri.release.conf.json
```

Nu genera o cheie nouă pentru fiecare release: aplicațiile instalate trebuie să poată verifica cheia publică deja inclusă. Pierderea cheii private împiedică actualizarea normală a versiunilor vechi.

Workflow-ul `.github/workflows/build.yml` rulează teste PostgreSQL și builduri native separate Windows/macOS. Toate buildurile produc artefacte Actions. Un tag `v…` creează un **release privat în draft**, după trecerea testelor, cu instalatoare și semnături updater. Nu publică site-ul, domeniile sau release-ul final.

Configurează `SOCOT_API_URL` și `SOCOT_UPDATE_URL` ca variabile GitHub numai după ce endpoint-urile HTTPS există și sunt aprobate. Fără `SOCOT_UPDATE_URL`, verificarea actualizărilor nu are un canal activ; nu se pretinde că un server există. Endpoint-ul trebuie să răspundă în formatul updater Tauri, cu versiune, URL HTTPS al pachetului potrivit platformei și conținutul fișierului `.sig`. Un repository GitHub privat nu este un CDN accesibil implicit clienților: NU distribui un token GitHub în aplicație. Folosește un endpoint de distribuție dedicat, după autorizarea publicării.

Aplicația verifică automat la pornire; utilizatorul confirmă instalarea și restartul, după golirea cozii. Tauri verifică semnătura înainte de instalare. Semnătura updater este separată de Apple Developer/Authenticode.

## Verificare

```sh
npm test
npm run typecheck
npm run build
npm run db:migrate
# Cu API-ul pornit și o bază de test dedicată:
npx tsx tests/api.integration.ts
```

Testul de integrare creează și șterge exclusiv companiile `test-company-a/b`; folosește numai o bază de test. Documentație API: [docs/API.md](docs/API.md). Domeniu și limitări: [docs/PLAN.md](docs/PLAN.md).

Pentru producție sunt necesare găzduire autorizată, TLS, backup și restaurare testate, monitorizare, rotația secretelor, politici de acces și validarea contabilă. Desktopul nu conține credențiale PostgreSQL.

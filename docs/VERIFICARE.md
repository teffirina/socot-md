# Verificări reale — 17 septembrie 2026

## Rezultat curent

Sarcina NU este încă finalizată: EXE/MSI nu au fost generate, iar codul nu a fost încă încărcat în repository-ul privat. Autorizarea GitHub CLI a expirat fără aprobare; este necesară reautorizarea pentru push și Actions.

## Executate cu succes

- Build Next.js static pentru web și aceeași interfață inclusă în Tauri 2.
- TypeScript, fără erori.
- 10 teste unitare și de sincronizare: emitere, plată parțială, creanță, validare sume, conflict, persistență după restart, răspuns pierdut și retry cu același ID, apeluri concurente, disc plin, date demo pe trei luni, alegerea explicită a versiunii locale.
- API verificat cu un proces PostgreSQL 18.4 temporar, ascultând numai pe loopback; migrația a fost aplicată. Autentificare, autorizare pe rol, izolarea companiilor, idempotency concurentă, încasare, conflict, audit și jurnal: PASS. Procesul și baza de test au fost oprite/eliminate la final. Acesta nu a fost un test Docker.
- `Socot.app`, executabil Mach-O ARM64 `Socot`, identificator `md.socot.desktop`.
- DMG real `Socot_0.1.0_aarch64.dmg`, verificare checksum `hdiutil verify`.
- Semnare ad-hoc a pachetului macOS; `codesign --verify --deep --strict` a trecut după corectare.
- Pornire reală a aplicației macOS și acces la demonstrația SQLite.
- Baza locală: `PRAGMA integrity_check = ok`; payload-ul facturii nu este text în clar.
- Pachet updater `Socot.app.tar.gz` și `.sig` generate. Verificare cu cheia publică: PASS; alterarea pachetului este respinsă.
- Audit npm pentru dependențele de producție: 0 vulnerabilități raportate la momentul verificării, după actualizarea dependenței tranzitive.
- Test UI web: autentificare demonstrativă, emitere factură 6000 MDL și actualizarea creanței.

## Erori întâlnite și remedieri

1. TypeScript: rezultatul `invoke` era `unknown`; adăugat tipul răspunsului nativ.
2. macOS: pachetul inițial avea semnătură incompletă (`code has no resources but signature indicates they must be present`). Configurat `signingIdentity: "-"`, refăcut buildul și verificat strict.
3. Dialogul `window.prompt` nu a funcționat în browserul de test. Înlocuit cu formular React pentru încasare și confirmare explicită.
4. `deepmerge-ts` avea un advisory pentru epuizarea stivei la grafuri recursive. Actualizat la versiunea 8 prin override și reluat verificările.
5. Prevenite concurența între instanțe/file, pierderea accesului la coadă după expirarea sesiunii și reutilizarea cache-ului între endpoint-uri API diferite.

## Neexecutate / limite

- Build Windows, instalare EXE/MSI și smoke test Windows: în așteptarea accesului CLI la GitHub și a runnerului Windows.
- Workflow-ul GitHub Actions este scris, dar nu a rulat încă.
- Publicarea artefactelor în release privat draft nu a avut loc încă.
- Docker lipsește: symlink-ul existent trimite la o aplicație Docker absentă. Compose este livrat, dar nu a fost rulat local.
- Nu există API public și nici canal updater public. Adresele propuse nu au fost activate sau folosite ca servicii existente.
- Test de actualizare completă între două versiuni instalate: neexecutat; au fost verificate semnătura și respingerea pachetului modificat.
- Fără certificat Apple Developer/notarizare și fără certificat Authenticode Windows.
- Numai macOS ARM64 verificat local. Intel necesită build separat.
- Backup/restaurare, migrarea între versiuni de business, scenarii E2E exhaustive și conformitatea fiscală nu sunt validate.
- Modul demo păstrează documentele local până la ștergere explicită; cache-ul API este limitat la 200 documente. Erorile permanente necesită anulare explicită și recreare; nu sunt șterse automat.

Loguri locale: `artifacts/desktop-build.log`, `artifacts/tests.log`, `artifacts/api-integration.log`, `artifacts/update-verification.log`, `artifacts/npm-audit.json`. Acestea nu sunt commit-uite automat. Instalatoarele se află în `src-tauri/target/release/bundle/`.

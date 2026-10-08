# Socot 0.7.0 — versiune de testare

Include modificările din spațiul de lucru până la 8 octombrie 2026: foi de calcul integrate, import cu verificare, organizarea modulelor, ciorne cu poziții și calcul net/TVA/total, vizualizarea mișcărilor debit/credit și reguli de repartizare în mai multe articole contabile.

## Limite importante

- Nu reprezintă paritate completă cu 1C sau Microsoft Excel.
- Ciornele cu poziții se pot salva și verifica; confirmarea lor în modelul contabil simplificat este blocată explicit. Nu generează automat stocuri sau declarații fiscale.
- Repartizarea în articole multiple nu înlocuiește un motor complet de TVA și costuri pe loturi.
- Adresele de producție nu sunt presupuse active. Modul demonstrativ local este destinat testării; pentru lucru comun este necesar API-ul configurat și baza PostgreSQL.
- Actualizările pot fi verificate cu cheia Socot existentă, dar distribuția automată necesită un endpoint HTTPS funcțional. Semnătura updater nu este notarizare Apple.
- Pachetul macOS folosește semnare ad-hoc; nu are certificat Developer ID și nu este notarizat de Apple. Windows nu are certificat Authenticode.

## Instalare și actualizare macOS

1. Alege DMG-ul potrivit procesorului: `aarch64` pentru Apple Silicon; nu presupune compatibilitate Intel.
2. Închide Socot, apoi deschide DMG-ul și copiază Socot în Applications. La actualizare, înlocuiește aplicația existentă.
3. Deschide Socot. Dacă macOS blochează versiunea de testare, verifică proveniența și suma SHA-256 înainte de a folosi opțiunea sistemului pentru deschidere. Nu dezactiva protecțiile globale ale sistemului.
4. La cererea Keychain, acordă acces aplicației numai după verificarea identității acesteia. Nu șterge cheile sau datele locale pentru a elimina dialogul: datele existente pot depinde de acele chei.

Păstrează o copie de siguranță înainte de actualizare. Identificatorul aplicației rămâne `md.socot.desktop`, iar executabilul `Socot`. Actualizarea aplicației nu este o migrare automată a serverului.

## Server

Versiunea include migrarea `202610070001_posting_groups`, care permite mai multe articole per operațiune și adaugă repartizări regulilor. Administratorul aplică migrările PostgreSQL înainte de pornirea API-ului nou, după backup. Nu se aplică automat bazei firmei la instalarea DMG-ului.

## Verificare

Rezultatele definitive ale împachetării și testelor sunt consemnate în release-ul GitHub și raportul local al buildului. Nu se consideră verificată instalarea pe un alt Mac doar pentru că DMG-ul a fost generat.

### Rezultate confirmate la 8 octombrie 2026

Pentru commitul `6ecbe4c` (tag `v0.7.0`):

- Local: TypeScript, 66/66 teste și build web static reușite.
- Local: Tauri a generat aplicația și DMG-ul Apple Silicon; `hdiutil verify` și verificarea semnăturii ad-hoc au trecut. Identificatorul și versiunea sunt corecte.
- Local: aplicația din DMG a pornit; foile de calcul și registrul documentelor au fost accesibile în modul SQLite, cu datele locale existente vizibile.
- Semnătura updater a fost verificată cu cheia existentă; pachetul alterat a fost respins.
- GitHub: jobul API (inclusiv migrările PostgreSQL și testele de integrare) și jobul macOS au trecut. Artefactul macOS descărcat a trecut și verificarea locală de integritate/semnătură.
- Windows era încă în compilare la redactarea acestei note. Starea finală și instalatoarele se verifică în [rularea versiunii](https://github.com/teffirina/socot-md/actions/runs/37780668621).

SHA-256 al DMG-ului construit local (diferit de pachetul construit independent de GitHub): `a69ca517baa441c6b4b9d0887f8439e1c53cbcf17f1bfe05f07de55421049fb8`.

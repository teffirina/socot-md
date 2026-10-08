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

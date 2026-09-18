# Plan și domeniu de implementare

Repository-ul de pornire era gol. Nu exista o platformă de convertit sau un API de conectat. Cererea activă: fundație Socot web + Tauri 2, SQLite demonstrativ și API PostgreSQL, instalatoare reale.

1. Next.js static export, interfață comună desktop/web, identitate Socot.
2. API separat Express/Prisma/PostgreSQL; serverul servește web și /api pe portul 3000.
3. Flux vertical: factură simplificată de servicii fără TVA → creanță → încasare parțială → raport. Server: jurnal și audit atomice.
4. Coada durabilă, idempotency UUID și conflict de versiune, confirmare explicită.
5. SQLite criptat și stocarea OS a secretelor în desktop.
6. Compilare macOS local, Windows/macOS în Actions, verificări și release privat draft.

Specificația inițială descrie o platformă mult mai mare. Produse, stocuri, TVA, importuri, raportări fiscale, asistent AI și majoritatea modulelor nu sunt implementate în această fundație. Nu există integrare 1C sau guvernamentală. Nu se afirmă conformitate fiscală ori adecvare pentru producție.

## Etapele din specificația extinsă

1. **În lucru:** autentificare, întreprindere, opt roluri, audit, conturi configurabile. Lipsesc administrarea utilizatorilor din UI, organizații multiple per utilizator și importul validat al planului național complet.
2. **Parțial:** factură simplificată → propunere contabilă → încasare parțială/completă → creanțe → raport. Lipsesc poziții detaliate, numerotare fiscală, storno și ciclul complet de documente.
3. **Neimplementat:** achiziție → recepție → datorie → plată → stoc → raport.
4. **Neimplementat:** bancă/casă, import și reconciliere.
5. **Neimplementat:** stocuri, inventariere, mijloace fixe și obiecte de mică valoare.
6. **Neimplementat:** personal, salarii și închidere lunară completă.
7. **Fundație tehnică:** reguli versionate și adaptoare care refuză explicit transmiterea fără integrare. Formulare oficiale, reguli fiscale validate și migrare 1C nu sunt implementate.

Nu se adaugă butoane decorative pentru etapele neimplementate. Fiecare etapă trebuie verificată pe date demonstrative și API PostgreSQL înainte de a fi declarată finalizată. Cele opt capturi au fost furnizate și analizate ulterior în REFERINTE-1C.md. Identitatea vizuală Socot rămâne originală.

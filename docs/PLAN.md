# Plan și domeniu de implementare

Repository-ul de pornire era gol. Nu exista o platformă de convertit sau un API de conectat. Cererea activă: fundație Socot web + Tauri 2, SQLite demonstrativ și API PostgreSQL, instalatoare reale.

1. Next.js static export, interfață comună desktop/web, identitate Socot.
2. API separat Express/Prisma/PostgreSQL; serverul servește web și /api pe portul 3000.
3. Flux vertical: factură simplificată de servicii fără TVA → creanță → încasare parțială → raport. Server: jurnal și audit atomice.
4. Coada durabilă, idempotency UUID și conflict de versiune, confirmare explicită.
5. SQLite criptat și stocarea OS a secretelor în desktop.
6. Compilare macOS local, Windows/macOS în Actions, verificări și release privat draft.

Specificația inițială descrie o platformă mult mai mare. Produse, stocuri, TVA, importuri, raportări fiscale, asistent AI și majoritatea modulelor nu sunt implementate în această fundație. Nu există integrare 1C sau guvernamentală. Nu se afirmă conformitate fiscală ori adecvare pentru producție.

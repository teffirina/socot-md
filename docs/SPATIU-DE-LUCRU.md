# Spațiul de lucru Socot 0.6

Flux implementat: import local XLSX/CSV/TSV → editare și formule → verificare explicită → document de vânzare/cheltuială → propunere în jurnalul existent. Nu necesită Excel instalat sau 1C.

## Folosire

1. Deschide **Activitate → Spațiu de lucru** și alege un fișier. Primul rând trebuie să conțină antetele. Importul singur nu schimbă documentele sau jurnalul.
2. Alege coloanele Partener, Data, Total MDL și tipul operațiunilor. Denumirile obișnuite propun automat o corespondență. Editează celulele; ieșirea din celulă salvează modificarea. Poți lipi un dreptunghi TSV în limitele tabelului și filtra rândurile.
3. Folosește **Arată originalul** pentru comparație. Originalul binar este păstrat separat și poate fi descărcat identic. Reîncărcarea aplicației păstrează prelucrarea.
4. **Verifică operațiunile** arată sumele calculate și datele normalizate. Datele/sumele/partenerii lipsă și posibilele duplicate blochează rândul. Corectează întregul tabel înainte de prima confirmare.
5. Confirmă fiecare rând dorit. Prima confirmare blochează tabelul pentru păstrarea provenienței. Documentele intră în fluxul existent cu reguli, perioade, roluri, audit și coadă offline. Postarea articolelor rămâne distinctă de crearea documentului.
6. Vezi documentul la **Cheltuieli** sau **Vânzări**, apoi jurnalul și rapoartele. Referința importului conține SHA-256 al originalului, foaia și rândul. Nu reprezintă verificarea autenticității juridice a fișierului.

## Compatibilitate și limite explicite

- O foaie, 500 rânduri de date, 26 coloane, fișier maximum 512.000 bytes; spațiul serializat maximum 2 milioane caractere. CSV/TSV UTF-8.
- XLSX fără celule îmbinate, hyperlinkuri/valori complexe neacceptate sau criptare. Arhiva este verificată înainte de decomprimare: maximum 200 intrări și 10 MB declarați necomprimați.
- Formule: numere cu punct zecimal, +, -, *, /, paranteze, referințe A1/$A$1 și SUM cu intervale/argumente. Referințele circulare, împărțirea la zero și formulele necunoscute produc erori. Nu executăm macrocomenzi, cod, legături externe sau formule prin eval. Rezultatele cache din Excel sunt ignorate.
- Un rând reprezintă un document cu total în MDL. Nu există încă import de poziții de produse, TVA pe linii sau identificare asistată a produselor/partenerilor din nomenclatoare.
- Detectarea duplicatelor compară tip/partener/data/total în import și documentele încărcate local (ultimele 200). Nu este o căutare globală pe server. ID stabil pentru același fișier/foaie/rând/profil împiedică recrearea oarbă a documentului; conflictele se gestionează în coada existentă.
- Un singur import activ pe profil/dispozitiv. Originalul și prelucrarea sunt locale, nu se sincronizează între utilizatori. Desktop: același SQLite criptat; browser: IndexedDB. Eliminarea copiei locale este explicită și este blocată cât timp există operațiuni aferente în coadă. Păstrează originalele în arhiva firmei înainte de eliminare.

## Ce nu este încă finalizat

Arhivare comună pe server, loturi multiple, identificare de produse, editare liberă a documentelor în lucru, storno/corecții motivate ale documentelor postate, compatibilitate Excel extinsă și generarea completă a facturilor fiscale/declarațiilor oficiale din acest flux. Formele și exporturile existente nu capătă automat statut fiscal oficial. Generarea, transmiterea și recipisa rămân etape distincte.

## Verificare 22.09.2026

36 teste unitare/integrate locale trecute; build web trecut; PostgreSQL temporar: migrare și integrare API trecute, inclusiv persistența sursei și idempotența. Browser: import XLSX cu cache fals 999 recalculat corect la 25; duplicate detectate; corectare de partener păstrată după reload; confirmarea rândului creează documentul demonstrativ o singură dată.

> Actualizare: editorul principal a fost înlocuit cu Socot · Foi de calcul. Vezi [FOI-DE-CALCUL.md](FOI-DE-CALCUL.md). Descrierea de mai jos privește editorul anterior, păstrat pentru verificarea contabilă.

# Tabele manuale în Socot

În Spațiu de lucru, alege „Tabel nou — introducere manuală” (sau „Tabel nou” dacă există deja un tabel). Completează celulele; salvarea locală are loc la ieșirea din celulă. Poți modifica titlul și antetele, adăuga rânduri și coloane și redeschide tabelele anterioare.

Modelul inițial conține Partener, Data, Total, Descriere, Cantitate și Preț unitar. Totalul primului rând este =E2*F2. Pentru rânduri suplimentare introdu formula potrivită explicit. Formulele acceptate sunt operațiile aritmetice, paranteze, referințe și SUM; nu sunt acceptate macrocomenzi sau toate funcțiile Microsoft Excel.

„Verifică operațiunile” verifică partenerul, data și totalul din coloanele selectate. Confirmarea individuală creează documentul și propunerea contabilă prin fluxul existent. Coloanele descriptive suplimentare rămân în tabel; nu sunt convertite automat în poziții de factură fiscală. Editarea tabelului nu modifică soldurile. După prima confirmare tabelul se blochează pentru trasabilitate.

„Descarcă Excel (.xlsx)” exportă valorile și formulele. „Imprimă / PDF” deschide imprimarea browserului. Tabelele sunt locale profilului curent, nu arhivate pe server; exportă o copie pentru păstrare externă. Limite: 500 rânduri de date, 26 coloane, 2 MB per tabel și 20 tabele arhivate. Eliminarea copiei active nu șterge tabelele arhivate anterior.

## Verificare — 6 octombrie 2026

43 teste trecute, inclusiv export XLSX și recitire cu verificarea formulelor, valorilor numerice și identificatorilor cu zero inițial. Build web de producție și TypeScript trecute într-o copie curată a proiectului cu dependențele din lockfile. Verificat în browser: creare manuală, păstrarea tabelului anterior, editare, calcul și persistență după reîncărcare. Descărcarea prin browserul integrat a expirat la așteptarea evenimentului; livrarea fișierului prin această interfață nu este confirmată. Imprimarea/PDF și noul build desktop nu au fost verificate în această schimbare.

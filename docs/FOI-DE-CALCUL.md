# Socot · Foi de calcul

În Spațiu de lucru, editorul principal este acum Univer Sheets 1.0.3 (Apache-2.0), încărcat local în aceeași interfață web/Tauri. Nu este Microsoft Excel și nu necesită instalarea lui. Nu folosește servicii de conversie sau conturi externe.

## Lucrul cu registre

- Registru gol sau model de cheltuieli, denumire proprie, mai multe foi, celule selectabile și copiere/lipire TSV.
- Bară de formule; motor de formule Univer. Testate în browser ROUND și SUM între foi. Compatibilitatea tuturor funcțiilor Excel nu este garantată.
- Formatare text, culori, borduri, aliniere, îmbinări, dimensiuni, înghețare, anulare/refacere; sortare, filtre, căutare/înlocuire, validări și formatare condițională prin extensii OSS.
- Ecran mare pentru lucru; pe ecrane înguste, bara de instrumente poate grupa comenzile în meniul suplimentar.
- Interfață parțial română; unele meniuri ale motorului rămân în engleză.

## Salvare și fișiere

Salvare automată locală după operațiuni, cu indicator de stare și avertizare la închidere cât timp există modificări nesalvate. Salvările sunt serializate. În browser se utilizează IndexedDB; desktopul folosește mecanismul existent de stocare criptată. Așteaptă „Salvat local”. Datele nu sunt sincronizate între dispozitive.

Import XLSX cu 1–20 foi, până la 2 MB comprimat / 10 MB decomprimat, 10.000 rânduri și 256 coloane/foaie. Conversia peste 4,5 MB este refuzată. CSV/TSV păstrează limitele parserului existent (500 rânduri și 26 coloane). Cel mult 20 registre locale. Aceste limite nu echivalează cu limitele Microsoft Excel.

Import/export: valori, formule, text cu zerouri inițiale, formatare de bază, îmbinări, dimensiuni și înghețare. Originalul importat este păstrat separat, descărcabil. Rezultatele formulelor din fișier nu sunt considerate de încredere; motorul le recalculează.

Exportul XLSX nu păstrează toate facilitățile avansate: validările, regulile condiționale, filtrele și alte resurse ale editorului pot lipsi. „Copie completă” păstrează snapshotul JSON al editorului; „Deschide fișier” restaurează .socot.json ca registru nou. Imprimarea/PDF generează local o foaie cu valorile calculate și formatare de bază; nu este un motor complet de paginare Excel.

Sunt disponibile centralizări Socot și grafice simple în panoul de analiză (vezi actualizarea de mai jos). Nu sunt implementate VBA/macros, Power Query, toate funcțiile pivot/grafice native Excel, imagini Excel sau colaborare simultană. XLS/XLSM sunt refuzate. Pentru fișiere complexe, folosește originalul drept referință; nu presupune fidelitate completă după conversie.

## Legătura cu documentele Socot

„Pregătește foaia pentru contabilitate” finalizează editarea și așteaptă calculul, apoi copiază valorile foii active în fluxul existent de verificare. Formulele cu rezultate lipsă sau erori sunt blocate. Datele calendaristice formatate numeric sunt convertite în ISO. Se păstrează separat snapshotul registrului la transfer, identificatorul foii și hashul datelor.

Foaia contabilă trebuie să aibă antet și cel mult 500 de rânduri, 26 coloane. Se aleg Partener, Data și Total. Validarea și confirmarea rămân explicite. Editarea registrului nu postează în contabilitate. Detaliile suplimentare nu devin automat poziții de factură fiscală.

Tabelul activ din vechiul editor este copiat automat la primul acces; înregistrarea veche și arhiva ei nu sunt șterse. Tabelele anterioare se găsesc și în verificarea contabilă.

## Verificare, 6 octombrie 2026

- 48 teste trecute, inclusiv conversie XLSX cu foi multiple, formule fără cache învechit, stiluri/îmbinări, date calendaristice, restaurare și escapare HTML pentru imprimare.
- Build static Next.js + verificare TypeScript reușite în copia curată /tmp/socot-workflow-check-20261003, din lockfile. Audit npm după actualizări compatibile: 0 vulnerabilități raportate.
- Browser: grilă și instrumente la lățime îngustă și desktop, model de cheltuieli, lipire TSV, ROUND(2*12.5,2)=25, foaie suplimentară, SUM între foi=25, salvare și redeschidere după reload, pregătire contabilă cu partener/data/25.00 și confirmare disponibilă. Rândul demonstrativ nu a fost confirmat în contabilitate.
- Descărcarea XLSX prin browserul integrat nu a emis evenimentul de descărcare în 8 secunde; fișierul produs de adaptor este verificat automat, livrarea prin acest browser rămâne neconfirmată. Dialogul de imprimare și buildurile desktop pentru această modificare nu au fost testate.

## Surse și licență

Univer și extensiile folosite: Apache-2.0. ExcelJS: MIT. Pachetele rămân în lockfile, fără biblioteci Pro sau chei de licență.

- https://docs.univer.ai/guides/sheets/getting-started/integrations/react
- https://docs.univer.ai/guides/sheets/features/core
- https://docs.univer.ai/guides/sheets/features/import-export — convertorul oficial cu server nu este folosit; Socot are adaptor local ExcelJS, cu limitele de mai sus.


## Actualizare — 7 octombrie 2026

„Centralizare / grafic” grupează foaia activă după un câmp, opțional împărțit după alt câmp, cu sumă, număr de rânduri sau medie. Totalurile mediei se calculează din observațiile sursă, nu prin media mediilor. Intersecțiile fără observații rămân goale la medie. Valorile lipsă/nenumerice și formulele cu erori opresc calculele numerice, cu un mesaj; numărarea acceptă rânduri fără sumă.

Sunt incluse toate rândurile cu date, inclusiv cele ascunse sau filtrate — mesaj explicit în interfață. Limite: 10.000 rânduri sursă, 256 coloane, 500 categorii de rând și 30 categorii de coloană. Primul rând este antetul. Graficul arată totalurile pe categorii (sau mediile/numărul ales), maximum primele 40, incluzând valori negative.

Inserarea generează o foaie nouă de valori, cu totaluri și configurația sursei în metadatele foii. Redeschiderea comenzii din această foaie reia configurația. Actualizarea este explicită și generează altă foaie; sursa și centralizările precedente nu sunt suprascrise. Acestea nu sunt obiecte PivotTable native Excel. Graficele se afișează în Socot și se exportă SVG separat, nu în interiorul XLSX. Metadatele pentru recalculare sunt păstrate în copia Socot, nu în exportul XLSX.

Exportul XLSX și copia completă au acum un link vizibil „Salvează fișierul” după pregătire. Fișierul reprezintă momentul pregătirii; după modificări, pregătește din nou exportul. Exportarea nu mai depinde de succesul salvării locale, pentru a permite recuperarea unei copii când stocarea locală eșuează.

Verificare: 55 teste trecute; build web și TypeScript trecute. În browser: date demonstrative (10, 20, 90, -5, 0), total 115, medie generală 23, împărțire pe categorii, inserarea foii Centralizare și reluarea configurației din ea. Nicio operațiune contabilă confirmată. Linkul de export este generat; atât apăsarea lui, cât și instrumentul de descărcare au expirat în browserul integrat. Descărcarea pe disc prin acel browser rămâne neconfirmată. Nu au fost generate instalatoare desktop noi.

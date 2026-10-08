# Fluxul documentelor Socot

Actualizat: 3 octombrie 2026.

Socot separă pregătirea documentului de confirmarea operațiunii și de postarea contabilă. Interfața este originală; instalarea platformei 1C nu oferă automat configurația contabilă a unei firme.

## Implementat în această etapă

- Registru comun „Documente”: vânzări și cheltuieli simple, căutare după partener/categorie/identificator și filtre de dată, tip și etapă.
- „Salvează ciorna” păstrează datele local, fără efect asupra evidenței operaționale sau soldurilor. Ciornele pot fi incomplete și editate.
- „Verifică documentul” validează suma, partenerul și referințele. „Confirmă documentul verificat” este o acțiune separată.
- Confirmarea elimină ciorna în aceeași salvare durabilă care înregistrează operațiunea locală. În modul online, aceasta intră în coada existentă și se sincronizează cu API-ul. Conflictele rămân vizibile și se rezolvă explicit.
- Articolele contabile propuse se verifică și se postează separat în Contabilitate. Rapoartele contabile folosesc articolele postate.
- Reviziile ciornelor împiedică folosirea unei verificări depășite; confirmările simultane nu trebuie să dubleze documentul.

## Limite explicite

Ciornele sunt locale dispozitivului și profilului. Nu se partajează între utilizatori înainte de confirmare. În desktop se folosește stocarea criptată existentă; în browser, stocarea locală a profilului. Salvarea trebuie confirmată prin buton înainte de părăsirea editorului. Deconectarea este blocată cât timp există ciorne/operațiuni nesincronizate pentru a preveni ștergerea lor prin curățarea profilului.

Registrul online afișează documentele din memoria locală limitată de API (ultimele 200), nu întregul istoric al firmei. Documentele de aici sunt servicii simple fără calcul TVA, poziții de stoc sau statut de factură fiscală oficială. Stocurile, producția, salariile, corecțiile prin storno și declarațiile complete necesită implementare separată. Nu este paritate integrală cu 1C.

Inspecția vizuală a aplicației 1C instalate a întâlnit două expirări de timp în instrumentul de control. Configurația concretă din baza 1C nu a fost verificată; referințele curente sunt capturile furnizate anterior și cerințele Socot.

## Verificare efectuată

- Verificarea TypeScript: trecută.
- 42 de teste automate: trecute, inclusiv șase teste noi pentru ciorne, reluare după restart, lucru offline, revizii, confirmări simultane și eșecul salvării.
- Build web Next.js: generat cu succes.
- Test în browser, profil demonstrativ: cheltuială fictivă de 123,45 MDL → ciornă → verificare → confirmare → articol contabil „Propus”, fără postare automată.
- Verificările au fost rulate într-o copie temporară cu aceleași surse și package-lock, instalare curată a dependențelor. Pornirea în directorul inițial s-a blocat în citirea unor fișiere din node_modules; copia temporară a necesitat și directorul config înainte ca verificările să treacă.
- Instalatoarele desktop 0.6.0 existente precedă această modificare; nu reprezintă builduri verificate ale noului flux.

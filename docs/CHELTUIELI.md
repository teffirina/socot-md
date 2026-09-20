# Cheltuieli — Socot 0.4

Activitate → Cheltuieli: furnizor, categorie, data documentului și total în MDL; apoi plăți parțiale sau integrale. Căutare, filtru pentru datorii și export CSV. Înregistrarea plății nu efectuează transfer bancar.

Cheltuielile sunt separate de vânzări, creanțe și raportul intern de facturi. Registrul afișează documentele din memoria locală (maximum 200 documente recente primite de la API, împreună cu vânzările); totalurile sunt pentru acest set, nu raportul complet al companiei. Balanța folosește istoricul postat de pe server.

Aceeași coadă persistentă, confirmare a conflictelor, idempotency și izolare pe companie se aplică documentelor de cheltuieli. Rolurile cu invoice.write pot înregistra cheltuieli și plăți; drepturile de citire sunt aceleași ca pentru registrul vânzărilor. Documentul emis este imuabil; se pot adăuga plăți. Corecții/storno și atașamente nu sunt încă implementate.

SQLite desktop/IndexedDB web păstrează documentele demonstrative. Datele vechi fără tip rămân vânzări. Migrarea PostgreSQL adaugă tipul și categoria fără ștergeri. Rulați db:migrate înainte de pornirea API-ului nou; db:seed adaugă regulile demo lipsă (necesită SOCOT_DEMO_PASSWORD local). Pentru companii reale, contabilul configurează și aprobă regulile expense/payment; aplicația refuză înregistrarea fără regulă aprobată.

Regulile demonstrative D713/C521 și D521/C242 sunt modele fără validare fiscală. Nu calculează TVA deductibilă, deductibilitate fiscală, active sau stocuri și nu înlocuiesc modulul complet de achiziții. Articolele noi sunt propuse și necesită postare autorizată pentru includerea în balanță.

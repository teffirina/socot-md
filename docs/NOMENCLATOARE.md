# Nomenclatoare — Socot 0.5

Administrare → Nomenclatoare oferă registre pentru parteneri, contracte, produse/materiale/servicii, unități, depozite, subdiviziuni, conturi bancare, casierii, valute/cursuri, cote TVA, funcții, angajați, active și articole de venit/cheltuială. Acestea sunt date de referință, nu implementarea operațiunilor fiecărui modul.

Codul și tipul sunt permanente; denumirea și detaliile se pot modifica cu motiv, versiune și audit. Arhivarea păstrează istoricul. Codurile sunt unice pe firmă/tip fără distincție între majuscule/minuscule. Referințele sunt verificate în aceeași firmă. Facturile și cheltuielile pot selecta partener și contract; numele rămâne în documentul istoric. Documentele vechi fără referințe se păstrează. Contractul trebuie să aparțină partenerului și să fie activ/valabil la data documentului.

Modificările nomenclatoarelor trec prin coadă persistentă, API idempotent și conflicte cu alegerea explicită a versiunii. Deconectarea și actualizarea sunt blocate când există operațiuni locale nesincronizate. Limita actuală este 1000 înregistrări comune per firmă; API-ul refuză depășirea în loc să prezinte o listă trunchiată. Documentele API au în continuare limita de cache documentată separat.

Drepturi: citire conform invoice.read; scriere conform invoice.write. Angajații sunt limitați la administrator, contabil/contabil-șef și auditor (citire); cotele și cursurile necesită rule.create. Registrul angajaților conține doar nume/cod, funcție și subdiviziune, fără identificatori personali sau salarii. Pe desktop snapshotul folosește SQLite criptat; web folosește IndexedDB. API-ul păstrează în PostgreSQL versiunile curente și auditul anterior/următor.

Cotele TVA/cursurile sunt doar valori de referință introduse cu sursă, nu cote oficiale validate și nu activează automat calcule. Registrul activelor nu calculează amortizare. Conturi avansate folosește API-ul existent, cu creare online și demo local; crearea conturilor nu are încă coadă offline.

Instalare API: db:migrate și regenerare Prisma înainte de utilizarea 0.5. Clienții vechi nu cunosc noile nomenclatoare. Nicio migrare nu șterge documente.

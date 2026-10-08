# Articole contabile multiple — 7 octombrie 2026

## Disponibil în această etapă

O regulă nouă poate repartiza suma unei operațiuni între 2–20 de perechi debit/credit. Se introduce în Contabilitate → Reguli → Adaugă o versiune de regulă, câmpul Repartizare: `Debit;Credit;Procent`, câte un rând, total 100%. Regula trebuie aprobată explicit; regulile existente nu sunt modificate. Perechea simplă este ignorată dacă există repartizare.

Sumele sunt calculate în bani întregi, prin metoda resturilor cele mai mari (egalitățile se rezolvă în ordinea rândurilor). Rândurile de valoare zero nu sunt înregistrate. Totalul articolelor este exact suma operațiunii. Încasarea/plata folosește propria regulă și diferența achitată.

Articolele primesc un operationId comun și lineNo distinct. Salvarea demo este o singură scriere; pe server, documentul, operațiunea și articolele sunt în aceeași tranzacție. Idempotency existentă rămâne la nivel de operațiune. Postarea aprobă întreg grupul, cu motiv și audit; se resping grupurile cu date/documente incompatibile sau stări mixte. Vechile articole locale fără operationId sunt tratate individual.

## Activare PostgreSQL

Migrarea `202610070001_posting_groups` păstrează articolele existente ca rând 1, înlocuiește unicitatea operationId cu (operationId,lineNo) și adaugă JSONB allocations pe reguli. API-ul nou trebuie pornit numai după migrare și regenerarea clientului Prisma. Vechiul API nu trebuie rulat concomitent după activarea regulilor repartizate.

În această sesiune Docker și psql nu au fost găsite în PATH. Migrarea NU a fost aplicată/testată pe PostgreSQL real. Au fost verificate generarea Prisma, TypeScript, buildul web și testele locale. Nu există un installer nou pentru această etapă.

## Limite

Repartizarea procentuală nu este un motor de TVA, costuri de stoc, analitice, avansuri sau retururi. Nu se folosesc procentele pentru a aproxima tratamente fiscale. Sunt necesare în continuare linii de document și baze de calcul distincte (net, TVA, cost, avans), validare contabilă și verificarea tranzacțiilor pe PostgreSQL real.

Verificare: 62 teste trecute, inclusiv conservarea banilor, sume mici, reguli istorice simple, incompatibilitatea stărilor de postare, persistența grupului după restart și evitarea confirmării duplicate. Testele endpointului anterior folosesc un substitut al bazei de date; nu confirmă migrarea reală.

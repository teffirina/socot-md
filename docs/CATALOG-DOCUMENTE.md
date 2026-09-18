# Catalogul efectiv al documentelor și legăturilor

| Obiect | Implementare | Registru / efect | Raport |
|---|---|---|---|
| Factură simplificată de servicii fără TVA | Client, dată, total, UUID, versiune; fără poziții fiscale | Facturi + articol propus; model debit 221 / credit 611 | Creanțe și listă export CSV |
| Încasare pentru factură | Suma cumulativă controlată; plată parțială sau integrală | Operațiune separată; model debit 242 / credit 221 | Soldul neîncasat recalculat |
| Articol contabil | Propus → postat explicit; regulă și versiune reținute | Jurnal; postarea protejată de trigger | Vizualizare jurnal |
| Profil întreprindere | Configurabil; motiv, versiune și audit | Profil companie | Nu produce formular oficial |
| Cont/subcont | Cod, clasă, natură sold, monedă, analitice, valabilitate, sursă | Plan configurabil al companiei | Vizualizare structurată pe clase |
| Regulă contabilă | Versiune declarativă și aprobare | Registru de reguli; nu modifică istoricul | Proveniență în jurnal |
| Raport intern de creanțe | Snapshot cu documente sursă, generat/exportat | Registru de rapoarte | CSV intern; fără transmitere oficială |
| Închidere/redeschidere perioadă | Motiv și permisiuni; blocare perioadă | Audit conformitate | Lista perioadelor |

Modelele de formule sunt demonstrații tehnice, nu recomandări fiscale. Factura simplificată nu este formularul fiscal oficial și nu are încă ciclul complet ciornă/validare/storno. Încasarea nu substituie documentele bancare sau de casă. Raportul nu primește starea „acceptat” prin simplul export.

Documente restante: comenzi, facturi cu poziții și numerotare, avize/recepții, retururi/storno, ordine de plată, casă, extrase, transferuri stoc, inventariere, amortizare, salarii și declarații oficiale. Nu există butoane de transmitere care mimează servicii guvernamentale.

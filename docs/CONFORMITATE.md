# Configurație contabilă versionată Socot

Implementat la 18 septembrie 2026 ca extensie a fluxului comercial. Nu este o certificare juridică, fiscală sau contabilă.

## Funcții implementate

- Reguli declarative pentru vânzare și încasare, stocate în PostgreSQL în modul API, în snapshot-ul SQLite criptat în demo. Ciorne, număr de versiune, interval de aplicare, sursă, aprobator și marcaj demonstrativ.
- Nucleul nu execută cod din reguli. Versiunile aprobate nu pot fi modificate prin UPDATE/DELETE; se creează o versiune nouă cu dată ulterioară. Noua regulă înlocuiește prospectiv regula anterioară. Expirarea celei noi nu reactivează automat o regulă veche.
- Selectarea regulii folosește data economică a operațiunii. Jurnalul păstrează ID-ul și versiunea regulii utilizate. Datele istorice nu se recalculează automat cu regulile actuale.
- Articole propuse; contabilul sau administratorul aprobă explicit postarea. Jurnalul postat este imuabil pentru API.
- Închiderea lunii refuză articolele neaprobate. Operațiunile și închiderea utilizează același lock tranzacțional de companie, evitând o cursă între postare și închidere. Redeschiderea cere rol și motiv; se auditează.
- Audit append-only protejat prin trigger PostgreSQL. Acest mecanism nu împiedică un administrator cu drepturi DDL să dezactiveze trigger-ele: pentru producție trebuie rol API separat de rolul pentru migrații și backup extern.
- Raportul intern de creanțe păstrează documentele și sumele sursă. Interfața distinge Generat / Exportat de Transmis / Acceptat. Nu există rută API care să declare arbitrar acceptarea de către o autoritate.
- Adaptor de raportare definit separat, cu implementare neconfigurată care refuză transmiterea. Nu inventează recipise sau API-uri oficiale.

## Date demonstrative și responsabilitate

`config/demo-rules.json` conține modele, nu afirmații de conformitate. Aprobarea în demo este etichetată demonstrativ. Motorul de producție refuză implicit regulile marcate demo, cu excepția companiei demonstrative `socot-demo`. Rolurile de contabil/administrator trebuie să verifice sursa, politica entității și perioada înainte de aprobarea unei reguli reale. Nici numele unui cont, nici un click pe „Aprobă” nu constituie certificare profesională.

Jurnalul demo se păstrează în aceeași tranzacție locală ca documentul. Imuabilitatea PostgreSQL nu se pretinde pentru fișierul demo local controlat de proprietarul dispozitivului.

## Surse verificate

Pagina Ministerului Finanțelor confirmă publicarea Planului general de conturi prin Ordinul nr. 119 din 06.08.2013: https://mf.gov.md/ro/content/planul-general-de-conturi-contabile-aprobat-prin-ordinul-nr119 . Nu a fost importat automat conținutul ca o configurație legală actualizată.

Linkul legis.md furnizat a răspuns 403 în verificarea web, iar raportare.gov.md a răspuns 502. Prin urmare, nu se afirmă verificarea formei legislative consolidate, a modificărilor din septembrie 2026 sau a unui protocol tehnic de integrare.

## Limite și etapele următoare

Nu sunt implementate integral planul de conturi național, taxele și TVA, salariile, mijloacele fixe, stocurile, stornarea și documentele corective, declarațiile oficiale sau integrarea MSign/e-Factura/MEV. Pentru moment, nucleul protejează articolele postate și refuză ștergerea; nu oferă un buton de stornare fără implementare.

Nu există sistem de extensii executabile și nici migrare automată a bazei serverului la actualizarea desktopului. Migrațiile PostgreSQL se aplică controlat prin Prisma, separat de actualizarea clientului. Validarea legală, backupul și restaurarea rămân obligatorii înainte de producție.

# API Socot v0.1

Local: `http://localhost:3000/api`. Producție: adresă HTTPS configurată, nepublicată în această etapă. JSON UTF-8; sume întregi în bani (600000 = 6000,00 MDL). O companie per utilizator în această fundație.

| Rută | Metodă | Autorizare | Efect |
|---|---|---|---|
| /health | GET | public | Verifică efectiv PostgreSQL |
| /login | POST | email, password | Creează sesiune 8 ore; cookie HttpOnly pentru web, token pentru native |
| /me | GET | sesiune | id, companyId, role |
| /logout | POST | sesiune | Revocă sesiunea curentă |
| /invoices | GET | sesiune | Maximum 200 de facturi din compania curentă |
| /operations | POST | admin/accountant/operator | Emite factura sau adaugă încasarea, atomic cu jurnal și audit |

Desktopul trimite Bearer din stocarea OS, prin Rust; tokenul nu ajunge în JavaScript. Browserul folosește cookie HttpOnly, SameSite=Strict, Secure în producție; originea cererilor este verificată. `NEXT_PUBLIC_APP_URL` trebuie să corespundă originii web. Tokenurile sunt stocate hash-uit pe server. Serverul nu acceptă companyId de la client pentru autorizare.

Exemplu operațiune:

```json
{
  "id": "ccb07308-f4a8-463f-a3a7-59c8e8d66f12",
  "baseVersion": 0,
  "invoice": {
    "id": "894a6a0a-d0b6-4e39-8b3d-b0d02195928f",
    "customer": "Socot client fictiv",
    "total": 600000,
    "paid": 0,
    "version": 0,
    "date": "2026-09-17"
  }
}
```

Răspuns 200: factura cu versiune incrementată. Pentru o încasare se trimite un UUID nou, `baseVersion` actual și valoarea cumulativă `paid`. Clientul nu poate reduce încasarea sau schimba totalul/clientul/datele unei facturi emise. UUID-ul aceleiași operațiuni este refolosit numai pentru retry identic, cu același utilizator.

- 400: payload invalid; rămâne local și este semnalat.
- 401: sesiune lipsă/expirată; cere autentificare.
- 403: rol, companie, origine sau reutilizare nepermisă UUID.
- 409: `{error, current}`; rezolvare explicită.
- 429: limitare; reîncercare la următoarea sincronizare.
- 500: eroare internă; retry idempotent, fără ștergerea cozii.

Nu există API de integrare fiscală, bancară, 1C sau e-Factura. Nu există transmitere demonstrativă prezentată ca reală.

## Extensii 0.2

| Rută | Metodă | Permisiune / efect |
|---|---|---|
| /company | GET | Profilul companiei sesiunii și versiunea curentă |
| /company | POST | Administrator; `{data, baseVersion, reason}`; 409 la versiune veche, audit atomic |
| /accounts | GET | Citire jurnal; planul companiei |
| /accounts | POST | Administrator/contabil-șef; creare cont validat și audit; 200 la succes |
| /compliance | GET | Citire jurnal; reguli, perioade, articole, rapoarte, audit |
| /rules | POST | Creare versiune de regulă de către contabil sau contabil-șef/admin |
| /rules/approve | POST | Contabil-șef/admin; aprobarea explicită a versiunii |
| /periods | POST | Închidere: contabil/contabil-șef/admin; redeschidere: contabil-șef/admin |
| /journal/approve | POST | Contabil/contabil-șef/admin; postează articolul propus |
| /reports | POST | Contabil/contabil-șef/admin; snapshot intern de creanțe |
| /reports/export | POST | Aceleași roluri; marchează exportul, nu transmiterea oficială |

Permisiunile exacte sunt în `lib/permissions.ts`. Directorul și auditorul nu modifică facturi. Casierul și gestionarul nu au acces implicit la module neimplementate. `chief_accountant` poate opera facturi, pe lângă rolurile din tabelul inițial. Aceste rute administrative nu intră încă în coada offline; serverul returnează succes numai după commit PostgreSQL.

## Rapoarte contabile 0.3 (în dezvoltare)

`POST /ledger-report` primește `{from,to}` (date ISO), cere `journal.read` și calculează balanța din istoricul companiei. Include soldul anterior perioadei; exclude articole nepostate/fără dată. Refuză explicit istoricul peste 100.000 articole în loc să emită un raport incomplet. Nu folosește cache-ul de 200 facturi.

`POST /source-document` primește `{id}` și returnează factura numai din compania sesiunii; 404 inclusiv pentru ID-uri din alte companii. Cere `journal.read`. Starea documentului este cea curentă, nu un snapshot istoric la data raportului.

## Nomenclatoare 0.5

`GET /catalog`: până la 1000 înregistrări din firma sesiunii, filtrate după rol; refuză explicit depășirea limitei. `POST /catalog`: `{id, entry, baseVersion, reason}` cu UUID idempotent, versiune și motiv de minimum 10 caractere. `entry` conține `{id, kind, code, name, version, active, details}`. Tipurile și câmpurile permise sunt definite în `lib/catalog.ts`; cheile necunoscute din details sunt refuzate. 409 returnează versiunea curentă pentru rezolvare explicită. Nu există ștergere; arhivarea folosește `active:false`.

Documentele noi pot include `partnerId` și `contractId`; serverul verifică firma, rolul partenerului, numele selectat și valabilitatea contractului la data documentului. Referințele nu pot fi schimbate prin operația de plată. Documentele anterioare fără referințe rămân valide.

Import 0.6: `Invoice.sourceRef` este un șir opțional/nullable (maximum 180 caractere), păstrat în PostgreSQL, GET invoices, conflicte și audit. Proveniența devine imuabilă după crearea documentului. Originalul/prelucrarea nu sunt încă arhivate în API; vezi `SPATIU-DE-LUCRU.md`.

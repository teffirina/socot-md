# Corpus legislativ Socot — implementare inițială

Nu a fost importată baza integrală legis.md. Nu există corpus oficial preinstalat și nici estimare verificată a numărului actelor în vigoare. Accesul prin instrument la exemplul doc_id=150498 a eșuat; endpoint-urile publice documentate de e-Lex pentru versions/manifest/healthz au fost inaccesibile la verificarea din 21.09.2026. Documentația e-Lex nu dovedește disponibilitatea unui export oficial. În browser, exemplul a afișat titlul CC1107/2002, dar corpul paginii a rămas „Conținutul se încarcă...”; datele versiunii nu sunt confirmate.

## Implementat

- PostgreSQL: LegalVersion separă identitatea actului, identificatorul documentului-sursă, limba, proveniența, hash-ul, publicarea, intervalele și prevederile.
- JSONL normalizat importat în flux, câte o versiune pe linie, fără a încărca întregul corpus în memorie. `node --env-file-if-exists=.env --import tsx scripts/legal-import.ts export.jsonl` validează fără scriere; `--commit` persistă în carantină. Exportul trebuie obținut pe o cale autorizată. Scriptul nu descarcă URL-uri.
- Schema exactă este în lib/legislation.ts. Identitatea actului și relațiile dintre versiuni trebuie confirmate din metadatele sursei; nu se generează prin ghicirea unui interval doc_id.
- Replay identic este ignorat; schimbarea textului sau metadatelor păstrează o revizie nouă, neverificată. Importul nu șterge și nu suprascrie versiunile existente. Dacă o linie este invalidă, scriptul se oprește cu eroare; liniile anterioare pot fi deja importate. Reluarea este idempotentă.
- Separare: în vigoare / viitoare / arhivă / proiecte / neverificate / aplicare necunoscută. Data de sfârșit este exclusivă. Abrogarea completă este distinctă de intervalele prevederilor. Datele necunoscute nu se ghicesc.
- API autentificat `/legislation/search`: data ISO, cuvinte-cheie, categorie și paginare 50. Căutare PostgreSQL full-text, fără executarea textului ca SQL. Datele legislative publice sunt comune firmelor; datele firmelor nu intră în corpus.
- `/legislation/verify`: cont admin/contabil-șef și ID inclus explicit în variabila server SOCOT_LEGAL_CURATORS (listă separată prin virgulă). Niciun curator activ implicit. Cere hash-ul reviziei și notă de verificare, sursă oficială, statut adoptat, date cunoscute; respinge intervalele suprapuse. Păstrează autor/data/nota validării. Nu modifică formulele contabile.
- Interfața Legislație oferă căutarea la o dată și separarea categoriilor; în demo precizează că nu există corpus importat. Nu copiază întreaga bază pe dispozitiv.

## Limite și lucrări rămase

Nu există încă adaptor verificat pentru exportul sursei, import masiv efectuat, reconciliere asistată a consolidărilor, corectare/revocare a validării ori activare a regulilor contabile. O versiune validată cu termen deschis va bloca validarea unei versiuni suprapuse: trebuie implementat și testat procesul de reconciliere înainte de exploatare continuă. Nu se activează automat versiunea cu cel mai mare doc_id.

Nu există încă serviciu server de sincronizare zilnică a corpusului, nici asistent AI conectat la textele sale. Monitorizarea Codex existentă rămâne doar monitorizare de metadate. Biblioteca nu reprezintă certificat de conformitate. Prevederile tranzitorii, retroactivitatea, anexele și aplicarea pe categorii de contribuabili necesită modelare și validare suplimentară. Căutarea folosește configurația simple, fără analizor morfologic românesc.

## Obținerea sursei

Este necesar un export autorizat care include identificator stabil de act, versiuni/doc_id, relații de modificare/abrogare, publicare, date de aplicare și anexe. Nu s-au creat abonamente, nu s-au trimis mesaje și nu s-au descărcat baze integrale. Documentația publică: https://e-lex.md/api ; registrul oficial: https://www.legis.md/ .

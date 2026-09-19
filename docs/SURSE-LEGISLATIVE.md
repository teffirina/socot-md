# Surse legislative și inspirație pentru Socot

Verificare inițială: 19 septembrie 2026. Acest document separă dovezile oficiale, semnalele secundare și inspirația de produs. Nicio regulă fiscală nouă nu a fost activată prin această cercetare.

## Surse și utilizare

| Sursă | Ce am verificat | Utilizare în Socot |
|---|---|---|
| [legis.md](https://legis.md/) | Registrul este identificat de Ministerul Justiției; accesul direct al instrumentului a primit 403. Nu am confirmat un API public de export integral. | Confirmarea actelor și a versiunilor; importul automat nu este încă funcțional. |
| [Monitorul Oficial](https://monitorul.gov.md/) | Cuprinsul public era accesibil; ediția afișată: 462–465 din 18.09.2026. Accesul complet la edițiile electronice este prezentat ca abonament. | Detectarea publicațiilor și identificarea actelor; fără ocolirea abonamentului. |
| [e-Lex](https://e-lex.md/) | Se declară inițiativă privată, neoficială. [API](https://e-lex.md/api): versiuni, diferențe, manifest și Atom. Apelurile publice pentru versions/manifest/feed nu au putut fi citite prin instrumentul folosit; exemplele din documentație conțin și un IP local, care nu a fost accesat. | Inspirație pentru identificatori, versiuni, compararea articolelor și proveniență. Disponibilitatea unui conector de producție nu este confirmată. |
| [Termenii e-Lex](https://e-lex.md/termeni) | Autorul declară datele structurate CC0 și codul MIT; recomandă contact pentru acces în volum și nu garantează completitudinea/actualitatea. | Posibilă reutilizare a datelor structurate după validare tehnică și confruntare cu sursa oficială; nu copiere integrală pornită acum. |
| [lex.md](http://www.lex.md/) | Timeout. Nu am confirmat statutul oficial al acestui domeniu. [Nota Ministerului Justiției](https://www.justice.gov.md/public/files/transparenta_in_procesul_decizional/spre_examinare/1.2_NI_pentru_PHG_SI_RSAJ.pdf) identifică vechiul registru drept **lex.justice.md**, actualizat până la 31.05.2019, și tranziția la legis.md. | Referință istorică; nu sursă curentă de cote sau obligații. Nu confundăm cele două domenii. |
| [Weblex](https://weblex.md/account/info) | Pagina furnizorului descrie istoria actului/articolului, căutare, mape tematice și acces contractual. Produsul său „e-LEX” nu este identificat aici cu inițiativa e-lex.md. | Inspirație: dosare tematice și istoric pe articol. Nu s-a creat cont și nu s-a cumpărat acces. |
| [Sirius](https://sirius.expert/) | Pagina publică descrie facturi, încasări/plăți, mai multe companii, roluri și proiecte. Pagina md.sirius.expert/welcome nu a fost accesibilă instrumentului. | Inspirație: fluxuri scurte și imagine clară a banilor. Nu presupunem acces la API-ul sau integrările lor. |
| [MonitorLegislativMD](https://t.me/MonitorLegislativMD) | Pagina și previzualizarea publică Telegram nu au fost accesibile instrumentului; conținutul nu a fost verificat. | Numai semnal secundar, niciodată confirmare juridică prin simpla postare. |
| [Robolex](https://robolex.io/) | Furnizorul prezintă fluxul document → extragere → verificare → generare. Nu am testat serviciul autentificat. | Inspirație: date extrase revizuibile, surse și validare înaintea rezultatului. Afirmațiile comerciale nu sunt dovezi de conformitate Socot. |
| [Fagura Director financiar AI](https://fagura.com/financiar-director-ai/) | Pagina prezintă indicatori și explicații financiare pornind de la datele unei firme. | Inspirație: explicarea indicatorilor în limbaj simplu, legată de cifrele și perioada din Socot. Nu am trimis IDNO sau documente. |
| [Fagura Jurist AI](https://fagura.com/jurist-ai/) | Pagina prezintă conversație și generare de modele juridice. | Inspirație: explicații cu trimiteri și modele verificabile, fără a prezenta textul AI drept aprobare juridică. |

SFS a returnat de asemenea 403 la verificarea directă. Sursele oficiale suplimentare de urmărit sunt [Ministerul Finanțelor](https://mf.gov.md/), [SFS](https://sfs.md/ro) și [Ministerul Justiției](https://justice.gov.md/). Accesul blocat trebuie raportat ca acoperire incompletă.

## Monitorizarea zilnică activată

Automatizare Codex atașată acestui task: `socot-monitorizare-legislativ-zilnic`, zilnic la 09:00, ora locală a programării. Aceasta este o verificare în Codex, nu un serviciu deja instalat pe serverul Socot și nici o funcție autonomă a installerului desktop.

Jurnal local: `artifacts/legislative-monitor/journal.md` (ignorat de Git). Prima verificare stabilește un reper; nu pretinde comparație cu un istoric care nu există. Notificarea este pentru schimbări relevante ori probleme noi, nu pentru fiecare rulare fără rezultat.

Flux: identificare schimbare → confirmare în sursă oficială → diferențe și date de aplicare → impact asupra modulelor → validare contabilă/juridică → versiune de regulă aprobată → teste → activare. AI poate pregăti explicația și clasificarea; nu schimbă automat cotele, formulele, documentele sau istoricul.

## Preluarea unei baze legislative

Nu avem încă un contract/API/export confirmat pentru baza integrală legis.md. Pasul tehnic următor este identificarea unei căi oficiale de acces și a condițiilor de reutilizare; o pagină publică sau o listă de rezultate nu dovedește existența unui export complet. Nu ocolim controale de acces.

Pentru fiecare versiune importată, modelul propus reține: emitent, tip/număr/an, titlu, articol, URL oficial, publicare, intrare în vigoare/expirare, data preluării, hash, versiune precedentă, diferențe, statut proiect/adoptat, validatori și module afectate. Acesta este un plan documentat; stocarea completă și interfața de validare legislativă nu sunt implementate încă.

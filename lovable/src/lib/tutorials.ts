export type TutorialStep = { selector: string; title: string; body: string };
export type Tutorial = { key: string; title: string; steps: TutorialStep[] };

export const tutorials: Record<string, Tutorial> = {
  acasa: {
    key: "acasa",
    title: "Privire de ansamblu",
    steps: [
      {
        selector: '[data-t="home-source"]',
        title: "Alegi sursa datelor",
        body: "„Exemplu demonstrativ” arată cifre fictive, ca să înveți aplicația fără risc. „Datele firmei” arată soldurile reale, calculate din documentele tale.",
      },
      {
        selector: '[data-t="home-balances"]',
        title: "Soldurile pe scurt",
        body: "Cele patru căsuțe arată situația firmei: banii din bancă și casă, ce ai de încasat de la clienți și ce ai de plătit furnizorilor.",
      },
      {
        selector: '[data-t="home-flux"]',
        title: "Fluxul documentelor",
        body: "Orice document parcurge aceiași pași: se salvează ca ciornă, se verifică, apoi se înregistrează contabil. Abia după înregistrare intră în balanță.",
      },
      {
        selector: '[data-t="home-docs"]',
        title: "Documente recente",
        body: "Ultimele documente cu conturile propuse, de exemplu Dt 221 · Ct 611 pentru o vânzare. Starea este scrisă în cuvânt: Ciornă, Verificat, Contabilizat sau Restanță.",
      },
      {
        selector: '[data-t="assistant-open"]',
        title: "Asistent Socot",
        body: "Pune întrebări simple, de exemplu „Cât avem de încasat de la clientul X?”. Asistentul caută doar în datele reale ale firmei, după drepturile tale, și pune link spre documente. Nu modifică și nu înregistrează nimic.",
      },
      {
        selector: '[data-t="home-actions"]',
        title: "Acțiuni rapide",
        body: "De aici cauți orice document sau partener, iar cu „+ Nou” sau „Document nou” pornești o factură fără să părăsești pagina.",
      },
    ],
  },
  vanzari: {
    key: "vanzari",
    title: "Facturi de vânzare",
    steps: [
      {
        selector: '[data-t="doc-new"]',
        title: "Creează factura",
        body: "Apasă „Document nou”, alege clientul din nomenclator, completează data și liniile cu produse sau servicii. Factura se salvează ca ciornă — nimic nu se contabilizează automat.",
      },
      {
        selector: '[data-t="doc-search"]',
        title: "Cauți rapid",
        body: "Scrie numele clientului sau numărul facturii, de exemplu „V-0001”, și lista se filtrează pe loc.",
      },
      {
        selector: '[data-t="doc-table"]',
        title: "Lista facturilor",
        body: "Vezi Total, Achitat și Rest pentru fiecare factură. Din rând deschizi factura, o modifici cât e ciornă, o verifici și o confirmi — atunci se propune înregistrarea Dt 221 · Ct 611. După confirmare, butonul „Încasare” înregistrează plata clientului.",
      },
      {
        selector: '[data-t="doc-print"]',
        title: "Previzualizezi și tipărești",
        body: "Butonul „Tipărește” deschide factura în formatul tipizat al facturii fiscale din Moldova, cu furnizor, cumpărător, tabelul 10.1–10.12 și totaluri. De acolo o tipărești sau o salvezi ca PDF.",
      },
    ],
  },
  cumparari: {
    key: "cumparari",
    title: "Facturi de cumpărare",
    steps: [
      {
        selector: '[data-t="doc-new"]',
        title: "Introduci factura furnizorului",
        body: "Apasă „Document nou”, alege furnizorul și completează liniile cu cantități și prețuri. Poți scana factura cu AI sau o poți completa manual. Se salvează ca ciornă.",
      },
      {
        selector: '[data-t="doc-search"]',
        title: "Cauți rapid",
        body: "Filtrezi după furnizor sau numărul facturii primite, ca să găsești imediat documentul.",
      },
      {
        selector: '[data-t="doc-table"]',
        title: "Lista cumpărărilor",
        body: "Urmărești Total, Achitat și Rest. La verificare și confirmare se propune înregistrarea Dt 713 · Ct 521, iar butonul „Plată” înregistrează achitarea către furnizor.",
      },
      {
        selector: '[data-t="doc-print"]',
        title: "Previzualizezi și tipărești",
        body: "Butonul „Tipărește” deschide factura în formatul tipizat al facturii fiscale din Moldova, cu furnizor, cumpărător, tabelul 10.1–10.12 și totaluri. De acolo o tipărești sau o salvezi ca PDF.",
      },
    ],
  },
  banca: {
    key: "banca",
    title: "Bancă și casă",
    steps: [
      {
        selector: '[data-t="bank-metrics"]',
        title: "Încasat și plătit",
        body: "Cele trei căsuțe însumează încasările de la clienți, plățile către furnizori și diferența dintre ele.",
      },
      {
        selector: '[data-t="bank-list"]',
        title: "Operațiunile",
        body: "Fiecare rând este o încasare sau o plată legată de o factură. Le înregistrezi din pagina facturii, cu butonul „Încasare” sau „Plată” — aici doar le urmărești.",
      },
    ],
  },
  contabilitate: {
    key: "contabilitate",
    title: "Contabilitate",
    steps: [
      {
        selector: "#rulaje",
        title: "Rulaje pe conturi",
        body: "Aici vezi totalurile pe conturi (de exemplu 221, 511, 611) doar din articolele postate. Cifrele se mișcă abia după postare, nu la simpla ciornă.",
      },
      {
        selector: '[data-t="journal-table"]',
        title: "Jurnalul operațiunilor",
        body: "La confirmarea unui document se propune automat articolul contabil. Verifici formula Dt/Ct și suma, apoi apeși „Postează”. Dacă suma nu corespunde facturii, revii la document și o corectezi înainte de postare.",
      },
    ],
  },
  rapoarte: {
    key: "rapoarte",
    title: "Rapoarte",
    steps: [
      {
        selector: '[data-t="report-actions"]',
        title: "Alegi raportul",
        body: "„Creanțe” arată ce au de plătit clienții, „Datorii” — ce datorezi furnizorilor. Cu „Export CSV” descarci situația pentru Excel.",
      },
      {
        selector: '[data-t="report-table"]',
        title: "Situația pe parteneri",
        body: "Fiecare rând grupează documentele confirmate ale unui partener: câte facturi, totalul, cât s-a achitat și restul rămas.",
      },
      {
        selector: '[data-t="report-act"]',
        title: "Act de verificare",
        body: "Din raportul „Creanțe” generezi actul de verificare a decontărilor reciproce cu un client: alegi clientul și perioada, iar aplicația completează partea firmei cu facturile de vânzare (Credit) și încasările din bancă și casă (Debit). Partea clientului rămâne goală pentru datele lui, apoi tipărești actul.",
      },
    ],
  },
  nomenclatoare: {
    key: "nomenclatoare",
    title: "Nomenclatoare",
    steps: [
      {
        selector: '[data-t="catalog-grid"]',
        title: "Alege nomenclatorul",
        body: "Aici sunt datele de referință folosite în documente: parteneri (clienți și furnizori), produse, servicii, conturi bancare și casierii. Le completezi o dată și le refolosești în fiecare factură.",
      },
    ],
  },
  nomenclator: {
    key: "nomenclator",
    title: "Nomenclator",
    steps: [
      {
        selector: '[data-t="catalog-form"]',
        title: "Adaugi o înregistrare",
        body: "Completezi un cod unic și denumirea. La parteneri adaugi și IDNO-ul de 13 cifre — dacă codul există deja, aplicația te anunță și nu salvează duplicatul.",
      },
      {
        selector: '[data-t="catalog-table"]',
        title: "Lista existentă",
        body: "Toate înregistrările nomenclatorului. Le poți șterge doar dacă nu le mai folosești în documente.",
      },
      {
        selector: '[data-t="catalog-back"]',
        title: "Revenire",
        body: "Butonul „Înapoi” te duce la pagina de unde ai venit, nu neapărat la lista de nomenclatoare.",
      },
    ],
  },
  intreprindere: {
    key: "intreprindere",
    title: "Întreprindere",
    steps: [
      {
        selector: '[data-t="company-form"]',
        title: "Rechizitele firmei",
        body: "Denumirea, IDNO-ul de 13 cifre, adresa, IBAN-ul și banca apar pe documentele emise. Comutatorul „Plătitor de TVA” stabilește regimul fiscal al firmei. Salvezi cu butonul „Salvează”.",
      },
    ],
  },
};

export function tutorialForPath(pathname: string): Tutorial | null {
  if (pathname === "/acasa" || pathname === "/") return tutorials["acasa"] ?? null;
  if (pathname.startsWith("/documente/sale")) return tutorials["vanzari"] ?? null;
  if (pathname.startsWith("/documente/expense")) return tutorials["cumparari"] ?? null;
  if (pathname.startsWith("/banca")) return tutorials["banca"] ?? null;
  if (pathname.startsWith("/contabilitate")) return tutorials["contabilitate"] ?? null;
  if (pathname.startsWith("/rapoarte")) return tutorials["rapoarte"] ?? null;
  if (pathname === "/nomenclatoare") return tutorials["nomenclatoare"] ?? null;
  if (pathname.startsWith("/nomenclatoare/")) return tutorials["nomenclator"] ?? null;
  if (pathname.startsWith("/intreprindere")) return tutorials["intreprindere"] ?? null;
  return null;
}

export const completedKey = (userId: string) => `socot-tutorials:${userId}`;

export function parseCompleted(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function readCompleted(userId: string): string[] {
  return parseCompleted(localStorage.getItem(completedKey(userId)));
}

export function markCompleted(userId: string, key: string): void {
  const done = readCompleted(userId);
  if (!done.includes(key)) localStorage.setItem(completedKey(userId), JSON.stringify([...done, key]));
}

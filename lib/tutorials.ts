// Guided tours over the real interface; steps whose element is not on screen
// are skipped, so a tour never points at a missing or unimplemented feature.
export type TutorialStep = { selector: string; title: string; body: string };
export type Tutorial = { key: string; title: string; steps: TutorialStep[] };

const documents = (kind: "sale" | "expense"): TutorialStep[] => [
  {
    selector: '[data-t="doc-flow"]',
    title: "Etapele documentului",
    body: "Orice document trece prin aceiași pași: ciornă, verificare și confirmare, apoi articolele contabile se postează separat. Abia după postare intră în rapoarte.",
  },
  {
    selector: '[data-t="doc-new"]',
    title: kind === "sale" ? "Creezi o vânzare" : "Introduci o cumpărare",
    body:
      kind === "sale"
        ? "Butonul „＋ Vânzare” deschide o ciornă: alegi clientul din nomenclator sau îl scrii, data și totalul. Salvarea nu afectează soldurile."
        : "Butonul „＋ Cumpărare / serviciu” deschide o ciornă pentru factura furnizorului. Salvarea nu afectează soldurile.",
  },
  {
    selector: '[data-t="doc-scan"]',
    title: "Scanezi factura cu AI",
    body: "Alegi un PDF sau o fotografie a facturii. AI citește partenerul, data și totalul și deschide o ciornă precompletată; verifici fiecare câmp înainte de a o salva. Nimic nu se salvează automat.",
  },
  {
    selector: '[data-t="doc-filters"]',
    title: "Cauți și filtrezi",
    body: "Filtrezi după partener, etapă și perioadă, ca să găsești imediat documentul.",
  },
  {
    selector: '[data-t="doc-table"]',
    title: "Lista documentelor",
    body: "Din rând deschizi documentul: îl modifici cât e ciornă, îl verifici și îl confirmi. Etapa arată dacă este ciornă, în sincronizare, de verificat sau postat.",
  },
];

export const tutorials: Record<string, Tutorial> = {
  acasa: {
    key: "acasa",
    title: "Acasă",
    steps: [
      {
        selector: '[data-t="menu-search"]',
        title: "Găsești orice modul",
        body: "Scrie în „Caută în meniu”, de exemplu „cumpărări” sau „rapoarte”, și meniul se filtrează pe loc.",
      },
      {
        selector: '[data-t="home-metrics"]',
        title: "Cifrele pe scurt",
        body: "Vânzările, cheltuielile și sumele de încasat și de plătit, calculate din documentele salvate, în MDL.",
      },
      {
        selector: '[data-t="new-invoice"]',
        title: "Factură nouă",
        body: "Pornești rapid o factură simplificată. Se salvează ca ciornă; o verifici și o confirmi în registrul Documente.",
      },
      {
        selector: '[data-t="home-actions"]',
        title: "Fluxul documentelor",
        body: "Câte documente sunt în ciornă, la verificare și înregistrate. Apasă pe o etapă ca să mergi direct acolo.",
      },
      {
        selector: '[data-t="home-docs"]',
        title: "Documente recente",
        body: "Ultimele documente cu suma și starea. „Încasează” înregistrează o plată parțială sau integrală.",
      },
    ],
  },
  vanzari: { key: "vanzari", title: "Documente de vânzare", steps: documents("sale") },
  cumparari: {
    key: "cumparari",
    title: "Documente de cumpărare",
    steps: documents("expense"),
  },
  rapoarte: {
    key: "rapoarte",
    title: "Rapoarte",
    steps: [
      {
        selector: '[data-t="report-switch"]',
        title: "Alegi raportul",
        body: "„Creanțe” arată facturile și sumele de încasat, „Act de verificare” pregătește decontările cu un client, iar „Balanță și conturi” arată soldurile contabile, dacă rolul tău are acces.",
      },
      {
        selector: '[data-t="act-form"]',
        title: "Actul de verificare",
        body: "Alegi clientul și perioada, apoi „Generează actul”. Socot completează partea firmei cu facturile la Credit și încasările la Debit, cu soldul inițial și final; partea clientului rămâne goală. „Imprimă / PDF” scoate actul pe hârtie.",
      },
    ],
  },
};

export function tutorialForView(view: string): Tutorial | null {
  if (view === "Acasă") return tutorials.acasa;
  if (view === "documents:sale") return tutorials.vanzari;
  if (view === "documents:expense") return tutorials.cumparari;
  if (view === "Rapoarte") return tutorials.rapoarte;
  return null;
}

export const completedKey = (userId: string) => `socot-tutorials:${userId}`;

export function parseCompleted(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

export function markCompleted(userId: string, key: string) {
  try {
    const done = parseCompleted(localStorage.getItem(completedKey(userId)));
    if (!done.includes(key))
      localStorage.setItem(completedKey(userId), JSON.stringify([...done, key]));
  } catch {
    // Progress is a convenience; a blocked storage must not break the tour.
  }
}

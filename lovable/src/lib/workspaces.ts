import type { CatalogKind } from "./catalog";

export type WorkspaceAction =
  | { title: string; description: string; to: "/documente/$kind"; kind: "sale" | "expense" }
  | { title: string; description: string; to: "/nomenclatoare/$kind"; kind: CatalogKind }
  | { title: string; description: string; to: "/contabilitate" | "/rapoarte" | "/banca" };

export type Workspace = {
  slug: string;
  title: string;
  subtitle: string;
  steps: string[];
  groups: { title: string; actions: WorkspaceAction[] }[];
  pending: string[];
};

const cat = (kind: CatalogKind, title: string, description: string): WorkspaceAction => ({
  title,
  description,
  to: "/nomenclatoare/$kind",
  kind,
});

export const workspaces: Workspace[] = [
  {
    slug: "vanzari",
    title: "Vânzări",
    subtitle: "Documentele clienților, verificarea lor și încasările, în aceeași ordine de lucru.",
    steps: ["Pregătește vânzarea", "Verifică și confirmă", "Urmărește creanța", "Înregistrează încasarea"],
    groups: [
      {
        title: "Documente și încasări",
        actions: [
          { title: "Documente de vânzare", description: "Ciorne și documente confirmate pentru servicii simple, fără TVA.", to: "/documente/$kind", kind: "sale" },
          { title: "Situația creanțelor", description: "Ce au de achitat clienții.", to: "/rapoarte" },
        ],
      },
      {
        title: "Date de referință",
        actions: [
          cat("partner", "Clienți și furnizori", "Parteneri comuni, cu rol de client, furnizor sau ambele."),
          cat("contract", "Contracte", "Condițiile și valabilitatea contractelor."),
          cat("item", "Produse și servicii", "Catalogul de articole vândute."),
        ],
      },
      {
        title: "Verificare contabilă",
        actions: [{ title: "Articole propuse și postare", description: "Verifică înregistrările rezultate din documente.", to: "/contabilitate" }],
      },
    ],
    pending: ["Poziții cu cantități, prețuri, reduceri și TVA", "Facturi fiscale și cartea vânzărilor", "Retururi de la clienți", "Avansuri și compensări"],
  },
  {
    slug: "cumparari",
    title: "Cumpărări",
    subtitle: "De la furnizor și documentul primit până la suma de plată.",
    steps: ["Pregătește documentul", "Verifică și confirmă", "Urmărește datoria", "Înregistrează plata"],
    groups: [
      {
        title: "Documente și plăți",
        actions: [
          { title: "Documente de cumpărare", description: "Ciorne, verificare și documente confirmate. Servicii simple, fără TVA.", to: "/documente/$kind", kind: "expense" },
          { title: "Datorii față de furnizori", description: "Sumele achitate și restul de plată.", to: "/rapoarte" },
        ],
      },
      {
        title: "Date de referință",
        actions: [
          cat("partner", "Furnizori și clienți", "Parteneri comuni, cu rol de furnizor, client sau ambele."),
          cat("contract", "Contracte", "Condițiile și valabilitatea contractelor cu partenerii."),
          cat("category", "Articole de cheltuieli", "Clasificarea cheltuielilor."),
        ],
      },
      {
        title: "Verificare contabilă",
        actions: [{ title: "Articole propuse și postare", description: "Verifică înregistrările rezultate din documente.", to: "/contabilitate" }],
      },
    ],
    pending: ["Recepții parțiale și mișcări de stoc", "Cheltuieli repartizate la cost", "Importuri și declarații vamale", "Facturi fiscale primite și cartea cumpărărilor"],
  },
  {
    slug: "depozit",
    title: "Depozit",
    subtitle: "Produse, materiale, unități și locuri de păstrare.",
    steps: ["Definește articolele", "Stabilește depozitele", "Înregistrează mișcările"],
    groups: [
      {
        title: "Nomenclatoare disponibile",
        actions: [
          cat("item", "Produse și materiale", "Catalogul articolelor."),
          cat("unit", "Unități de măsură", "Bucăți, kilograme, ore etc."),
          cat("warehouse", "Depozite", "Locurile de păstrare."),
        ],
      },
    ],
    pending: ["Intrări, transferuri și ieșiri de stoc", "Inventariere", "Evaluarea stocurilor"],
  },
  {
    slug: "productie",
    title: "Producție",
    subtitle: "Pregătirea datelor pentru materiale, produse și subdiviziuni.",
    steps: ["Definește subdiviziunile", "Pregătește materialele", "Calculează costul"],
    groups: [
      {
        title: "Pregătire disponibilă",
        actions: [
          cat("subdivision", "Subdiviziuni", "Secțiile și centrele de cost."),
          cat("item", "Materiale și produse", "Articolele folosite în producție."),
        ],
      },
    ],
    pending: ["Specificații de produs", "Rapoarte de producție", "Calculația costului"],
  },
  {
    slug: "active",
    title: "Active",
    subtitle: "Evidența de referință a mijloacelor fixe și a responsabililor.",
    steps: ["Înregistrează activul", "Stabilește responsabilul", "Calculează amortizarea"],
    groups: [
      {
        title: "Date disponibile",
        actions: [cat("asset", "Mijloace fixe", "Lista activelor cu număr de inventar."), cat("employee", "Responsabili", "Angajații care răspund de active.")],
      },
    ],
    pending: ["Punere în funcțiune", "Amortizare lunară", "Casare și vânzare"],
  },
  {
    slug: "personal",
    title: "Personal și salarii",
    subtitle: "Organizează datele personalului înainte de calculul salarial.",
    steps: ["Definește funcțiile", "Adaugă angajații", "Calculează salariile"],
    groups: [
      {
        title: "Nomenclatoare disponibile",
        actions: [
          cat("position", "Funcții", "Statul de funcții."),
          cat("employee", "Angajați", "Datele personalului."),
          cat("subdivision", "Subdiviziuni", "Structura întreprinderii."),
        ],
      },
    ],
    pending: ["Angajări, transferuri și concedieri", "Pontaj", "Calculul salariilor și contribuțiilor", "Declarații IPC"],
  },
];

export const findWorkspace = (slug: string) => workspaces.find((w) => w.slug === slug);

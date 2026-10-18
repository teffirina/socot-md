import type { CatalogKind } from "./catalog";
export type WorkspaceAction = {
  title: string;
  description: string;
  target: string;
  journal?: boolean;
};
export type WorkspaceDefinition = {
  title: string;
  icon: string;
  subtitle: string;
  steps: string[];
  groups: { title: string; actions: WorkspaceAction[] }[];
  pending: string[];
};
const catalog = (
  kind: CatalogKind,
  title: string,
  description: string,
): WorkspaceAction => ({ title, description, target: `catalog:${kind}` });
export const workspaces: Record<string, WorkspaceDefinition> = {
  Cumpărări: {
    title: "Cumpărări",
    icon: "↙",
    subtitle: "De la furnizor și documentul primit până la suma de plată.",
    steps: [
      "Pregătește documentul",
      "Verifică și confirmă",
      "Urmărește datoria",
      "Înregistrează plata",
    ],
    groups: [
      {
        title: "Documente și plăți",
        actions: [
          {
            title: "Documente de cumpărare",
            description:
              "Ciorne, verificare și documente confirmate. Momentan servicii simple, fără TVA.",
            target: "documents:expense",
          },
          {
            title: "Datorii și plăți furnizori",
            description:
              "Sumele achitate și restul de plată pentru documentele confirmate.",
            target: "Cheltuieli",
          },
          {
            title: "Pregătire din Excel",
            description:
              "Prelucrează tabelul și verifică datele înainte de confirmare.",
            target: "Spațiu de lucru",
          },
        ],
      },
      {
        title: "Date de referință",
        actions: [
          catalog(
            "partner",
            "Furnizori și clienți",
            "Parteneri comuni, cu rol de furnizor, client sau ambele.",
          ),
          catalog(
            "contract",
            "Contracte",
            "Condițiile și valabilitatea contractelor cu partenerii.",
          ),
          catalog(
            "item",
            "Produse și servicii",
            "Catalog de articole; gestiunea stocurilor se implementează separat.",
          ),
        ],
      },
      {
        title: "Verificare contabilă",
        actions: [
          {
            title: "Articole propuse și postare",
            description: "Verifică înregistrările rezultate din documente.",
            target: "Contabilitate",
            journal: true,
          },
        ],
      },
    ],
    pending: [
      "Poziții cu cantități, prețuri, reduceri și TVA",
      "Recepții parțiale și mișcări de stoc",
      "Cheltuieli suplimentare repartizate la cost",
      "Importuri și declarații vamale",
      "Retururi către furnizori și corectări",
      "Facturi fiscale primite și cartea cumpărărilor",
      "Avansuri, compensări și acte de reconciliere",
    ],
  },
  Vânzări: {
    title: "Vânzări",
    icon: "↗",
    subtitle:
      "Documentele clienților, verificarea lor și încasările, în aceeași ordine de lucru.",
    steps: [
      "Pregătește vânzarea",
      "Verifică și confirmă",
      "Urmărește creanța",
      "Înregistrează încasarea",
    ],
    groups: [
      {
        title: "Documente și încasări",
        actions: [
          {
            title: "Documente de vânzare",
            description:
              "Ciorne și documente confirmate pentru servicii simple, fără TVA.",
            target: "documents:sale",
          },
          {
            title: "Creanțe și încasări clienți",
            description:
              "Soldurile documentelor și încasările parțiale sau integrale.",
            target: "Încasări clienți",
          },
          {
            title: "Pregătire din Excel",
            description:
              "Tabele, formule și importuri înainte de înregistrarea în evidență.",
            target: "Spațiu de lucru",
          },
        ],
      },
      {
        title: "Date de referință",
        actions: [
          catalog(
            "partner",
            "Clienți și furnizori",
            "Identificarea partenerilor și datele lor comune.",
          ),
          catalog("contract", "Contracte", "Acordurile asociate documentelor."),
          catalog(
            "item",
            "Produse și servicii",
            "Articole comune pentru introducerea datelor.",
          ),
        ],
      },
      {
        title: "Verificare contabilă",
        actions: [
          {
            title: "Articole propuse și postare",
            description: "Verifică înregistrările rezultate din documente.",
            target: "Contabilitate",
            journal: true,
          },
          {
            title: "Situația creanțelor",
            description: "Consultă documentele și sumele rămase de încasat.",
            target: "Rapoarte",
          },
        ],
      },
    ],
    pending: [
      "Poziții cu cantități, prețuri, reduceri și TVA",
      "Oferte, comenzi și documente generate pe baza altora",
      "Livrări parțiale și costul bunurilor vândute",
      "Retururi, reduceri ulterioare și corectări",
      "Facturi fiscale, cartea vânzărilor și export oficial",
      "Vânzări cu amănuntul, bonuri și rapoarte de tură",
      "Avansuri, compensări și acte de reconciliere",
    ],
  },
  "Bancă și casă": {
    title: "Bancă și casă",
    icon: "▱",
    subtitle: "Urmărește încasările și plățile asociate documentelor.",
    steps: [],
    groups: [
      {
        title: "Disponibil acum",
        actions: [
          {
            title: "Încasări de la clienți",
            description:
              "Înregistrează o sumă încasată pentru un document confirmat.",
            target: "Încasări clienți",
          },
          {
            title: "Plăți către furnizori",
            description:
              "Înregistrează o sumă achitată pentru un document confirmat.",
            target: "Cheltuieli",
          },
          catalog(
            "bank",
            "Conturi bancare",
            "Date de referință: IBAN, bancă și valută.",
          ),
          catalog(
            "cash",
            "Casierii",
            "Date de referință pentru casieriile firmei.",
          ),
        ],
      },
    ],
    pending: [
      "Plăți distincte, cu alocare la mai multe facturi",
      "Ordine de plată și import de extrase bancare",
      "Reconciliere bancară",
      "Dispoziții de casă și registrul de casă",
      "Deconturi de avans și inventarierea numerarului",
      "Carduri, avansuri și diferențe valutare",
    ],
  },
  Depozit: {
    title: "Depozit",
    icon: "▧",
    subtitle: "Stocuri evaluate FIFO sau la cost mediu, produse și depozite.",
    steps: [],
    groups: [
      {
        title: "Nomenclatoare disponibile",
        actions: [
          catalog(
            "item",
            "Produse și materiale",
            "Definirea articolelor; nu reprezintă stocul disponibil.",
          ),
          catalog("warehouse", "Depozite", "Locațiile folosite de firmă."),
          catalog(
            "unit",
            "Unități de măsură",
            "Unități comune pentru produse și materiale.",
          ),
        ],
      },
    ],
    pending: [
      "Recepții, livrări și transferuri între depozite",
      "Inventariere, surplusuri și lipsuri",
      "Consumuri și completări/dezasamblări",
      "Obiecte de mică valoare și scurtă durată",
      "Formulare cu regim special",
      "Anvelope, acumulatoare, foi de parcurs și combustibil",
    ],
  },
  Producție: {
    title: "Producție",
    icon: "⚒",
    subtitle: "Rapoarte de producție și costul efectiv al produselor.",
    steps: [],
    groups: [
      {
        title: "Pregătire disponibilă",
        actions: [
          catalog(
            "item",
            "Materiale și produse",
            "Nomenclator comun cu achizițiile și vânzările.",
          ),
          catalog(
            "subdivision",
            "Subdiviziuni",
            "Locuri de activitate și responsabilitate.",
          ),
          {
            title: "Foi de calcul",
            description:
              "Pregătește manual calcule și tabele. Acestea nu postează producția.",
            target: "Spațiu de lucru",
          },
        ],
      },
    ],
    pending: [
      "Rețete și norme de consum",
      "Rapoarte de producție și servicii productive",
      "Producție neterminată",
      "Prelucrare la terți și a materialelor clienților",
    ],
  },
  Active: {
    title: "Active",
    icon: "▣",
    subtitle: "Mijloace fixe, obiecte în construcție și uzura calculată automat.",
    steps: [],
    groups: [
      {
        title: "Date disponibile",
        actions: [
          catalog(
            "asset",
            "Registrul mijloacelor fixe",
            "Fișe cu valoare, durată, locație și responsabil; uzura se calculează din ele.",
          ),
          catalog("warehouse", "Locații", "Locurile de păstrare a bunurilor."),
        ],
      },
    ],
    pending: [
      "Active necorporale și terenuri",
      "Transfer, modernizare și inventariere",
      "Leasing și răscumpărare",
      "Amortizare fiscală și metode degresive",
      "Ieșire, casare și rapoarte specifice",
    ],
  },
  "Personal și salarii": {
    title: "Personal și salarii",
    icon: "♙",
    subtitle: "Organizează datele personalului înainte de calculul salarial.",
    steps: [],
    groups: [
      {
        title: "Nomenclatoare disponibile",
        actions: [
          catalog(
            "employee",
            "Angajați",
            "Date de referință, funcție și subdiviziune.",
          ),
          catalog("position", "Funcții", "Funcțiile din organizație."),
          catalog("subdivision", "Subdiviziuni", "Structura firmei."),
        ],
      },
    ],
    pending: [
      "Angajare, transfer și încetarea raporturilor de muncă",
      "Pontaj și calendare de lucru",
      "Concedii, indemnizații și solduri de concediu",
      "Calcul salarial, scutiri, rețineri și contribuții",
      "Tichete de masă, premii și ajutoare",
      "State de plată prin bancă și casă",
      "Rapoarte salariale și declarații validate",
    ],
  },
};
export function workspaceParent(view: string): string {
  if (view === "documents:sale" || view === "Încasări clienți")
    return "Vânzări";
  if (view === "documents:expense" || view === "Cheltuieli") return "Cumpărări";
  if (view.startsWith("catalog:")) return "Nomenclatoare";
  return view;
}
export function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("ro");
}

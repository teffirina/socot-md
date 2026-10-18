import type { Grid } from "./workbook";

// Lists saved from 1C (Excel or CSV): sales/purchase documents, the document
// journal, or the counterparty list. Headers may be in Romanian or Russian and
// usually sit under a few title rows.
export type Kind = "sale" | "expense";

export type DocumentRow = {
  line: number;
  number: string;
  date: string;
  partner: string;
  total: number;
  kind: Kind | null;
  error?: string;
};

export type PartnerRow = {
  line: number;
  code: string;
  name: string;
  idno: string;
  vatCode: string;
  address: string;
  error?: string;
};

export type Read1C =
  | {
      type: "documents";
      header: number;
      defaultKind: Kind | null;
      /** the amount on the file's own "Total" row, when there is one */
      controlTotal: number | null;
      rows: DocumentRow[];
    }
  | { type: "partners"; header: number; rows: PartnerRow[] };

export const MAX_1C_ROWS = 2000;

const plain = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const headers = {
  date: /^(дата|data)(\b|$)/,
  number: /^(номер|nr\.?|numar|№|number)(\b|$)|^nr\.? document/,
  partner:
    /контрагент|contragent|partener|покупател|поставщик|^client|furnizor|cumparator/,
  amount: /^(сумма|suma|total)/,
  type: /вид документа|тип документа|^документ$|^tip( document)?$|^document$|^вид операции|^tip operatie/,
  currency: /валют|^valut|^currency/,
  name: /^(наименование|denumire|nume|name)/,
  code: /^(код|cod|code)$/,
  idno: /инн|фискальн|idno|cod fiscal|код фиск/,
  vatCode: /код ндс|плательщика ндс|cod tva|cod (de )?inregistrare tva/,
  address: /адрес|adres/,
};
// Columns that hold only VAT, not the document total.
const vatOnly = (h: string) =>
  /ндс|tva/.test(h) && !/с ндс|cu tva|включая ндс|inclusiv tva/.test(h);

export const documentFields = {
  date: "Data",
  number: "Numărul",
  partner: "Contragentul",
  amount: "Suma cu TVA",
  type: "Tipul documentului",
  currency: "Valuta",
} as const;
export const partnerFields = {
  name: "Denumirea",
  code: "Codul",
  idno: "IDNO",
  vatCode: "Codul TVA",
  address: "Adresa",
} as const;
export type DocumentField = keyof typeof documentFields;
export type PartnerField = keyof typeof partnerFields;
export const requiredFields = {
  documents: ["date", "partner", "amount"] as DocumentField[],
  partners: ["name"] as PartnerField[],
};

/** Where the data sits: the header row and the column of each field (-1 = none). */
export type Layout = {
  type: "documents" | "partners";
  header: number;
  columns: Partial<Record<DocumentField | PartnerField, number>>;
};

function findColumns(row: string[]) {
  const cells = row.map(plain);
  const at = (re: RegExp, skip?: (h: string) => boolean) =>
    cells.findIndex((h) => h && re.test(h) && !skip?.(h));
  return {
    date: at(headers.date),
    number: at(headers.number),
    partner: at(headers.partner),
    amount: at(headers.amount, vatOnly),
    type: at(headers.type),
    currency: at(headers.currency),
    name: at(headers.name),
    code: at(headers.code),
    idno: at(headers.idno),
    vatCode: at(headers.vatCode),
    address: at(headers.address),
  };
}

/** Columns found from the header names, or null when no header is recognised. */
export function detect1C(grid: Grid): Layout | null {
  let best = -1,
    score = 0;
  for (let r = 0; r < Math.min(grid.length, 30); r++) {
    const c = findColumns(grid[r]);
    const docs = [c.date, c.amount, c.partner].filter((i) => i >= 0).length;
    const partners = c.name >= 0 ? 1 + (c.idno >= 0 || c.code >= 0 ? 1 : 0) : 0;
    const s = docs === 3 ? 3 : partners === 2 && docs < 2 ? 2 : 0;
    if (s > score) {
      score = s;
      best = r;
    }
  }
  if (best < 0) return null;
  const c = findColumns(grid[best]);
  if (score === 2)
    return {
      type: "partners",
      header: best,
      columns: {
        name: c.name,
        code: c.code,
        idno: c.idno,
        vatCode: c.vatCode,
        address: c.address,
      },
    };
  return {
    type: "documents",
    header: best,
    columns: {
      date: c.date,
      number: c.number,
      partner: c.partner,
      amount: c.amount,
      type: c.type,
      currency: c.currency,
    },
  };
}

/** A starting point for choosing columns by hand: the first row with text. */
export function blankLayout(grid: Grid): Layout {
  const header = Math.max(
    0,
    grid.findIndex((row) => row.filter((v) => v.trim()).length >= 2),
  );
  return { type: "documents", header, columns: {} };
}

export function kindFromText(text: string): Kind | null {
  const t = plain(text);
  if (/реализац|продаж|отгрузк|выданн|livrar|vanzar|realizar|emis/.test(t))
    return "sale";
  if (
    /поступлен|покупк|приобрет|получен|intrar|cumpar|achizit|procurar|primit/.test(
      t,
    )
  )
    return "expense";
  return null;
}

/** Amount in bani from "1 234,56", "1,234.56", "1234.5" or a number cell. */
export function amount1C(value: string): number {
  let s = value.replace(/[\s ']/g, "").replace(/(mdl|lei|лей|руб)\.?$/i, "");
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");
  else if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s))
    s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(s)) throw Error("Sumă nerecunoscută");
  return Math.round(Number(s) * 100);
}

/** ISO date from "05.10.2026", "05.10.2026 0:00:00", "5.10.26" or ISO text. */
export function date1C(value: string): string {
  const s = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const m = /^(\d{1,2})[./](\d{1,2})[./](\d{2}|\d{4})(\s|$)/.exec(s);
  if (!m) throw Error("Dată nerecunoscută");
  const year = m[3].length === 2 ? `20${m[3]}` : m[3];
  const out = `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  const d = new Date(`${out}T12:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== out)
    throw Error("Dată nerecunoscută");
  return out;
}

// "Реализация товаров и услуг 0000-000123 от 05.10.2026" carries the number too.
const numberInText = (text: string) =>
  /([A-ZА-Я]{0,4}[-\d]*\d{2,}[-\d]*)\s+(от|din)\s+\d/i.exec(text)?.[1] ?? "";

const totalRow = (row: string[]) =>
  row.some((c) => /^(итого|всего|total( general)?|total:)$/.test(plain(c)));

export function read1C(grid: Grid, layout?: Layout): Read1C {
  const found = layout ?? detect1C(grid);
  if (!found)
    throw Error(
      "Nu am găsit antetul 1C. Fișierul trebuie să aibă coloanele Data, Contragent și Suma (pentru documente) sau Denumire și Cod/IDNO (pentru contragenți).",
    );
  const best = found.header;
  const col = (f: DocumentField | PartnerField) => found.columns[f] ?? -1;
  const fields = found.type === "documents" ? documentFields : partnerFields;
  for (const f of requiredFields[found.type])
    if (col(f) < 0)
      throw Error(
        `Alege coloana pentru „${(fields as Record<string, string>)[f]}”.`,
      );
  const raw = (grid[best] ?? []).map(plain);
  const body = grid
    .slice(best + 1)
    .map((row, i) => ({ row, line: best + i + 2 }))
    .filter(({ row }) => row.some((v) => v.trim()) && !totalRow(row));
  if (!body.length) throw Error("Fișierul nu conține rânduri după antet.");
  if (body.length > MAX_1C_ROWS)
    throw Error(
      `Maximum ${MAX_1C_ROWS} rânduri într-un import. Împarte lista pe perioade.`,
    );
  const get = (row: string[], i: number) =>
    i >= 0 ? (row[i] ?? "").trim() : "";

  if (found.type === "partners") {
    return {
      type: "partners",
      header: best,
      rows: body.map(({ row, line }) => {
        const idno = get(row, col("idno")).replace(/\D/g, "");
        const out: PartnerRow = {
          line,
          code: get(row, col("code")).slice(0, 40),
          name: get(row, col("name")).replace(/\s+/g, " ").slice(0, 120),
          idno: /^\d{13}$/.test(idno) ? idno : "",
          vatCode: get(row, col("vatCode")).slice(0, 40),
          address: get(row, col("address")).slice(0, 500),
        };
        if (out.name.length < 2) out.error = "Denumirea lipsește.";
        return out;
      }),
    };
  }

  const partnerHeader = raw[col("partner")] ?? "";
  const defaultKind: Kind | null = /покупател|cumparator|client/.test(
    partnerHeader,
  )
    ? "sale"
    : /поставщик|furnizor/.test(partnerHeader)
      ? "expense"
      : null;
  const last = grid
    .slice(best + 1)
    .filter(totalRow)
    .at(-1);
  let controlTotal: number | null = null;
  try {
    if (last && get(last, col("amount")))
      controlTotal = amount1C(get(last, col("amount")));
  } catch {
    controlTotal = null;
  }
  return {
    type: "documents",
    header: best,
    defaultKind,
    controlTotal,
    rows: body.map(({ row, line }) => {
      const typeText = get(row, col("type"));
      const out: DocumentRow = {
        line,
        number: (get(row, col("number")) || numberInText(typeText)).slice(
          0,
          60,
        ),
        date: "",
        partner: get(row, col("partner")).replace(/\s+/g, " ").slice(0, 120),
        total: 0,
        kind: kindFromText(typeText) ?? defaultKind,
      };
      try {
        out.date = date1C(get(row, col("date")));
        out.total = amount1C(get(row, col("amount")));
        const currency = plain(get(row, col("currency")));
        if (currency && !/^(mdl|lei|лей|леи|498)$/.test(currency))
          out.error = `Valuta ${get(row, col("currency"))} nu este acceptată încă; doar MDL.`;
        else if (out.partner.length < 2) out.error = "Contragentul lipsește.";
        else if (out.total <= 0)
          out.error =
            "Suma trebuie să fie pozitivă (stornările se introduc separat).";
        else if (out.total > 100_000_000)
          out.error = "Sumă prea mare pentru un document.";
      } catch (e) {
        out.error = `${(e as Error).message}.`;
      }
      return out;
    }),
  };
}

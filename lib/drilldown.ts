import { z } from "zod";
import type { Invoice } from "./domain";
import type { Entry } from "./ledger-report";

// Behind every amount in a report: the documents, how the amount is made up,
// the journal entries and who changed what. The same functions run on the
// server and in the demo, so both show the same breakdown.

export const columns = ["opening", "debit", "credit", "closing"] as const;
export type Column = (typeof columns)[number];
export const columnNames: Record<Column, string> = {
  opening: "Sold inițial",
  debit: "Rulaj debit",
  credit: "Rulaj credit",
  closing: "Sold final",
};

export const drillSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("account"),
      account: z.string().trim().min(1).max(20),
      column: z.enum(columns),
      from: z.iso.date(),
      to: z.iso.date(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("documents"),
      invoiceIds: z.array(z.uuid()).min(1).max(500),
    })
    .strict(),
]);
export type DrillRequest = z.infer<typeof drillSchema>;

export type Step = { label: string; amount: number; sign?: "+" | "−" | "=" };

export type HistoryItem = {
  at: string;
  who: string;
  invoiceId?: string;
  what: string;
  changes: { field: string; before: string; after: string }[];
};

export type Drill = {
  title: string;
  steps: Step[];
  invoices: Invoice[];
  entries: Entry[];
  history: HistoryItem[];
  /** set when the list was cut to stay readable */
  truncated?: boolean;
};

export const MAX_DRILL_ENTRIES = 2000;

const lei = (bani: number) =>
  (bani / 100).toLocaleString("ro-MD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** Posted entries that make up one cell of the trial balance, and the sum. */
export function accountDrill(
  all: Entry[],
  account: string,
  column: Column,
  from: string,
  to: string,
): Pick<Drill, "title" | "steps" | "entries"> {
  const posted = all.filter(
    (e) =>
      e.state === "posted" &&
      e.effectiveDate &&
      e.effectiveDate <= to &&
      (e.debit === account || e.credit === account),
  );
  const signed = (e: Entry) => (e.debit === account ? e.amount : -e.amount);
  const before = posted.filter((e) => e.effectiveDate! < from);
  const inside = posted.filter((e) => e.effectiveDate! >= from);
  const opening = before.reduce((a, e) => a + signed(e), 0);
  const debit = inside
    .filter((e) => e.debit === account)
    .reduce((a, e) => a + e.amount, 0);
  const credit = inside
    .filter((e) => e.credit === account)
    .reduce((a, e) => a + e.amount, 0);
  const title = `${columnNames[column]} · cont ${account} · ${from} — ${to}`;
  const byDate = (list: Entry[]) =>
    [...list].sort(
      (a, b) =>
        a.effectiveDate!.localeCompare(b.effectiveDate!) ||
        a.id.localeCompare(b.id),
    );
  if (column === "opening")
    return {
      title,
      entries: byDate(before),
      steps: [
        {
          label: `Debite până la ${from}`,
          amount: before
            .filter((e) => e.debit === account)
            .reduce((a, e) => a + e.amount, 0),
        },
        {
          label: `Credite până la ${from}`,
          amount: before
            .filter((e) => e.credit === account)
            .reduce((a, e) => a + e.amount, 0),
          sign: "−",
        },
        { label: "Sold inițial (pozitiv = debit)", amount: opening, sign: "=" },
      ],
    };
  if (column === "debit" || column === "credit") {
    const list = byDate(
      inside.filter((e) =>
        column === "debit" ? e.debit === account : e.credit === account,
      ),
    );
    return {
      title,
      entries: list,
      steps: [
        ...list.slice(0, 30).map((e, i) => ({
          label: `${e.effectiveDate} · Dt ${e.debit} Ct ${e.credit}`,
          amount: e.amount,
          sign: i ? ("+" as const) : undefined,
        })),
        ...(list.length > 30
          ? [
              {
                label: `alte ${list.length - 30} articole`,
                amount: list.slice(30).reduce((a, e) => a + e.amount, 0),
                sign: "+" as const,
              },
            ]
          : []),
        {
          label: columnNames[column],
          amount: column === "debit" ? debit : credit,
          sign: "=",
        },
      ],
    };
  }
  return {
    title,
    entries: byDate(posted),
    steps: [
      { label: "Sold inițial", amount: opening },
      { label: "Rulaj debit", amount: debit, sign: "+" },
      { label: "Rulaj credit", amount: credit, sign: "−" },
      {
        label: "Sold final (pozitiv = debit)",
        amount: opening + debit - credit,
        sign: "=",
      },
    ],
  };
}

/** What is still to collect or pay on a set of documents. */
export function dueSteps(invoices: Invoice[]): Step[] {
  const total = invoices.reduce((a, i) => a + i.total, 0);
  const paid = invoices.reduce((a, i) => a + i.paid, 0);
  return [
    {
      label:
        invoices.length === 1
          ? "Totalul documentului"
          : `Totalul celor ${invoices.length} documente`,
      amount: total,
    },
    { label: "Achitat până acum", amount: paid, sign: "−" },
    { label: "Rămas de achitat", amount: total - paid, sign: "=" },
  ];
}

const fieldNames: Record<string, string> = {
  customer: "Contragent",
  total: "Total",
  paid: "Achitat",
  date: "Data",
  kind: "Tip",
  category: "Categorie",
  partnerId: "Partener din nomenclator",
  contractId: "Contract",
  sourceRef: "Sursa",
};
const shown = (field: string, v: unknown) =>
  v === null || v === undefined || v === ""
    ? "—"
    : field === "total" || field === "paid"
      ? lei(Number(v))
      : field === "kind"
        ? v === "expense"
          ? "Cumpărare"
          : "Vânzare"
        : String(v);

/** Field-by-field changes between two versions of a document. */
export function invoiceChanges(
  before: Partial<Invoice> | null,
  after: Partial<Invoice>,
) {
  return Object.keys(fieldNames)
    .map((f) => ({
      f,
      before: before ? shown(f, before[f as keyof Invoice]) : "—",
      after: shown(f, after[f as keyof Invoice]),
    }))
    .filter((c) => c.before !== c.after)
    .map((c) => ({ field: fieldNames[c.f], before: c.before, after: c.after }));
}

const actionNames: Record<string, string> = {
  "journal.group.posted": "Articole postate",
  "sale.created": "Document creat",
  "expense.created": "Document creat",
  "payment.created": "Plată înregistrată",
  "receipt.created": "Încasare înregistrată",
};
export const actionName = (action: string) =>
  actionNames[action] ??
  (action.endsWith(".created") ? "Operațiune înregistrată" : action);

/**
 * Puts a drill-down together from data already limited to the company:
 * `entries` are the journal lines that may matter, `invoices` the documents.
 */
export function assembleDrill(
  req: DrillRequest,
  entries: Entry[],
  invoices: Invoice[],
  history: HistoryItem[],
): Drill {
  let base: Pick<Drill, "title" | "steps" | "entries">;
  let docs: Invoice[];
  if (req.kind === "account") {
    base = accountDrill(entries, req.account, req.column, req.from, req.to);
    const ids = new Set(base.entries.map((e) => e.invoiceId));
    docs = invoices.filter((i) => ids.has(i.id));
  } else {
    const ids = new Set(req.invoiceIds);
    docs = invoices.filter((i) => ids.has(i.id));
    base = {
      title:
        docs.length === 1
          ? `${docs[0].customer} · ${docs[0].date}`
          : `${docs.length} documente`,
      steps: dueSteps(docs),
      entries: entries
        .filter((e) => ids.has(e.invoiceId))
        .sort(
          (a, b) =>
            (a.effectiveDate ?? "").localeCompare(b.effectiveDate ?? "") ||
            a.id.localeCompare(b.id),
        ),
    };
  }
  const keep = new Set(docs.map((d) => d.id));
  return {
    ...base,
    entries: base.entries.slice(0, MAX_DRILL_ENTRIES),
    invoices: [...docs].sort((a, b) => a.date.localeCompare(b.date)),
    history: history
      .filter((h) => !h.invoiceId || keep.has(h.invoiceId))
      .sort((a, b) => b.at.localeCompare(a.at)),
    truncated: base.entries.length > MAX_DRILL_ENTRIES || undefined,
  };
}

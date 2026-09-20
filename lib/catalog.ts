import { z } from "zod";
export const catalogKinds = [
  "partner",
  "contract",
  "item",
  "unit",
  "warehouse",
  "subdivision",
  "bank",
  "cash",
  "currency",
  "exchange_rate",
  "vat",
  "position",
  "employee",
  "asset",
  "category",
] as const;
export type CatalogKind = (typeof catalogKinds)[number];
export const catalogNames: Record<CatalogKind, string> = {
  partner: "Clienți și furnizori",
  contract: "Contracte",
  item: "Produse, materiale și servicii",
  unit: "Unități de măsură",
  warehouse: "Depozite",
  subdivision: "Subdiviziuni",
  bank: "Conturi bancare",
  cash: "Casierii",
  currency: "Valute",
  exchange_rate: "Cursuri valutare",
  vat: "Cote TVA",
  position: "Funcții",
  employee: "Angajați",
  asset: "Mijloace fixe",
  category: "Articole de venituri și cheltuieli",
};
export const catalogSchema = z
  .object({
    id: z.uuid(),
    kind: z.enum(catalogKinds),
    code: z.string().trim().min(1).max(40),
    name: z.string().trim().min(2).max(160),
    version: z.number().int().nonnegative(),
    active: z.boolean(),
    details: z.record(z.string().max(40), z.string().max(500)),
  })
  .strict()
  .superRefine((x, ctx) => {
    if (x.kind === "partner" && x.name.length > 120)
      ctx.addIssue({
        code: "custom",
        message: "Denumirea partenerului poate avea cel mult 120 caractere",
      });
    const allowed = new Set(catalogFields[x.kind].map((f) => f.key));
    for (const key of Object.keys(x.details))
      if (!allowed.has(key))
        ctx.addIssue({ code: "custom", message: `Câmp nepermis: ${key}` });
    for (const field of catalogFields[x.kind]) {
      const v = x.details[field.key] ?? "";
      if (field.required && !v.trim())
        ctx.addIssue({ code: "custom", message: `Completează ${field.label}` });
      if (v && field.type === "date" && !z.iso.date().safeParse(v).success)
        ctx.addIssue({
          code: "custom",
          message: `Dată invalidă: ${field.label}`,
        });
      if (
        v &&
        field.type === "number" &&
        (!/^\d+(\.\d{1,6})?$/.test(v) || !Number.isFinite(Number(v)))
      )
        ctx.addIssue({
          code: "custom",
          message: `Număr invalid: ${field.label}`,
        });
      if (v && field.ref && !z.uuid().safeParse(v).success)
        ctx.addIssue({
          code: "custom",
          message: `Referință invalidă: ${field.label}`,
        });
      if (v && field.options && !field.options.includes(v))
        ctx.addIssue({
          code: "custom",
          message: `Valoare invalidă: ${field.label}`,
        });
    }
    if (
      x.kind === "partner" &&
      x.details.idno &&
      !/^\d{13}$/.test(x.details.idno)
    )
      ctx.addIssue({
        code: "custom",
        message: "IDNO trebuie să aibă 13 cifre",
      });
    if (
      x.kind === "bank" &&
      x.details.iban &&
      !/^[A-Z]{2}[0-9A-Z]{13,32}$/.test(x.details.iban)
    )
      ctx.addIssue({ code: "custom", message: "Format IBAN invalid" });
    if (x.kind === "currency" && !/^[A-Z]{3}$/.test(x.code))
      ctx.addIssue({
        code: "custom",
        message: "Cod valută: trei litere majuscule",
      });
    if (x.kind === "exchange_rate" && Number(x.details.rate) <= 0)
      ctx.addIssue({
        code: "custom",
        message: "Cursul trebuie să fie pozitiv",
      });
    if (x.kind === "vat" && Number(x.details.rate) > 100)
      ctx.addIssue({
        code: "custom",
        message: "Cota TVA nu poate depăși 100%",
      });
    if (
      x.details.validTo &&
      x.details.validFrom &&
      x.details.validTo < x.details.validFrom
    )
      ctx.addIssue({
        code: "custom",
        message: "Interval de valabilitate invalid",
      });
  });
export type CatalogEntry = z.infer<typeof catalogSchema>;
export type CatalogField = {
  key: string;
  label: string;
  type?: "date" | "number";
  required?: boolean;
  ref?: CatalogKind;
  options?: string[];
};
export const catalogFields: Record<CatalogKind, CatalogField[]> = {
  partner: [
    {
      key: "role",
      label: "Tip partener",
      required: true,
      options: ["client", "furnizor", "ambele"],
    },
    { key: "idno", label: "IDNO" },
    { key: "vatCode", label: "Cod TVA" },
    { key: "address", label: "Adresă" },
  ],
  contract: [
    { key: "partnerId", label: "Partener", ref: "partner", required: true },
    { key: "validFrom", label: "Valabil din", type: "date", required: true },
    { key: "validTo", label: "Valabil până la", type: "date" },
  ],
  item: [
    {
      key: "type",
      label: "Tip articol",
      required: true,
      options: ["produs", "material", "serviciu"],
    },
    { key: "unitId", label: "Unitate de măsură", ref: "unit", required: true },
    { key: "barcode", label: "Cod de bare" },
  ],
  unit: [],
  warehouse: [
    { key: "subdivisionId", label: "Subdiviziune", ref: "subdivision" },
    { key: "address", label: "Adresă" },
  ],
  subdivision: [],
  bank: [
    { key: "iban", label: "IBAN", required: true },
    { key: "bankName", label: "Banca", required: true },
    { key: "currencyId", label: "Valută", ref: "currency", required: true },
  ],
  cash: [
    { key: "subdivisionId", label: "Subdiviziune", ref: "subdivision" },
    { key: "currencyId", label: "Valută", ref: "currency", required: true },
  ],
  currency: [],
  exchange_rate: [
    { key: "currencyId", label: "Valută", ref: "currency", required: true },
    { key: "date", label: "Data cursului", type: "date", required: true },
    {
      key: "rate",
      label: "MDL pentru o unitate",
      type: "number",
      required: true,
    },
    { key: "source", label: "Sursa verificată", required: true },
  ],
  vat: [
    { key: "rate", label: "Cotă (%)", type: "number", required: true },
    { key: "validFrom", label: "Valabil din", type: "date", required: true },
    { key: "validTo", label: "Valabil până la", type: "date" },
    { key: "source", label: "Temei / sursă verificată", required: true },
  ],
  position: [],
  employee: [
    { key: "positionId", label: "Funcție", ref: "position", required: true },
    { key: "subdivisionId", label: "Subdiviziune", ref: "subdivision" },
  ],
  asset: [
    { key: "responsibleId", label: "Responsabil", ref: "employee" },
    { key: "warehouseId", label: "Locație / depozit", ref: "warehouse" },
  ],
  category: [
    {
      key: "type",
      label: "Tip articol",
      options: ["venit", "cheltuială"],
      required: true,
    },
  ],
};
export const catalogOperationSchema = z
  .object({
    id: z.uuid(),
    entry: catalogSchema,
    baseVersion: z.number().int().nonnegative(),
    reason: z.string().trim().min(10).max(500),
  })
  .strict();
export type CatalogOperation = z.infer<typeof catalogOperationSchema>;
export type CatalogPending = CatalogOperation & {
  conflict?: CatalogEntry | null;
  error?: string;
};
export function validateCatalogChange(
  entries: CatalogEntry[],
  op: CatalogOperation,
): CatalogEntry {
  const old = entries.find((e) => e.id === op.entry.id);
  if ((old?.version ?? 0) !== op.baseVersion) throw new Error("CONFLICT");
  if (old && (old.kind !== op.entry.kind || old.code !== op.entry.code))
    throw new Error(
      "Tipul și codul sunt permanente; creează o înregistrare nouă.",
    );
  if (
    entries.some(
      (e) =>
        e.id !== op.entry.id &&
        e.kind === op.entry.kind &&
        e.code.toLowerCase() === op.entry.code.toLowerCase(),
    )
  )
    throw new Error("Cod deja folosit în acest nomenclator.");
  for (const f of catalogFields[op.entry.kind])
    if (f.ref && op.entry.details[f.key]) {
      const ref = entries.find(
        (e) => e.id === op.entry.details[f.key] && e.kind === f.ref,
      );
      if (!ref || (!ref.active && old?.details[f.key] !== ref.id))
        throw new Error(`Referința ${f.label} lipsește sau este arhivată.`);
    }
  return { ...op.entry, version: op.baseVersion + 1 };
}
export const canReadCatalog = (role: string, kind: CatalogKind) =>
  kind !== "employee" ||
  ["admin", "chief_accountant", "accountant", "auditor"].includes(role);

export function validateDocumentReferences(
  entries: CatalogEntry[],
  doc: {
    partnerId?: string | null;
    contractId?: string | null;
    kind?: string;
    customer: string;
    date: string;
  },
) {
  if (!doc.partnerId) {
    if (doc.contractId) throw Error("Contractul necesită un partener.");
    return;
  }
  const partner = entries.find(
    (e) => e.id === doc.partnerId && e.kind === "partner" && e.active,
  );
  if (
    !partner ||
    ![doc.kind === "expense" ? "furnizor" : "client", "ambele"].includes(
      partner.details.role,
    )
  )
    throw Error("Partener inexistent, arhivat sau cu tip nepotrivit.");
  if (partner.name !== doc.customer)
    throw Error(
      "Denumirea partenerului s-a schimbat; verifică documentul înainte de salvare.",
    );
  if (doc.contractId) {
    const contract = entries.find(
      (e) => e.id === doc.contractId && e.kind === "contract" && e.active,
    );
    if (
      !contract ||
      contract.details.partnerId !== partner.id ||
      contract.details.validFrom > doc.date ||
      (contract.details.validTo && contract.details.validTo < doc.date)
    )
      throw Error(
        "Contractul nu aparține partenerului sau nu este valabil la data documentului.",
      );
  }
}

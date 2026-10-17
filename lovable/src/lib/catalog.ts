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

export type CatalogField = { key: string; label: string; placeholder?: string };

export const catalogFields: Record<CatalogKind, CatalogField[]> = {
  partner: [
    { key: "idno", label: "IDNO", placeholder: "13 cifre" },
    { key: "vatCode", label: "Cod TVA" },
    { key: "address", label: "Adresa juridică" },
    { key: "iban", label: "IBAN" },
    { key: "bank", label: "Banca" },
    { key: "bankCode", label: "Cod bancar" },
    { key: "role", label: "Rol", placeholder: "client / furnizor / ambele" },
    { key: "phone", label: "Telefon" },
  ],
  contract: [
    { key: "partner", label: "Partener" },
    { key: "validTo", label: "Valabil până la", placeholder: "AAAA-LL-ZZ" },
  ],
  item: [
    { key: "unit", label: "Unitate" },
    { key: "type", label: "Tip", placeholder: "produs / material / serviciu" },
  ],
  unit: [{ key: "short", label: "Abreviere" }],
  warehouse: [{ key: "address", label: "Adresă" }],
  subdivision: [{ key: "head", label: "Responsabil" }],
  bank: [
    { key: "iban", label: "IBAN" },
    { key: "bank", label: "Banca" },
  ],
  cash: [{ key: "cashier", label: "Casier" }],
  currency: [{ key: "symbol", label: "Simbol" }],
  exchange_rate: [
    { key: "date", label: "Data", placeholder: "AAAA-LL-ZZ" },
    { key: "rate", label: "Curs" },
  ],
  vat: [{ key: "rate", label: "Cotă %" }],
  position: [{ key: "subdivision", label: "Subdiviziune" }],
  employee: [
    { key: "position", label: "Funcție" },
    { key: "idnp", label: "IDNP" },
  ],
  asset: [
    { key: "inventory", label: "Nr. inventar" },
    { key: "responsible", label: "Responsabil" },
  ],
  category: [{ key: "type", label: "Tip", placeholder: "venit / cheltuială" }],
};

export function validateCatalog(kind: CatalogKind, code: string, name: string, details: Record<string, string>) {
  if (!code.trim()) return "Completează codul.";
  if (name.trim().length < 2) return "Denumirea este prea scurtă.";
  if (kind === "partner" && details['idno'] && !/^\d{13}$/.test(details['idno'])) return "IDNO trebuie să aibă 13 cifre.";
  if (kind === "bank" && details['iban'] && !/^MD\d{2}[A-Z0-9]{20}$/.test(details['iban'].replace(/\s/g, "")))
    return "Format IBAN invalid.";
  if (kind === "currency" && !/^[A-Z]{3}$/.test(code)) return "Cod valută: trei litere majuscule.";
  if (kind === "vat" && details['rate'] && (Number(details['rate']) < 0 || Number(details['rate']) > 100))
    return "Cota TVA trebuie să fie între 0 și 100.";
  return null;
}

// Amounts are stored as integer "bani" (1 MDL = 100 bani).
const fmt = new Intl.NumberFormat("ro-MD", { style: "currency", currency: "MDL" });
const codeFmt = new Intl.NumberFormat("ro-MD", { style: "currency", currency: "MDL", currencyDisplay: "code" });

export const money = (bani: number, display: "symbol" | "code" = "symbol") => (display === "code" ? codeFmt : fmt).format(bani / 100);

/** Parses "1 234,56" / "1234.5" into bani. Returns null when invalid. */
export function parseMoney(text: string): number | null {
  const clean = text.replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const [whole, frac = ""] = clean.split(".");
  const value = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return Number.isSafeInteger(value) ? value : null;
}

import { z } from "zod";
// Numeric input is stored as text while a draft is edited, avoiding silent rounding.
export const documentLineSchema = z
  .object({
    id: z.uuid(),
    description: z.string().max(160),
    unit: z.string().max(30),
    quantity: z.string().max(20),
    price: z.string().max(20),
    vat: z.string().max(10),
    priceMode: z.enum(["net", "gross"]),
    category: z.enum(["goods", "service"]),
  })
  .strict();
export type DocumentLine = z.infer<typeof documentLineSchema>;
export const documentLinesSchema = z
  .array(documentLineSchema)
  .min(1)
  .max(200)
  .refine(
    (rows) => new Set(rows.map((r) => r.id)).size === rows.length,
    "Identificatori de rând duplicați.",
  );
function fixed(value: string, places: number, label: string): bigint {
  const input = value.trim().replace(",", ".");
  if (!new RegExp(`^\\d{1,8}(\\.\\d{1,${places}})?$`).test(input))
    throw Error(
      `${label}: introdu cel mult ${places} zecimale, fără valori negative.`,
    );
  const [whole, fraction = ""] = input.split(".");
  return (
    BigInt(whole) * 10n ** BigInt(places) + BigInt(fraction.padEnd(places, "0"))
  );
}
const rounded = (n: bigint, d: bigint) => (n + d / 2n) / d;
export function calculateDocumentLines(input: DocumentLine[]) {
  const rows = documentLinesSchema.parse(input).map((line) => {
    if (!line.description.trim() || !line.unit.trim())
      throw Error("Completează denumirea și unitatea fiecărei poziții.");
    const quantity = fixed(line.quantity, 3, "Cantitate"),
      price = fixed(line.price, 2, "Preț"),
      rate = fixed(line.vat, 2, "TVA");
    if (quantity <= 0n)
      throw Error("Cantitatea trebuie să fie mai mare decât zero.");
    if (rate > 10000n) throw Error("Procentul TVA nu poate depăși 100%.");
    const extended = rounded(quantity * price, 1000n);
    const net =
      line.priceMode === "net"
        ? extended
        : rounded(extended * 10000n, 10000n + rate);
    const vat =
      line.priceMode === "net" ? rounded(net * rate, 10000n) : extended - net;
    const total = net + vat;
    if (total > 100000000n)
      throw Error("Poziția depășește limita documentului.");
    return {
      id: line.id,
      net: Number(net),
      vat: Number(vat),
      total: Number(total),
    };
  });
  const totals = rows.reduce(
    (s, r) => ({
      net: s.net + r.net,
      vat: s.vat + r.vat,
      total: s.total + r.total,
    }),
    { net: 0, vat: 0, total: 0 },
  );
  if (totals.total > 100000000)
    throw Error("Totalul depășește limita documentului.");
  return { ...totals, rows };
}

import { z } from "zod";
const date = z.iso.date();
export const legalVersionSchema = z
  .object({
    actId: z.string().min(3).max(200),
    sourceDocumentId: z.string().min(1).max(100),
    title: z.string().min(3).max(1000),
    issuer: z.string().min(2).max(200),
    actType: z.string().min(2).max(100),
    number: z.string().min(1).max(100),
    adoptedOn: date,
    publishedOn: date.nullable(),
    language: z.enum(["ro", "ru"]),
    sourceUrl: z
      .url()
      .refine(
        (v) => new URL(v).protocol === "https:",
        "Sursa trebuie să fie HTTPS",
      ),
    sourceClass: z.enum(["official", "secondary"]),
    status: z.enum(["adopted", "draft"]),
    validFrom: date.nullable(),
    validTo: date.nullable(), // exclusive
    repealedOn: date.nullable(), // complete repeal; partial repeal belongs to provisions
    provisions: z
      .array(
        z
          .object({
            reference: z.string().min(1).max(200),
            text: z.string().min(1).max(500000),
            validFrom: date.nullable(),
            validTo: date.nullable(),
          })
          .strict(),
      )
      .min(1)
      .max(10000),
  })
  .strict()
  .superRefine((v, ctx) => {
    const bad = (message: string) => ctx.addIssue({ code: "custom", message });
    if (v.sourceClass === "official") {
      const host = new URL(v.sourceUrl).hostname;
      if (
        ![
          "legis.md",
          "www.legis.md",
          "monitorul.gov.md",
          "www.monitorul.gov.md",
          "mf.gov.md",
          "www.mf.gov.md",
          "sfs.md",
          "www.sfs.md",
          "justice.gov.md",
          "www.justice.gov.md",
        ].includes(host)
      )
        bad("Domeniu oficial neaprobat");
    }
    if (v.validFrom && v.validTo && v.validFrom >= v.validTo)
      bad("Interval invalid");
    if (
      new Set(v.provisions.map((p) => p.reference)).size !== v.provisions.length
    )
      bad("Referințe de articol duplicate");
    for (const p of v.provisions)
      if (p.validFrom && p.validTo && p.validFrom >= p.validTo)
        bad("Interval de articol invalid");
  });
export type LegalVersion = z.infer<typeof legalVersionSchema>;
export type LegalState =
  "current" | "future" | "archive" | "draft" | "unverified" | "unknown";
export function legalState(
  v: LegalVersion,
  at: string,
  verified: boolean,
): LegalState {
  date.parse(at);
  if (v.status === "draft") return "draft";
  if (!verified || v.sourceClass !== "official") return "unverified";
  if (!v.validFrom) return "unknown";
  if ((v.repealedOn && at >= v.repealedOn) || (v.validTo && at >= v.validTo))
    return "archive";
  return v.validFrom > at ? "future" : "current";
}
export function applicableProvisions(
  v: LegalVersion,
  at: string,
  verified: boolean,
) {
  if (legalState(v, at, verified) !== "current") return [];
  return v.provisions.filter((p) => {
    const from = p.validFrom ?? v.validFrom;
    const to = p.validTo ?? v.validTo;
    return from && from <= at && (!to || at < to);
  });
}
export function overlapping(a: LegalVersion, b: LegalVersion) {
  if (
    a.actId !== b.actId ||
    a.language !== b.language ||
    !a.validFrom ||
    !b.validFrom
  )
    return false;
  const end = (v: LegalVersion) =>
    [v.validTo, v.repealedOn].filter((x): x is string => !!x).sort()[0] ??
    "9999-12-31";
  return a.validFrom < end(b) && b.validFrom < end(a);
}

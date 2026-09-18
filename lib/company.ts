import { z } from "zod";
export const companySchema = z
  .object({
    name: z.string().trim().min(2).max(160),
    shortName: z.string().trim().min(2).max(80),
    legalForm: z.string().max(30),
    idno: z.string().regex(/^$|^\d{13}$/),
    vatCode: z.string().max(30),
    legalAddress: z.string().max(250),
    businessAddress: z.string().max(250),
    phone: z.string().max(40),
    email: z.union([z.email(), z.literal("")]),
    iban: z
      .string()
      .max(34)
      .refine((v) => !v || /^[A-Z]{2}[0-9A-Z]{13,32}$/.test(v), "IBAN invalid"),
    bank: z.string().max(120),
    bic: z.string().max(11),
    director: z.string().max(120),
    chiefAccountant: z.string().max(120),
    currency: z.enum(["MDL", "EUR", "USD"]),
    taxRegime: z.string().max(120),
    vatRegistered: z.boolean(),
    reportingPeriod: z.string().max(80),
    accountingPolicy: z.string().max(4000),
    effectiveFrom: z.iso.date(),
  })
  .strict();
export type Company = z.infer<typeof companySchema>;
export const demoCompany: Company = {
  name: "Socot Atelier SRL",
  shortName: "Socot Atelier",
  legalForm: "SRL",
  idno: "",
  vatCode: "",
  legalAddress: "Adresă fictivă, Republica Moldova",
  businessAddress: "",
  phone: "",
  email: "",
  iban: "",
  bank: "",
  bic: "",
  director: "Responsabil demonstrativ",
  chiefAccountant: "Contabil demonstrativ",
  currency: "MDL",
  taxRegime: "Nedefinit — necesită validare",
  vatRegistered: false,
  reportingPeriod: "Lunar (demonstrativ)",
  accountingPolicy:
    "Model demonstrativ. Se validează separat înainte de utilizare reală.",
  effectiveFrom: "2026-01-01",
};
export const accountSchema = z
  .object({
    code: z.string().regex(/^\d{3,8}$/),
    name: z.string().trim().min(2).max(150),
    class: z.number().int().min(1).max(9),
    type: z.enum([
      "asset",
      "liability",
      "income",
      "expense",
      "management",
      "off_balance",
    ]),
    balanceNature: z.enum(["debit", "credit", "mixed"]),
    currency: z.enum(["MDL", "EUR", "USD"]),
    analytics: z.array(z.string().max(40)).max(10),
    parentCode: z.string().max(8).nullable(),
    validFrom: z.iso.date(),
    validTo: z.iso.date().nullable(),
    source: z.string().min(10).max(500),
    directPosting: z.boolean(),
    active: z.boolean(),
  })
  .strict()
  .refine(
    (a) => a.class === Number(a.code[0]),
    "Clasa trebuie să corespundă codului",
  )
  .refine((a) => !a.validTo || a.validTo >= a.validFrom, "Interval invalid");
export type Account = z.infer<typeof accountSchema>;
export const accountClasses = [
  "Active imobilizate",
  "Active circulante",
  "Capital propriu",
  "Datorii pe termen lung",
  "Datorii curente",
  "Venituri",
  "Cheltuieli",
  "Conturi de gestiune",
  "Conturi extrabilanțiere",
];
export const demoAccounts: Account[] = [
  {
    code: "221",
    name: "Creanțe comerciale — model",
    class: 2,
    type: "asset",
    balanceNature: "debit",
    currency: "MDL",
    analytics: ["partener", "document"],
    parentCode: null,
    validFrom: "2000-01-01",
    validTo: null,
    source: "Model demonstrativ Socot — necesită validare profesională",
    directPosting: true,
    active: true,
  },
  {
    code: "242",
    name: "Conturi bancare — model",
    class: 2,
    type: "asset",
    balanceNature: "debit",
    currency: "MDL",
    analytics: ["cont bancar"],
    parentCode: null,
    validFrom: "2000-01-01",
    validTo: null,
    source: "Model demonstrativ Socot — necesită validare profesională",
    directPosting: true,
    active: true,
  },
  {
    code: "611",
    name: "Venituri din vânzări — model",
    class: 6,
    type: "income",
    balanceNature: "credit",
    currency: "MDL",
    analytics: ["document"],
    parentCode: null,
    validFrom: "2000-01-01",
    validTo: null,
    source: "Model demonstrativ Socot — necesită validare profesională",
    directPosting: true,
    active: true,
  },
];

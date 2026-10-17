import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import type { PrismaClient } from "@prisma/client";
import {
  draftFromScan,
  scanSignatureMatches,
  type ScannedInvoice,
} from "../lib/invoice-scan";
import type { CatalogEntry } from "../lib/catalog";
import { aiRouter } from "../server/ai";

const scan: ScannedInvoice = {
  number: "AA 123",
  issueDate: "2026-10-03",
  currency: "MDL",
  supplier: { name: "Furnizor SRL", fiscalCode: "1003600000001" },
  customer: { name: "Client SRL", fiscalCode: "1003600000002" },
  lines: [
    { name: "Hârtie A4", unit: "top", quantity: "2", unitPrice: 12550, vatRate: "20%" },
    { name: "Livrare", unit: "serv", quantity: "1", unitPrice: 5000, vatRate: "scutit" },
    { name: null, unit: null, quantity: null, unitPrice: null, vatRate: null },
  ],
  total: 35120,
  warnings: [],
};
const partner = {
  id: "11111111-1111-4111-8111-111111111111",
  kind: "partner",
  code: "P1",
  name: "Furnizor SRL (nomenclator)",
  version: 1,
  active: true,
  details: { role: "furnizor", idno: "1003 6000 00001" },
} as CatalogEntry;
const draftId = "33333333-3333-4333-8333-333333333333";

test("scanarea devine ciornă cu partenerul din nomenclator și poziții calculabile", () => {
  const { draft, warnings } = draftFromScan(scan, "expense", [partner], draftId, "2026-10-17");
  assert.equal(draft.kind, "expense");
  assert.equal(draft.partnerId, partner.id);
  assert.equal(draft.customer, partner.name);
  assert.equal(draft.date, "2026-10-03");
  assert.equal(draft.total, 35120);
  assert.equal(draft.lines, undefined);
  assert.ok(warnings.some((w) => w.startsWith("Poziții citite: 2.")));
});

test("vânzarea folosește cumpărătorul; partener necunoscut și dată lipsă sunt semnalate", () => {
  const { draft, warnings } = draftFromScan({ ...scan, issueDate: "03.10.2026" }, "sale", [partner], draftId, "2026-10-17");
  assert.equal(draft.customer, "Client SRL");
  assert.equal(draft.partnerId, null);
  assert.equal(draft.date, "2026-10-17");
  assert.ok(warnings.some((w) => w.includes("nomenclator")));
  assert.ok(warnings.some((w) => w.includes("data de azi")));
});

test("facturile în altă monedă sunt refuzate", () => {
  assert.throws(() => draftFromScan({ ...scan, currency: "EUR" }, "sale", [], draftId, "2026-10-17"), /EUR/);
});

test("semnătura fișierului trebuie să corespundă tipului", () => {
  assert.equal(scanSignatureMatches("application/pdf", Buffer.from("%PDF-1.7")), true);
  assert.equal(scanSignatureMatches("image/png", Buffer.from("%PDF-1.7")), false);
  assert.equal(scanSignatureMatches("image/jpeg", Buffer.from([255, 216, 255])), true);
});

test("ruta de scanare cere drept de scriere, verifică fișierul și nu creează documente", async () => {
  let extracted = 0;
  const audits: any[] = [];
  const db = { complianceAudit: { create: async (a: any) => audits.push(a) } } as unknown as PrismaClient;
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use((req, res, next) => {
    res.locals.user = { id: "user", companyId: "own", role: req.headers["x-test-role"] || "accountant" };
    next();
  });
  app.use("/ai", aiRouter(db, async () => { throw Error("unused"); }, async () => { extracted++; return scan; }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/ai/invoice-scan`;
  const post = (body: unknown, role = "accountant") =>
    fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-test-role": role }, body: JSON.stringify(body) });
  const pdf = { name: "f.pdf", type: "application/pdf", data: Buffer.from("%PDF-1.7 test").toString("base64") };
  try {
    assert.equal((await post({ kind: "sale", file: pdf }, "auditor")).status, 403);
    assert.equal((await post({ kind: "sale", file: { ...pdf, type: "image/png" } })).status, 400);
    assert.equal((await post({ kind: "sale", file: { ...pdf, type: "text/html" } })).status, 400);
    assert.equal(extracted, 0);
    const ok = await post({ kind: "sale", file: pdf });
    assert.equal(ok.status, 200);
    assert.deepEqual((await ok.json()).invoice, scan);
    assert.equal(extracted, 1);
    assert.equal(audits[0].data.action, "ai.invoice-scan");
    assert.equal(audits[0].data.companyId, "own");
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateDocumentLines,
  type DocumentLine,
} from "../lib/document-lines";
import { invoiceFromDraft, type DocumentDraft } from "../lib/document-workflow";
const line: DocumentLine = {
  id: "00000000-0000-4000-8000-000000000001",
  description: "Serviciu",
  unit: "buc.",
  quantity: "1",
  price: "2500",
  vat: "20",
  priceMode: "gross",
  category: "service",
};
test("calcul separat net și TVA pentru preț inclus și exclus", () => {
  assert.deepEqual(calculateDocumentLines([line]).rows[0], {
    id: line.id,
    net: 208333,
    vat: 41667,
    total: 250000,
  });
  assert.deepEqual(
    calculateDocumentLines([{ ...line, priceMode: "net" }]).rows[0],
    { id: line.id, net: 250000, vat: 50000, total: 300000 },
  );
  const r = calculateDocumentLines([
    { ...line, quantity: "1,125", price: "0,29", vat: "0", priceMode: "net" },
  ]);
  assert.equal(r.total, 33);
  assert.equal(r.net + r.vat, r.total);
});
test("totaluri conservate și cote explicite pe poziții", () => {
  const r = calculateDocumentLines([
    line,
    {
      ...line,
      id: "00000000-0000-4000-8000-000000000002",
      vat: "8",
      price: "100",
      priceMode: "net",
    },
  ]);
  assert.equal(r.total, 260800);
  assert.equal(r.total, r.net + r.vat);
  for (const change of [
    { quantity: "0" },
    { quantity: "1.0001" },
    { price: "1.001" },
    { vat: "" },
    { vat: "101" },
    { description: "" },
    { price: "99999999" },
  ])
    assert.throws(() => calculateDocumentLines([{ ...line, ...change }]));
  assert.throws(() => calculateDocumentLines([line, line]));
});
test("documentele cu poziții nu sunt convertite în înregistrări simplificate", () => {
  const draft: DocumentDraft = {
    id: line.id,
    kind: "sale",
    customer: "Test",
    category: "",
    partnerId: null,
    contractId: null,
    date: "2026-10-07",
    revision: 0,
    total: 250000,
    lines: [line],
  };
  assert.throws(
    () => invoiceFromDraft(draft),
    /Confirmarea contabilă pe poziții/,
  );
});

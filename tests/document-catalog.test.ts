import test from "node:test";
import assert from "node:assert/strict";
import { lineFromCatalog, calculateDocumentLines } from "../lib/document-lines";
import { draftSchema } from "../lib/document-workflow";
import type { CatalogEntry } from "../lib/catalog";
const unit: CatalogEntry = {
  id: "00000000-0000-4000-8000-000000000001",
  kind: "unit",
  code: "buc.",
  name: "Bucată",
  active: true,
  version: 1,
  details: {},
};
const item: CatalogEntry = {
  ...unit,
  id: "00000000-0000-4000-8000-000000000002",
  kind: "item",
  code: "S1",
  name: "Serviciu test",
  details: { type: "serviciu", unitId: unit.id },
};
const id = "00000000-0000-4000-8000-000000000003";
test("selectarea articolului păstrează instantaneul, dar nu presupune TVA", () => {
  const line = lineFromCatalog(item.id, [item, unit], id);
  assert.equal(line.itemId, item.id);
  assert.equal(line.category, "service");
  assert.equal(line.unit, "buc.");
  assert.throws(() => calculateDocumentLines([line]), /TVA/);
  const draft = draftSchema.parse({
    id,
    kind: "sale",
    customer: "Test",
    category: "",
    partnerId: null,
    contractId: null,
    date: "2026-10-13",
    total: 0,
    revision: 0,
    lines: [{ ...line, discount: "7.5" }],
  });
  const restored = draftSchema.parse(JSON.parse(JSON.stringify(draft)));
  assert.equal(restored.lines?.[0].itemId, item.id);
  assert.equal(restored.lines?.[0].discount, "7.5");
  const renamed = { ...item, name: "Altă denumire" };
  assert.notEqual(line.description, renamed.name);
  assert.equal(line.description, "Serviciu test");
});
test("articole și unități arhivate/lipsă nu intră în ciornă", () => {
  for (const catalog of [
    [item],
    [{ ...item, active: false }, unit],
    [item, { ...unit, active: false }],
  ])
    assert.throws(() => lineFromCatalog(item.id, catalog, id));
  assert.equal(
    lineFromCatalog(
      item.id,
      [{ ...item, details: { ...item.details, type: "material" } }, unit],
      id,
    ).category,
    "goods",
  );
});

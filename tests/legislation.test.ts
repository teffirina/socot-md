import test from "node:test";
import assert from "node:assert/strict";
import {
  legalVersionSchema,
  legalState,
  applicableProvisions,
  overlapping,
  type LegalVersion,
} from "../lib/legislation";
const v: LegalVersion = {
  actId: "TEST/1",
  sourceDocumentId: "1",
  title: "Act fictiv pentru test",
  issuer: "Test",
  actType: "Lege",
  number: "1",
  adoptedOn: "2025-01-01",
  publishedOn: "2025-01-02",
  language: "ro",
  sourceUrl: "https://www.legis.md/cautare/getResults?doc_id=1&lang=ro",
  sourceClass: "official",
  status: "adopted",
  validFrom: "2025-02-01",
  validTo: "2026-01-01",
  repealedOn: null,
  provisions: [
    {
      reference: "art. 1",
      text: "Exemplu fictiv",
      validFrom: null,
      validTo: null,
    },
    {
      reference: "art. 2",
      text: "Exemplu cu aplicare ulterioară",
      validFrom: "2025-07-01",
      validTo: null,
    },
  ],
};
test("Legislație: data aplicării, limite exclusive și păstrarea istoricului", () => {
  assert.equal(legalState(v, "2025-01-31", true), "future");
  assert.equal(legalState(v, "2025-02-01", true), "current");
  assert.equal(legalState(v, "2026-01-01", true), "archive");
  assert.equal(
    legalState({ ...v, repealedOn: "2025-06-01" }, "2025-06-01", true),
    "archive",
  );
  assert.equal(applicableProvisions(v, "2025-06-30", true).length, 1);
  assert.equal(applicableProvisions(v, "2025-07-01", true).length, 2);
});
test("Proiectele și sursele neverificate nu furnizează reguli aplicabile", () => {
  assert.equal(legalState(v, "2025-03-01", false), "unverified");
  assert.equal(
    legalState({ ...v, status: "draft" }, "2025-03-01", true),
    "draft",
  );
  assert.equal(
    legalState({ ...v, sourceClass: "secondary" }, "2025-03-01", true),
    "unverified",
  );
  assert.equal(applicableProvisions(v, "2025-03-01", false).length, 0);
  assert.equal(
    legalState({ ...v, validFrom: null }, "2025-03-01", true),
    "unknown",
  );
});
test("Suprapuneri și validare: nu alegem versiunea cu doc_id mai mare", () => {
  assert.ok(overlapping(v, { ...v, sourceDocumentId: "999" }));
  assert.ok(!overlapping(v, { ...v, validFrom: "2026-01-01", validTo: null }));
  assert.ok(!overlapping(v, { ...v, language: "ru" }));
  assert.throws(() => legalVersionSchema.parse({ ...v, validTo: v.validFrom }));
  assert.throws(() =>
    legalVersionSchema.parse({
      ...v,
      sourceUrl: "https://legis.md.evil.test/a",
    }),
  );
  assert.throws(() => legalState(v, "2025-02-30", true));
});

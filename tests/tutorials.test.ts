import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseCompleted, tutorialForView, tutorials } from "../lib/tutorials";

test("fiecare tutorial are pași compleți, cu ținte existente în interfață", () => {
  const ui = [
    "app/page.tsx",
    "app/home-dashboard.tsx",
    "app/documents-panel.tsx",
    "app/reconciliation-panel.tsx",
  ]
    .map((f) => readFileSync(f, "utf8"))
    .join("\n");
  for (const t of Object.values(tutorials)) {
    assert.ok(t.steps.length > 0);
    for (const s of t.steps) {
      assert.ok(s.title && s.body);
      const id = s.selector.match(/^\[data-t="([a-z-]+)"\]$/)?.[1];
      assert.ok(id, s.selector);
      assert.ok(ui.includes(`data-t="${id}"`), `lipsește data-t="${id}"`);
    }
  }
});

test("ecranele implementate au tutorial, modulele neimplementate nu", () => {
  assert.equal(tutorialForView("Acasă")?.key, "acasa");
  assert.equal(tutorialForView("documents:sale")?.key, "vanzari");
  assert.equal(tutorialForView("documents:expense")?.key, "cumparari");
  assert.equal(tutorialForView("Rapoarte")?.key, "rapoarte");
  assert.equal(tutorialForView("Depozit"), null);
});

test("lista tutorialelor finalizate se citește tolerant", () => {
  assert.deepEqual(parseCompleted(null), []);
  assert.deepEqual(parseCompleted("nu-e-json"), []);
  assert.deepEqual(parseCompleted('["acasa",5,"rapoarte"]'), ["acasa", "rapoarte"]);
});

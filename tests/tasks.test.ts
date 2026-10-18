import test from "node:test";
import assert from "node:assert/strict";
import { applyTaskAction, newTask, nextActor } from "../lib/tasks";

const invoice = {
  id: crypto.randomUUID(),
  kind: "expense" as const,
  customer: "Beta SA",
  total: 123456,
  paid: 0,
  version: 1,
  date: "2026-10-05",
};

test("contabilul cere ce lipsește, antreprenorul răspunde, contabilul confirmă", () => {
  let t = newTask(invoice, "Operator");
  assert.equal(t.status, "todo");
  assert.equal(nextActor(t), "accountant");
  assert.match(t.ref, /Cumpărare · Beta SA · 1.?234,56 lei/);
  t = applyTaskAction(
    t,
    { id: t.id, action: "request", baseVersion: 1, items: ["Contractul"] },
    "Contabil",
  );
  assert.equal(t.status, "needs_info");
  assert.equal(nextActor(t), "entrepreneur");
  assert.throws(
    () =>
      applyTaskAction(
        t,
        { id: t.id, action: "confirm", baseVersion: t.version },
        "Contabil",
      ),
    /Așteaptă răspunsul/,
  );
  t = applyTaskAction(
    t,
    {
      id: t.id,
      action: "answer",
      baseVersion: 2,
      text: "Am trimis contractul.",
    },
    "Operator",
  );
  assert.equal(t.status, "answered");
  t = applyTaskAction(
    t,
    { id: t.id, action: "confirm", baseVersion: 3 },
    "Contabil",
  );
  assert.equal(t.status, "done");
  assert.equal(nextActor(t), null);
  assert.deepEqual(
    t.messages.map((m) => m.kind),
    ["created", "request", "answer", "confirmed"],
  );
});

test("o versiune veche sau o cerere goală sunt refuzate", () => {
  const t = newTask(invoice, "Operator");
  assert.throws(
    () =>
      applyTaskAction(
        t,
        { id: t.id, action: "confirm", baseVersion: 0 },
        "Contabil",
      ),
    /CONFLICT/,
  );
  assert.throws(
    () =>
      applyTaskAction(
        t,
        { id: t.id, action: "request", baseVersion: 1 },
        "Contabil",
      ),
    /Alege ce lipsește/,
  );
  assert.throws(
    () =>
      applyTaskAction(
        t,
        { id: t.id, action: "answer", baseVersion: 1, text: "da" },
        "Operator",
      ),
    /nu a cerut/,
  );
});

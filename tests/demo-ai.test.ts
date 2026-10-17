import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { filterDocuments } from "../lib/ai";
import { demoAiRouter } from "../server/demo-ai";

const filters = {
  intent: "search" as const,
  customer: "atelier",
  sourceRef: null,
  kind: "sale" as const,
  unpaid: true,
  from: "2026-09-01",
  to: "2026-09-30",
};
const invoice = (id: string, extra: object) => ({
  id: `11111111-1111-4111-8111-11111111111${id}`,
  customer: "Socot · Atelier Lumină",
  total: 1000,
  paid: 0,
  version: 1,
  date: "2026-09-10",
  kind: "sale" as const,
  ...extra,
});

test("filtrele AI se aplică local pe documentele demonstrative", () => {
  const result = filterDocuments(
    [
      invoice("1", {}),
      invoice("2", { date: "2026-09-20" }),
      invoice("3", { paid: 1000 }),
      invoice("4", { kind: "expense" }),
      invoice("5", { date: "2026-10-01" }),
      invoice("6", { customer: "Studio Nord" }),
    ],
    filters,
  );
  assert.deepEqual(
    result.documents.map((d) => d.id.at(-1)),
    ["2", "1"],
  );
  assert.equal(result.hasMore, false);
});

test("AI demonstrativ trimite doar întrebarea și refuză cereri forwardate", async () => {
  const questions: string[] = [];
  const app = express();
  app.use(express.json());
  app.use(
    "/demo-ai",
    demoAiRouter(async (q) => {
      questions.push(q);
      return filters;
    }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/demo-ai`;
  try {
    const ok = await fetch(`${base}/interpret`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "facturi neachitate" }),
    });
    assert.equal(ok.status, 200);
    assert.deepEqual((await ok.json()).filters, filters);
    assert.deepEqual(questions, ["facturi neachitate"]);
    const proxied = await fetch(`${base}/status`, {
      headers: { "x-forwarded-for": "203.0.113.5" },
    });
    assert.equal(proxied.status, 403);
  } finally {
    server.close();
  }
});

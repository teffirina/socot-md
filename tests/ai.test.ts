import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import type { PrismaClient } from "@prisma/client";
import { aiSearchSchema, proposalFor } from "../lib/ai";
import { demoRules } from "../lib/compliance";
import { aiRouter, interpretQuestion } from "../server/ai";
const filters = {
  intent: "search" as const,
  customer: "Atelier",
  sourceRef: null,
  kind: null,
  unpaid: true,
  from: "2026-09-01",
  to: "2026-09-30",
};
const invoice = {
  id: "11111111-1111-4111-8111-111111111111",
  customer: "Atelier",
  total: 10001,
  paid: 0,
  date: "2026-09-20",
  version: 1,
  kind: "sale" as const,
};

test("AI filters reject SQL-like extra fields and invalid intervals", () => {
  assert.equal(
    aiSearchSchema.safeParse({ ...filters, companyId: "other" }).success,
    false,
  );
  assert.equal(
    aiSearchSchema.safeParse({ ...filters, from: "2026-10-01" }).success,
    false,
  );
  assert.equal(
    aiSearchSchema.safeParse({ ...filters, from: "2026-02-30" }).success,
    false,
  );
});
test("Proposal uses approved real rules and integer bani, refusing demo rules", () => {
  assert.throws(() => proposalFor(invoice, demoRules));
  const rules = demoRules.map((r) => ({ ...r, demo: false }));
  const result = proposalFor(invoice, rules);
  assert.equal(
    result.entries.reduce((sum, e) => sum + e.amount, 0),
    invoice.total,
  );
  assert.ok(result.entries.every((e) => Number.isSafeInteger(e.amount)));
});

test("AI routes enforce permissions, tenant isolation and never write journal entries", async () => {
  const calls: any[] = [];
  const db = {
    invoice: {
      fields: { total: "total-field" },
      findMany: async (args: any) => {
        calls.push(args);
        return Array.from({ length: 51 }, () => invoice);
      },
      findFirst: async (args: any) => {
        calls.push(args);
        return null;
      },
    },
    complianceAudit: { create: async () => ({}) },
  } as unknown as PrismaClient;
  let interpretations = 0;
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    res.locals.user = {
      id: "user",
      companyId: "own-company",
      role: req.headers["x-test-role"] || "accountant",
    };
    next();
  });
  app.use(
    "/ai",
    aiRouter(db, async () => {
      interpretations++;
      return filters;
    }),
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/ai`;
  const post = (path: string, body: unknown, role = "accountant") =>
    fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-test-role": role },
      body: JSON.stringify(body),
    });
  try {
    assert.equal(
      (await post("/search", { question: "facturi" }, "cashier")).status,
      403,
    );
    assert.equal(interpretations, 0);
    const response = await post("/search", {
      question: "facturi neachitate Atelier în septembrie",
    });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.documents.length, 50);
    assert.equal(result.hasMore, true);
    assert.equal(calls[0].where.companyId, "own-company");
    assert.deepEqual(calls[0].where.paid, { lt: "total-field" });
    assert.equal(calls[0].where.date.gte, "2026-09-01");
    assert.equal(
      (await post("/proposal", { id: invoice.id }, "operator")).status,
      403,
    );
    assert.equal((await post("/proposal", { id: invoice.id })).status, 404);
    assert.equal(calls[1].where.companyId, "own-company");
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("Provider sends only the question, validates output, and hides upstream errors", async () => {
  const original = globalThis.fetch;
  const key = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-key";
  try {
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(init!.body as string);
      assert.equal(body.store, false);
      assert.equal(body.messages.length, 2);
      assert.equal(body.messages[1].content, "facturi Atelier");
      assert.equal(body.response_format.json_schema.strict, true);
      return new Response(
        JSON.stringify({
          choices: [
            {
              finish_reason: "stop",
              message: { content: JSON.stringify(filters) },
            },
          ],
        }),
      );
    };
    assert.deepEqual(await interpretQuestion("facturi Atelier"), filters);
    globalThis.fetch = async () =>
      new Response("secret upstream error", { status: 401 });
    await assert.rejects(
      interpretQuestion("facturi"),
      /Serviciul AI nu este disponibil/,
    );
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              finish_reason: "stop",
              message: {
                content: JSON.stringify({ ...filters, sql: "DELETE" }),
              },
            },
          ],
        }),
      );
    await assert.rejects(interpretQuestion("facturi"));
  } finally {
    globalThis.fetch = original;
    if (key === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = key;
  }
});

test("Proposal reads only the current company's rules and journal, with audit and no mutation", async () => {
  const calls: { table: string; args: any }[] = [];
  const rules = demoRules.map((r) => ({
    ...r,
    demo: false,
    companyId: "own-company",
  }));
  const db = {
    invoice: {
      findFirst: async (args: any) => {
        calls.push({ table: "invoice", args });
        return invoice;
      },
    },
    accountingRule: {
      findMany: async (args: any) => {
        calls.push({ table: "rules", args });
        return rules;
      },
    },
    journal: {
      findMany: async (args: any) => {
        calls.push({ table: "journal", args });
        return [];
      },
    },
    complianceAudit: {
      create: async (args: any) => {
        calls.push({ table: "audit", args });
        return {};
      },
    },
  } as unknown as PrismaClient;
  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => {
    res.locals.user = {
      id: "user",
      companyId: "own-company",
      role: "accountant",
    };
    next();
  });
  app.use("/ai", aiRouter(db));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    const response = await fetch(
      `http://127.0.0.1:${(server.address() as AddressInfo).port}/ai/proposal`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: invoice.id }),
      },
    );
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(
      data.entries.reduce((n: number, e: any) => n + e.amount, 0),
      invoice.total,
    );
    for (const call of calls.filter((c) => c.table !== "audit"))
      assert.equal(call.args.where.companyId, "own-company");
    assert.equal(
      calls.find((c) => c.table === "rules")!.args.where.demo,
      false,
    );
    assert.equal(
      calls.find((c) => c.table === "audit")!.args.data.action,
      "ai.proposal.viewed",
    );
    assert.deepEqual(data.existing, []);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("AI search rejects unsupported or malformed interpretations before querying data", async () => {
  let reads = 0;
  let interpretation: unknown = { ...filters, intent: "unsupported" };
  const db = {
    invoice: { findMany: async () => { reads++; return []; } },
  } as unknown as PrismaClient;
  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => {
    res.locals.user = { id: "user", companyId: "own-company", role: "accountant" };
    next();
  });
  app.use("/ai", aiRouter(db, async () => interpretation as typeof filters));
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(400).json({ error: "Cerere invalidă" });
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const post = (body: unknown) => fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/ai/search`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  try {
    assert.equal((await post({ question: "modifică documentul" })).status, 422);
    interpretation = { ...filters, companyId: "another-company" };
    assert.equal((await post({ question: "caută documente" })).status, 503);
    assert.equal((await post({ question: "ab" })).status, 400);
    assert.equal(reads, 0);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

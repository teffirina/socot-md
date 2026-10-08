import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { complianceRouter } from "../server/compliance";

test("mișcările cer drepturi și limitează documentul și jurnalul la firmă", async () => {
  const queries: any[] = [];
  const db: any = {
    invoice: {
      findFirst: async (q: any) => {
        queries.push(q);
        return q.where.id.endsWith("1") ? { id: q.where.id } : null;
      },
    },
    journal: {
      findMany: async (q: any) => {
        queries.push(q);
        return [{ id: "entry", debit: "221.1", credit: "611.2" }];
      },
    },
  };
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    res.locals.user = {
      companyId: "company-a",
      role: req.headers["x-role"] || "viewer",
    };
    next();
  });
  app.use(complianceRouter(db));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", r));
  const address = server.address() as { port: number };
  async function request(id: string, role: string) {
    return fetch(`http://127.0.0.1:${address.port}/document-movements`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-role": role },
      body: JSON.stringify({ id }),
    });
  }
  try {
    const id = "00000000-0000-4000-8000-000000000001";
    const denied = await request(id, "operator");
    assert.equal(denied.status, 403);
    assert.equal(queries.length, 0);
    const allowed = await request(id, "accountant");
    assert.equal(allowed.status, 200);
    assert.equal((await allowed.json()).entries.length, 1);
    assert.deepEqual(queries[0].where, { id, companyId: "company-a" });
    assert.deepEqual(queries[1].where, {
      invoiceId: id,
      companyId: "company-a",
    });
    const missing = await request(
      "00000000-0000-4000-8000-000000000002",
      "accountant",
    );
    assert.equal(missing.status, 404);
    assert.equal(queries.length, 3);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
});

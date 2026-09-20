import { demoCompany, demoAccounts } from "../lib/company";
import { demoRules } from "../lib/compliance";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const db = new PrismaClient();
let disposable = false;
const base = "http://localhost:3000/api";
const password = crypto.randomUUID();
const companies = ["test-company-a", "test-company-b"];
async function request(path: string, body?: any, token?: string) {
  const res = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}
async function run() {
  const databases = await db.$queryRaw<
    { current_database: string }[]
  >`SELECT current_database()`;
  assert.equal(
    databases[0].current_database,
    "socot_test",
    "Use only the dedicated socot_test database",
  );
  disposable = true;
  for (const companyId of companies)
    for (const rule of demoRules)
      await db.accountingRule.create({
        data: {
          ...rule,
          id: crypto.randomUUID(),
          companyId,
          demo: false,
          approvedBy: "test-accountant",
        },
      });
  for (const [index, companyId] of companies.entries()) {
    await db.user.create({
      data: {
        email: `test-${index}@socot.local`,
        passwordHash: await bcrypt.hash(password, 12),
        companyId,
        role: index ? "director" : "operator",
      },
    });
  }
  await db.user.create({
    data: {
      email: "accountant-test@socot.local",
      passwordHash: await bcrypt.hash(password, 12),
      companyId: companies[0],
      role: "chief_accountant",
    },
  });
  const accountant = await request("/login", {
    email: "accountant-test@socot.local",
    password,
  });
  await db.user.create({
    data: {
      email: "admin-test@socot.local",
      passwordHash: await bcrypt.hash(password, 12),
      companyId: companies[0],
      role: "admin",
    },
  });
  const admin = await request("/login", {
    email: "admin-test@socot.local",
    password,
  });
  const profile = {
    data: demoCompany,
    baseVersion: 0,
    reason: "Configurare inițială verificată în test",
  };
  assert.equal(
    (await request("/company", profile, accountant.data.token)).status,
    403,
  );
  const saved = await request("/company", profile, admin.data.token);
  assert.equal(saved.status, 200);
  assert.equal(saved.data.version, 1);
  assert.equal(
    (await request("/company", profile, admin.data.token)).status,
    409,
  );
  assert.equal(
    (await request("/company", undefined, admin.data.token)).data.data.name,
    demoCompany.name,
  );
  assert.equal(
    (await request("/accounts", demoAccounts[0], accountant.data.token)).status,
    200,
  );
  const a = await request("/login", { email: "test-0@socot.local", password });
  const b = await request("/login", { email: "test-1@socot.local", password });
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.equal((await request("/invoices")).status, 401);
  const invoice = {
    id: crypto.randomUUID(),
    customer: "Client fictiv Socot",
    total: 600000,
    paid: 0,
    version: 0,
    date: "2026-09-17",
  };
  const op = { id: crypto.randomUUID(), invoice, baseVersion: 0 };
  const results = await Promise.all([
    request("/operations", op, a.data.token),
    request("/operations", op, a.data.token),
  ]);
  assert.ok(results.every((x) => x.status === 200));
  assert.equal(await db.journal.count({ where: { invoiceId: invoice.id } }), 1);
  assert.equal((await request("/operations", op, b.data.token)).status, 403);
  assert.equal(
    (await request("/invoices", undefined, b.data.token)).data.length,
    0,
  );
  const paid = {
    id: crypto.randomUUID(),
    invoice: { ...invoice, paid: 200000, version: 1 },
    baseVersion: 1,
  };
  assert.equal((await request("/operations", paid, a.data.token)).status, 200);
  const stale = await request(
    "/operations",
    { ...paid, id: crypto.randomUUID() },
    a.data.token,
  );
  assert.equal(stale.status, 409);
  assert.equal(stale.data.current.paid, 200000);
  assert.equal(await db.audit.count({ where: { invoiceId: invoice.id } }), 2);
  assert.equal(await db.journal.count({ where: { invoiceId: invoice.id } }), 2);
  const journals = await db.journal.findMany({
    where: { invoiceId: invoice.id },
  });
  for (const j of journals) {
    assert.equal(j.ruleVersion, 1);
    assert.equal(
      (
        await request(
          "/journal/approve",
          { id: j.id, reason: "Test verified balanced entry" },
          accountant.data.token,
        )
      ).status,
      200,
    );
  }
  await assert.rejects(() =>
    db.journal.update({ where: { id: journals[0].id }, data: { amount: 1 } }),
  );
  const audit = await db.audit.findFirstOrThrow({
    where: { invoiceId: invoice.id },
  });
  await assert.rejects(() => db.audit.delete({ where: { id: audit.id } }));
  const balance = await request(
    "/ledger-report",
    { from: "2026-09-01", to: "2026-09-30" },
    accountant.data.token,
  );
  assert.equal(balance.status, 200);
  assert.equal(
    balance.data.accounts.find((r: any) => r.code === "221").closing,
    400000,
  );
  assert.equal(
    (
      await request(
        "/ledger-report",
        { from: "2026-09-01", to: "2026-09-30" },
        a.data.token,
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/source-document",
        { id: invoice.id },
        accountant.data.token,
      )
    ).data.id,
    invoice.id,
  );
  await db.user.create({
    data: {
      email: "audit-other@socot.local",
      passwordHash: await bcrypt.hash(password, 12),
      companyId: companies[1],
      role: "auditor",
    },
  });
  const otherAudit = await request("/login", {
    email: "audit-other@socot.local",
    password,
  });
  assert.equal(
    (
      await request(
        "/source-document",
        { id: invoice.id },
        otherAudit.data.token,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await request(
        "/ledger-report",
        { from: "2026-09-01", to: "2026-09-30" },
        otherAudit.data.token,
      )
    ).data.accounts.length,
    0,
  );
  const closing = {
    month: "2026-09",
    closed: true,
    reason: "Test close after all postings checked",
  };
  assert.equal((await request("/periods", closing, a.data.token)).status, 403);
  assert.equal(
    (await request("/periods", closing, accountant.data.token)).status,
    200,
  );
  assert.equal(
    (
      await request(
        "/operations",
        {
          id: crypto.randomUUID(),
          invoice: { ...invoice, id: crypto.randomUUID() },
          baseVersion: 0,
        },
        a.data.token,
      )
    ).status,
    422,
  );
  assert.equal(
    (
      await request(
        "/periods",
        {
          ...closing,
          closed: false,
          reason: "Test authorised reopening with explanation",
        },
        accountant.data.token,
      )
    ).status,
    200,
  );
  const newRule = {
    ...demoRules[0],
    id: crypto.randomUUID(),
    version: 2,
    debit: "222",
    validFrom: "2026-10-01",
    status: "draft",
    approvedBy: null,
    demo: false,
  };
  assert.equal(
    (await request("/rules", newRule, accountant.data.token)).status,
    200,
  );
  assert.equal(
    (
      await request(
        "/rules/approve",
        { id: newRule.id, reason: "Test source and mapping reviewed" },
        accountant.data.token,
      )
    ).status,
    200,
  );
  const october = { ...invoice, id: crypto.randomUUID(), date: "2026-10-03" };
  assert.equal(
    (
      await request(
        "/operations",
        { id: crypto.randomUUID(), invoice: october, baseVersion: 0 },
        a.data.token,
      )
    ).status,
    200,
  );
  assert.equal(
    (await db.journal.findFirstOrThrow({ where: { invoiceId: october.id } }))
      .ruleVersion,
    2,
  );
  await assert.rejects(() =>
    db.accountingRule.update({
      where: { id: newRule.id },
      data: { debit: "333" },
    }),
  );
  const expense = {
    ...invoice,
    id: crypto.randomUUID(),
    kind: "expense",
    category: "Chirie",
    date: "2026-10-04",
    total: 150000,
  };
  const expenseOp = {
    id: crypto.randomUUID(),
    invoice: expense,
    baseVersion: 0,
  };
  const createdExpense = await request("/operations", expenseOp, a.data.token);
  assert.equal(createdExpense.status, 200, JSON.stringify(createdExpense.data));
  assert.equal(
    (await request("/operations", expenseOp, a.data.token)).status,
    200,
  );
  assert.equal(await db.journal.count({ where: { invoiceId: expense.id } }), 1);
  assert.equal(
    (await db.journal.findFirstOrThrow({ where: { invoiceId: expense.id } }))
      .credit,
    "521",
  );
  const expensePayment = {
    id: crypto.randomUUID(),
    invoice: { ...createdExpense.data, paid: 50000 },
    baseVersion: 1,
    effectiveDate: "2026-10-05",
  };
  assert.equal(
    (await request("/operations", expensePayment, a.data.token)).status,
    200,
  );
  assert.equal(
    (
      await request(
        "/operations",
        { ...expensePayment, id: crypto.randomUUID() },
        a.data.token,
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await request(
        "/operations",
        { ...expensePayment, id: crypto.randomUUID(), baseVersion: 2 },
        b.data.token,
      )
    ).status,
    403,
  );
  const visible = await request("/invoices", undefined, a.data.token);
  assert.equal(
    visible.data.find((i: any) => i.id === expense.id).kind,
    "expense",
  );
  assert.equal(
    (await request("/invoices", undefined, b.data.token)).data.some(
      (i: any) => i.id === expense.id,
    ),
    false,
  );
  const report = await request("/reports", {}, accountant.data.token);
  assert.equal(report.data.status, "generated");
  assert.equal(report.data.sourceIds.includes(expense.id), false);
  const exported = await request(
    "/reports/export",
    { id: report.data.id },
    accountant.data.token,
  );
  assert.equal(exported.data.status, "exported");
  assert.equal(exported.data.receiptId, null);
  console.log(
    "PASS: versioned rules, immutable audit/journal/rules, period close/reopen, role enforcement, report export without fabricated receipt",
  );
  console.log(
    "PASS: auth, RBAC, tenant isolation, concurrent idempotency, payment, conflict, audit, journal",
  );
}
run().finally(async () => {
  if (disposable)
    await db.$executeRawUnsafe(
      'TRUNCATE "User", "Session", "Invoice", "Operation", "Journal", "Audit", "AccountingRule", "AccountingPeriod", "ComplianceAudit", "RegulatoryReport", "CompanyProfile", "ChartAccount" CASCADE',
    );
  await db.$disconnect();
});

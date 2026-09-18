import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { ruleSchema, approveRule, type Rule } from "../lib/compliance";
export function complianceRouter(db: PrismaClient) {
  const router = Router();
  router.get("/compliance", async (_req, res) => {
    const companyId = res.locals.user.companyId;
    const [rules, periods, reports, audit, ledger] = await Promise.all([
      db.accountingRule.findMany({
        where: { companyId },
        orderBy: { version: "asc" },
      }),
      db.accountingPeriod.findMany({ where: { companyId } }),
      db.regulatoryReport.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      db.complianceAudit.findMany({
        where: { companyId },
        orderBy: { at: "desc" },
        take: 100,
      }),
      db.journal.findMany({
        where: { companyId },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    ]);
    res.json({
      rules: rules.map(({ companyId, ...r }) => r),
      periods,
      reports,
      audit,
      ledger,
    });
  });
  router.use(
    [
      "/rules",
      "/rules/approve",
      "/periods",
      "/journal/approve",
      "/reports",
      "/reports/export",
    ],
    (_req, res, next) => {
      if (!["admin", "accountant"].includes(res.locals.user.role)) {
        res
          .status(403)
          .json({ error: "Este necesar rolul de contabil sau administrator." });
        return;
      }
      next();
    },
  );
  router.post("/rules", async (req, res) => {
    const rule = ruleSchema.parse({
      ...req.body,
      status: "draft",
      approvedBy: null,
      demo: false,
    });
    const user = res.locals.user;
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`company:${user.companyId}`}))`;
      await tx.accountingRule.create({
        data: { ...rule, companyId: user.companyId },
      });
      await tx.complianceAudit.create({
        data: {
          companyId: user.companyId,
          actor: user.id,
          action: "rule.created",
          objectId: rule.id,
          reason: rule.source,
        },
      });
    });
    res.json(rule);
  });
  router.post("/rules/approve", async (req, res) => {
    const { id, reason } = z
      .object({ id: z.string(), reason: z.string().trim().min(10).max(500) })
      .parse(req.body);
    const user = res.locals.user;
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`company:${user.companyId}`}))`;
      const rows = await tx.accountingRule.findMany({
        where: { companyId: user.companyId },
      });
      const rules = rows.map(({ companyId, ...r }) => ruleSchema.parse(r));
      const next = approveRule(rules, id, user.id).find((r) => r.id === id)!;
      await tx.accountingRule.update({
        where: { id },
        data: { status: next.status, approvedBy: user.id },
      });
      await tx.complianceAudit.create({
        data: {
          companyId: user.companyId,
          actor: user.id,
          action: "rule.approved",
          objectId: id,
          reason,
        },
      });
    });
    res.json({ ok: true });
  });
  router.post("/periods", async (req, res) => {
    const input = z
      .object({
        month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
        closed: z.boolean(),
        reason: z.string().trim().min(10).max(500),
      })
      .parse(req.body);
    const user = res.locals.user;
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`company:${user.companyId}`}))`;
      if (
        input.closed &&
        (await tx.journal.count({
          where: {
            companyId: user.companyId,
            state: "proposed",
            OR: [
              { effectiveDate: { startsWith: input.month } },
              { effectiveDate: null },
            ],
          },
        }))
      )
        throw new Error(
          "Există articole contabile neaprobate. Verifică registrul înainte de închidere.",
        );
      await tx.accountingPeriod.upsert({
        where: {
          companyId_month: { companyId: user.companyId, month: input.month },
        },
        create: { ...input, companyId: user.companyId, changedBy: user.id },
        update: { ...input, changedBy: user.id },
      });
      await tx.complianceAudit.create({
        data: {
          companyId: user.companyId,
          actor: user.id,
          action: input.closed ? "period.closed" : "period.reopened",
          objectId: input.month,
          reason: input.reason,
        },
      });
    });
    res.json({ ok: true });
  });
  router.post("/journal/approve", async (req, res) => {
    const { id, reason } = z
      .object({ id: z.string(), reason: z.string().trim().min(10).max(500) })
      .parse(req.body);
    const user = res.locals.user;
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`company:${user.companyId}`}))`;
      const entry = await tx.journal.findFirst({
        where: { id, companyId: user.companyId, state: "proposed" },
      });
      if (!entry)
        throw new Error("Articolul nu există sau a fost deja aprobat.");
      if (!entry.effectiveDate)
        throw new Error(
          "Articol vechi fără dată contabilă; necesită migrare verificată.",
        );
      const period = await tx.accountingPeriod.findUnique({
        where: {
          companyId_month: {
            companyId: user.companyId,
            month: entry.effectiveDate.slice(0, 7),
          },
        },
      });
      if (period?.closed) throw new Error("Perioada este închisă.");
      await tx.journal.update({
        where: { id },
        data: { state: "posted", approvedBy: user.id },
      });
      await tx.complianceAudit.create({
        data: {
          companyId: user.companyId,
          actor: user.id,
          action: "journal.posted",
          objectId: id,
          reason,
        },
      });
    });
    res.json({ ok: true });
  });
  router.post("/reports", async (_req, res) => {
    const user = res.locals.user;
    const invoices = await db.invoice.findMany({
      where: { companyId: user.companyId },
      select: { id: true, customer: true, total: true, paid: true },
    });
    const report = await db.regulatoryReport.create({
      data: {
        id: crypto.randomUUID(),
        companyId: user.companyId,
        sourceIds: invoices.map((i) => i.id),
        rows: invoices,
      },
    });
    res.json(report);
  });
  router.post("/reports/export", async (req, res) => {
    const { id } = z.object({ id: z.string() }).parse(req.body);
    const user = res.locals.user;
    const report = await db.$transaction(async (tx) => {
      const report = await tx.regulatoryReport.findFirst({
        where: { id, companyId: user.companyId },
      });
      if (!report || !["generated", "exported"].includes(report.status))
        throw new Error("Raport indisponibil pentru export.");
      const next = await tx.regulatoryReport.update({
        where: { id },
        data: { status: "exported" },
      });
      await tx.complianceAudit.create({
        data: {
          companyId: user.companyId,
          actor: user.id,
          action: "report.exported",
          objectId: id,
          reason: "Export CSV local; netransmis către autorități",
        },
      });
      return next;
    });
    res.json(report);
  });
  return router;
}

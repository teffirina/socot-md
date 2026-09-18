import { Router } from "express";
import { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { companySchema, accountSchema, demoCompany } from "../lib/company";
import { can } from "../lib/permissions";
export function companyRouter(db: PrismaClient) {
  const router = Router();
  router.get("/company", async (_req, res) => {
    const company = await db.companyProfile.findUnique({
      where: { id: res.locals.user.companyId },
    });
    res.json(
      company
        ? { data: company.data, version: company.version }
        : {
            data: {
              ...demoCompany,
              name: "Întreprindere nouă",
              shortName: "Întreprindere",
              director: "",
              chiefAccountant: "",
              legalAddress: "",
            },
            version: 0,
          },
    );
  });
  router.post("/company", async (req, res) => {
    const user = res.locals.user;
    if (!can(user.role, "company.manage")) {
      res.status(403).json({
        error: "Numai administratorul poate configura întreprinderea.",
      });
      return;
    }
    const input = z
      .object({
        data: companySchema,
        baseVersion: z.number().int().nonnegative(),
        reason: z.string().min(10).max(500),
      })
      .parse(req.body);
    const result = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`company:${user.companyId}`}))`;
      const old = await tx.companyProfile.findUnique({
        where: { id: user.companyId },
      });
      if ((old?.version ?? 0) !== input.baseVersion) return null;
      const next = await tx.companyProfile.upsert({
        where: { id: user.companyId },
        create: { id: user.companyId, data: input.data },
        update: { data: input.data, version: { increment: 1 } },
      });
      await tx.audit.create({
        data: {
          companyId: user.companyId,
          userId: user.id,
          invoiceId: `company:${user.companyId}`,
          before: old?.data ?? Prisma.JsonNull,
          after: {
            data: input.data,
            reason: input.reason,
            version: next.version,
          },
        },
      });
      return next;
    });
    if (!result) {
      res.status(409).json({
        error:
          "Profilul a fost modificat de alt utilizator. Reîncarcă înainte de salvare.",
      });
      return;
    }
    res.json({ data: result.data, version: result.version });
  });
  router.get("/accounts", async (_req, res) => {
    const user = res.locals.user;
    if (!can(user.role, "journal.read")) {
      res.status(403).json({ error: "Nu ai acces la planul de conturi." });
      return;
    }
    res.json(
      await db.chartAccount.findMany({
        where: { companyId: user.companyId },
        orderBy: { code: "asc" },
      }),
    );
  });
  router.post("/accounts", async (req, res) => {
    const user = res.locals.user;
    if (!can(user.role, "accounts.manage")) {
      res.status(403).json({ error: "Este necesar rolul de contabil-șef." });
      return;
    }
    const account = accountSchema.parse(req.body);
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`company:${user.companyId}`}))`;
      if (
        account.parentCode &&
        !(await tx.chartAccount.findUnique({
          where: {
            companyId_code: {
              companyId: user.companyId,
              code: account.parentCode,
            },
          },
        }))
      )
        throw new Error("Contul părinte nu există.");
      await tx.chartAccount.create({
        data: { companyId: user.companyId, code: account.code, data: account },
      });
      await tx.complianceAudit.create({
        data: {
          companyId: user.companyId,
          actor: user.id,
          action: "account.created",
          objectId: account.code,
          reason: account.source,
        },
      });
    });
    res.json({ ok: true });
  });
  return router;
}

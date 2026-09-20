import { Router } from "express";
import { Prisma, PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import {
  catalogOperationSchema,
  catalogSchema,
  validateCatalogChange,
  canReadCatalog,
} from "../lib/catalog";
import { can } from "../lib/permissions";
export function catalogRouter(db: PrismaClient) {
  const router = Router();
  router.get("/catalog", async (_req, res) => {
    const user = res.locals.user;
    if (!can(user.role, "invoice.read")) {
      res.status(403).json({ error: "Acces refuzat" });
      return;
    }
    const rows = await db.catalogEntry.findMany({
      where: {
        companyId: user.companyId,
        ...(!canReadCatalog(user.role, "employee")
          ? { kind: { not: "employee" } }
          : {}),
      },
      orderBy: { id: "asc" },
      take: 1001,
    });
    if (rows.length > 1000) {
      res
        .status(422)
        .json({
          error:
            "Nomenclatorul depășește limita locală de 1000 înregistrări. Este necesară paginare înainte de continuare.",
        });
      return;
    }
    res.json(rows.map((r) => r.data));
  });
  router.post("/catalog", async (req, res) => {
    const user = res.locals.user;
    const op = catalogOperationSchema.parse(req.body);
    if (
      !can(user.role, "invoice.write") ||
      !canReadCatalog(user.role, op.entry.kind) ||
      (["vat", "exchange_rate"].includes(op.entry.kind) &&
        !can(user.role, "rule.create"))
    ) {
      res.status(403).json({ error: "Rolul nu permite această modificare." });
      return;
    }
    const hash = createHash("sha256").update(JSON.stringify(op)).digest("hex");
    try {
      const result = await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`company:${user.companyId}`}))`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${op.id}))`;
        const replay = await tx.operation.findUnique({ where: { id: op.id } });
        if (replay) {
          if (
            replay.companyId !== user.companyId ||
            replay.userId !== user.id ||
            replay.requestHash !== hash
          )
            throw Error("FORBIDDEN");
          return replay.result;
        }
        const old = await tx.catalogEntry.findUnique({
          where: { id: op.entry.id },
        });
        if (old && old.companyId !== user.companyId) throw Error("FORBIDDEN");
        const rows = await tx.catalogEntry.findMany({
          where: { companyId: user.companyId },
          take: 1001,
        });
        if (rows.length > 1000 || (!old && rows.length === 1000))
          throw Error("Limita nomenclatorului a fost atinsă.");
        let next;
        try {
          next = validateCatalogChange(
            rows.map((r) => catalogSchema.parse(r.data)),
            op,
          );
        } catch (e) {
          if ((e as Error).message === "CONFLICT")
            throw Object.assign(Error("CONFLICT"), {
              current: old?.data ?? null,
            });
          throw e;
        }
        await tx.catalogEntry.upsert({
          where: { id: next.id },
          create: {
            id: next.id,
            companyId: user.companyId,
            kind: next.kind,
            code: next.code.toLowerCase(),
            data: next,
          },
          update: { data: next },
        });
        await tx.operation.create({
          data: {
            id: op.id,
            companyId: user.companyId,
            userId: user.id,
            requestHash: hash,
            result: next,
          },
        });
        await tx.audit.create({
          data: {
            companyId: user.companyId,
            userId: user.id,
            invoiceId: `catalog:${next.id}`,
            before: old?.data ?? Prisma.JsonNull,
            after: { entry: next, reason: op.reason },
          },
        });
        return next;
      });
      res.json(result);
    } catch (e) {
      const err = e as Error & { current?: unknown };
      if (err.message === "CONFLICT")
        res
          .status(409)
          .json({
            error:
              "Înregistrarea a fost modificată. Alege explicit versiunea de păstrat.",
            current: err.current,
          });
      else if (err.message === "FORBIDDEN")
        res.status(403).json({ error: "Operațiune nepermisă" });
      else throw e;
    }
  });
  return router;
}

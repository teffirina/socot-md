import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import { can } from "../lib/permissions";
import {
  buildReconciliation,
  paymentsFromLedger,
  reconciliationSchema,
} from "../lib/reconciliation";

export function reconciliationRouter(db: PrismaClient) {
  const router = Router();
  router.post("/reconciliation", async (req, res) => {
    const user = res.locals.user;
    if (!can(user.role, "invoice.read")) {
      res.status(403).json({ error: "Nu ai acces la facturi." });
      return;
    }
    const { customer, from, to } = reconciliationSchema.parse(req.body);
    const invoices = await db.invoice.findMany({
      where: { companyId: user.companyId, customer, kind: "sale", date: { lte: to } },
      take: 10001,
    });
    if (invoices.length > 10000) {
      res.status(422).json({
        error: "Clientul are prea multe documente pentru un singur act.",
      });
      return;
    }
    const lines = await db.journal.findMany({
      where: {
        companyId: user.companyId,
        invoiceId: { in: invoices.map((i) => i.id) },
      },
      orderBy: [{ createdAt: "asc" }, { lineNo: "asc" }],
      select: {
        id: true,
        invoiceId: true,
        operationId: true,
        amount: true,
        effectiveDate: true,
      },
    });
    res.json(
      buildReconciliation(
        invoices.map(({ companyId, ...i }) => i),
        paymentsFromLedger(lines),
        customer,
        from,
        to,
      ),
    );
  });
  return router;
}

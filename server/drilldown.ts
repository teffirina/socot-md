import { Router } from "express";
import type { PrismaClient } from "@prisma/client";
import { can, roleNames, type Role } from "../lib/permissions";
import {
  actionName,
  assembleDrill,
  drillSchema,
  invoiceChanges,
  type HistoryItem,
} from "../lib/drilldown";
import type { Invoice } from "../lib/domain";

const invoiceFields = {
  id: true,
  customer: true,
  sourceRef: true,
  partnerId: true,
  contractId: true,
  kind: true,
  category: true,
  total: true,
  paid: true,
  version: true,
  date: true,
} as const;

// One amount from a report, opened: documents, calculation, entries, history.
export function drilldownRouter(db: PrismaClient) {
  const router = Router();
  router.post("/drilldown", async (req, res) => {
    const user = res.locals.user;
    const journal = can(user.role, "journal.read");
    if (!can(user.role, "invoice.read")) {
      res.status(403).json({ error: "Nu ai acces la documente." });
      return;
    }
    const input = drillSchema.parse(req.body);
    if (input.kind === "account" && !journal) {
      res.status(403).json({ error: "Nu ai acces la registrele contabile." });
      return;
    }
    const companyId = user.companyId;
    const entries = journal
      ? await db.journal.findMany({
          where:
            input.kind === "account"
              ? {
                  companyId,
                  state: "posted",
                  effectiveDate: { lte: input.to },
                  OR: [{ debit: input.account }, { credit: input.account }],
                }
              : { companyId, invoiceId: { in: input.invoiceIds } },
          take: 100001,
        })
      : [];
    if (entries.length > 100000) {
      res.status(422).json({ error: "Prea multe articole pentru detaliere." });
      return;
    }
    const ids = [
      ...new Set(
        input.kind === "account"
          ? entries.map((e) => e.invoiceId)
          : input.invoiceIds,
      ),
    ];
    // The list of documents is capped; the sums above it are not.
    const shownIds = ids.slice(0, 500);
    const invoices = (await db.invoice.findMany({
      where: { companyId, id: { in: shownIds } },
      select: invoiceFields,
    })) as Invoice[];
    const audits = await db.audit.findMany({
      where: { companyId, invoiceId: { in: shownIds } },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });
    const operations = [
      ...new Set(
        entries
          .filter((e) => shownIds.includes(e.invoiceId))
          .map((e) => e.operationId),
      ),
    ];
    const compliance = journal
      ? await db.complianceAudit.findMany({
          where: { companyId, objectId: { in: [...shownIds, ...operations] } },
          orderBy: { at: "desc" },
          take: 1000,
        })
      : [];
    const people = await db.user.findMany({
      where: {
        companyId,
        id: {
          in: [
            ...new Set([
              ...audits.map((a) => a.userId),
              ...compliance.map((c) => c.actor),
            ]),
          ],
        },
      },
      select: { id: true, email: true, role: true },
    });
    const who = (id: string) => {
      const p = people.find((x) => x.id === id);
      return p
        ? `${roleNames[p.role as Role] ?? p.role} · ${p.email}`
        : "Utilizator necunoscut";
    };
    const operationInvoice = new Map(
      entries.map((e) => [e.operationId, e.invoiceId]),
    );
    const history: HistoryItem[] = [
      ...audits.map((a) => ({
        at: a.createdAt.toISOString(),
        who: who(a.userId),
        invoiceId: a.invoiceId,
        what: a.before ? "Document modificat" : "Document creat",
        changes: invoiceChanges(
          a.before as Partial<Invoice> | null,
          a.after as Partial<Invoice>,
        ),
      })),
      ...compliance.map((c) => ({
        at: c.at.toISOString(),
        who: who(c.actor),
        invoiceId: shownIds.includes(c.objectId)
          ? c.objectId
          : operationInvoice.get(c.objectId),
        what: `${actionName(c.action)}: ${c.reason}`,
        changes: [],
      })),
    ];
    res.json({
      ...assembleDrill(input, entries, invoices, history),
      ...(ids.length > shownIds.length ? { truncated: true } : {}),
    });
  });
  return router;
}

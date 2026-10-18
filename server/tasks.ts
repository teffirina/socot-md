import { Router } from "express";
import type { Prisma, PrismaClient } from "@prisma/client";
import { can, roleNames, type Role } from "../lib/permissions";
import {
  applyTaskAction,
  newTask,
  taskActionSchema,
  taskSchema,
} from "../lib/tasks";
import type { Invoice } from "../lib/domain";

type User = { id: string; email: string; role: string; companyId: string };

/** How a person appears in a task: role and e-mail, both known to the company. */
export const taskAuthor = (u: User) =>
  `${roleNames[u.role as Role] ?? u.role} · ${u.email}`.slice(0, 80);

/** Called inside the document transaction when the author cannot post it. */
export async function openTask(
  tx: Prisma.TransactionClient,
  user: User,
  invoice: Invoice,
) {
  if (can(user.role, "journal.post")) return;
  const task = newTask(invoice, taskAuthor(user));
  await tx.documentTask.create({
    data: {
      id: task.id,
      companyId: user.companyId,
      invoiceId: invoice.id,
      status: task.status,
      version: task.version,
      data: task,
    },
  });
}

export function tasksRouter(db: PrismaClient) {
  const router = Router();
  router.get("/tasks", async (_req, res) => {
    const user = res.locals.user as User;
    if (!can(user.role, "invoice.read")) {
      res.status(403).json({ error: "Nu ai acces la documente." });
      return;
    }
    const rows = await db.documentTask.findMany({
      where: { companyId: user.companyId },
      orderBy: { updatedAt: "desc" },
      take: 300,
    });
    res.json(rows.map((r) => taskSchema.parse(r.data)));
  });
  router.post("/tasks/action", async (req, res) => {
    const user = res.locals.user as User;
    const op = taskActionSchema.parse(req.body);
    const accountant = op.action !== "answer";
    if (
      !can(user.role, "invoice.read") ||
      (accountant && !can(user.role, "journal.post"))
    ) {
      res.status(403).json({
        error: accountant
          ? "Doar contabilul poate cere informații sau confirma înregistrarea."
          : "Nu ai acces la documente.",
      });
      return;
    }
    try {
      const task = await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`company:${user.companyId}`}))`;
        const row = await tx.documentTask.findFirst({
          where: { id: op.id, companyId: user.companyId },
        });
        if (!row) throw Error("Sarcina nu există.");
        const next = applyTaskAction(
          taskSchema.parse(row.data),
          op,
          taskAuthor(user),
        );
        if (op.action === "confirm") {
          // Confirming the task posts the document's proposed entries.
          const entries = await tx.journal.findMany({
            where: {
              companyId: user.companyId,
              invoiceId: next.invoiceId,
              state: "proposed",
            },
          });
          const months = [
            ...new Set(entries.map((e) => (e.effectiveDate ?? "").slice(0, 7))),
          ];
          if (entries.some((e) => !e.effectiveDate))
            throw Error(
              "Articol vechi fără dată contabilă; necesită migrare verificată.",
            );
          const closed = await tx.accountingPeriod.findFirst({
            where: {
              companyId: user.companyId,
              month: { in: months },
              closed: true,
            },
          });
          if (closed) throw Error(`Perioada ${closed.month} este închisă.`);
          await tx.journal.updateMany({
            where: { id: { in: entries.map((e) => e.id) } },
            data: { state: "posted", approvedBy: user.id },
          });
          for (const operationId of new Set(entries.map((e) => e.operationId)))
            await tx.complianceAudit.create({
              data: {
                companyId: user.companyId,
                actor: user.id,
                action: "journal.group.posted",
                objectId: operationId,
                reason: `Confirmat din sarcina pentru ${next.ref}`.slice(
                  0,
                  500,
                ),
              },
            });
        }
        const updated = await tx.documentTask.updateMany({
          where: { id: row.id, version: row.version },
          data: { status: next.status, version: next.version, data: next },
        });
        if (!updated.count) throw Error("CONFLICT");
        return next;
      });
      res.json(task);
    } catch (e) {
      if ((e as Error).message === "CONFLICT")
        res.status(409).json({
          error:
            "Sarcina a fost schimbată între timp. Reîncarcă și reîncearcă.",
        });
      else throw e;
    }
  });
  return router;
}

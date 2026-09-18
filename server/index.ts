import { complianceRouter } from "./compliance";
import { ruleSchema, selectRule, assertPeriodOpen } from "../lib/compliance";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { PrismaClient, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { operationSchema, applyOperation, journal } from "../lib/domain";
const db = new PrismaClient();
const app = express();
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        scriptSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: [
          "'self'",
          process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api",
        ],
      },
    },
  }),
);
app.use(cors({ origin, credentials: true }));
app.use(express.json({ limit: "32kb" }));
app.use(cookieParser());
app.use("/api", rateLimit({ windowMs: 60_000, limit: 120 }));
app.use("/api", (req, res, next) => {
  if (
    req.method !== "GET" &&
    req.headers.origin &&
    req.headers.origin !== origin
  ) {
    res.status(403).json({ error: "Origine nepermisă" });
    return;
  }
  next();
});
app.get("/api/health", async (_req, res) => {
  await db.$queryRaw`SELECT 1`;
  res.json({ ok: true });
});
app.post(
  "/api/login",
  rateLimit({ windowMs: 15 * 60_000, limit: 10 }),
  async (req, res) => {
    const input = z
      .object({ email: z.email(), password: z.string().min(1).max(128) })
      .parse(req.body);
    const user = await db.user.findUnique({ where: { email: input.email } });
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      res.status(401).json({ error: "E-mail sau parolă incorectă" });
      return;
    }
    const token = randomBytes(32).toString("hex");
    await db.session.create({
      data: {
        tokenHash: hash(token),
        userId: user.id,
        expiresAt: new Date(Date.now() + 8 * 3600_000),
      },
    });
    res.cookie("socot_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 8 * 3600_000,
      path: "/api",
    });
    res.json({
      user: { id: user.id, companyId: user.companyId, role: user.role },
      ...(!req.headers.origin ? { token } : {}),
    });
  },
);
app.use("/api", async (req, res, next) => {
  const token =
    req.headers.authorization?.replace(/^Bearer /, "") ??
    req.cookies.socot_session;
  const session = token
    ? await db.session.findUnique({
        where: { tokenHash: hash(token) },
        include: { user: true },
      })
    : null;
  if (!session || session.expiresAt.getTime() < Date.now()) {
    res.status(401).json({ error: "Sesiune expirată" });
    return;
  }
  res.locals.user = session.user;
  res.locals.tokenHash = session.tokenHash;
  next();
});
app.get("/api/me", (_req, res) => {
  const u = res.locals.user;
  res.json({ user: { id: u.id, companyId: u.companyId, role: u.role } });
});
app.post("/api/logout", async (_req, res) => {
  await db.session.deleteMany({ where: { tokenHash: res.locals.tokenHash } });
  res.clearCookie("socot_session", { path: "/api" });
  res.json({ ok: true });
});
app.get("/api/invoices", async (_req, res) =>
  res.json(
    await db.invoice.findMany({
      where: { companyId: res.locals.user.companyId },
      orderBy: { date: "desc" },
      take: 200,
      select: {
        id: true,
        customer: true,
        total: true,
        paid: true,
        version: true,
        date: true,
      },
    }),
  ),
);
app.use("/api", complianceRouter(db));
app.post("/api/operations", async (req, res) => {
  const user = res.locals.user;
  if (!["admin", "accountant", "operator"].includes(user.role)) {
    res.status(403).json({ error: "Rolul tău nu permite modificări" });
    return;
  }
  const op = operationSchema.parse(req.body);
  const requestHash = hash(JSON.stringify(op));
  try {
    const result = await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`company:${user.companyId}`}))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${op.id}))`;
      const previous = await tx.operation.findUnique({ where: { id: op.id } });
      if (previous) {
        if (
          previous.companyId !== user.companyId ||
          previous.userId !== user.id ||
          previous.requestHash !== requestHash
        )
          throw new Error("ID_REUSED");
        return previous.result;
      }
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${op.invoice.id}))`;
      const current = await tx.invoice.findUnique({
        where: { id: op.invoice.id },
      });
      if (current && current.companyId !== user.companyId)
        throw new Error("FORBIDDEN");
      const effectiveDate = op.effectiveDate ?? op.invoice.date;
      const periods = await tx.accountingPeriod.findMany({
        where: { companyId: user.companyId },
      });
      assertPeriodOpen(periods, effectiveDate);
      const records = await tx.accountingRule.findMany({
        where: { companyId: user.companyId },
      });
      const rules = records.map(({ companyId, ...r }) => ruleSchema.parse(r));
      const allowDemo = user.companyId === "socot-demo";
      const rule = selectRule(
        rules,
        current ? "receipt" : "sale",
        effectiveDate,
        allowDemo,
      );
      let next;
      try {
        next = applyOperation(current, op);
      } catch (e) {
        if ((e as Error).message === "CONFLICT")
          throw Object.assign(new Error("CONFLICT"), { current });
        throw e;
      }
      await tx.invoice.upsert({
        where: { id: next.id },
        create: { ...next, companyId: user.companyId },
        update: next,
      });
      await tx.operation.create({
        data: {
          id: op.id,
          companyId: user.companyId,
          userId: user.id,
          requestHash,
          result: next,
        },
      });
      await tx.journal.create({
        data: {
          companyId: user.companyId,
          invoiceId: next.id,
          operationId: op.id,
          ...journal(current, next, rules, effectiveDate, allowDemo),
          ruleId: rule.id,
          ruleVersion: rule.version,
          effectiveDate,
          state: "proposed",
        },
      });
      await tx.audit.create({
        data: {
          companyId: user.companyId,
          userId: user.id,
          invoiceId: next.id,
          before: current ?? Prisma.JsonNull,
          after: next,
        },
      });
      return next;
    });
    res.json(result);
  } catch (e: any) {
    if (e.message === "CONFLICT") {
      const c = e.current;
      res.status(409).json({
        error: "Factura a fost modificată de alt utilizator",
        current: c
          ? {
              id: c.id,
              customer: c.customer,
              total: c.total,
              paid: c.paid,
              date: c.date,
              version: c.version,
            }
          : null,
      });
    } else if (["FORBIDDEN", "ID_REUSED"].includes(e.message))
      res.status(403).json({ error: "Operațiune nepermisă" });
    else if (e instanceof Error && !(e as any).code)
      res.status(422).json({ error: e.message });
    else throw e;
  }
});
app.use(express.static("out"));
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err.name, err.code ?? "");
    res
      .status(
        err instanceof z.ZodError
          ? 400
          : err instanceof Error && !(err as any).code
            ? 422
            : 500,
      )
      .json({
        error:
          err instanceof z.ZodError
            ? "Datele introduse nu sunt valide"
            : !err.code
              ? err.message
              : "Operațiunea nu a fost finalizată. Reîncearcă.",
      });
  },
);
app.listen(3000, "127.0.0.1", () =>
  console.log("Socot: http://localhost:3000 • API /api"),
);

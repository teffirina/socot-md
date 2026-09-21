import { Router } from "express";
import { PrismaClient, Prisma } from "@prisma/client";
import { z } from "zod";
import {
  legalVersionSchema,
  legalState,
  applicableProvisions,
  overlapping,
} from "../lib/legislation";
export function legislationRouter(db: PrismaClient) {
  const router = Router();
  router.post("/legislation/search", async (req, res) => {
    const input = z
      .object({
        at: z.iso.date(),
        q: z.string().max(200).default(""),
        view: z
          .enum([
            "current",
            "future",
            "archive",
            "draft",
            "unverified",
            "unknown",
          ])
          .default("current"),
        offset: z.number().int().min(0).max(10000000).default(0),
      })
      .parse(req.body);
    const state = Prisma.sql`CASE WHEN "data"->>'status'='draft' THEN 'draft' WHEN "verifiedAt" IS NULL OR "data"->>'sourceClass'<>'official' THEN 'unverified' WHEN "data"->>'validFrom' IS NULL THEN 'unknown' WHEN "data"->>'repealedOn' <= ${input.at} OR "data"->>'validTo' <= ${input.at} THEN 'archive' WHEN "data"->>'validFrom' > ${input.at} THEN 'future' ELSE 'current' END`;
    const where = Prisma.sql`WHERE (${state}) = ${input.view} ${input.q ? Prisma.sql`AND to_tsvector('simple', "data"::text) @@ plainto_tsquery('simple', ${input.q})` : Prisma.empty}`;
    const rows = await db.$queryRaw<
      Array<{
        id: string;
        data: unknown;
        verifiedAt: Date | null;
        contentHash: string;
      }>
    >(
      Prisma.sql`SELECT "id","data","verifiedAt","contentHash" FROM "LegalVersion" ${where} ORDER BY "id" LIMIT 51 OFFSET ${input.offset}`,
    );
    const [total, verified] = await Promise.all([
      db.legalVersion.count(),
      db.legalVersion.count({ where: { verifiedAt: { not: null } } }),
    ]);
    res.json({
      total,
      verified,
      completeCorpus: false,
      hasMore: rows.length > 50,
      items: rows.slice(0, 50).map((r) => {
        const v = legalVersionSchema.parse(r.data);
        return {
          id: r.id,
          hash: r.contentHash,
          title: v.title,
          actId: v.actId,
          sourceUrl: v.sourceUrl,
          sourceDocumentId: v.sourceDocumentId,
          validFrom: v.validFrom,
          validTo: v.validTo,
          status: legalState(v, input.at, !!r.verifiedAt),
          provisions: applicableProvisions(v, input.at, !!r.verifiedAt),
        };
      }),
    });
  });
  router.post("/legislation/verify", async (req, res) => {
    if (!["admin", "chief_accountant"].includes(res.locals.user.role)) {
      res.status(403).json({ error: "Acces refuzat" });
      return;
    }
    // Shared corpus verification must be explicitly enabled for named curators.
    if (
      !(process.env.SOCOT_LEGAL_CURATORS ?? "")
        .split(",")
        .includes(res.locals.user.id)
    ) {
      res
        .status(403)
        .json({
          error:
            "Verificarea corpusului este rezervată curatorilor configurați pe server.",
        });
      return;
    }
    const input = z
      .object({
        id: z.string().length(64),
        hash: z.string().length(64),
        note: z.string().min(20).max(2000),
      })
      .parse(req.body);
    await db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(9212026)`;
      const row = await tx.legalVersion.findUniqueOrThrow({
        where: { id: input.id },
      });
      const data = legalVersionSchema.parse(row.data);
      if (
        row.contentHash !== input.hash ||
        data.sourceClass !== "official" ||
        data.status !== "adopted" ||
        !data.validFrom ||
        !data.publishedOn
      )
        throw Error(
          "Versiunea nu poate fi validată: verificați sursa, hash-ul, publicarea și aplicarea.",
        );
      if (row.verifiedAt)
        throw Error("Versiune deja validată; validarea este imuabilă.");
      const others = await tx.legalVersion.findMany({
        where: {
          actId: data.actId,
          language: data.language,
          verifiedAt: { not: null },
        },
      });
      if (
        others.some((o) => overlapping(data, legalVersionSchema.parse(o.data)))
      )
        throw Error(
          "Intervale suprapuse. Necesită reconciliere; nu se selectează automat ultima versiune.",
        );
      await tx.legalVersion.update({
        where: { id: row.id },
        data: {
          verifiedAt: new Date(),
          verifiedBy: res.locals.user.id,
          verificationNote: input.note,
        },
      });
    });
    res.json({ verified: true, accountingRulesChanged: false });
  });
  return router;
}

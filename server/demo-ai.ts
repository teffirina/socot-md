import express, { Router, type Request } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { aiSearchSchema } from "../lib/ai";
import {
  scanRequestSchema,
  scanSignatureMatches,
  scannedInvoiceSchema,
} from "../lib/invoice-scan";
import { extractInvoice, interpretQuestion } from "./ai";

// Demo mode has no account, so AI is served only to the computer running Socot:
// the OpenAI key cannot be spent by anyone reaching the server over the network.
export function fromThisComputer(req: Request) {
  const address = req.socket.remoteAddress ?? "";
  return (
    !req.headers["x-forwarded-for"] &&
    ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address)
  );
}

/**
 * AI for the demonstration company. Only the question or the scanned file goes
 * to OpenAI; the demo documents stay in the browser, which applies the filters.
 */
export function demoAiRouter(
  interpret = interpretQuestion,
  extract = extractInvoice,
) {
  const router = Router();
  router.use((req, res, next) => {
    if (fromThisComputer(req)) next();
    else
      res.status(403).json({
        error:
          "AI în modul demonstrativ funcționează numai pe calculatorul unde rulează Socot.",
      });
  });
  router.use(rateLimit({ windowMs: 60_000, limit: 10 }));
  router.get("/status", (_req, res) =>
    res.json({ configured: !!process.env.OPENAI_API_KEY }),
  );
  router.post("/interpret", async (req, res) => {
    const { question } = z
      .object({ question: z.string().trim().min(3).max(1000) })
      .strict()
      .parse(req.body);
    try {
      res.json({ filters: aiSearchSchema.parse(await interpret(question)) });
    } catch {
      res.status(503).json({
        error: process.env.OPENAI_API_KEY
          ? "AI nu este disponibil sau răspunsul nu este valid. Reîncearcă ori reformulează întrebarea."
          : "AI nu este configurat. Pune OPENAI_API_KEY în fișierul .env și repornește Socot.",
      });
    }
  });
  router.post(
    "/invoice-scan",
    express.json({ limit: "10mb" }),
    async (req, res) => {
      const parsed = scanRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: "Alege o factură PDF, PNG, JPEG sau WEBP de cel mult 7 MB.",
        });
        return;
      }
      const { file } = parsed.data;
      if (!scanSignatureMatches(file.type, Buffer.from(file.data, "base64"))) {
        res
          .status(400)
          .json({ error: "Conținutul fișierului nu corespunde formatului." });
        return;
      }
      try {
        res.json({ invoice: scannedInvoiceSchema.parse(await extract(file)) });
      } catch {
        res.status(503).json({
          error: process.env.OPENAI_API_KEY
            ? "Scanarea nu a reușit. Încearcă din nou sau completează factura manual."
            : "AI nu este configurat. Pune OPENAI_API_KEY în fișierul .env și repornește Socot.",
        });
      }
    },
  );
  return router;
}

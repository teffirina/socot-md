// Import an authorized normalized JSONL export. Never fetches arbitrary URLs.
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { legalVersionSchema } from "../lib/legislation";
const file = process.argv[2];
if (!file)
  throw Error(
    "Utilizare: legal-import.ts export.jsonl [--commit]. Implicit: doar validare.",
  );
const commit = process.argv.includes("--commit");
const db = commit ? new PrismaClient() : null;
let count = 0,
  inserted = 0;
try {
  for await (const line of createInterface({
    input: createReadStream(file),
    crlfDelay: Infinity,
  })) {
    if (!line.trim()) continue;
    const data = legalVersionSchema.parse(JSON.parse(line));
    const contentHash = createHash("sha256")
      .update(JSON.stringify(data))
      .digest("hex");
    // Same source ID with changed text is retained as another unverified revision.
    const id = createHash("sha256")
      .update(data.sourceUrl + "\n" + data.language + "\n" + contentHash)
      .digest("hex");
    if (db) {
      const r = await db.legalVersion.createMany({
        data: [
          {
            id,
            actId: data.actId,
            language: data.language,
            sourceDocumentId: data.sourceDocumentId,
            sourceUrl: data.sourceUrl,
            contentHash,
            data,
          },
        ],
        skipDuplicates: true,
      });
      inserted += r.count;
    }
    count++;
  }
  console.log(
    JSON.stringify({
      validated: count,
      inserted,
      mode: commit ? "quarantine" : "validation",
      verified: 0,
    }),
  );
} finally {
  await db?.$disconnect();
}

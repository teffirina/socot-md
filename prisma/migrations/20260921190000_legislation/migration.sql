CREATE TABLE "LegalVersion" (
 "id" TEXT PRIMARY KEY,
 "actId" TEXT NOT NULL,
 "language" TEXT NOT NULL,
 "sourceDocumentId" TEXT NOT NULL,
 "sourceUrl" TEXT NOT NULL,
 "contentHash" TEXT NOT NULL,
 "data" JSONB NOT NULL,
 "verifiedBy" TEXT,
 "verifiedAt" TIMESTAMP(3),
 "verificationNote" TEXT,
 "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "LegalVersion_actId_language_idx" ON "LegalVersion"("actId", "language");
CREATE INDEX "LegalVersion_importedAt_id_idx" ON "LegalVersion"("importedAt", "id");
CREATE INDEX "LegalVersion_text_idx" ON "LegalVersion" USING GIN (to_tsvector('simple', "data"::text));

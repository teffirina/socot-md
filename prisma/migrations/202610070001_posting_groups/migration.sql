BEGIN;
ALTER TABLE "Journal" ADD COLUMN "lineNo" INTEGER NOT NULL DEFAULT 1;
DROP INDEX "Journal_operationId_key";
CREATE UNIQUE INDEX "Journal_operationId_lineNo_key" ON "Journal"("operationId", "lineNo");
ALTER TABLE "AccountingRule" ADD COLUMN "allocations" JSONB;
COMMIT;

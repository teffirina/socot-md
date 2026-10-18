BEGIN;
CREATE TABLE "DocumentTask" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "version" INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DocumentTask_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "DocumentTask_companyId_status_idx" ON "DocumentTask"("companyId", "status");
CREATE INDEX "DocumentTask_companyId_invoiceId_idx" ON "DocumentTask"("companyId", "invoiceId");
COMMIT;

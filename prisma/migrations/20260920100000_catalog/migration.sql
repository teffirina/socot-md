CREATE TABLE "CatalogEntry" ("id" TEXT PRIMARY KEY, "companyId" TEXT NOT NULL, "kind" TEXT NOT NULL, "code" TEXT NOT NULL, "data" JSONB NOT NULL);
CREATE UNIQUE INDEX "CatalogEntry_companyId_kind_code_key" ON "CatalogEntry"("companyId", "kind", "code");

ALTER TABLE "Invoice" ADD COLUMN "partnerId" TEXT, ADD COLUMN "contractId" TEXT;

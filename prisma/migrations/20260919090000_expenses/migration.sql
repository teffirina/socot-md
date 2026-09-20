CREATE TYPE "DocumentKind" AS ENUM ('sale', 'expense');
ALTER TABLE "Invoice" ADD COLUMN "kind" "DocumentKind" NOT NULL DEFAULT 'sale', ADD COLUMN "category" TEXT NOT NULL DEFAULT '';

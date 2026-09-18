-- AlterTable
ALTER TABLE "Journal" ADD COLUMN     "approvedBy" TEXT,
ADD COLUMN     "effectiveDate" TEXT,
ADD COLUMN     "ruleId" TEXT,
ADD COLUMN     "ruleVersion" INTEGER,
ADD COLUMN     "state" TEXT NOT NULL DEFAULT 'proposed';

-- CreateTable
CREATE TABLE "AccountingRule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "debit" TEXT NOT NULL,
    "credit" TEXT NOT NULL,
    "validFrom" TEXT NOT NULL,
    "validTo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "source" TEXT NOT NULL,
    "approvedBy" TEXT,
    "demo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AccountingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingPeriod" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,

    CONSTRAINT "AccountingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceAudit" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegulatoryReport" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'generated',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceIds" JSONB NOT NULL,
    "rows" JSONB NOT NULL,
    "receiptId" TEXT,

    CONSTRAINT "RegulatoryReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountingRule_companyId_kind_status_idx" ON "AccountingRule"("companyId", "kind", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingRule_companyId_kind_version_key" ON "AccountingRule"("companyId", "kind", "version");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingPeriod_companyId_month_key" ON "AccountingPeriod"("companyId", "month");


-- Append-only audit and posted journals. Administrators with DDL privileges
-- remain outside this guarantee; deploy with a separate restricted API role.
CREATE FUNCTION socot_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Socot: append-only record cannot be changed or deleted'; END;
$$;
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE ON "Audit" FOR EACH ROW EXECUTE FUNCTION socot_append_only();
CREATE TRIGGER compliance_audit_append_only BEFORE UPDATE OR DELETE ON "ComplianceAudit" FOR EACH ROW EXECUTE FUNCTION socot_append_only();
CREATE FUNCTION socot_journal_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'UPDATE' AND OLD.state = 'proposed' AND NEW.state = 'posted'
    AND NEW."approvedBy" IS NOT NULL
    AND (to_jsonb(OLD) - 'state' - 'approvedBy') = (to_jsonb(NEW) - 'state' - 'approvedBy') THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'Socot: journal entries are immutable; use a corrective document';
END;
$$;
CREATE TRIGGER journal_immutable BEFORE UPDATE OR DELETE ON "Journal" FOR EACH ROW EXECUTE FUNCTION socot_journal_guard();
CREATE FUNCTION socot_rule_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status = 'approved' THEN RAISE EXCEPTION 'Socot: approved rule is immutable; create a new version'; END IF;
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END;
$$;
CREATE TRIGGER rule_immutable BEFORE UPDATE OR DELETE ON "AccountingRule" FOR EACH ROW EXECUTE FUNCTION socot_rule_guard();

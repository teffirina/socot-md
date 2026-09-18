import test from "node:test";
import assert from "node:assert/strict";
import { can, roles } from "../lib/permissions";
import {
  companySchema,
  demoCompany,
  accountSchema,
  demoAccounts,
} from "../lib/company";
test("auditorul și directorul nu pot posta sau modifica documente", () => {
  for (const role of ["auditor", "director"]) {
    assert.equal(can(role, "invoice.write"), false);
    assert.equal(can(role, "journal.post"), false);
  }
  assert.equal(can("auditor", "journal.read"), true);
});
test("contabilul pregătește reguli, contabilul-șef aprobă și redeschide perioade", () => {
  assert.equal(can("accountant", "rule.create"), true);
  assert.equal(can("accountant", "rule.approve"), false);
  assert.equal(can("accountant", "period.reopen"), false);
  assert.equal(can("chief_accountant", "rule.approve"), true);
  assert.equal(can("chief_accountant", "period.reopen"), true);
});
test("rolurile necunoscute, casierul și gestionarul nu primesc implicit acces la facturi", () => {
  for (const role of ["unknown", "cashier", "warehouse"])
    assert.equal(can(role, "invoice.read"), false);
  assert.equal(roles.length, 8);
});
test("profilul companiei și clasele conturilor sunt validate", () => {
  assert.equal(companySchema.safeParse(demoCompany).success, true);
  assert.equal(
    companySchema.safeParse({ ...demoCompany, idno: "123" }).success,
    false,
  );
  assert.equal(
    accountSchema.safeParse({ ...demoAccounts[0], class: 6 }).success,
    false,
  );
});

import { demoRules } from "../lib/compliance";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const db = new PrismaClient();
async function seed() {
  const password = process.env.SOCOT_DEMO_PASSWORD;
  if (!password || password.length < 12)
    throw new Error(
      "Configurează SOCOT_DEMO_PASSWORD (minimum 12 caractere) în mediul local.",
    );
  for (const role of ["admin", "director", "accountant", "operator"]) {
    await db.user.upsert({
      where: { email: `${role}@demo.socot.local` },
      update: {},
      create: {
        email: `${role}@demo.socot.local`,
        passwordHash: await bcrypt.hash(password, 12),
        companyId: "socot-demo",
        role,
      },
    });
  }
  for (const rule of demoRules)
    await db.accountingRule.upsert({
      where: { id: rule.id },
      update: {},
      create: { ...rule, companyId: "socot-demo" },
    });
  console.log("4 conturi demonstrative create.");
}
seed().finally(() => db.$disconnect());

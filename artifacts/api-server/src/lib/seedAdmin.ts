import bcrypt from "bcryptjs";
import { db, adminAccountsTable } from "@workspace/db";
import { count, eq } from "drizzle-orm";
import { logger } from "./logger";

export async function seedAdminIfNeeded() {
  const [{ total }] = await db.select({ total: count() }).from(adminAccountsTable);

  if (Number(total) === 0) {
    const passwordHash = await bcrypt.hash("admin123", 10);
    await db.insert(adminAccountsTable).values({
      username: "admin",
      passwordHash,
      displayName: "Administrator",
      active: true,
      accountLevel: "superadmin",
    });
    logger.info("Default admin account created — username: admin, password: admin123, level: superadmin");
    return;
  }

  // Upgrade any existing account that still has default "admin" level to "superadmin"
  // if there is no superadmin yet
  const [{ superCount }] = await db
    .select({ superCount: count() })
    .from(adminAccountsTable)
    .where(eq(adminAccountsTable.accountLevel, "superadmin"));

  if (Number(superCount) === 0) {
    const [first] = await db
      .select({ id: adminAccountsTable.id })
      .from(adminAccountsTable)
      .orderBy(adminAccountsTable.id)
      .limit(1);
    if (first) {
      await db
        .update(adminAccountsTable)
        .set({ accountLevel: "superadmin" })
        .where(eq(adminAccountsTable.id, first.id));
      logger.info({ id: first.id }, "Promoted first admin account to superadmin");
    }
  }
}

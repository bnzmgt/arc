import { pgTable, text, serial, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./boxes";

export const ACCOUNT_LEVELS = ["superadmin", "admin", "staff_admin", "user"] as const;
export type AccountLevel = typeof ACCOUNT_LEVELS[number];

export const adminAccountsTable = pgTable("admin_accounts", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull().default("Administrator"),
  active: boolean("active").notNull().default(true),
  accountLevel: text("account_level").notNull().default("admin"),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAdminAccountSchema = createInsertSchema(adminAccountsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertAdminAccount = z.infer<typeof insertAdminAccountSchema>;
export type AdminAccount = typeof adminAccountsTable.$inferSelect;

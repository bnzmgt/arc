import { pgTable, text, serial, timestamp, integer, pgEnum, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const boxStatusEnum = pgEnum("box_status", ["received", "in_progress", "completed", "returned"]);
export const workflowStepNameEnum = pgEnum("workflow_step_name", ["cleaning", "cataloging", "scanning", "qc", "repacking", "returning"]);
export const workflowStepStatusEnum = pgEnum("workflow_step_status", ["pending", "in_progress", "completed", "skipped"]);
export const roleWorkflowStepEnum = pgEnum("role_workflow_step", ["cleaning", "cataloging", "scanning", "qc", "repacking", "returning", "admin"]);
export const materialTypeEnum = pgEnum("material_type", ["newspaper", "maps", "books", "magazine", "archives", "heritage_items"]);
export const priorityLevelEnum = pgEnum("priority_level", ["P0", "P1", "P2", "P3"]);
export const custodyTypeEnum = pgEnum("custody_type", ["loan", "ptad", "project"]);

export const rolesTable = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  workflowStep: roleWorkflowStepEnum("workflow_step").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  active: text("active").notNull().default("true"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userRolesTable = pgTable("user_roles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  roleId: integer("role_id").notNull().references(() => rolesTable.id, { onDelete: "cascade" }),
});

export const boxesTable = pgTable("boxes", {
  id: serial("id").primaryKey(),
  boxCode: text("box_code").notNull().unique(),
  clientName: text("client_name").notNull(),
  collectionsOwner: text("collections_owner"),
  description: text("description"),
  location: text("location"),
  archiveYear: text("archive_year"),
  totalBoxes: integer("total_boxes"),
  totalItems: integer("total_items"),
  materialTypes: text("material_types").array().notNull().default(["newspaper"]),
  placeOfOrigin: text("place_of_origin"),
  priority: priorityLevelEnum("priority_level"),
  custodyType: custodyTypeEnum("custody_type"),
  status: boxStatusEnum("status").notNull().default("received"),
  ticketCode: text("ticket_code").notNull().unique(),
  notes: text("notes"),
  photoLink: text("photo_link"),
  inDate: timestamp("in_date", { withTimezone: true }),
  outDate: timestamp("out_date", { withTimezone: true }),
  deadline: timestamp("deadline", { withTimezone: true }),
  cost: numeric("cost", { precision: 12, scale: 2 }),
  currentStep: text("current_step").default("cleaning"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const workflowStepsTable = pgTable("workflow_steps", {
  id: serial("id").primaryKey(),
  boxId: integer("box_id").notNull().references(() => boxesTable.id, { onDelete: "cascade" }),
  stepName: workflowStepNameEnum("step_name").notNull(),
  stepOrder: integer("step_order").notNull(),
  status: workflowStepStatusEnum("status").notNull().default("pending"),
  assignedUserId: integer("assigned_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  performedByAdminId: integer("performed_by_admin_id"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  notes: text("notes"),
  itemCount: integer("item_count"),
  itemCountSecondary: integer("item_count_secondary"),
  copyForClient: text("copy_for_client"),
  storagePrepared: text("storage_prepared"),
  hddReady: text("hdd_ready"),
  documentHandover: text("document_handover"),
  clientCopyReceived: text("client_copy_received"),
  hddReceivedByClient: text("hdd_received_by_client"),
  handoverDocumentSigned: text("handover_document_signed"),
  unreturnedMaterials: text("unreturned_materials"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const activityLogTable = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  boxId: integer("box_id").references(() => boxesTable.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  stepName: text("step_name"),
  performedByUserId: integer("performed_by_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  performedByAdminId: integer("performed_by_admin_id"),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRoleSchema = createInsertSchema(rolesTable).omit({ id: true, createdAt: true });
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type Role = typeof rolesTable.$inferSelect;

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

export const insertBoxSchema = createInsertSchema(boxesTable).omit({ id: true, createdAt: true, updatedAt: true, boxCode: true, ticketCode: true, currentStep: true, status: true });
export type InsertBox = z.infer<typeof insertBoxSchema>;
export type Box = typeof boxesTable.$inferSelect;

export const insertWorkflowStepSchema = createInsertSchema(workflowStepsTable).omit({ id: true, updatedAt: true });
export type InsertWorkflowStep = z.infer<typeof insertWorkflowStepSchema>;
export type WorkflowStep = typeof workflowStepsTable.$inferSelect;

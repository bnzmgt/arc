import { Router, type IRouter } from "express";
import { eq, count, sum, desc, and, sql } from "drizzle-orm";
import { db, boxesTable, workflowStepsTable, activityLogTable, usersTable, adminAccountsTable } from "@workspace/db";
import { requireAdmin } from "../lib/authMiddleware";

const router: IRouter = Router();

router.get("/stats/dashboard", async (_req, res): Promise<void> => {
  const [stats] = await db
    .select({
      totalBoxes: count(boxesTable.id),
    })
    .from(boxesTable);

  const statusRows = await db
    .select({
      status: boxesTable.status,
      cnt: count(boxesTable.id),
    })
    .from(boxesTable)
    .groupBy(boxesTable.status);

  const [itemStats] = await db
    .select({
      totalItems: sum(boxesTable.totalItems),
    })
    .from(boxesTable);

  const byStatus: Record<string, number> = {};
  for (const row of statusRows) {
    byStatus[row.status] = Number(row.cnt);
  }

  res.json({
    totalBoxes: Number(stats?.totalBoxes ?? 0),
    activeBoxes: (byStatus["received"] ?? 0) + (byStatus["in_progress"] ?? 0),
    completedBoxes: byStatus["completed"] ?? 0,
    returnedBoxes: byStatus["returned"] ?? 0,
    totalItems: Number(itemStats?.totalItems ?? 0),
    boxesInProgress: byStatus["in_progress"] ?? 0,
  });
});

router.get("/stats/workflow-progress", async (_req, res): Promise<void> => {
  const stepNames = ["cleaning", "cataloging", "scanning", "qc", "repacking", "returning"] as const;

  const rows = await db
    .select({
      stepName: workflowStepsTable.stepName,
      status: workflowStepsTable.status,
      cnt: count(workflowStepsTable.id),
    })
    .from(workflowStepsTable)
    .groupBy(workflowStepsTable.stepName, workflowStepsTable.status);

  const progress = stepNames.map(stepName => {
    const stepRows = rows.filter(r => r.stepName === stepName);
    const total = stepRows.reduce((acc, r) => acc + Number(r.cnt), 0);
    const completed = Number(stepRows.find(r => r.status === "completed")?.cnt ?? 0);
    const inProgress = Number(stepRows.find(r => r.status === "in_progress")?.cnt ?? 0);
    const pending = Number(stepRows.find(r => r.status === "pending")?.cnt ?? 0);
    return { stepName, total, completed, inProgress, pending };
  });

  res.json(progress);
});

router.get("/stats/recent-activity", async (_req, res): Promise<void> => {
  const activities = await db
    .select({
      id: activityLogTable.id,
      boxId: activityLogTable.boxId,
      boxCode: boxesTable.boxCode,
      clientName: boxesTable.clientName,
      action: activityLogTable.action,
      stepName: activityLogTable.stepName,
      performedBy: sql<string | null>`COALESCE(${usersTable.name}, ${adminAccountsTable.displayName})`,
      timestamp: activityLogTable.timestamp,
    })
    .from(activityLogTable)
    .leftJoin(boxesTable, eq(activityLogTable.boxId, boxesTable.id))
    .leftJoin(usersTable, eq(activityLogTable.performedByUserId, usersTable.id))
    .leftJoin(adminAccountsTable, eq(activityLogTable.performedByAdminId, adminAccountsTable.id))
    .orderBy(desc(activityLogTable.timestamp))
    .limit(20);

  res.json(activities);
});

router.get("/stats/activity-log", async (req, res): Promise<void> => {
  const limit = Math.min(parseInt((req.query.limit as string) ?? "100", 10), 200);
  const offset = parseInt((req.query.offset as string) ?? "0", 10);
  const stepFilter = req.query.step as string | undefined;
  const boxIdFilter = req.query.boxId ? parseInt(req.query.boxId as string, 10) : undefined;
  const userFilter = req.query.userId ? parseInt(req.query.userId as string, 10) : undefined;

  const conditions = [];
  if (stepFilter) conditions.push(eq(activityLogTable.stepName, stepFilter));
  if (boxIdFilter) conditions.push(eq(activityLogTable.boxId, boxIdFilter));
  if (userFilter) conditions.push(eq(activityLogTable.performedByUserId, userFilter));

  const rows = await db
    .select({
      id: activityLogTable.id,
      boxId: activityLogTable.boxId,
      boxCode: boxesTable.boxCode,
      clientName: boxesTable.clientName,
      action: activityLogTable.action,
      stepName: activityLogTable.stepName,
      performedBy: sql<string | null>`COALESCE(${usersTable.name}, ${adminAccountsTable.displayName})`,
      performedByUserId: activityLogTable.performedByUserId,
      timestamp: activityLogTable.timestamp,
    })
    .from(activityLogTable)
    .leftJoin(boxesTable, eq(activityLogTable.boxId, boxesTable.id))
    .leftJoin(usersTable, eq(activityLogTable.performedByUserId, usersTable.id))
    .leftJoin(adminAccountsTable, eq(activityLogTable.performedByAdminId, adminAccountsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(activityLogTable.timestamp))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: count(activityLogTable.id) })
    .from(activityLogTable)
    .leftJoin(boxesTable, eq(activityLogTable.boxId, boxesTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  res.json({ rows, total: Number(total), limit, offset });
});

export default router;

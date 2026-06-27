import { Router, type IRouter } from "express";
import { eq, and, ilike, or, desc, sql } from "drizzle-orm";
import { db, boxesTable, workflowStepsTable, usersTable, rolesTable, activityLogTable, userRolesTable, adminAccountsTable } from "@workspace/db";
import { requireAdmin } from "../lib/authMiddleware";
import {
  CreateBoxBody,
  UpdateBoxBody,
  GetBoxParams,
  UpdateBoxParams,
  DeleteBoxParams,
  ListBoxesQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const WORKFLOW_STEPS = ["cleaning", "cataloging", "scanning", "qc", "repacking", "returning"] as const;

async function createWorkflowSteps(boxId: number) {
  const steps = WORKFLOW_STEPS.map((stepName, index) => ({
    boxId,
    stepName: stepName as typeof WORKFLOW_STEPS[number],
    stepOrder: index + 1,
    status: "pending" as const,
  }));
  await db.insert(workflowStepsTable).values(steps);
}

const CUSTODY_TYPE_PREFIXES: Record<string, string> = {
  loan: "LOA",
  owned: "OWN",
};

async function generateBoxCode(custodyType: string): Promise<string> {
  const prefix = CUSTODY_TYPE_PREFIXES[custodyType] ?? "OWN";
  const year = new Date().getFullYear();
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(boxesTable)
    .where(ilike(boxesTable.boxCode, `${prefix}-${year}-%`));
  const seq = (result[0]?.count ?? 0) + 1;
  return `${prefix}-${year}-${String(seq).padStart(3, "0")}`;
}

router.get("/boxes", async (req, res): Promise<void> => {
  const params = ListBoxesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  let query = db.select().from(boxesTable).$dynamic();

  const conditions = [];
  if (params.data.search) {
    conditions.push(
      or(
        ilike(boxesTable.boxCode, `%${params.data.search}%`),
        ilike(boxesTable.clientName, `%${params.data.search}%`)
      )
    );
  }
  if (params.data.status) {
    conditions.push(eq(boxesTable.status, params.data.status as "received" | "in_progress" | "completed" | "returned"));
  }
  if (params.data.location) {
    conditions.push(ilike(boxesTable.location, `%${params.data.location}%`));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const boxes = await query.orderBy(desc(boxesTable.createdAt));
  res.json(boxes);
});

router.post("/boxes", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateBoxBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const boxCode = await generateBoxCode(parsed.data.custodyType ?? "owned");
  const [box] = await db.insert(boxesTable).values({
    ...parsed.data,
    boxCode,
    ticketCode: boxCode,
    status: "received",
    currentStep: "cleaning",
    inDate: parsed.data.inDate ? new Date(parsed.data.inDate) : new Date(),
    cost: parsed.data.cost != null ? String(parsed.data.cost) : undefined,
  }).returning();

  await createWorkflowSteps(box.id);

  await db.insert(activityLogTable).values({
    boxId: box.id,
    action: "Box created and received",
    stepName: null,
    performedByUserId: null,
    performedByAdminId: req.session?.adminId ?? null,
  });

  res.status(201).json(box);
});

router.get("/boxes/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [box] = await db.select().from(boxesTable).where(eq(boxesTable.id, id));
  if (!box) {
    res.status(404).json({ error: "Box not found" });
    return;
  }

  res.json(box);
});

router.put("/boxes/:id", requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = UpdateBoxBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.outDate !== undefined) {
    updateData.outDate = parsed.data.outDate ? new Date(parsed.data.outDate) : null;
  }
  if (parsed.data.inDate !== undefined) {
    updateData.inDate = parsed.data.inDate ? new Date(parsed.data.inDate) : null;
  }

  const [box] = await db.update(boxesTable)
    .set(updateData as Partial<typeof boxesTable.$inferInsert>)
    .where(eq(boxesTable.id, id))
    .returning();

  if (!box) {
    res.status(404).json({ error: "Box not found" });
    return;
  }

  res.json(box);
});

router.delete("/boxes/:id", requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [box] = await db.delete(boxesTable).where(eq(boxesTable.id, id)).returning();
  if (!box) {
    res.status(404).json({ error: "Box not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/boxes/:id/workflow", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const steps = await db
    .select({
      id: workflowStepsTable.id,
      boxId: workflowStepsTable.boxId,
      stepName: workflowStepsTable.stepName,
      stepOrder: workflowStepsTable.stepOrder,
      status: workflowStepsTable.status,
      assignedUserId: workflowStepsTable.assignedUserId,
      assignedUserName: usersTable.name,
      performedByAdminName: adminAccountsTable.displayName,
      startedAt: workflowStepsTable.startedAt,
      completedAt: workflowStepsTable.completedAt,
      notes: workflowStepsTable.notes,
      itemCount: workflowStepsTable.itemCount,
      itemCountSecondary: workflowStepsTable.itemCountSecondary,
      updatedAt: workflowStepsTable.updatedAt,
    })
    .from(workflowStepsTable)
    .leftJoin(usersTable, eq(workflowStepsTable.assignedUserId, usersTable.id))
    .leftJoin(adminAccountsTable, eq(workflowStepsTable.performedByAdminId, adminAccountsTable.id))
    .where(eq(workflowStepsTable.boxId, id))
    .orderBy(workflowStepsTable.stepOrder);

  res.json(steps);
});

router.post("/boxes/:id/workflow", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const { stepName, status, assignedUserId, notes } = req.body;
  if (!stepName || !status) {
    res.status(400).json({ error: "stepName and status are required" });
    return;
  }

  // Role-based access: user must have at least one role that covers this step (or admin role)
  if (assignedUserId != null) {
    const actorRoles = await db
      .select({ workflowStep: rolesTable.workflowStep, roleName: rolesTable.name })
      .from(userRolesTable)
      .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id))
      .where(eq(userRolesTable.userId, Number(assignedUserId)));

    if (actorRoles.length > 0) {
      const allowed = actorRoles.some(
        r => r.workflowStep === "admin" || r.workflowStep === stepName
      );
      if (!allowed) {
        const roleNames = actorRoles.map(r => r.roleName).join(", ");
        res.status(403).json({
          error: `Access denied: user's roles (${roleNames}) do not cover the "${stepName}" step`,
        });
        return;
      }
    }
  }

  const [box] = await db.select().from(boxesTable).where(eq(boxesTable.id, id));
  if (!box) {
    res.status(404).json({ error: "Box not found" });
    return;
  }

  const allSteps = await db
    .select()
    .from(workflowStepsTable)
    .where(eq(workflowStepsTable.boxId, id))
    .orderBy(workflowStepsTable.stepOrder);

  const targetStep = allSteps.find(s => s.stepName === stepName);
  if (!targetStep) {
    res.status(404).json({ error: "Step not found" });
    return;
  }

  if (status === "in_progress" || status === "completed") {
    const order = targetStep.stepOrder;
    if (order <= 4) {
      // Steps 1–4 (Cleaning, Cataloging, Scanning, QC) are parallel — no prerequisite
    } else if (order === 5) {
      // Repacking requires all 4 processing steps to be completed/skipped
      const firstFour = allSteps.filter(s => s.stepOrder <= 4);
      const blocked = firstFour.some(s => s.status !== "completed" && s.status !== "skipped");
      if (blocked) {
        res.status(403).json({ error: "All 4 processing steps (Cleaning, Cataloging, Scanning, QC) must be completed before Repacking" });
        return;
      }
      // Block completing Repacking if preceding steps have mismatched item counts
      if (status === "completed") {
        const effectiveCount = (s: { itemCount: number | null; itemCountSecondary: number | null }) =>
          (s.itemCount ?? 0) + (s.itemCountSecondary ?? 0);
        const countedSteps = firstFour.filter(s => s.status !== "skipped" && s.itemCount != null);
        const uniqueCounts = new Set(countedSteps.map(s => effectiveCount(s)));
        if (countedSteps.length >= 2 && uniqueCounts.size > 1) {
          const detail = countedSteps.map(s => `${s.stepName} (${effectiveCount(s)})`).join(", ");
          res.status(422).json({ error: `Item count mismatch in preceding steps: ${detail}. Staff must recount and correct the item counts before completing Repacking.` });
          return;
        }
      }
    } else if (order === 6) {
      // Returning requires Repacking to be completed/skipped
      const repacking = allSteps.find(s => s.stepOrder === 5);
      if (!repacking || (repacking.status !== "completed" && repacking.status !== "skipped")) {
        res.status(403).json({ error: "Repacking must be completed before Returning" });
        return;
      }
      // Block completing Returning if any preceding steps have mismatched item counts
      if (status === "completed") {
        const effectiveCount = (s: { itemCount: number | null; itemCountSecondary: number | null }) =>
          (s.itemCount ?? 0) + (s.itemCountSecondary ?? 0);
        const preceding = allSteps.filter(s => s.stepOrder < 6 && s.status !== "skipped" && s.itemCount != null);
        const uniqueCounts = new Set(preceding.map(s => effectiveCount(s)));
        if (preceding.length >= 2 && uniqueCounts.size > 1) {
          const detail = preceding.map(s => `${s.stepName} (${effectiveCount(s)})`).join(", ");
          res.status(422).json({ error: `Item count mismatch in preceding steps: ${detail}. Staff must recount and correct the item counts before completing Returning.` });
          return;
        }
      }
    }
  }

  const itemCount = req.body.itemCount != null ? Number(req.body.itemCount) : undefined;
  const itemCountSecondary = req.body.itemCountSecondary != null ? Number(req.body.itemCountSecondary) : undefined;

  const updateData: Record<string, unknown> = {
    status,
    notes: notes ?? targetStep.notes,
    ...(itemCount !== undefined ? { itemCount } : {}),
    ...(itemCountSecondary !== undefined ? { itemCountSecondary } : {}),
  };

  if (assignedUserId !== undefined) {
    updateData.assignedUserId = assignedUserId;
  }

  if (req.session?.adminId) {
    updateData.performedByAdminId = req.session.adminId;
  }

  if (status === "in_progress" && !targetStep.startedAt) {
    updateData.startedAt = new Date();
  }
  if (status === "completed") {
    if (!targetStep.startedAt) updateData.startedAt = new Date();
    if (!targetStep.completedAt) updateData.completedAt = new Date();
  }

  const [updatedStep] = await db
    .update(workflowStepsTable)
    .set(updateData)
    .where(eq(workflowStepsTable.id, targetStep.id))
    .returning();

  if (status === "completed") {
    const nextStep = allSteps.find(s => s.stepOrder === targetStep.stepOrder + 1);
    if (nextStep) {
      await db.update(boxesTable)
        .set({ currentStep: nextStep.stepName, status: "in_progress" })
        .where(eq(boxesTable.id, id));
    } else {
      // All steps done — owned items are "completed" (stored), loaned items are "returned"
      const finalStatus = box.custodyType === "owned" ? "completed" : "returned";
      await db.update(boxesTable)
        .set({ currentStep: null, status: finalStatus, outDate: updatedStep.completedAt ?? new Date() })
        .where(eq(boxesTable.id, id));
    }
  } else if (status === "in_progress") {
    await db.update(boxesTable)
      .set({ currentStep: stepName, status: "in_progress" })
      .where(eq(boxesTable.id, id));
  }

  const [user] = assignedUserId
    ? await db.select().from(usersTable).where(eq(usersTable.id, assignedUserId))
    : [null];

  const adminId = req.session?.adminId ?? null;
  const [adminAccount] = adminId
    ? await db.select().from(adminAccountsTable).where(eq(adminAccountsTable.id, adminId))
    : [null];

  await db.insert(activityLogTable).values({
    boxId: id,
    action: `Workflow step "${stepName}" updated to "${status}"`,
    stepName,
    performedByUserId: assignedUserId ?? null,
    performedByAdminId: adminId,
  });

  res.json({
    ...updatedStep,
    assignedUserName: user?.name ?? null,
    performedByAdminName: adminAccount?.displayName ?? null,
  });
});

router.get("/boxes/:id/ticket", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [box] = await db.select().from(boxesTable).where(eq(boxesTable.id, id));
  if (!box) {
    res.status(404).json({ error: "Box not found" });
    return;
  }

  const steps = await db
    .select({
      id: workflowStepsTable.id,
      boxId: workflowStepsTable.boxId,
      stepName: workflowStepsTable.stepName,
      stepOrder: workflowStepsTable.stepOrder,
      status: workflowStepsTable.status,
      assignedUserId: workflowStepsTable.assignedUserId,
      assignedUserName: usersTable.name,
      performedByAdminName: adminAccountsTable.displayName,
      startedAt: workflowStepsTable.startedAt,
      completedAt: workflowStepsTable.completedAt,
      notes: workflowStepsTable.notes,
      itemCount: workflowStepsTable.itemCount,
      itemCountSecondary: workflowStepsTable.itemCountSecondary,
      updatedAt: workflowStepsTable.updatedAt,
    })
    .from(workflowStepsTable)
    .leftJoin(usersTable, eq(workflowStepsTable.assignedUserId, usersTable.id))
    .leftJoin(adminAccountsTable, eq(workflowStepsTable.performedByAdminId, adminAccountsTable.id))
    .where(eq(workflowStepsTable.boxId, id))
    .orderBy(workflowStepsTable.stepOrder);

  const domain = process.env.REPLIT_DOMAINS?.split(",")[0] ?? req.headers.host ?? "localhost";
  const protocol = domain.includes("localhost") ? "http" : "https";
  const scanUrl = `${protocol}://${domain}/scan/${box.ticketCode}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&ecc=L&data=${encodeURIComponent(scanUrl)}`;

  res.json({
    boxId: box.id,
    boxCode: box.boxCode,
    clientName: box.clientName,
    ticketCode: box.ticketCode,
    qrCodeUrl,
    description: box.description,
    location: box.location,
    archiveYear: box.archiveYear,
    totalItems: box.totalItems,
    inDate: box.inDate,
    currentStep: box.currentStep,
    status: box.status,
    workflowSteps: steps,
  });
});

router.get("/scan/:ticketCode", async (req, res): Promise<void> => {
  const ticketCode = Array.isArray(req.params.ticketCode)
    ? req.params.ticketCode[0]
    : req.params.ticketCode;

  const [box] = await db.select().from(boxesTable).where(eq(boxesTable.ticketCode, ticketCode));
  if (!box) {
    res.status(404).json({ error: "Box not found" });
    return;
  }

  const steps = await db
    .select({
      id: workflowStepsTable.id,
      boxId: workflowStepsTable.boxId,
      stepName: workflowStepsTable.stepName,
      stepOrder: workflowStepsTable.stepOrder,
      status: workflowStepsTable.status,
      assignedUserId: workflowStepsTable.assignedUserId,
      assignedUserName: usersTable.name,
      performedByAdminName: adminAccountsTable.displayName,
      startedAt: workflowStepsTable.startedAt,
      completedAt: workflowStepsTable.completedAt,
      notes: workflowStepsTable.notes,
      itemCount: workflowStepsTable.itemCount,
      itemCountSecondary: workflowStepsTable.itemCountSecondary,
      updatedAt: workflowStepsTable.updatedAt,
    })
    .from(workflowStepsTable)
    .leftJoin(usersTable, eq(workflowStepsTable.assignedUserId, usersTable.id))
    .leftJoin(adminAccountsTable, eq(workflowStepsTable.performedByAdminId, adminAccountsTable.id))
    .where(eq(workflowStepsTable.boxId, box.id))
    .orderBy(workflowStepsTable.stepOrder);

  const users = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    roleId: userRolesTable.roleId,
    roleName: rolesTable.name,
    workflowStep: rolesTable.workflowStep,
    active: usersTable.active,
    createdAt: usersTable.createdAt,
  })
    .from(usersTable)
    .innerJoin(userRolesTable, eq(userRolesTable.userId, usersTable.id))
    .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id))
    .where(eq(usersTable.active, "true"));

  res.json({ box, workflowSteps: steps, users });
});

export default router;

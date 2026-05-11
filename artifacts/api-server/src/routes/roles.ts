import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, rolesTable } from "@workspace/db";
import { CreateRoleBody, UpdateRoleBody } from "@workspace/api-zod";
import { requireAdmin } from "../lib/authMiddleware";

const router: IRouter = Router();

router.get("/roles", async (_req, res): Promise<void> => {
  const roles = await db.select().from(rolesTable).orderBy(rolesTable.createdAt);
  res.json(roles);
});

router.post("/roles", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateRoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [role] = await db.insert(rolesTable).values(parsed.data).returning();
  res.status(201).json(role);
});

router.put("/roles/:id", requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = UpdateRoleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [role] = await db.update(rolesTable).set(parsed.data).where(eq(rolesTable.id, id)).returning();
  if (!role) {
    res.status(404).json({ error: "Role not found" });
    return;
  }

  res.json(role);
});

router.delete("/roles/:id", requireAdmin, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [role] = await db.delete(rolesTable).where(eq(rolesTable.id, id)).returning();
  if (!role) {
    res.status(404).json({ error: "Role not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;

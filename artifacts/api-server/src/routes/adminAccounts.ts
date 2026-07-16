import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, adminAccountsTable, activityLogTable } from "@workspace/db";
import { eq, isNull, ne } from "drizzle-orm";
import { requireAdmin, requireSuperAdmin } from "../lib/authMiddleware";
import { ACCOUNT_LEVELS } from "@workspace/db";

const router: IRouter = Router();

// GET /admin-accounts — list all standalone admin/superadmin accounts (superadmin only)
router.get("/admin-accounts", requireSuperAdmin, async (req, res): Promise<void> => {
  const accounts = await db
    .select({
      id: adminAccountsTable.id,
      username: adminAccountsTable.username,
      displayName: adminAccountsTable.displayName,
      active: adminAccountsTable.active,
      accountLevel: adminAccountsTable.accountLevel,
      userId: adminAccountsTable.userId,
      createdAt: adminAccountsTable.createdAt,
    })
    .from(adminAccountsTable)
    .orderBy(adminAccountsTable.createdAt);

  res.json(accounts);
});

// POST /admin-accounts — create standalone admin or superadmin account (superadmin only)
router.post("/admin-accounts", requireSuperAdmin, async (req, res): Promise<void> => {
  const { username, password, displayName, accountLevel } = req.body as {
    username?: string;
    password?: string;
    displayName?: string;
    accountLevel?: string;
  };

  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }
  if (username.trim().length < 2 || !/^[a-z0-9_]+$/.test(username.trim())) {
    res.status(400).json({ error: "Username: 2+ chars, lowercase/numbers/underscores only" });
    return;
  }
  if (password.length < 4) {
    res.status(400).json({ error: "Password must be at least 4 characters" });
    return;
  }
  const level = (accountLevel ?? "admin") as string;
  if (!ACCOUNT_LEVELS.includes(level as "superadmin" | "admin" | "user")) {
    res.status(400).json({ error: "Invalid account level" });
    return;
  }

  const existing = await db
    .select({ id: adminAccountsTable.id })
    .from(adminAccountsTable)
    .where(eq(adminAccountsTable.username, username.trim().toLowerCase()))
    .limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "Username already taken" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const [account] = await db.insert(adminAccountsTable).values({
    username: username.trim().toLowerCase(),
    passwordHash,
    displayName: (displayName ?? username).trim(),
    active: true,
    accountLevel: level,
    userId: null,
  }).returning();

  res.status(201).json({
    id: account.id,
    username: account.username,
    displayName: account.displayName,
    active: account.active,
    accountLevel: account.accountLevel,
    userId: account.userId,
    createdAt: account.createdAt,
  });
});

// PATCH /admin-accounts/:id — update username, display name, password, level, or active (superadmin only)
router.patch("/admin-accounts/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const selfId = req.session.adminId!;
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { username, password, displayName, accountLevel, active } = req.body as {
    username?: string; password?: string; displayName?: string;
    accountLevel?: string; active?: boolean;
  };

  const updates: Record<string, unknown> = {};
  if (typeof displayName === "string" && displayName.trim()) updates.displayName = displayName.trim();
  if (typeof active === "boolean") {
    if (id === selfId && active === false) {
      res.status(400).json({ error: "You cannot suspend your own account" });
      return;
    }
    updates.active = active;
  }
  if (username) {
    if (username.trim().length < 2 || !/^[a-z0-9_]+$/.test(username.trim())) {
      res.status(400).json({ error: "Invalid username format" });
      return;
    }
    updates.username = username.trim().toLowerCase();
  }
  if (password) {
    if (password.length < 4) { res.status(400).json({ error: "Password too short" }); return; }
    updates.passwordHash = await bcrypt.hash(password, 10);
  }
  if (accountLevel) {
    if (!ACCOUNT_LEVELS.includes(accountLevel as "superadmin" | "admin" | "user")) {
      res.status(400).json({ error: "Invalid account level" });
      return;
    }
    if (id === selfId && accountLevel !== "superadmin") {
      res.status(400).json({ error: "You cannot demote yourself" });
      return;
    }
    updates.accountLevel = accountLevel;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  const [account] = await db
    .update(adminAccountsTable)
    .set(updates)
    .where(eq(adminAccountsTable.id, id))
    .returning();

  if (!account) { res.status(404).json({ error: "Account not found" }); return; }

  if (password) {
    await db.insert(activityLogTable).values({
      boxId: null,
      action: `Password changed for account: ${account.username} (${account.displayName})`,
      stepName: null,
      performedByAdminId: req.session.adminId ?? null,
    });
  }

  res.json({
    id: account.id,
    username: account.username,
    displayName: account.displayName,
    active: account.active,
    accountLevel: account.accountLevel,
    userId: account.userId,
    createdAt: account.createdAt,
  });
});

// DELETE /admin-accounts/:id — delete an admin account (superadmin only, cannot delete self)
router.delete("/admin-accounts/:id", requireSuperAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  const selfId = req.session.adminId!;
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  if (id === selfId) { res.status(400).json({ error: "You cannot delete your own account" }); return; }

  const [deleted] = await db
    .delete(adminAccountsTable)
    .where(eq(adminAccountsTable.id, id))
    .returning({ id: adminAccountsTable.id });

  if (!deleted) { res.status(404).json({ error: "Account not found" }); return; }
  res.json({ ok: true });
});

export default router;

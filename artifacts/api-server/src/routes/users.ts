import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db, usersTable, rolesTable, adminAccountsTable, userRolesTable } from "@workspace/db";
import { requireFullAdmin } from "../lib/authMiddleware";

const router: IRouter = Router();

function validateAccountBody(body: unknown): { username: string; password: string } | { error: string } {
  const b = body as Record<string, unknown>;
  const username = typeof b.username === "string" ? b.username.trim().toLowerCase() : "";
  const password = typeof b.password === "string" ? b.password : "";
  if (username.length < 2 || username.length > 40) return { error: "Username must be 2–40 characters" };
  if (!/^[a-z0-9_]+$/.test(username)) return { error: "Username: only lowercase letters, numbers, underscores" };
  if (password.length < 4) return { error: "Password must be at least 4 characters" };
  return { username, password };
}

async function userWithAccount(userId: number) {
  const [acct] = await db
    .select({ id: adminAccountsTable.id, username: adminAccountsTable.username, active: adminAccountsTable.active })
    .from(adminAccountsTable)
    .where(eq(adminAccountsTable.userId, userId))
    .limit(1);
  return acct ?? null;
}

async function getUserRoles(userId: number) {
  return db
    .select({ id: rolesTable.id, name: rolesTable.name, workflowStep: rolesTable.workflowStep })
    .from(userRolesTable)
    .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id))
    .where(eq(userRolesTable.userId, userId));
}

async function setUserRoles(userId: number, roleIds: number[]) {
  await db.delete(userRolesTable).where(eq(userRolesTable.userId, userId));
  if (roleIds.length > 0) {
    const unique = [...new Set(roleIds)];
    await db.insert(userRolesTable).values(unique.map(roleId => ({ userId, roleId })));
  }
}

router.get("/users", requireFullAdmin, async (_req, res): Promise<void> => {
  const users = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      active: usersTable.active,
      createdAt: usersTable.createdAt,
      accountId: adminAccountsTable.id,
      accountUsername: adminAccountsTable.username,
      accountActive: adminAccountsTable.active,
    })
    .from(usersTable)
    .leftJoin(adminAccountsTable, eq(adminAccountsTable.userId, usersTable.id))
    .orderBy(usersTable.createdAt);

  const userRoleRows = await db
    .select({
      userId: userRolesTable.userId,
      roleId: rolesTable.id,
      roleName: rolesTable.name,
      workflowStep: rolesTable.workflowStep,
    })
    .from(userRolesTable)
    .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id));

  const rolesByUser = new Map<number, Array<{ id: number; name: string; workflowStep: string }>>();
  for (const r of userRoleRows) {
    const arr = rolesByUser.get(r.userId) ?? [];
    arr.push({ id: r.roleId, name: r.roleName, workflowStep: r.workflowStep });
    rolesByUser.set(r.userId, arr);
  }

  res.json(users.map(u => ({
    ...u,
    hasAccount: u.accountId != null,
    roles: rolesByUser.get(u.id) ?? [],
  })));
});

router.post("/users", requireFullAdmin, async (req, res): Promise<void> => {
  const body = req.body as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    res.status(400).json({ error: "Name is required" });
    return;
  }
  const email = typeof body.email === "string" && body.email.trim() ? body.email.trim() : null;
  const roleIds: number[] = Array.isArray(body.roleIds)
    ? (body.roleIds as unknown[]).filter((v): v is number => typeof v === "number")
    : (typeof body.roleId === "number" ? [body.roleId] : []);

  const { loginUsername, loginPassword } = body as { loginUsername?: string; loginPassword?: string };

  if (loginUsername || loginPassword) {
    const acctParsed = validateAccountBody({ username: loginUsername, password: loginPassword });
    if ("error" in acctParsed) {
      res.status(400).json({ error: acctParsed.error });
      return;
    }
    const existing = await db.select({ id: adminAccountsTable.id })
      .from(adminAccountsTable)
      .where(eq(adminAccountsTable.username, acctParsed.username))
      .limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "Username already taken" });
      return;
    }
  }

  const [user] = await db.insert(usersTable).values({ name, email, active: "true" }).returning();

  if (roleIds.length > 0) await setUserRoles(user.id, roleIds);

  if (loginUsername && loginPassword) {
    const passwordHash = await bcrypt.hash(loginPassword, 10);
    await db.insert(adminAccountsTable).values({
      username: loginUsername.trim().toLowerCase(),
      passwordHash,
      displayName: name,
      active: true,
      accountLevel: "user",
      userId: user.id,
    });
  }

  const roles = await getUserRoles(user.id);
  const acct = await userWithAccount(user.id);

  res.status(201).json({
    ...user,
    roles,
    hasAccount: acct != null,
    accountId: acct?.id ?? null,
    accountUsername: acct?.username ?? null,
    accountActive: acct?.active ?? null,
  });
});

router.put("/users/:id", requireFullAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const body = req.body as Record<string, unknown>;
  const updateData: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) updateData.name = body.name.trim();
  if ("email" in body) updateData.email = body.email || null;
  if (typeof body.active !== "undefined") updateData.active = body.active ? "true" : "false";

  if (Object.keys(updateData).length > 0) {
    const [user] = await db.update(usersTable).set(updateData).where(eq(usersTable.id, id)).returning();
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    if (updateData.name) {
      await db.update(adminAccountsTable).set({ displayName: updateData.name as string }).where(eq(adminAccountsTable.userId, id));
    }
  } else {
    const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
  }

  const roleIds: number[] = Array.isArray(body.roleIds)
    ? (body.roleIds as unknown[]).filter((v): v is number => typeof v === "number")
    : (typeof body.roleId === "number" ? [body.roleId] : []);
  if ("roleIds" in body || "roleId" in body) {
    await setUserRoles(id, roleIds);
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  const roles = await getUserRoles(id);
  const acct = await userWithAccount(id);

  res.json({
    ...user,
    roles,
    hasAccount: acct != null,
    accountId: acct?.id ?? null,
    accountUsername: acct?.username ?? null,
    accountActive: acct?.active ?? null,
  });
});

router.post("/users/:id/account", requireFullAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const validated = validateAccountBody(req.body);
  if ("error" in validated) {
    res.status(400).json({ error: validated.error });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const { username: uname, password } = validated;
  const conflict = await db.select({ id: adminAccountsTable.id })
    .from(adminAccountsTable)
    .where(eq(adminAccountsTable.username, uname))
    .limit(1);

  const existingAcct = await userWithAccount(id);
  if (conflict.length > 0 && conflict[0].id !== existingAcct?.id) {
    res.status(409).json({ error: "Username already taken" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  if (existingAcct) {
    await db.update(adminAccountsTable)
      .set({ username: uname, passwordHash, displayName: user.name, active: true, accountLevel: "user" })
      .where(eq(adminAccountsTable.id, existingAcct.id));
  } else {
    await db.insert(adminAccountsTable).values({
      username: uname, passwordHash, displayName: user.name, active: true, accountLevel: "user", userId: id,
    });
  }

  const acct = await userWithAccount(id);
  res.json({ hasAccount: true, accountUsername: acct!.username, accountActive: acct!.active });
});

router.patch("/users/:id/account/active", requireFullAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { active } = req.body as { active?: boolean };
  if (typeof active !== "boolean") { res.status(400).json({ error: "active must be boolean" }); return; }

  const acct = await userWithAccount(id);
  if (!acct) { res.status(404).json({ error: "No account for this user" }); return; }

  await db.update(adminAccountsTable).set({ active }).where(eq(adminAccountsTable.id, acct.id));
  res.json({ hasAccount: true, accountActive: active, accountUsername: acct.username });
});

router.delete("/users/:id/account", requireFullAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const acct = await userWithAccount(id);
  if (!acct) { res.status(404).json({ error: "No account for this user" }); return; }

  await db.delete(adminAccountsTable).where(eq(adminAccountsTable.id, acct.id));
  res.json({ hasAccount: false });
});

router.delete("/users/:id", requireFullAdmin, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [user] = await db.delete(usersTable).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  res.sendStatus(204);
});

export default router;

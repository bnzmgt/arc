import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, adminAccountsTable, usersTable, userRolesTable, rolesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/auth/me", (req, res): void => {
  if (!req.session?.adminId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json({
    id: req.session.adminId,
    username: req.session.adminUsername,
    displayName: req.session.adminDisplayName,
    accountLevel: req.session.accountLevel ?? "user",
  });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { username, password, website } = req.body as { username?: string; password?: string; website?: string };

  if (website) {
    await new Promise(r => setTimeout(r, 1200));
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  const [account] = await db
    .select()
    .from(adminAccountsTable)
    .where(eq(adminAccountsTable.username, username.trim().toLowerCase()))
    .limit(1);

  if (!account || !account.active) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  const valid = await bcrypt.compare(password, account.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  req.session.adminId = account.id;
  req.session.adminUsername = account.username;
  req.session.adminDisplayName = account.displayName;
  req.session.accountLevel = account.accountLevel ?? "user";

  res.json({
    id: account.id,
    username: account.username,
    displayName: account.displayName,
    accountLevel: account.accountLevel ?? "user",
  });
});

router.get("/auth/me/identity", async (req, res): Promise<void> => {
  if (!req.session?.adminId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [account] = await db
    .select({ id: adminAccountsTable.id, userId: adminAccountsTable.userId, displayName: adminAccountsTable.displayName })
    .from(adminAccountsTable)
    .where(eq(adminAccountsTable.id, req.session.adminId))
    .limit(1);

  if (!account?.userId) {
    res.json({ userId: null, name: account?.displayName ?? null, workflowStep: null, roleName: null });
    return;
  }

  const [user] = await db
    .select({ id: usersTable.id, name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, account.userId))
    .limit(1);

  const roles = await db
    .select({ id: rolesTable.id, name: rolesTable.name, workflowStep: rolesTable.workflowStep })
    .from(userRolesTable)
    .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id))
    .where(eq(userRolesTable.userId, account.userId));

  const workflowSteps = roles.map(r => r.workflowStep).filter(Boolean) as string[];
  res.json({
    userId: account.userId,
    name: user?.name ?? account.displayName,
    workflowStep: roles[0]?.workflowStep ?? null,
    workflowSteps,
    roleName: roles.map(r => r.name).filter(Boolean).join(", ") || null,
  });
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {
    res.clearCookie("archiveflow.sid");
    res.json({ ok: true });
  });
});

export default router;

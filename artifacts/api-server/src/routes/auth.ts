import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, adminAccountsTable } from "@workspace/db";
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
  const { username, password } = req.body as { username?: string; password?: string };

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

router.post("/auth/logout", (req, res): void => {
  req.session.destroy(() => {
    res.clearCookie("archiveflow.sid");
    res.json({ ok: true });
  });
});

export default router;

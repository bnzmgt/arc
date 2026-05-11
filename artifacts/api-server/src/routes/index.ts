import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import healthRouter from "./health";
import boxesRouter from "./boxes";
import rolesRouter from "./roles";
import usersRouter from "./users";
import statsRouter from "./stats";
import authRouter from "./auth";
import adminAccountsRouter from "./adminAccounts";

const router: IRouter = Router();

// ── Public routes (no auth required) ──────────────────────────────────────────
const PUBLIC: Array<{ method: string; pattern: RegExp }> = [
  { method: "POST", pattern: /^\/auth\/login$/ },
  { method: "GET",  pattern: /^\/auth\/me$/ },
  { method: "POST", pattern: /^\/auth\/logout$/ },
  { method: "GET",  pattern: /^\/healthz$/ },
  { method: "GET",  pattern: /^\/scan\// },
  { method: "POST", pattern: /^\/boxes\/\d+\/workflow$/ },
];

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const isPublic = PUBLIC.some(
    (r) => r.method === req.method && r.pattern.test(req.path)
  );
  if (isPublic) return next();

  if (!req.session?.adminId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

router.use(authMiddleware);

router.use(authRouter);
router.use(healthRouter);
router.use(boxesRouter);
router.use(rolesRouter);
router.use(usersRouter);
router.use(statsRouter);
router.use(adminAccountsRouter);

export default router;

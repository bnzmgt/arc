import type { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.adminId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.adminId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const level = req.session.accountLevel ?? "user";
  if (level !== "admin" && level !== "superadmin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.adminId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (req.session.accountLevel !== "superadmin") {
    res.status(403).json({ error: "Super admin access required" });
    return;
  }
  next();
}

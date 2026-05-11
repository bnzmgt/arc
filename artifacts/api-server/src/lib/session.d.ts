import "express-session";

declare module "express-session" {
  interface SessionData {
    adminId?: number;
    adminUsername?: string;
    adminDisplayName?: string;
    accountLevel?: string;
  }
}

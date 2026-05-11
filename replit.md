# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite (Tailwind CSS, shadcn/ui, Wouter routing, TanStack Query)

## Applications

### ArchiveFlow — Archive Tracker (`artifacts/archive-tracker`)
A full-stack archive tracking and workflow management system with:
- **Authentication**: username/password login protecting all admin routes; session-based auth with `express-session` + `bcryptjs`; default admin seeded on startup (username: `admin`, password: `admin123`)
- Box CRUD management (add/edit/delete archive boxes)
- 6-step workflow: Cleaning → Cataloging → Scanning → QC → Repacking → Returning
- Role-based access control (roles mapped to workflow steps)
- Team member management
- E-ticket generation per box with QR codes
- 58mm thermal label printing with large QR code at 200 DPI
- QR scan interface (`/scan/:ticketCode`) — mobile-friendly public page for field workers (no auth required)
- Short QR redirect (`/q/:ticketCode`) for compact QR codes
- Activity log page (`/activity-log`) — paginated audit trail with filters
- Dashboard with stats, workflow progress, and activity feed
- Works locally and in the cloud

### API Server (`artifacts/api-server`)
Express 5 backend serving all REST API endpoints under `/api`.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/archive-tracker run dev` — run frontend locally

## Database Schema

- `boxes` — archive boxes with ticket codes and status
- `workflow_steps` — per-box workflow steps (cleaning/cataloging/scanning/qc/repacking/returning)
- `roles` — team roles mapped to workflow steps
- `users` — team members with role assignments
- `activity_log` — audit trail of all workflow actions
- `admin_accounts` — admin login accounts (username, bcrypt password hash, displayName, active flag)

## Authentication

- Session-based auth via `express-session` (cookie name: `archiveflow.sid`)
- All `/api` routes protected except: `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`, `GET /healthz`, `GET /scan/*`, `POST /boxes/:id/workflow`
- Default admin seeded automatically on first startup: `admin` / `admin123`
- Frontend auth context at `artifacts/archive-tracker/src/contexts/auth.tsx`
- `RequireAuth` guard wraps all admin routes in the router

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

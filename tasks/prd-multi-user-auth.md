# PRD: Multi-User Authentication
**Brand Monitor — v1.1**
**Date:** 2026-05-24

---

## Introduction / Overview

Brand Monitor is currently a single-user app (hardcoded `settings` row `id=1`).
This feature adds passwordless magic-link auth, open registration, JWT sessions,
and multi-workspace support so one user can monitor multiple companies.

---

## Goals

1. Any visitor can register with just an email address — no password to forget.
2. Each registered user gets their own isolated data (workspaces, digests, delivery logs).
3. One user can create and switch between multiple workspaces (one per company/brand).
4. All existing API routes are protected — no data leaks to unauthenticated callers.
5. Zero new paid infra: stays on SQLite + Railway volume, Resend for magic-link emails.

---

## User Stories

- **As a new visitor**, I can enter my email and receive a magic link so I can sign in without a password.
- **As a returning user**, I can click my magic link and be signed back in automatically.
- **As a user**, I can create a new workspace by giving it a company name, so I can monitor multiple brands.
- **As a user**, I can switch between my workspaces from a dropdown, and each workspace has its own settings, digests, and delivery config.
- **As a user**, all my data is private — other users cannot see my workspaces or digests.
- **As a user**, my session persists for 7 days without needing to re-authenticate.

---

## Functional Requirements

### Auth
1. `POST /api/auth/request-link` — accepts `{ email }`, creates a one-time token, sends magic link via Resend.
2. `GET /api/auth/verify?token=<token>` — validates token (not expired, not used), marks token used, returns signed JWT `{ token, expiresAt }`.
3. JWT payload: `{ userId, email, iat, exp }`. Signed with `JWT_SECRET` env var. TTL: 7 days.
4. All `/api/*` routes (except `/api/auth/*` and `/health`) require `Authorization: Bearer <jwt>` header. Return `401` if missing or invalid.
5. Magic link tokens expire after 15 minutes. Tokens are stored hashed (SHA-256) in DB.
6. `POST /api/auth/logout` — client-side only (delete JWT from localStorage); no server state to clear.

### Data Model — new tables
7. `users` table: `id INTEGER PK`, `email TEXT UNIQUE`, `created_at TEXT`.
8. `magic_tokens` table: `id INTEGER PK`, `user_id INTEGER FK`, `token_hash TEXT`, `expires_at TEXT`, `used INTEGER DEFAULT 0`.
9. `workspaces` table: `id INTEGER PK`, `user_id INTEGER FK`, `name TEXT`, `created_at TEXT`.

### Data Model — migrations
10. `settings` table gains `workspace_id INTEGER` column (FK to workspaces). Existing row `id=1` is migrated: create a seed user (`seed@brand-monitor.local`) and a seed workspace, and link the existing settings row to it.
11. `digests` table gains `workspace_id INTEGER` column.
12. `delivery_log` table gains `workspace_id INTEGER` column.
13. All queries that previously filtered by `id=1` now filter by `workspace_id = <active workspace>`.

### Workspaces
14. `GET /api/workspaces` — list all workspaces for the authenticated user.
15. `POST /api/workspaces` — create a new workspace `{ name }`. Auto-creates a default settings row for it.
16. `DELETE /api/workspaces/:id` — delete workspace and all its data (settings, digests, delivery logs).
17. All existing settings/digest/delivery endpoints accept a `workspace_id` query param or header (e.g., `X-Workspace-Id`). If omitted, use the user's first workspace.

### Frontend
18. New `/login` page: email input + "Send magic link" button. No password field.
19. New `/auth/callback` page: reads `?token=` from URL, calls verify endpoint, stores JWT in `localStorage`, redirects to dashboard.
20. `AuthGuard` component wraps all pages — redirects to `/login` if no valid JWT in localStorage.
21. Workspace switcher dropdown in the top nav (shows current workspace name, lists others, + "New workspace" option).
22. On workspace switch, all data-fetching hooks re-fetch with the new `workspace_id`.

---

## Non-Goals (Out of Scope)

- Team/shared workspaces — each workspace is owned by exactly one user.
- Google OAuth or any third-party identity provider.
- Admin panel or user management UI.
- Email verification beyond the magic link itself.
- Password reset (there is no password).
- Rate limiting on magic link requests (v1.2 concern).
- PostgreSQL migration — stays on SQLite.

---

## Design Considerations

- **Login page** is minimal: centered card, email input, "Send me a link" button, confirmation state ("Check your inbox").
- **Workspace switcher** lives in the top nav bar (desktop) or hamburger menu (mobile). Shows initials/icon of current workspace.
- **Error states**: expired token → "This link has expired. Request a new one." Invalid token → "Invalid link." Already used → "This link has already been used."
- **JWT storage**: `localStorage` (acceptable for this app's threat model; no sensitive PII beyond email).

---

## Technical Considerations

- Use `jsonwebtoken` npm package for JWT sign/verify.
- Use `crypto.createHash('sha256')` (already in codebase) to hash magic link tokens before storage.
- Magic link URL format: `https://<frontend-domain>/auth/callback?token=<raw-token>`
- `JWT_SECRET` must be added to Railway Variables and `.env.example`.
- Auth middleware lives in `backend/middleware/auth.js` — applied in `server.js` before `apiRouter`.
- The scheduler (`cronManager.js`) runs server-side and calls `getSettingsInternal()` — it must be updated to loop over all active workspaces (not just `id=1`).
- Existing `getSettings()` / `getSettingsInternal()` / `saveSettings()` in `user.js` must accept a `workspaceId` parameter.

---

## Success Metrics

- A new user can register, receive a magic link, sign in, create a workspace, and run a digest within 3 minutes.
- Two different users' workspaces are fully isolated — no data cross-contamination.
- All existing features (digest run, email/WhatsApp delivery, scheduler) work per-workspace.
- No plaintext tokens stored in DB (SHA-256 hashed at rest).

---

## Open Questions

1. Should the seed migration for the existing `id=1` settings row be automatic on boot, or a one-time migration script?
2. Should `DELETE /api/workspaces/:id` be soft-delete (archived) or hard-delete?
3. What should the magic link email look like — plain text or branded HTML template?
4. Should the frontend workspace switcher support renaming a workspace inline?

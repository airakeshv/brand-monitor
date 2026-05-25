# Task List: Multi-User Authentication
**PRD:** [prd-multi-user-auth.md](prd-multi-user-auth.md)
**Branch:** `feature/multi-user-auth`

---

## Relevant Files

### Modified
- `backend/models/user.js` — add users/magic_tokens tables, workspaceId param on settings functions
- `backend/models/digest.js` — add workspace_id column, filter by workspaceId
- `backend/models/deliveryLog.js` — add workspace_id column, filter by workspaceId
- `backend/routes/api.js` — add auth + workspace routes, pass workspaceId to all settings calls
- `backend/scheduler/cronManager.js` — loop all active workspaces instead of single settings row
- `backend/server.js` — apply auth middleware before apiRouter
- `backend/services/digestService.js` — pass workspaceId through runDigest
- `frontend/src/App.jsx` — add /login + /auth/callback routes, wrap routes in AuthGuard + WorkspaceProvider
- `frontend/src/pages/Dashboard.jsx` — add X-Workspace-Id header to all API calls
- `frontend/src/pages/Settings.jsx` — add X-Workspace-Id header to all API calls
- `frontend/src/pages/History.jsx` — add X-Workspace-Id header to all API calls

### New
- `backend/middleware/auth.js` — JWT validation middleware
- `backend/services/authService.js` — generateToken, verifyToken, hashToken helpers
- `backend/models/workspace.js` — getWorkspaces, createWorkspace, deleteWorkspace
- `frontend/src/pages/Login.jsx` — magic link request page
- `frontend/src/pages/AuthCallback.jsx` — magic link verify + JWT store + redirect
- `frontend/src/components/AuthGuard.jsx` — redirect to /login if no valid JWT
- `frontend/src/utils/auth.js` — getToken, isLoggedIn, logout, authHeaders
- `frontend/src/context/WorkspaceContext.jsx` — active workspace state + switcher
- `frontend/src/components/WorkspaceSwitcher.jsx` — dropdown nav component

### Notes
- Never read node_modules/, .git/, dist/, pnpm-lock.yaml
- Test after each parent task with `pnpm dev` before moving on
- JWT_SECRET must be added to Railway Variables before deploying

---

## Instructions for Completing Tasks

**IMPORTANT:** Check off each task as you complete it by changing `- [ ]` to `- [x]`. Update after each sub-task, not just after finishing a parent task.

---

## Tasks

- [x] 0.0 Create feature branch
  - [x] 0.1 Run `git checkout -b feature/multi-user-auth`

- [x] 1.0 Database migrations
  - [x] 1.1 In `backend/models/user.js` — add `users` table: `id INTEGER PK, email TEXT UNIQUE, created_at TEXT`
  - [x] 1.2 In `backend/models/user.js` — add `magic_tokens` table: `id INTEGER PK, user_id INTEGER FK, token_hash TEXT, expires_at TEXT, used INTEGER DEFAULT 0`
  - [x] 1.3 Create `backend/models/workspace.js` — add `workspaces` table: `id INTEGER PK, user_id INTEGER FK, name TEXT, created_at TEXT`; export `getWorkspaces(userId)`, `createWorkspace(userId, name)`, `deleteWorkspace(id, userId)`
  - [x] 1.4 In `backend/models/user.js` — safe ALTER TABLE to add `workspace_id INTEGER` to `settings` (try/catch like `news_lookback`)
  - [x] 1.5 In `backend/models/digest.js` — safe ALTER TABLE to add `workspace_id INTEGER` to `digests`
  - [x] 1.6 In `backend/models/deliveryLog.js` — safe ALTER TABLE to add `workspace_id INTEGER` to `delivery_log`
  - [x] 1.7 In `backend/models/user.js` `initDB()` — seed migration on boot: if `users` table is empty, insert seed user `(email='seed@local')`, insert seed workspace `(user_id=1, name=company_name||'Default')`, set `workspace_id=1` on existing settings row `id=1`

- [x] 2.0 Backend auth API
  - [x] 2.1 Run `pnpm add jsonwebtoken` inside `backend/`
  - [x] 2.2 Create `backend/services/authService.js` — `hashToken(raw)` (SHA-256 hex), `generateMagicToken()` (returns `{ raw, hash, expiresAt }`), `signJWT(userId, email)` (7-day JWT signed with `JWT_SECRET`), `verifyJWT(token)` (returns payload or null)
  - [x] 2.3 In `backend/routes/api.js` — add `POST /api/auth/request-link`: accepts `{ email }`, upserts user row, inserts magic_token row (hashed), sends email via Resend with link `${FRONTEND_URL}/auth/callback?token=<raw>`
  - [x] 2.4 In `backend/routes/api.js` — add `GET /api/auth/verify`: reads `?token`, SHA-256 hashes it, looks up token row (not expired, not used), marks `used=1`, returns `{ token: signJWT(...), expiresAt }`
  - [x] 2.5 Create `backend/middleware/auth.js` — reads `Authorization: Bearer <jwt>`, calls `verifyJWT`, attaches `req.userId` and `req.userEmail`; returns 401 if missing or invalid
  - [x] 2.6 In `backend/server.js` — apply auth middleware to all `/api/*` except `/api/auth/*` and `/api/ping` using a selective middleware pattern
  - [x] 2.7 Add `JWT_SECRET=` and `FRONTEND_URL=` to `.env.example`

- [ ] 3.0 Backend workspace API
  - [ ] 3.1 In `backend/routes/api.js` — add `GET /api/workspaces` (calls `getWorkspaces(req.userId)`), `POST /api/workspaces` (calls `createWorkspace`, returns new workspace + its default settings row), `DELETE /api/workspaces/:id`
  - [ ] 3.2 Add workspace middleware to `api.js` — reads `X-Workspace-Id` header, verifies it belongs to `req.userId`, attaches `req.workspaceId`; fallback to user's first workspace if header absent
  - [ ] 3.3 Update `getSettings(workspaceId)`, `getSettingsInternal(workspaceId)`, `saveSettings(updates, workspaceId)` in `user.js` to filter by `workspace_id` instead of `id=1`
  - [ ] 3.4 Update all route handlers in `api.js` that call settings functions to pass `req.workspaceId`
  - [ ] 3.5 Update `saveDigest` in `digest.js` and `logDelivery` in `deliveryLog.js` to accept and store `workspace_id`
  - [ ] 3.6 Update `runDigest` in `digestService.js` to accept and forward `workspaceId` through to `saveDigest`
  - [ ] 3.7 Update `cronManager.js` `deliverWithRetry` — replace single `getSettingsInternal()` call with a loop over all workspaces that have `company_name` set; schedule one cron per workspace

- [ ] 4.0 Frontend auth
  - [ ] 4.1 Create `frontend/src/utils/auth.js` — `getToken()` (from localStorage), `isLoggedIn()` (token exists + not expired), `logout()` (remove from localStorage), `authHeaders()` (returns `{ Authorization: 'Bearer <token>' }`)
  - [ ] 4.2 Create `frontend/src/pages/Login.jsx` — centered card, email input, "Send magic link" onClick handler calling `POST /api/auth/request-link`, confirmation state "Check your inbox"
  - [ ] 4.3 Create `frontend/src/pages/AuthCallback.jsx` — on mount reads `?token` from URL, calls `GET /api/auth/verify?token=`, stores returned JWT in localStorage, redirects to `/`; shows error states for expired/invalid/used tokens
  - [ ] 4.4 Create `frontend/src/components/AuthGuard.jsx` — calls `isLoggedIn()`, redirects to `/login` if false, renders `children` if true
  - [ ] 4.5 In `frontend/src/App.jsx` — add `<Route path="/login" element={<Login />} />`, add `<Route path="/auth/callback" element={<AuthCallback />} />`, wrap existing routes with `<AuthGuard>`
  - [ ] 4.6 Add `authHeaders()` to every `fetch` call in `Dashboard.jsx`, `Settings.jsx`, `History.jsx`

- [ ] 5.0 Frontend workspace switcher
  - [ ] 5.1 Create `frontend/src/context/WorkspaceContext.jsx` — React context with `workspaces` list, `activeWorkspaceId`, `setActiveWorkspace(id)`, `refreshWorkspaces()`; fetches `GET /api/workspaces` on mount; stores active id in localStorage
  - [ ] 5.2 Create `frontend/src/components/WorkspaceSwitcher.jsx` — dropdown showing current workspace name, lists others, "＋ New workspace" option that opens an inline name-input modal calling `POST /api/workspaces`
  - [ ] 5.3 In `frontend/src/App.jsx` — wrap app in `<WorkspaceProvider>`, add `<WorkspaceSwitcher>` to the top nav bar
  - [ ] 5.4 Update `Dashboard.jsx`, `Settings.jsx`, `History.jsx` — read `activeWorkspaceId` from context, add `X-Workspace-Id: <id>` header to all API calls alongside `authHeaders()`
  - [ ] 5.5 In `WorkspaceContext` — on `setActiveWorkspace` trigger a custom event or context refresh so all pages re-fetch their data for the new workspace

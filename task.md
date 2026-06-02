# Brand Intelligence Monitor — Task Tracker
# Last updated: 2026-06-02

## Project Summary
Brand monitoring app that searches news, social media, and reviews for a company name,
generates an AI digest, and delivers it via email + WhatsApp + Slack on a daily schedule.

---

## What's Already Built

### Backend (`/backend`)
- [x] `server.js` — Express entry point
- [x] `routes/api.js` — All REST endpoints
- [x] `middleware/auth.js` — Auth middleware
- [x] `models/user.js` — SQLite user schema
- [x] `models/digest.js` — Digest history schema
- [x] `models/workspace.js` — Multi-workspace support
- [x] `models/deliveryLog.js` — Delivery logging
- [x] `services/searchService.js` — Serper API (news + India sources)
- [x] `services/llmRouter.js` — Multi-model LLM abstraction (Gemini default)
- [x] `services/digestService.js` — Digest generation logic
- [x] `services/digestPrompt.js` — LLM prompt builder
- [x] `services/digestValidator.js` — Schema validation
- [x] `services/emailService.js` — SendGrid email delivery (HTML + plain text)
- [x] `services/whatsappService.js` — Twilio WhatsApp delivery (5-8 line condensed)
- [x] `services/slackService.js` — Slack webhook delivery
- [x] `services/noiseFilter.js` — Keyword exclusion logic
- [x] `services/authService.js` — Magic link auth
- [x] `scheduler/cronManager.js` — node-cron + timezone scheduling
- [x] `scripts/migrate-encrypt-api-key.js` — AES-256 key migration

### Frontend (`/frontend/src`)
- [x] `App.jsx` — Root app + routing
- [x] `main.jsx` — Entry point
- [x] `pages/Dashboard.jsx` — Main page + Run Now button
- [x] `pages/Settings.jsx` — 5-tab settings page
- [x] `pages/History.jsx` — Past digests viewer
- [x] `pages/Login.jsx` — Magic link login
- [x] `pages/AuthVerify.jsx` — Auth token verification
- [x] `components/RunNow.jsx` — Streaming run button
- [x] `components/DigestPreview.jsx` — On-screen digest display
- [x] `components/SourceBadge.jsx` — Coloured source pill
- [x] `components/Navbar.jsx` — Navigation bar
- [x] `components/WorkspaceSwitcher.jsx` — Multi-workspace switcher
- [x] `context/WorkspaceContext.jsx` — Workspace state context
- [x] `utils/api.js` — API client helpers

### Features Delivered (from git history)
- [x] Core digest generation with Gemini 2.5 Flash (free default)
- [x] Serper news search with India source support
- [x] Executive/founder name tracking + mentions in digest
- [x] Email delivery via SendGrid
- [x] WhatsApp delivery via Twilio (scheduled + on-demand)
- [x] Slack webhook delivery
- [x] Multi-workspace support
- [x] Magic link authentication
- [x] AES-256 API key encryption
- [x] Timezone-aware scheduling (UTC stored, local display)
- [x] Digest history with correct local timestamps
- [x] Crisis flag detection
- [x] Noise/keyword filtering

---

## Known Issues / Recent Fixes
- WhatsApp scheduled delivery fixed (2026-06-02)
- History list UTC→local time display fixed
- timezone_label now computed server-side
- Serper 400/429 errors resolved (batching + retry logic)
- SendGrid replaces Resend (Railway SMTP port blocks)

---

## Pending / Next Up
- [x] Fix: digest.date off by one day in email — now overridden server-side using user's IANA timezone (2026-06-02)
- [x] Fix: History list shows wrong time (UTC created_at) — now shows digest.date + digest.timezone_label instead (2026-06-02)

---

## Notes
- Package manager: pnpm only
- Default LLM: gemini-2.5-flash (free tier, 1500 req/day)
- DB: SQLite (MVP), PostgreSQL planned for v1.1
- Deployment: Vercel (frontend) + Railway (backend)

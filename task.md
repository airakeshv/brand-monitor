# Brand Intelligence Monitor — Task Tracker
# Last updated: 2026-06-02 (gap analysis added)

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

## Recent Fixes
- [x] Fix: digest.date off by one day in email — server-side override using IANA timezone (2026-06-02)
- [x] Fix: History list shows wrong time — now uses digest.date + digest.timezone_label (2026-06-02)

---

## NOT YET BUILT — Gaps vs CLAUDE.md Spec

### Missing Backend Services (files don't exist)
- [ ] `services/reviewService.js` — scrape/search Trustpilot, Google Reviews, Glassdoor for company reviews; populate `reviews[]` in DigestSchema with real data (currently LLM-guessed)
- [ ] `services/aiVisibilityService.js` — query ChatGPT + Perplexity to check if company appears in AI answers; populate `ai_visibility[]` in DigestSchema
- [ ] `tests/e2e.js` — end-to-end test: run digest for "Tata Motors", assert all schema fields present, assert delivery logs created

### DigestSchema Fields Not Properly Populated
- [ ] `reviews[]` — no real review scraping; depends on LLM inference from search results. Needs `reviewService.js`
- [ ] `ai_visibility[]` — always empty; needs `aiVisibilityService.js` + ChatGPT/Perplexity API keys
- [ ] `sov` (Share of Voice) — `company_pct` always 0; needs competitor search results to compute real SOV
- [ ] `sparkline[7]` — always `[0,0,0,0,0,0,0]`; needs 7-day digest history lookup to compute daily sentiment scores

### Settings Schema Fields Not Wired Up
- [ ] `sources_enabled` — settings UI has no toggle per source; all sources always run
- [ ] `pause_from` / `pause_to` — pause scheduling window stored in DB but cronManager doesn't check it before firing
- [ ] `fallback_model` — setting exists but llmRouter doesn't auto-retry with fallback on primary LLM failure
- [ ] `dev_webhook` — stored in settings but no code sends test payload to it
- [ ] `competitor_names` in search — settings accepts competitor names but searchService doesn't search for them to populate `competitor_signals[]`

### Other Missing Integrations
- [ ] Reddit search via snoowrap — mentioned in CLAUDE.md API integrations, no snoowrap usage anywhere in codebase
- [ ] Claude Haiku 4.5 crisis spike detection — mentioned as "crisis spike detection only" but llmRouter just uses the same model for everything; no Haiku-specific crisis check
- [ ] Digest language support — `digest_language` setting exists but prompt doesn't enforce non-English output

### v1.1 Roadmap (not urgent)
- [ ] PostgreSQL migration (replace SQLite for multi-user scale)
- [ ] Multi-user onboarding flow (currently single-user magic link only)

---

## Notes
- Package manager: pnpm only
- Default LLM: gemini-2.5-flash (free tier, 1500 req/day)
- DB: SQLite (MVP), PostgreSQL planned for v1.1
- Deployment: Vercel (frontend) + Railway (backend)

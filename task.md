# Brand Intelligence Monitor — Task Tracker
# Last updated: 2026-06-03

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

## Fixes Completed — 2026-06-03 (Today)

### 1. Digest date off by one day in email (c057f98)
- `digestService.js`: `digest.date` was LLM-generated (hallucinated UTC date)
- Now overridden server-side using `format(new Date(), 'yyyy-MM-dd', { timeZone: userTz })`
- Email header now correctly shows "3 Jun 2026 · 8:00 AM IST"

### 2. History list showing wrong time — 3 fixes stacked (c057f98, dc76032, e9bfa81)
- `History.jsx`: replaced `created_at` display with `digest.date + digest.timezone_label`
- `fmtDate` bug: was checking `iso.includes('T')` to skip Z; API returns T-without-Z so browser parsed as local time → now checks for Z or + only, always appends Z for UTC
- Hardcoded `'en-IN'` locale replaced with `undefined` (browser locale) → US users see "Jun 3, 2026", India sees "3 Jun 2026"

### 3. Timezone display works per user location (e9bfa81)
- Confirmed: `Settings.jsx` auto-detects `Intl.DateTimeFormat().resolvedOptions().timeZone` on first setup
- `buildTimezoneLabel` maps IANA → abbreviation (ET/PT/CT/IST/GMT etc.)
- Email, history preview, history list all show correct timezone label for any country

### 4. Magic link auth loop fixed (02b4d52)
- `Login.jsx`: if token in localStorage → redirect to `/dashboard` (was showing login form to logged-in users)
- `api.js` (`authFetch`): any 401 response → clears token + redirects to `/login` (was silently failing)
- `WorkspaceContext.jsx`: 401 on workspace load → clear token + redirect (was leaving user on blank broken app)

### 5. Magic link email going to SPAM fixed (607a0dc)
- Rebuilt HTML: white background, proper DOCTYPE, preheader text (dark HTML was matching phishing signatures)
- Disabled SendGrid click + open tracking (tracking redirect URLs trigger spam filters)
- Added `replyTo` header + proper plain-text fallback
- Removed `console.log` of email addresses (security rule fix)
- **User must also**: verify domain in SendGrid + set `SENDGRID_FROM` to own domain (not Gmail)

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

# Brand Intelligence Monitor — Task List
**Scope:** Core + delivery | Single user | User-selectable LLM | Local only | All MVP sources

---

## Relevant Files

- `backend/server.js` — Express entry point, loads env, mounts routes
- `backend/routes/api.js` — All REST endpoints
- `backend/services/searchService.js` — Serper API, all source queries
- `backend/services/llmRouter.js` — Multi-model LLM abstraction
- `backend/services/emailService.js` — Resend HTML email delivery
- `backend/services/whatsappService.js` — Twilio WhatsApp delivery
- `backend/services/slackService.js` — Slack webhook delivery
- `backend/services/noiseFilter.js` — Keyword exclusion logic
- `backend/scheduler/cronManager.js` — node-cron + timezone scheduling
- `backend/models/user.js` — SQLite settings schema
- `backend/models/digest.js` — Digest history schema
- `backend/tests/e2e.js` — End-to-end test script
- `frontend/src/App.jsx` — Root component + routing
- `frontend/src/pages/Dashboard.jsx` — Main page + Run Now
- `frontend/src/pages/Settings.jsx` — 5-tab settings page
- `frontend/src/pages/History.jsx` — Past digests
- `frontend/src/components/RunNow.jsx` — Streaming run button
- `frontend/src/components/DigestPreview.jsx` — On-screen digest display
- `frontend/src/components/SourceBadge.jsx` — Coloured source pill
- `pnpm-workspace.yaml` — Monorepo workspace config
- `package.json` — Root scripts (dev, build, lint, test)
- `.env` — API keys (never commit)

### Notes
- Package manager: pnpm always — never npm or yarn
- No `<form>` tags anywhere — use onClick handlers only
- All async functions wrapped in try/catch
- Never console.log API keys, emails, or user data
- Run backend tests: `cd backend && pnpm test`

---

## Instructions for Completing Tasks

**IMPORTANT:** Check off each task as you complete it by changing `- [ ]` to `- [x]`. Update after each sub-task, not just after finishing a parent task.

---

## Tasks

- [x] 0.0 Create feature branch
  - [x] 0.1 Run `git checkout -b feature/brand-monitor-mvp` inside `brand-monitor/`

---

- [x] 1.0 Project scaffolding
  - [x] 1.1 Create `pnpm-workspace.yaml` listing `backend` and `frontend` packages
  - [x] 1.2 Create root `package.json` with `dev`, `build`, `lint`, `test` scripts using `concurrently`
  - [x] 1.3 Scaffold `backend/` — `package.json`, install: `express cors dotenv better-sqlite3 node-cron date-fns-tz crypto-js axios snoowrap`
  - [x] 1.4 Create `backend/server.js` — Express app, load `.env`, mount `/api` router, start on PORT 3001
  - [x] 1.5 Create `backend/routes/api.js` — Router stub with placeholder endpoints
  - [x] 1.6 Create `backend/models/user.js` — SQLite `settings` table matching Settings Schema in CLAUDE.md
  - [x] 1.7 Create `backend/models/digest.js` — SQLite `digests` table (id, company, date, json, delivered_at)
  - [x] 1.8 Scaffold `frontend/` — Vite + React, install Tailwind CSS v3, configure `tailwind.config.js` with design tokens from `design.md`
  - [x] 1.9 Create `frontend/src/App.jsx` — root component with React Router routes: `/`, `/settings`, `/history`
  - [x] 1.10 Verify `pnpm dev` starts both backend (port 3001) and frontend (port 5173) without errors

---

- [x] 2.0 Multi-source search engine
  - [x] 2.1 Create `backend/services/searchService.js` — Serper API client, reads `SERPER_API_KEY` from env
  - [x] 2.2 Add `searchIndiaNews(company)` — queries TOI, ET, HT, Moneycontrol, NDTV using `site:` filters
  - [x] 2.3 Add `searchGlobalNews(company)` — queries Reuters, BBC via Serper general news
  - [x] 2.4 Add `searchReddit(company)` — snoowrap Reddit API, reads `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET`
  - [x] 2.5 Add `searchReviews(company)` — Google Reviews, Glassdoor, G2, X/Twitter via Serper Places + site: filters
  - [x] 2.6 Add `searchAll(company, settings)` — aggregates all sources, applies enabled/disabled flags from settings
  - [x] 2.7 Create `backend/services/noiseFilter.js` — filters results by `exclude_keywords` and `exclude_domains` from settings
  - [x] 2.8 Add `POST /api/search` endpoint in `api.js` — accepts `{ company }`, returns raw aggregated results
  - [x] 2.9 Test with company name "Tata Motors" — verify results return from at least 3 sources

---

- [x] 3.0 LLM Router + digest generation
  - [x] 3.1 Create `backend/services/llmRouter.js` — `LLMRouter` class with `route(model, apiKey, prompt)` method
  - [x] 3.2 Add Gemini 2.5 Flash adapter — uses `GEMINI_API_KEY`, default + fallback model
  - [x] 3.3 Add OpenAI GPT-4o Mini adapter — uses `OPENAI_API_KEY`
  - [x] 3.4 Add Anthropic Claude adapter — uses `ANTHROPIC_API_KEY`
  - [x] 3.5 Add Perplexity adapter stub — uses `PERPLEXITY_API_KEY`
  - [x] 3.6 Write unified digest prompt template
  - [x] 3.7 Add DigestSchema validator
  - [x] 3.8 Add fallback logic
  - [x] 3.9 Add POST /api/digest endpoint
  - [x] 3.1 Create `backend/services/llmRouter.js` — `LLMRouter` class with `route(model, apiKey, prompt)` method

---

- [x] 4.0 Delivery layer
  - [x] 4.1 emailService.js created
  - [x] 4.2 HTML email template built
  - [x] 4.3 whatsappService.js created
  - [x] 4.4 slackService.js created
  - [x] 4.5 cronManager.js created
  - [x] 4.6 delivery wired after digest
  - [x] 4.7 schedule endpoints added
  - [x] 4.8 run-now SSE endpoint added
  - [x] 4.9 email delivery tested

---

- [x] 5.0 Frontend
  - [x] 5.1 Apply design tokens from `design.md` globally in `frontend/src/index.css` (colours, fonts, spacing, radius)
  - [x] 5.2 Build `frontend/src/components/SourceBadge.jsx` — coloured pill per source (TOI=orange, Reddit=red, G2=purple, etc.)
  - [x] 5.3 Build `frontend/src/components/DigestPreview.jsx` — renders DigestSchema sections: news, social, reviews, crisis flag
  - [x] 5.4 Build `frontend/src/components/RunNow.jsx` — button with 3 states: idle / streaming (SSE progress) / done
  - [x] 5.5 Build `frontend/src/pages/Dashboard.jsx` — company name input (onClick, no form tag), Run Now button, DigestPreview below
  - [x] 5.6 Build `frontend/src/pages/Settings.jsx` — 5 tabs: Company | Sources | LLM | Delivery | Schedule
    - [x] 5.6a Company tab — company name, competitor names, executive names, include/exclude keywords
    - [x] 5.6b Sources tab — toggle switches for each source (India news, global, Reddit, reviews)
    - [x] 5.6c LLM tab — model picker dropdown (Gemini/OpenAI/Claude/Perplexity), API key input (masked), shown on first visit
    - [x] 5.6d Delivery tab — email address, WhatsApp number, Slack webhook URL inputs
    - [x] 5.6e Schedule tab — delivery time picker, frequency (daily/weekly), timezone selector, pause date range
  - [x] 5.7 Build `frontend/src/pages/History.jsx` — list of past digests from `GET /api/history`, click to expand DigestPreview
  - [x] 5.8 Add `GET /api/settings` and `PUT /api/settings` endpoints in `api.js`, wire to Settings page save button
  - [x] 5.9 Add `GET /api/history` endpoint in `api.js`, returns last 30 digests from SQLite
  - [x] 5.10 Final smoke test — servers running, backend healthy, frontend at localhost:5173, history has data

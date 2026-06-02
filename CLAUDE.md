# Brand Intelligence Monitor — CLAUDE.md
# Keep this file under 200 lines. Every line costs tokens every session.

## Project
Brand monitoring app: searches news + social + reviews for a company name,
generates AI digest, delivers via email + WhatsApp + Slack daily on schedule.

## Stack
- Frontend: React + Tailwind CSS → Vercel
- Backend: Node.js + Express → Railway
- Package manager: pnpm (always use pnpm, never npm or yarn)
- Database: SQLite (MVP) → PostgreSQL (v1.1)
- Scheduler: node-cron + date-fns-tz for timezone handling

## Commands
```
pnpm dev          # start both frontend and backend
pnpm test         # run tests
pnpm build        # build for production
pnpm lint         # ESLint check
```

## Folder Structure
```
/backend
  server.js              # Express entry point
  /routes
    api.js               # all REST endpoints
  /services
    searchService.js     # Serper API calls
    llmRouter.js         # multi-model LLM abstraction
    emailService.js      # Resend.com delivery
    whatsappService.js   # Twilio WhatsApp delivery
    reviewService.js     # review site monitoring
    aiVisibilityService.js # ChatGPT/Perplexity visibility check
    noiseFilter.js       # keyword exclusion logic
  /scheduler
    cronManager.js       # node-cron + timezone scheduling
  /models
    user.js              # SQLite user schema
    digest.js            # digest history schema
  /tests
    e2e.js               # end-to-end test script

/frontend
  /src
    App.jsx
    /pages
      Dashboard.jsx      # main page + Run Now button
      Settings.jsx       # 5-tab settings page
      History.jsx        # past digests
    /components
      RunNow.jsx         # streaming run button
      DigestPreview.jsx  # on-screen digest display
      SourceBadge.jsx    # coloured source pill component
```

## FORBIDDEN — Never Read These
- node_modules/
- .git/
- dist/
- build/
- pnpm-lock.yaml
- *.log files
- /frontend/public/

## Token Rules — Follow Every Session
1. Read ONLY the file(s) relevant to the current task
2. Explicitly state which files you are reading before reading them
3. Never read more than 3 files per task without asking first
4. Use subagents for investigation tasks — keep main context clean
5. Batch related edits into one operation — never edit same file twice in one session
6. After completing a task, confirm with one line: "Done — [what was done]"

## Code Rules
- No HTML <form> tags anywhere — use onClick handlers only
- All API keys encrypted with AES-256 before storage — never in plain text
- All scheduled times stored in UTC — convert to user IANA timezone at runtime
- Never log API keys, email addresses, or user data to console
- Use async/await — no callback hell, no .then() chains
- Error handling: every async function wrapped in try/catch
- Comments: one line above each function explaining what it does

## API Integrations
- Serper API: use site: filters for India sources (timesofindia.com, economictimes.com, ndtv.com, hindustantimes.com, moneycontrol.com)
- Gemini 2.5 Flash: DEFAULT model — free tier, 1500 req/day, use for all digest generation until user sets their own key
- Claude Haiku 4.5: crisis spike detection only (fast + cheap)
- Resend.com: email delivery — HTML with plain text fallback
- Twilio: WhatsApp delivery — condensed 5-8 line digest only
- node-cron: all scheduling — store times in UTC, convert via date-fns-tz
- snoowrap: Reddit API wrapper

## LLM Router — Supported Models
claude-sonnet-4-6 | gemini-2.5-flash (default) | gpt-4o-mini | 
deepseek-v4 | groq-llama-70b | perplexity-api | mistral-large

## DigestSchema (standard output format — all LLMs must return this)
```json
{
  "company": "string",
  "date": "ISO date",
  "timezone_label": "string (e.g. 8:00 AM IST)",
  "model_used": "string",
  "news": [{"title","source","url","sentiment","emotion","snippet"}],
  "social": [{"title","source","url","sentiment","snippet"}],
  "reviews": [{"platform","rating","excerpt","urgency","draft_response"}],
  "ai_visibility": [{"engine","summary","accuracy_flag"}],
  "competitor_signals": [{"company","signal_type","detail"}],
  "corporate_events": [{"type","headline","implication"}],
  "keywords": ["string"],
  "sov": {"company_pct": 0, "competitors": []},
  "sparkline": [0,0,0,0,0,0,0],
  "crisis_flag": {"triggered": false, "reason": ""},
  "watch_out": "string or null"
}
```

## Settings Schema (stored per user in SQLite)
```json
{
  "company_name": "string",
  "competitor_names": ["string"],
  "executive_names": ["string"],
  "include_keywords": ["string"],
  "exclude_keywords": ["string"],
  "exclude_domains": ["string"],
  "llm_model": "gemini-2.5-flash",
  "llm_api_key": "AES256_encrypted_string",
  "fallback_model": "gemini-2.5-flash",
  "digest_language": "English",
  "timezone": "Asia/Kolkata",
  "delivery_time": "08:00",
  "frequency": "daily",
  "pause_from": null,
  "pause_to": null,
  "email": "string",
  "whatsapp": "string",
  "slack_webhook": "string",
  "dev_webhook": "string",
  "crisis_sensitivity": "medium",
  "review_threshold": 3,
  "sources_enabled": {}
}
```

## Cost Targets
- Build phase: $0 (use Claude Code Pro plan, Gemini free tier)
- Per digest (Gemini free): $0
- Per digest (Claude Sonnet): ~$0.003
- Monthly infra (1 user): <$5 (Vercel free + Railway $5 credit)
- Monthly infra (100 users): ~$25

## When Compacting
Always preserve:
1. The DigestSchema structure
2. The Settings Schema structure  
3. The list of supported LLM models
4. Current task completion status

## Definition of Done
A feature is done when:
1. Code written and saved
2. No console.log with sensitive data
3. Error handling present
4. Tested with at least one real company name (e.g. "Tata Motors")
5. Changes committed and pushed to GitHub (`git push origin main`)

## Git Workflow — Run After Every Task
```
git add <changed files>          # stage only relevant files (never git add -A)
git commit -m "type: short why"  # feat / fix / chore
git push origin main             # always push — Vercel and Railway auto-deploy from main
```
- Commit message format: `fix: what was broken and why` or `feat: what was added`
- Always update task.md status before committing
- Never commit: .env, *.log, node_modules, pnpm-lock.yaml

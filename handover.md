# Brand Monitor — Project Handover
Last updated: 2026-06-23 (session 2)

---

## Live Deployment

| Layer    | URL                                                   |
|----------|-------------------------------------------------------|
| Frontend | https://brand-monitor-two.vercel.app                  |
| Backend  | https://backend-production-ab624.up.railway.app       |

- **Auth**: Magic link via Resend → JWT stored in `localStorage` as `bm_token`
- **Database**: SQLite at `/data/brand-monitor.db` on Railway persistent Volume

---

## Features Built — 24 of 32

| # | Feature | Notes |
|---|---------|-------|
| 1 | React frontend | Deployed on Vercel |
| 2 | Node.js backend | Deployed on Railway |
| 3 | Magic link auth | JWT-protected routes |
| 4 | Settings page | 5 tabs, AES-256 key encryption |
| 5 | Multi-source search | 15 sources via Serper API |
| 6 | LLM router | 7 models; Gemini 2.5 Flash free default |
| 7 | AI digest generation | Full DigestSchema output |
| 8 | Sentiment scoring | 6 levels (strongly_positive → strongly_negative) |
| 9 | News vs Social categorisation | Auto-splits by source domain |
| 10 | Review monitoring | Glassdoor, G2, Trustpilot |
| 11 | Corporate event detection | Earnings, launches, leadership changes |
| 12 | Crisis alert detection | Flag + reason in digest |
| 13 | Competitor signals | Tracked alongside primary company |
| 14 | Email delivery | Resend.com — HTML + plain text |
| 15 | Run Now | Streaming SSE pipeline |
| 16 | Daily scheduler | 8 AM IST, UTC-correct via node-cron |
| 17 | Digest history page | Browsable past digests |
| 18 | Multi-company tracking | Up to 5 companies per workspace |
| 19 | Plan tier system | Free and Pro tiers |
| 20 | Executive name tracking | Mentions surfaced in digest |
| 21 | WhatsApp delivery | Twilio sandbox (join code required every 72h) |
| 22 | Pricing page | Free vs Pro cards, dark theme, `/pricing` route, Navbar CTA |
| 23 | Landing page | Hero, ticker, How It Works, Features, Pricing preview, Footer |
| 24 | Navbar Pricing link | Desktop + mobile, styled as purple outlined CTA button |
| — | UI polish | Spinners, toasts, empty states, mobile responsive |

---

## Next to Build — Phase 2

| # | Feature | Status |
|---|---------|--------|
| 25 | Razorpay billing | Pricing page UI done; payment flow + webhook not yet wired |
| 26 | Custom domain | Not started |
| 27 | Resend domain verification | Not started |
| 28 | Digest pause / vacation mode | Not started |

---

## Pending — Phase 3

| # | Feature |
|---|---------|
| 26 | AI chatbot visibility (ChatGPT / Perplexity check) |
| 27 | Share of Voice (SOV %) |
| 28 | Weekly Sunday digest |
| 29 | Slack + webhook delivery |
| 30 | Hindi language monitoring |
| 31 | PWA (offline / install) |
| 32 | Misinformation detection |

---

## Critical Notes — Read Before Launch

1. **HMAC validation in magic-link auth** — must be audited and confirmed before paying customers are onboarded.
2. **Razorpay keys** — test keys are set in Railway env vars. Switch to live keys after Razorpay KYC approval.
3. **Resend sender restriction** — email delivery only works to `airakeshv@gmail.com` until a custom domain is verified in Resend.
4. **All users are set to Pro plan** in the SQLite DB — revert to Free tier logic before billing goes live.
5. **WhatsApp Twilio sandbox** — sandbox session expires every 72 h of inactivity. User must re-send the join code from their number to `+1 415 523 8886` on WhatsApp to restore delivery. Production fix: upgrade to a Twilio WhatsApp Business number.

---

## Known Fallbacks Active

- **Serper quota exhausted** → Gemini web search grounding auto-activates as fallback (no Serper credits needed).
- **News links** — titles without a valid `http` URL render as plain text (not broken links) in both email and dashboard.

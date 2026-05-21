import { format } from 'date-fns-tz';

// build the unified digest prompt sent to every LLM model
export function buildDigestPrompt(company, results, settings = {}) {
  const timezone = settings.timezone || 'Asia/Kolkata';
  const now = format(new Date(), "yyyy-MM-dd'T'HH:mm:ssXXX", { timeZone: timezone });
  const timezoneLabel = format(new Date(), 'h:mm a zzz', { timeZone: timezone });
  const language = settings.digest_language || 'English';

  const resultsText = results
    .slice(0, 60)
    .map(r => `[${r.source_category?.toUpperCase() || 'NEWS'}] ${r.title || ''} — ${r.snippet || ''} (${r.link || r.url || ''})`)
    .join('\n');

  return `You are a brand intelligence analyst. Analyse the following search results about "${company}" and return a JSON digest.

DATE: ${now}
TIMEZONE: ${timezoneLabel}
LANGUAGE: ${language}

SEARCH RESULTS:
${resultsText}

Return ONLY valid JSON matching this exact schema — no markdown, no explanation:
{
  "company": "${company}",
  "date": "ISO date string",
  "timezone_label": "${timezoneLabel}",
  "model_used": "to be filled by router",
  "news": [{"title": "", "source": "", "url": "", "sentiment": "positive|neutral|negative|mixed", "emotion": "", "snippet": ""}],
  "social": [{"title": "", "source": "", "url": "", "sentiment": "", "snippet": ""}],
  "reviews": [{"platform": "", "rating": 0, "excerpt": "", "urgency": "CRITICAL|HIGH|WATCH", "draft_response": ""}],
  "ai_visibility": [],
  "competitor_signals": [{"company": "", "signal_type": "", "detail": ""}],
  "corporate_events": [{"type": "", "headline": "", "implication": ""}],
  "keywords": [""],
  "sov": {"company_pct": 0, "competitors": []},
  "sparkline": [0,0,0,0,0,0,0],
  "crisis_flag": {"triggered": false, "reason": ""},
  "watch_out": null
}

Rules:
- Include ALL relevant news items up to 15 (do not summarise or drop articles — list every distinct story found), 3–5 social items, all reviews found
- Sentiment must be one of: positive, neutral, negative, mixed, strongly_positive, strongly_negative
- Flag crisis_flag.triggered = true if you see fraud, lawsuit, scam, data breach, or viral negative coverage
- Extract top 5–8 keywords from all results combined
- draft_response for reviews must be under 80 words, professional and empathetic
- Return ONLY the JSON object`;
}

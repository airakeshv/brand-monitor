import { format } from 'date-fns-tz';

// build the unified digest prompt sent to every LLM model
export function buildDigestPrompt(company, results, settings = {}) {
  const timezone = settings.timezone || 'Asia/Kolkata';
  const now = format(new Date(), "yyyy-MM-dd'T'HH:mm:ssXXX", { timeZone: timezone });
  const timezoneLabel = format(new Date(), 'h:mm a zzz', { timeZone: timezone });
  const language = settings.digest_language || 'English';

  const resultsText = results
    .slice(0, 60)
    .map(r => {
      const cat = r.source_category?.toUpperCase() || 'NEWS';
      const tag = (cat === 'EXECUTIVE' && r.person_badge)
        ? `[EXECUTIVE: ${r.person_badge}]`
        : `[${cat}]`;
      return `${tag} ${r.title || ''} — ${r.snippet || ''} (${r.link || r.url || ''})`;
    })
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
  "reviews": [{"platform": "", "rating": null, "excerpt": "", "urgency": "CRITICAL|HIGH|WATCH", "draft_response": ""}],
  "executive_mentions": [{"person_name": "", "role": "", "title": "", "source": "", "url": "", "sentiment": "", "snippet": ""}],
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
- For [REVIEW] tagged results: always create a review entry — use the snippet as excerpt, set platform from source name, infer urgency from tone (negative/complaint = CRITICAL, concern = HIGH, positive/neutral = WATCH), set rating to null if not stated, write a draft_response
- draft_response for reviews must be under 80 words, professional and empathetic
- For [EXECUTIVE: Name] tagged results: create an executive_mentions entry — set person_name from the name in the tag, infer role from context (CEO/MD/Founder etc.), fill title/source/url/sentiment/snippet from the result. If no [EXECUTIVE] results exist, return executive_mentions as []
- Return ONLY the JSON object`;
}

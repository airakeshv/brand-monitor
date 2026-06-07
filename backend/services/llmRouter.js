import axios from 'axios';

// retry an async fn up to maxRetries times on 503/429, with exponential backoff
async function withRetry(fn, maxRetries = 2) {
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = err.response?.status;
      if ((status === 503 || status === 429) && attempt < maxRetries) {
        const wait = (attempt + 1) * 2000;
        await new Promise(r => setTimeout(r, wait));
        lastErr = err;
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// build a rule-based digest from raw search results when all LLMs are unavailable
export function buildBasicDigest(company, results = [], timezone_label = 'UTC') {
  const today = new Date().toISOString().split('T')[0];
  const newsCategories = new Set(['india_news', 'global_news', 'news']);

  const news = results
    .filter(r => newsCategories.has(r.source_category) || !r.source_category)
    .slice(0, 5)
    .map(r => ({
      title: r.title || '',
      source: r.source || r.displayLink || '',
      url: r.link || r.url || '',
      sentiment: 'neutral',
      emotion: '',
      snippet: r.snippet || '',
    }));

  const social = results
    .filter(r => r.source_category === 'social')
    .slice(0, 3)
    .map(r => ({
      title: r.title || '',
      source: r.source || '',
      url: r.link || r.url || '',
      sentiment: 'neutral',
      snippet: r.snippet || '',
    }));

  const executives = results
    .filter(r => r.source_category === 'executive')
    .slice(0, 5)
    .map(r => ({
      person:    r.person_badge || '',
      title:     r.title || '',
      source:    r.source || r.displayLink || '',
      url:       r.link || r.url || '',
      sentiment: 'neutral',
      snippet:   r.snippet || '',
    }));

  const digest = {
    company,
    date: today,
    timezone_label,
    model_used: 'rule-based (LLM unavailable)',
    news,
    social,
    executive_mentions: executives,
    reviews: [],
    ai_visibility: [],
    competitor_signals: [],
    corporate_events: [],
    keywords: [],
    sov: { company_pct: 0, competitors: [] },
    sparkline: [0, 0, 0, 0, 0, 0, 0],
    crisis_flag: { triggered: false, reason: '' },
    watch_out: 'AI analysis unavailable — showing raw search results only. LLM services were temporarily down.',
  };

  return { text: JSON.stringify(digest), model_used: 'rule-based (LLM unavailable)' };
}

// route a prompt to the chosen LLM — waterfall: primary → user fallback → system Gemini → rule-based
// fallbackModel/fallbackApiKey: user's chosen backup model + its key (from settings)
// context = { company, results } is used only for the rule-based last resort
export async function routeLLM(model, apiKey, prompt, context = {}, fallbackModel = null, fallbackApiKey = null) {
  let primaryErr;

  // step 1 — try primary model
  try {
    switch (model) {
      case 'gemini-2.5-flash':
        return await withRetry(() => callGemini(apiKey || process.env.GEMINI_API_KEY, prompt));
      case 'gpt-4o-mini':
        return await callOpenAI(apiKey || process.env.OPENAI_API_KEY, prompt);
      case 'claude-sonnet-4-6':
        return await callClaude(apiKey || process.env.ANTHROPIC_API_KEY, prompt);
      case 'perplexity-api':
        return await callPerplexity(apiKey || process.env.PERPLEXITY_API_KEY, prompt);
      default:
        throw new Error(`Unsupported model: ${model}`);
    }
  } catch (err) {
    primaryErr = err;
    console.error(`Primary model ${model} failed: ${err.message}`);
  }

  // step 2 — user's chosen backup model (with their backup key; Gemini backup is always free)
  if (fallbackModel && fallbackModel !== model) {
    const fbKey = fallbackModel === 'gemini-2.5-flash'
      ? (fallbackApiKey || process.env.GEMINI_API_KEY)
      : fallbackApiKey; // paid backup — only attempt if user supplied a key
    if (fbKey) {
      try {
        console.error(`Falling back to user backup: ${fallbackModel}`);
        switch (fallbackModel) {
          case 'gemini-2.5-flash':
            return await withRetry(() => callGemini(fbKey, prompt, true));
          case 'gpt-4o-mini':
            return await callOpenAI(fbKey, prompt);
          case 'claude-sonnet-4-6':
            return await callClaude(fbKey, prompt);
          case 'perplexity-api':
            return await callPerplexity(fbKey, prompt);
        }
      } catch (err) {
        console.error(`Backup model ${fallbackModel} failed: ${err.message}`);
      }
    }
  }

  // step 3 — last resort: system Gemini (free tier, always available unless both above already tried it)
  const alreadyTriedGemini = model === 'gemini-2.5-flash' || fallbackModel === 'gemini-2.5-flash';
  if (!alreadyTriedGemini && process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'add_later') {
    try {
      console.error('Final fallback to system Gemini 2.5 Flash');
      return await withRetry(() => callGemini(process.env.GEMINI_API_KEY, prompt, true));
    } catch (err) {
      console.error(`System Gemini fallback failed: ${err.message}`);
    }
  }

  // step 4 — rule-based digest from raw search results (never shows 503)
  if (context.company && context.results?.length > 0) {
    console.error('All LLMs unavailable — returning rule-based digest');
    return buildBasicDigest(context.company, context.results, context.timezone_label);
  }

  throw primaryErr;
}

// Gemini 2.5 Flash via Google GenAI REST
async function callGemini(apiKey, prompt, isFallback = false) {
  if (!apiKey || apiKey === 'add_later') throw new Error('Gemini API key not set');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const res = await axios.post(url, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json' },
  });
  const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned empty response');
  return { text, model_used: isFallback ? 'gemini-2.5-flash (fallback)' : 'gemini-2.5-flash' };
}

// OpenAI GPT-4o Mini
async function callOpenAI(apiKey, prompt) {
  if (!apiKey || apiKey === 'add_later') throw new Error('OpenAI API key not set');
  const res = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    },
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );
  const text = res.data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('OpenAI returned empty response');
  return { text, model_used: 'gpt-4o-mini' };
}

// Anthropic Claude Sonnet
async function callClaude(apiKey, prompt) {
  if (!apiKey || apiKey === 'add_later') throw new Error('Anthropic API key not set');
  const res = await axios.post(
    'https://api.anthropic.com/v1/messages',
    {
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    },
    {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
    }
  );
  const text = res.data?.content?.[0]?.text;
  if (!text) throw new Error('Claude returned empty response');
  return { text, model_used: 'claude-sonnet-4-6' };
}

// Perplexity API
async function callPerplexity(apiKey, prompt) {
  if (!apiKey || apiKey === 'add_later') throw new Error('Perplexity API key not set');
  const res = await axios.post(
    'https://api.perplexity.ai/chat/completions',
    {
      model: 'llama-3.1-sonar-large-128k-online',
      messages: [{ role: 'user', content: prompt }],
    },
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );
  const text = res.data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Perplexity returned empty response');
  return { text, model_used: 'perplexity-api' };
}

// format the current server time in a given IANA timezone — "6:03 PM IST", "9:15 AM GMT"
function fmtLocalTime(tz) {
  try {
    const now  = new Date();
    const time = now.toLocaleTimeString('en-US', {
      timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true,
    });
    const abbr = now.toLocaleTimeString('en-US', {
      timeZone: tz, timeZoneName: 'short',
    }).split(' ').pop();
    return `${time} ${abbr}`;
  } catch { return tz; }
}

// Gemini 2.5 Flash with Google Search grounding — fallback when Serper quota is exhausted
export async function callGeminiWithSearch(company, lang, today, timezone_label) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'add_later') throw new Error('Gemini API key not set');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  const prompt = `Search the web for recent news about "${company}" from the last 7 days. Analyze what you find and return a brand intelligence digest in ${lang}.

Return ONLY valid JSON — no markdown, no explanation — matching this exact schema:
{
  "company": "${company}",
  "date": "${today}",
  "timezone_label": "${timezone_label}",
  "model_used": "gemini-2.5-flash (web search)",
  "news": [{"title":"","source":"","url":"","sentiment":"positive|negative|neutral","emotion":"","snippet":""}],
  "social": [{"title":"","source":"","url":"","sentiment":"positive|negative|neutral","snippet":""}],
  "executive_mentions": [{"person":"","title":"","source":"","url":"","sentiment":"positive|negative|neutral","snippet":""}],
  "reviews": [],
  "ai_visibility": [],
  "competitor_signals": [{"company":"","signal_type":"","detail":""}],
  "corporate_events": [{"type":"","headline":"","implication":""}],
  "keywords": [],
  "sov": {"company_pct": 0, "competitors": []},
  "sparkline": [0,0,0,0,0,0,0],
  "crisis_flag": {"triggered": false, "reason": ""},
  "watch_out": null
}

Rules: news up to 10 items; social up to 5; keywords top 8 brand terms; crisis_flag.triggered = true if >30% news is negative; watch_out = one-sentence biggest risk or null.`;

  const res = await withRetry(() => axios.post(url, {
    tools: [{ google_search: {} }],
    contents: [{ parts: [{ text: prompt }] }],
  }));
  // google_search responses may have multiple parts — join all text parts
  const parts = res.data?.candidates?.[0]?.content?.parts || [];
  const text  = parts.filter(p => p.text).map(p => p.text).join('');
  if (!text) throw new Error('Gemini web search returned empty response');
  return { text, model_used: 'gemini-2.5-flash (web search)' };
}

// build DigestSchema prompt from search results and call the configured LLM
export async function generateDigest(company, searchResults, settings = {}) {
  const model          = settings.llm_model      || 'gemini-2.5-flash';
  const apiKey         = settings.llm_api_key    || '';
  const fallbackModel  = settings.fallback_model  || 'gemini-2.5-flash';
  const fallbackApiKey = settings.fallback_api_key || '';
  const lang   = settings.digest_language || 'English';
  const tz     = settings.timezone || 'Asia/Kolkata';
  const today          = new Date().toISOString().split('T')[0];
  const timezone_label = fmtLocalTime(tz); // always server-computed — never rely on LLM to guess

  // Serper quota exhausted — use Gemini web search grounding instead of empty prompt
  if (searchResults.length === 0) {
    console.log(`[llm] No Serper results for "${company}" — falling back to Gemini web search`);
    try {
      const { text, model_used } = await callGeminiWithSearch(company, lang, today, timezone_label);
      const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      const digest  = JSON.parse(cleaned);
      digest.model_used     = model_used;
      digest.timezone_label = timezone_label;
      return digest;
    } catch (err) {
      console.error(`[llm] Gemini web search fallback failed: ${err.message}`);
      // last resort: rule-based empty digest with a clear warning
      const fallback = buildBasicDigest(company, [], timezone_label);
      const digest   = JSON.parse(fallback.text);
      digest.watch_out = 'Serper search quota exhausted and Gemini web search unavailable. Top up Serper credits at serper.dev to restore full digests.';
      return digest;
    }
  }

  // cap at 60 results; pass person_badge for executive items so LLM populates executive_mentions
  const items = searchResults.slice(0, 60).map(r => ({
    title:    r.title    || r.name || '',
    source:   r.source   || r.displayLink || '',
    url:      r.link     || r.url || '',
    snippet:  r.snippet  || '',
    category: r.source_category || 'news',
    ...(r.person_badge && { person_badge: r.person_badge }),
  }));

  const prompt = `You are a brand intelligence analyst. Analyze these search results for "${company}" and return a single JSON object. Respond in ${lang}.

Search results (${items.length} items):
${JSON.stringify(items)}

Return ONLY valid JSON — no markdown, no explanation — matching this exact schema:
{
  "company": "${company}",
  "date": "${today}",
  "timezone_label": "${timezone_label}",
  "model_used": "${model}",
  "news": [{"title":"","source":"","url":"","sentiment":"positive|negative|neutral","emotion":"","snippet":""}],
  "social": [{"title":"","source":"","url":"","sentiment":"positive|negative|neutral","snippet":""}],
  "executive_mentions": [{"person":"","title":"","source":"","url":"","sentiment":"positive|negative|neutral","snippet":""}],
  "reviews": [{"platform":"","rating":0,"excerpt":"","urgency":"low|medium|high","draft_response":""}],
  "ai_visibility": [{"engine":"","summary":"","accuracy_flag":true}],
  "competitor_signals": [{"company":"","signal_type":"","detail":""}],
  "corporate_events": [{"type":"","headline":"","implication":""}],
  "keywords": [],
  "sov": {"company_pct": 0, "competitors": []},
  "sparkline": [0,0,0,0,0,0,0],
  "crisis_flag": {"triggered": false, "reason": ""},
  "watch_out": null
}

Rules:
- news: up to 10 items from india_news / global_news categories; include sentiment per article
- social: up to 5 items from social / reddit / twitter categories
- executive_mentions: up to 5 items where category is 'executive'; set person = the item's person_badge value; include sentiment
- reviews: up to 5 items from review category; urgency = high if rating ≤ 2
- keywords: top 8 brand-related terms from the results
- sov.company_pct: estimated 0-100 share of voice vs competitors
- sparkline: 7 daily sentiment scores (-1 to 1), oldest first
- crisis_flag.triggered = true if >30% of news is negative or there is a PR crisis
- watch_out: one-sentence biggest risk, or null if nothing notable`;

  const { text, model_used } = await routeLLM(model, apiKey, prompt, { company, results: searchResults, timezone_label }, fallbackModel, fallbackApiKey);

  // strip markdown code fences if LLM wraps output
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const digest  = JSON.parse(cleaned);
  digest.model_used     = model_used;
  digest.timezone_label = timezone_label; // always override with server-computed time
  return digest;
}

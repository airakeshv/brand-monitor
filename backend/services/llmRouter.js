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

// route a prompt to the chosen LLM, returns raw text response
export async function routeLLM(model, apiKey, prompt) {
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
    // fallback order: try OpenAI first (reliable), then Gemini
    if (model !== 'gpt-4o-mini' && process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'add_later') {
      console.error(`Model ${model} failed (${err.message}), falling back to OpenAI`);
      return await callOpenAI(process.env.OPENAI_API_KEY, prompt);
    }
    if (model !== 'gemini-2.5-flash') {
      console.error(`Model ${model} failed (${err.message}), falling back to Gemini`);
      return await withRetry(() => callGemini(process.env.GEMINI_API_KEY, prompt, true));
    }
    throw err;
  }
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

// build DigestSchema prompt from search results and call the configured LLM
export async function generateDigest(company, searchResults, settings = {}) {
  const model  = settings.llm_model   || 'gemini-2.5-flash';
  const apiKey = settings.llm_api_key || '';
  const lang   = settings.digest_language || 'English';
  const tz     = settings.timezone || 'Asia/Kolkata';
  const today  = new Date().toISOString().split('T')[0];

  // cap at 60 results to stay within token limits
  const items = searchResults.slice(0, 60).map(r => ({
    title:    r.title    || r.name || '',
    source:   r.source   || r.displayLink || '',
    url:      r.link     || r.url || '',
    snippet:  r.snippet  || '',
    category: r.source_category || 'news',
  }));

  const prompt = `You are a brand intelligence analyst. Analyze these search results for "${company}" and return a single JSON object. Respond in ${lang}.

Search results (${items.length} items):
${JSON.stringify(items)}

Return ONLY valid JSON — no markdown, no explanation — matching this exact schema:
{
  "company": "${company}",
  "date": "${today}",
  "timezone_label": "current local time in ${tz}",
  "model_used": "${model}",
  "news": [{"title":"","source":"","url":"","sentiment":"positive|negative|neutral","emotion":"","snippet":""}],
  "social": [{"title":"","source":"","url":"","sentiment":"positive|negative|neutral","snippet":""}],
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
- reviews: up to 5 items from review category; urgency = high if rating ≤ 2
- keywords: top 8 brand-related terms from the results
- sov.company_pct: estimated 0-100 share of voice vs competitors
- sparkline: 7 daily sentiment scores (-1 to 1), oldest first
- crisis_flag.triggered = true if >30% of news is negative or there is a PR crisis
- watch_out: one-sentence biggest risk, or null if nothing notable`;

  const { text, model_used } = await routeLLM(model, apiKey, prompt);

  // strip markdown code fences if LLM wraps output
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const digest  = JSON.parse(cleaned);
  digest.model_used = model_used;
  return digest;
}

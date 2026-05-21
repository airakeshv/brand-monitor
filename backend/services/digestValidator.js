const REQUIRED_FIELDS = ['company', 'date', 'news', 'social', 'reviews', 'keywords', 'crisis_flag'];

// parse and validate LLM text output into DigestSchema
export function parseAndValidate(text, model_used) {
  let json;
  try {
    // strip markdown code fences if model wraps output
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    json = JSON.parse(cleaned);
  } catch {
    throw new Error('LLM returned invalid JSON');
  }

  for (const field of REQUIRED_FIELDS) {
    if (!(field in json)) throw new Error(`DigestSchema missing field: ${field}`);
  }

  // ensure array fields are arrays
  for (const arr of ['news', 'social', 'reviews', 'keywords', 'ai_visibility', 'competitor_signals', 'corporate_events', 'sparkline']) {
    if (!Array.isArray(json[arr])) json[arr] = [];
  }

  // fill optional fields with defaults
  json.ai_visibility      = json.ai_visibility      || [];
  json.competitor_signals = json.competitor_signals || [];
  json.corporate_events   = json.corporate_events   || [];
  json.sov                = json.sov                || { company_pct: 0, competitors: [] };
  json.sparkline          = json.sparkline?.length === 7 ? json.sparkline : [0,0,0,0,0,0,0];
  json.crisis_flag        = json.crisis_flag        || { triggered: false, reason: '' };
  json.watch_out          = json.watch_out          || null;
  json.model_used         = model_used;

  return json;
}

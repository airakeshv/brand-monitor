import { format } from 'date-fns-tz';
import { searchAll } from './searchService.js';
import { applyNoiseFilter } from './noiseFilter.js';
import { buildDigestPrompt } from './digestPrompt.js';
import { routeLLM, callGeminiWithSearch } from './llmRouter.js';
import { parseAndValidate } from './digestValidator.js';
import { saveDigest } from '../models/digest.js';

// IANA timezone → friendly abbreviation shown in digest headers and email
const TZ_ABBR = {
  'Asia/Kolkata':          'IST',
  'Asia/Calcutta':         'IST',
  'America/New_York':      'ET',
  'America/Chicago':       'CT',
  'America/Denver':        'MT',
  'America/Los_Angeles':   'PT',
  'Europe/London':         'GMT',
  'Europe/Paris':          'CET',
  'Europe/Berlin':         'CET',
  'Asia/Dubai':            'GST',
  'Asia/Singapore':        'SGT',
  'Asia/Tokyo':            'JST',
  'Australia/Sydney':      'AEST',
  'America/Sao_Paulo':     'BRT',
};

// build the timezone_label from the ACTUAL current time in the user's timezone
// (was: used delivery_time, causing "6:00 AM IST" even when run at 6 PM)
function buildTimezoneLabel(settings) {
  const tz   = settings.timezone || 'Asia/Kolkata';
  const abbr = TZ_ABBR[tz] || tz;
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour:     'numeric',
      minute:   '2-digit',
      hour12:   true,
    });
    return `${fmt.format(new Date())} ${abbr}`;
  } catch {
    return abbr;
  }
}

// social platform domains/keywords — items from these always belong in social, not news
const SOCIAL_DOMAINS = [
  'instagram', 'facebook', 'twitter', 'x.com', 'linkedin',
  'reddit', 'youtube', 'tiktok', 'threads', 'pinterest',
];

// move any news item whose source matches a social platform into the social array
function normaliseSections(digest) {
  const movedToSocial = [];
  const remainingNews = [];

  for (const item of (digest.news || [])) {
    const src = (item.source || '').toLowerCase();
    const url = (item.url   || '').toLowerCase();
    const isSocial = SOCIAL_DOMAINS.some(d => src.includes(d) || url.includes(d));
    if (isSocial) {
      movedToSocial.push(item);
    } else {
      remainingNews.push(item);
    }
  }

  // prepend moved items to social so they appear first
  digest.news   = remainingNews;
  digest.social = [...movedToSocial, ...(digest.social || [])];

  // deduplicate social by url (keep first occurrence)
  const seen = new Set();
  digest.social = digest.social.filter(s => {
    const key = s.url || s.title || '';
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return digest;
}

// run a full digest: search → filter → prompt → LLM → validate → save
export async function runDigest(company, settings = {}, onProgress = null, workspaceId = null) {
  const model   = settings.llm_model  || 'gemini-2.5-flash';
  const apiKey  = settings.llm_api_key || '';

  onProgress?.('Searching sources…');
  const raw      = await searchAll(company, settings);
  const filtered = applyNoiseFilter(raw, settings);

  onProgress?.(`Found ${filtered.length} results. Generating digest…`);

  let text, model_used;
  if (filtered.length === 0) {
    // Serper quota exhausted — search + generate via Gemini web search grounding
    onProgress?.('Searching via Gemini web search (Serper quota exhausted)…');
    const lang           = settings.digest_language || 'English';
    const today          = format(new Date(), 'yyyy-MM-dd', { timeZone: settings.timezone || 'Asia/Kolkata' });
    const timezone_label = buildTimezoneLabel(settings);
    ({ text, model_used } = await callGeminiWithSearch(company, lang, today, timezone_label));
  } else {
    const prompt = buildDigestPrompt(company, filtered, settings);
    ({ text, model_used } = await routeLLM(model, apiKey, prompt, { company, results: filtered }));
  }

  onProgress?.('Validating digest…');
  let digest = parseAndValidate(text, model_used);
  digest = normaliseSections(digest);
  digest.timezone_label = buildTimezoneLabel(settings);
  // override LLM-supplied date with server-side truth in the user's timezone
  digest.date = format(new Date(), 'yyyy-MM-dd', { timeZone: settings.timezone || 'Asia/Kolkata' });

  const { lastInsertRowid } = saveDigest({
    company,
    date:       digest.date,
    model_used: digest.model_used,
    json:       digest,
    workspaceId,
  });

  onProgress?.('Digest saved.');
  return { id: lastInsertRowid, digest };
}

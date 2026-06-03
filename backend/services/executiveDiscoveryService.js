import axios from 'axios';
import { routeLLM } from './llmRouter.js';

const SERPER_URL = 'https://google.serper.dev/search';

// search for leadership info about a company using Serper
async function searchLeadership(company) {
  try {
    const query = `"${company}" CEO MD founder chairman "managing director" "chief executive"`;
    const res = await axios.post(
      SERPER_URL,
      { q: query, num: 10 },
      { headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' } }
    );
    const results = res.data.organic || [];
    return results.map(r => `${r.title || ''} — ${r.snippet || ''}`).join('\n');
  } catch (err) {
    console.error(`[exec-discovery] Serper failed for "${company}":`, err.message);
    return '';
  }
}

// use LLM to extract [{name, role}] list from leadership search results
async function extractExecutives(company, searchText, model, apiKey) {
  const prompt = `Extract up to 5 key executives, founders, or owners for the company "${company}" from the search results below.
Return ONLY a valid JSON array — no markdown, no explanation:
[{"name":"Full Name","role":"CEO"},{"name":"Full Name","role":"Founder"}]

Rules:
- Roles must be concise: CEO, MD, Founder, Chairman, CFO, COO, CTO, Director, Owner, President
- Only include real named individuals confirmed in the text
- Return [] if no individuals can be clearly identified

SEARCH RESULTS:
${searchText.slice(0, 3000)}`;

  try {
    const { text } = await routeLLM(model || 'gemini-2.5-flash', apiKey || '', prompt);
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(e => e.name && e.role).slice(0, 5);
  } catch (err) {
    console.error('[exec-discovery] LLM extraction failed:', err.message);
    return [];
  }
}

// discover C-level executives for a company — Serper search then LLM confirms names + roles
export async function discoverExecutives(company, settings = {}) {
  const searchText = await searchLeadership(company);
  if (!searchText) return [];
  return extractExecutives(company, searchText, settings.llm_model, settings.llm_api_key);
}

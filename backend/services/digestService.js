import { searchAll } from './searchService.js';
import { applyNoiseFilter } from './noiseFilter.js';
import { buildDigestPrompt } from './digestPrompt.js';
import { routeLLM } from './llmRouter.js';
import { parseAndValidate } from './digestValidator.js';
import { saveDigest } from '../models/digest.js';

// run a full digest: search → filter → prompt → LLM → validate → save
export async function runDigest(company, settings = {}, onProgress = null) {
  const model   = settings.llm_model  || 'gemini-2.5-flash';
  const apiKey  = settings.llm_api_key || '';

  onProgress?.('Searching sources…');
  const raw      = await searchAll(company, settings);
  const filtered = applyNoiseFilter(raw, settings);

  onProgress?.(`Found ${filtered.length} results. Generating digest…`);
  const prompt   = buildDigestPrompt(company, filtered, settings);
  const { text, model_used } = await routeLLM(model, apiKey, prompt);

  onProgress?.('Validating digest…');
  const digest   = parseAndValidate(text, model_used);

  const { lastInsertRowid } = saveDigest({
    company,
    date:       digest.date,
    model_used: digest.model_used,
    json:       digest,
  });

  onProgress?.('Digest saved.');
  return { id: lastInsertRowid, digest };
}

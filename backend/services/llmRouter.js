import axios from 'axios';

// route a prompt to the chosen LLM, returns raw text response
export async function routeLLM(model, apiKey, prompt) {
  try {
    switch (model) {
      case 'gemini-2.5-flash':
        return await callGemini(apiKey || process.env.GEMINI_API_KEY, prompt);
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
    // fallback to Gemini free tier on any error
    if (model !== 'gemini-2.5-flash') {
      console.error(`Model ${model} failed (${err.message}), falling back to Gemini`);
      return await callGemini(process.env.GEMINI_API_KEY, prompt, true);
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

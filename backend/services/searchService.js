import axios from 'axios';

const SERPER_URL      = 'https://google.serper.dev/search';
const SERPER_NEWS_URL = 'https://google.serper.dev/news'; // dedicated news endpoint — no site: operator limit

// generic Serper search — returns array of result objects; auto-retries on 429 rate limit
async function serperSearch(query, params = {}, attempt = 0) {
  try {
    const res = await axios.post(
      SERPER_URL,
      { q: query, num: 10, ...params },
      {
        headers: {
          'X-API-KEY': process.env.SERPER_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );
    return res.data.organic || [];
  } catch (err) {
    const status = err.response?.status;
    if (status === 429 && attempt < 2) {
      const waitMs = (attempt + 1) * 2000; // 2 s then 4 s
      console.log(`[serper] rate limited — retrying in ${waitMs / 1000}s…`);
      await new Promise(r => setTimeout(r, waitMs));
      return serperSearch(query, params, attempt + 1);
    }
    // log actual Serper error body so Railway logs show the real rejection reason (not just "400")
    if (err.response?.data) {
      console.error(`[serper] error body:`, JSON.stringify(err.response.data).slice(0, 300));
    }
    console.error(`Serper search failed for "${query}":`, err.message);
    return [];
  }
}

// Serper /news endpoint search — returns news[] array; used for India/global news to avoid site: operator limit
async function serperNewsSearch(query, params = {}, attempt = 0) {
  try {
    const res = await axios.post(
      SERPER_NEWS_URL,
      { q: query, num: 10, ...params },
      { headers: { 'X-API-KEY': process.env.SERPER_API_KEY, 'Content-Type': 'application/json' } }
    );
    return res.data.news || [];
  } catch (err) {
    const status = err.response?.status;
    if (status === 429 && attempt < 2) {
      const waitMs = (attempt + 1) * 2000;
      console.log(`[serper-news] rate limited — retrying in ${waitMs / 1000}s…`);
      await new Promise(r => setTimeout(r, waitMs));
      return serperNewsSearch(query, params, attempt + 1);
    }
    if (err.response?.data) console.error('[serper-news] error:', JSON.stringify(err.response.data).slice(0, 200));
    console.error(`Serper news search failed for "${query}":`, err.message);
    return [];
  }
}

// run an array of task functions in batches of batchSize — prevents bursting Serper with 10+ concurrent requests
async function runBatched(taskFns, batchSize = 3, delayMs = 300) {
  const results = [];
  for (let i = 0; i < taskFns.length; i += batchSize) {
    const batch = await Promise.all(taskFns.slice(i, i + batchSize).map(fn => fn()));
    results.push(...batch);
    if (i + batchSize < taskFns.length) await new Promise(r => setTimeout(r, delayMs));
  }
  return results;
}

// convert YYYY-MM-DD to M/D/YYYY for Serper custom date range
function fmtSerperDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${Number(m)}/${Number(d)}/${y}`;
}

// map lookback setting (or custom date range) to Serper tbs value
function toTbs(lookback = '7d', dateFrom = null, dateTo = null) {
  if (dateFrom && dateTo) return `cdr:1,cd_min:${fmtSerperDate(dateFrom)},cd_max:${fmtSerperDate(dateTo)}`;
  if (lookback === '1d')  return 'qdr:d';
  if (lookback === '30d') return 'qdr:m';
  return 'qdr:w';
}

// search India-specific news — uses /news endpoint with gl:'in' geo-targeting
// switched from site: OR groups (5 operators) which exceed Serper free-plan query limits → 400 errors
export async function searchIndiaNews(company, tbs = 'qdr:w') {
  const results = await serperNewsSearch(company, { gl: 'in', num: 15, tbs });
  return results.map(r => ({ ...r, source_category: 'india_news' }));
}

// search global news — uses /news endpoint with gl:'us' for international wire coverage
export async function searchGlobalNews(company, tbs = 'qdr:w') {
  const num = tbs.startsWith('cdr:') ? 20 : 10;
  const results = await serperNewsSearch(company, { gl: 'us', num, tbs });
  return results.map(r => ({ ...r, source_category: 'global_news' }));
}

// search Reddit via snoowrap
export async function searchReddit(company) {
  try {
    const { default: Snoowrap } = await import('snoowrap');
    if (
      !process.env.REDDIT_CLIENT_ID ||
      process.env.REDDIT_CLIENT_ID === 'add_later'
    ) {
      return [];
    }
    const r = new Snoowrap({
      userAgent: process.env.REDDIT_USER_AGENT || 'BrandMonitor/1.0',
      clientId: process.env.REDDIT_CLIENT_ID,
      clientSecret: process.env.REDDIT_CLIENT_SECRET,
      username: process.env.REDDIT_USERNAME || '',
      password: process.env.REDDIT_PASSWORD || '',
    });
    const posts = await r.search({ query: company, sort: 'new', limit: 10 });
    return posts.map(p => ({
      title: p.title,
      link: `https://reddit.com${p.permalink}`,
      snippet: p.selftext?.slice(0, 200) || '',
      source: 'Reddit',
      source_category: 'social',
    }));
  } catch (err) {
    console.error('Reddit search failed:', err.message);
    return [];
  }
}

// search review platforms
export async function searchReviews(company) {
  const reviewSites = [
    { site: 'site:google.com/maps', label: 'Google Reviews' },
    { site: 'site:glassdoor.co.in OR site:glassdoor.com', label: 'Glassdoor' },
    { site: 'site:g2.com', label: 'G2' },
    { site: 'site:trustpilot.com', label: 'Trustpilot' },
  ];
  const results = await Promise.all(
    reviewSites.map(({ site, label }) =>
      serperSearch(`${company} reviews ${site}`).then(items =>
        items.map(r => ({ ...r, source: label, source_category: 'review' }))
      )
    )
  );
  return results.flat();
}

// search LinkedIn posts and articles via Google (official API planned for v1.1)
export async function searchLinkedIn(company) {
  const results = await serperSearch(`"${company}" site:linkedin.com/posts OR site:linkedin.com/pulse`, { tbs: 'qdr:w' });
  return results.map(r => ({ ...r, source: 'LinkedIn', source_category: 'social' }));
}

// catch-all: finds coverage from any outlet not in the site-specific lists
export async function searchGeneralNews(company, tbs = 'qdr:w') {
  if (tbs.startsWith('cdr:')) {
    // for date ranges: broad catch-all — limited to 2 -site: operators (Serper free-plan limit)
    const results = await serperSearch(
      `"${company}" -site:glassdoor.com -site:g2.com`,
      { tbs, num: 50 }
    );
    return results.map(r => ({ ...r, source_category: 'india_news' }));
  }
  // for recent lookback: content filter — max 2 negative site: operators (Serper free-plan limit)
  const results = await serperSearch(
    `"${company}" (news OR press release OR announcement) -site:glassdoor.com -site:g2.com`,
    { tbs, num: 10 }
  );
  return results.map(r => ({ ...r, source_category: 'india_news' }));
}

// search X/Twitter — direct site: search + news articles that quote/reference tweets
// Note: X.com blocks most Google indexing; official Twitter API needed for real-time coverage
export async function searchTwitter(company) {
  const [direct, newsRefs] = await Promise.all([
    // direct x.com search (returns whatever Google has indexed)
    serperSearch(`"${company}" site:x.com OR site:twitter.com`, { tbs: 'qdr:d' }),
    // news articles that quote or report on tweets mentioning the company
    serperSearch(`"${company}" (tweeted OR "on twitter" OR "on X" OR tweet) -site:twitter.com -site:x.com`, { tbs: 'qdr:w', num: 8 }),
  ]);
  const seen = new Set();
  // direct x.com/twitter.com results → social
  const socialItems = direct
    .filter(r => { if (seen.has(r.link)) return false; seen.add(r.link); return true; })
    .map(r => ({ ...r, source: 'X/Twitter', source_category: 'social' }));
  // news articles that reference tweets → news (not social)
  const newsItems = newsRefs
    .filter(r => { if (seen.has(r.link)) return false; seen.add(r.link); return true; })
    .map(r => ({ ...r, source_category: 'india_news' }));
  return [...socialItems, ...newsItems];
}

// known social media domains — results from these are always 'social'
const SOCIAL_DOMAINS = new Set([
  'instagram.com', 'facebook.com', 'fb.com',
  'x.com', 'twitter.com', 'linkedin.com',
  'threads.net', 'reddit.com', 'youtube.com', 'tiktok.com',
]);

// map messy social source strings (e.g. "Alok Jain - Instagram") to clean platform names
function cleanSource(source = '', link = '') {
  const s = source.toLowerCase();
  const l = link.toLowerCase();
  if (s.includes('instagram') || l.includes('instagram.com'))                         return 'Instagram';
  if (s.includes('facebook')  || l.includes('facebook.com') || l.includes('fb.com'))  return 'Facebook';
  if (s.includes('linkedin')  || l.includes('linkedin.com'))                          return 'LinkedIn';
  if (s.includes('twitter')   || l.includes('twitter.com')  || l.includes('x.com'))   return 'X (formerly Twitter)';
  if (s.includes('youtube')   || l.includes('youtube.com'))                           return 'YouTube';
  if (s.includes('reddit')    || l.includes('reddit.com'))                            return 'Reddit';
  try { return new URL(link).hostname.replace(/^www\./, '') || source; } catch { return source; }
}

// reclassify any result whose URL or source string belongs to a social platform
function normalizeResult(result) {
  const link = (result.link || result.url || '').toLowerCase();
  const src  = (result.source || result.displayLink || '').toLowerCase();
  const isSocial =
    [...SOCIAL_DOMAINS].some(d => link.includes(d) || src.includes(d)) ||
    ['instagram', 'facebook', 'twitter', 'linkedin', 'youtube'].some(p => src.includes(p));
  if (!isSocial) return result;
  return {
    ...result,
    source: cleanSource(result.source || result.displayLink || '', result.link || result.url || ''),
    source_category: 'social',
  };
}

// keep results where any meaningful word from the company name appears in title or first 100 chars of snippet
function isRelevant(result, company) {
  const words   = company.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const title   = (result.title   || '').toLowerCase();
  const snippet = (result.snippet || '').slice(0, 100).toLowerCase();
  return words.some(w => title.includes(w) || snippet.includes(w));
}

// aggregate all sources based on enabled flags in settings
export async function searchAll(company, settings = {}) {
  const c       = (company || '').trim(); // trim trailing spaces — prevents double-space queries like "Reliance  (site:..."
  const enabled = settings.sources_enabled || {};
  const tbs     = toTbs(settings.news_lookback, settings.search_from, settings.search_to);

  // use thunks so runBatched can start them in controlled batches (not all at once)
  const tasks = [];
  if (enabled.india_news  !== false) tasks.push(() => searchIndiaNews(c, tbs));
  if (enabled.global_news !== false) tasks.push(() => searchGlobalNews(c, tbs));
  tasks.push(() => searchGeneralNews(c, tbs)); // always run — catches outlets outside site lists
  if (enabled.reddit      !== false) tasks.push(() => searchReddit(c));
  if (enabled.reviews     !== false) tasks.push(() => searchReviews(c));
  if (enabled.twitter     !== false) tasks.push(() => searchTwitter(c));
  if (enabled.linkedin    !== false) tasks.push(() => searchLinkedIn(c));

  // run 3 sources at a time with 300 ms gap — prevents 10+ concurrent Serper requests that cause 400/429
  const allResults = await runBatched(tasks, 3, 300);
  return allResults.flat().map(normalizeResult).filter(r => isRelevant(r, c));
}

// run searchAll for every company sequentially — avoids Serper burst when workspace tracks multiple companies
export async function searchAllCompanies(companies, settings = {}) {
  const result = {};
  for (const company of (companies || []).filter(Boolean)) {
    result[company] = await searchAll(company, settings);
  }
  return result;
}

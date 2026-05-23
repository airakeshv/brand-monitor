import axios from 'axios';

const SERPER_URL = 'https://google.serper.dev/search';

// generic Serper search — returns array of result objects
async function serperSearch(query, params = {}) {
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
    console.error(`Serper search failed for "${query}":`, err.message);
    return [];
  }
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

// 2 grouped OR queries instead of 10 single-site calls — same coverage, 5× fewer API requests
const INDIA_SITE_GROUPS = [
  'site:timesofindia.com OR site:economictimes.com OR site:hindustantimes.com OR site:moneycontrol.com OR site:ndtv.com',
  'site:livemint.com OR site:business-standard.com OR site:thehindu.com OR site:financialexpress.com OR site:businesstoday.in',
];

// search India-specific news sources — 2 grouped queries cover all 10 sites
export async function searchIndiaNews(company, tbs = 'qdr:w') {
  const results = await Promise.all(
    INDIA_SITE_GROUPS.map(sites =>
      serperSearch(`${company} (${sites})`, { tbs, num: 15 }).then(items =>
        items.map(r => ({ ...r, source_category: 'india_news' }))
      )
    )
  );
  return results.flat();
}

// search global news (Reuters, BBC, Bloomberg, FT, WSJ)
export async function searchGlobalNews(company, tbs = 'qdr:w') {
  const sites = 'site:reuters.com OR site:bbc.com OR site:bloomberg.com OR site:ft.com OR site:wsj.com';
  const num   = tbs.startsWith('cdr:') ? 20 : 10;
  const results = await serperSearch(`${company} (${sites})`, { tbs, num });
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
    // for date ranges: no content-type filter — catches investment/expansion/launch articles
    // that don't use words like "news" or "announcement" in their headline
    const results = await serperSearch(
      `"${company}" -site:glassdoor.com -site:g2.com -site:trustpilot.com -site:reddit.com`,
      { tbs, num: 50 }
    );
    return results.map(r => ({ ...r, source_category: 'india_news' }));
  }
  // for recent lookback: content filter reduces noise from job boards / reviews
  const results = await serperSearch(
    `"${company}" (news OR press release OR announcement) -site:glassdoor.com -site:g2.com -site:trustpilot.com`,
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
  return [...direct, ...newsRefs]
    .filter(r => { if (seen.has(r.link)) return false; seen.add(r.link); return true; })
    .map(r => ({ ...r, source: 'X/Twitter', source_category: 'social' }));
}

// keep results where any meaningful word from the company name appears in title or snippet
function isRelevant(result, company) {
  const words = company.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const text  = `${result.title || ''} ${result.snippet || ''}`.toLowerCase();
  return words.some(w => text.includes(w));
}

// aggregate all sources based on enabled flags in settings
export async function searchAll(company, settings = {}) {
  const enabled = settings.sources_enabled || {};
  const tbs     = toTbs(settings.news_lookback, settings.search_from, settings.search_to);

  const tasks = [];

  if (enabled.india_news  !== false) tasks.push(searchIndiaNews(company, tbs));
  if (enabled.global_news !== false) tasks.push(searchGlobalNews(company, tbs));
  tasks.push(searchGeneralNews(company, tbs)); // always run — catches outlets outside site lists
  if (enabled.reddit      !== false) tasks.push(searchReddit(company));
  if (enabled.reviews     !== false) tasks.push(searchReviews(company));
  if (enabled.twitter     !== false) tasks.push(searchTwitter(company));
  if (enabled.linkedin    !== false) tasks.push(searchLinkedIn(company));

  const allResults = await Promise.all(tasks);
  return allResults.flat().filter(r => isRelevant(r, company));
}

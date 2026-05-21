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

// search India-specific news sources
export async function searchIndiaNews(company, tbs = 'qdr:w') {
  const sites = [
    'site:timesofindia.com',
    'site:economictimes.com',
    'site:hindustantimes.com',
    'site:moneycontrol.com',
    'site:ndtv.com',
  ];
  const results = await Promise.all(
    sites.map(site =>
      serperSearch(`${company} ${site}`, { tbs }).then(items =>
        items.map(r => ({ ...r, source_category: 'india_news' }))
      )
    )
  );
  return results.flat();
}

// search global news (Reuters, BBC, Bloomberg)
export async function searchGlobalNews(company, tbs = 'qdr:w') {
  const results = await serperSearch(`${company} site:reuters.com OR site:bbc.com OR site:bloomberg.com`, { tbs });
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

// search X/Twitter via Serper — combines direct x.com results with news articles referencing tweets
export async function searchTwitter(company) {
  const [direct, mentioned] = await Promise.all([
    serperSearch(`"${company}" site:x.com OR site:twitter.com`, { tbs: 'qdr:d' }),
    serperSearch(`"${company}" tweet OR twitter reaction OR twitter users`, { tbs: 'qdr:d', num: 5 }),
  ]);
  const seen = new Set();
  return [...direct, ...mentioned]
    .filter(r => { if (seen.has(r.link)) return false; seen.add(r.link); return true; })
    .map(r => ({ ...r, source: 'X/Twitter', source_category: 'social' }));
}

// aggregate all sources based on enabled flags in settings
export async function searchAll(company, settings = {}) {
  const enabled = settings.sources_enabled || {};
  const tbs     = toTbs(settings.news_lookback, settings.search_from, settings.search_to);

  const tasks = [];

  if (enabled.india_news  !== false) tasks.push(searchIndiaNews(company, tbs));
  if (enabled.global_news !== false) tasks.push(searchGlobalNews(company, tbs));
  if (enabled.reddit      !== false) tasks.push(searchReddit(company));
  if (enabled.reviews     !== false) tasks.push(searchReviews(company));
  if (enabled.twitter     !== false) tasks.push(searchTwitter(company));
  if (enabled.linkedin    !== false) tasks.push(searchLinkedIn(company));

  const allResults = await Promise.all(tasks);
  return allResults.flat();
}

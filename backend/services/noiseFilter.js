// filter search results by exclude_keywords and exclude_domains from settings
export function applyNoiseFilter(results, settings = {}) {
  const excludeKeywords = (settings.exclude_keywords || []).map(k => k.toLowerCase());
  const excludeDomains  = (settings.exclude_domains  || []).map(d => d.toLowerCase());

  return results.filter(result => {
    const text = `${result.title || ''} ${result.snippet || ''}`.toLowerCase();
    const link = (result.link || result.url || '').toLowerCase();

    if (excludeKeywords.some(kw => text.includes(kw))) return false;
    if (excludeDomains.some(domain => link.includes(domain))) return false;
    return true;
  });
}

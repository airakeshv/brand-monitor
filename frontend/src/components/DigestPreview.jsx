import SourceBadge from './SourceBadge.jsx';

// format ISO date to "1 Jan 2026" — returns empty string if null or invalid
function fmtDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso.includes('T') ? iso : iso + 'T12:00:00Z');
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return ''; }
}

// sentiment → color mapping
function sentimentColor(s = '') {
  if (s.includes('strongly_positive')) return '#22c55e';
  if (s.includes('positive'))          return '#86efac';
  if (s.includes('strongly_negative')) return '#ef4444';
  if (s.includes('negative'))          return '#fca5a5';
  if (s.includes('mixed'))             return '#facc15';
  return '#6B7A99';
}

// urgency → color mapping
function urgencyColor(u = '') {
  if (u === 'CRITICAL') return '#ef4444';
  if (u === 'HIGH')     return '#f97316';
  return '#facc15';
}

// section header label
function SectionLabel({ children }) {
  return (
    <div style={{ color: '#E91E8C', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
      {children}
    </div>
  );
}

// single news row
function NewsRow({ item }) {
  return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid #2A3858' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {item.source && <SourceBadge source={item.source} />}
        {item.sentiment && (
          <span style={{
            background: sentimentColor(item.sentiment),
            color: '#0A0E27',
            borderRadius: '999px',
            padding: '2px 8px',
            fontSize: 11,
            fontWeight: 600,
          }}>
            {item.sentiment}
          </span>
        )}
      </div>
      <div style={{ marginTop: 6 }}>
        <a href={item.url || '#'} target="_blank" rel="noreferrer"
          style={{ color: '#FFFFFF', fontWeight: 600, textDecoration: 'none' }}>
          {item.title}
        </a>
      </div>
      {item.snippet && (
        <div style={{ color: '#B4B4B4', fontSize: 13, marginTop: 4 }}>{item.snippet}</div>
      )}
    </div>
  );
}

// single review row
function ReviewRow({ item }) {
  const uc = urgencyColor(item.urgency);
  const filled = Math.max(0, item.rating || 0);
  const empty  = Math.max(0, 5 - filled);
  return (
    <div style={{
      padding: '10px 0 10px 12px',
      borderBottom: '1px solid #2A3858',
      borderLeft: `3px solid ${uc}`,
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: uc, fontWeight: 700, fontSize: 12 }}>{item.urgency}</span>
        <span style={{ color: '#B4B4B4', fontSize: 12 }}>
          {item.platform} · {'★'.repeat(filled)}{'☆'.repeat(empty)}
        </span>
      </div>
      <div style={{ color: '#FFFFFF', marginTop: 4, fontSize: 14 }}>"{item.excerpt}"</div>
      {item.draft_response && (
        <div style={{
          background: '#111830',
          border: '1px solid #2A3858',
          borderRadius: 8,
          padding: '8px 12px',
          marginTop: 8,
          color: '#B4B4B4',
          fontSize: 13,
        }}>
          <strong style={{ color: '#5B63EB' }}>Suggested reply:</strong> {item.draft_response}
        </div>
      )}
    </div>
  );
}

// sparkline bar chart (7 days)
function Sparkline({ data = [] }) {
  const max = Math.max(...data, 1);
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 40 }}>
      {data.map((v, i) => (
        <div key={i} style={{
          flex: 1,
          background: '#5B63EB',
          borderRadius: 3,
          height: `${Math.round((v / max) * 100)}%`,
          minHeight: 4,
          opacity: 0.7,
        }} />
      ))}
    </div>
  );
}

// renders a full DigestSchema payload
export default function DigestPreview({ digest }) {
  if (!digest) return null;

  const hasCrisis   = digest.crisis_flag?.triggered;
  const news        = (digest.news     || []).filter(n => n.title);
  const social      = (digest.social   || []).filter(s => s.title);
  const reviews     = (digest.reviews  || []).filter(r => r.excerpt || r.platform);
  const keywords    = (digest.keywords || []).filter(Boolean);
  const hasNews     = news.length > 0;
  const hasSocial   = social.length > 0;
  const hasReviews  = reviews.length > 0;
  const hasKeywords = keywords.length > 0;

  return (
    <div style={{ background: '#111830', border: '1px solid #2A3858', borderRadius: 16, overflow: 'hidden' }}>

      {/* header */}
      <div style={{ background: 'linear-gradient(135deg,#5B63EB,#E91E8C)', padding: '20px 28px' }}>
        <div style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 700 }}>
          Brand<span style={{ color: '#fff' }}>Monitor</span>
        </div>
        <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: 600, marginTop: 4 }}>
          {digest.company}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 3 }}>
          📅 {fmtDate(digest.date) || digest.date || 'No date'}
          {digest.timezone_label ? ' · ' + digest.timezone_label : ''}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 }}>
          Model: {digest.model_used}
        </div>
      </div>

      <div style={{ padding: '24px 28px' }}>

        {/* crisis banner */}
        {hasCrisis && (
          <div style={{
            background: 'rgba(239,68,68,0.15)',
            border: '1px solid #ef4444',
            borderRadius: 10,
            padding: '12px 16px',
            marginBottom: 20,
          }}>
            <strong style={{ color: '#ef4444' }}>⚠ CRISIS ALERT:</strong>{' '}
            <span style={{ color: '#FFFFFF' }}>{digest.crisis_flag.reason}</span>
          </div>
        )}

        {/* sparkline + SOV */}
        {digest.sparkline?.some(v => v > 0) && (
          <div style={{ marginBottom: 20 }}>
            <SectionLabel>7-Day Mention Trend</SectionLabel>
            <Sparkline data={digest.sparkline} />
          </div>
        )}

        {/* news */}
        {hasNews && (
          <div style={{ marginBottom: 20 }}>
            <SectionLabel>News Highlights</SectionLabel>
            {news.map((n, i) => <NewsRow key={i} item={n} />)}
          </div>
        )}

        {/* social */}
        {hasSocial && (
          <div style={{ marginBottom: 20 }}>
            <SectionLabel>Social Mentions</SectionLabel>
            {social.map((s, i) => <NewsRow key={i} item={s} />)}
          </div>
        )}

        {/* reviews */}
        {hasReviews && (
          <div style={{ marginBottom: 20 }}>
            <SectionLabel>Review Alerts</SectionLabel>
            {reviews.map((r, i) => <ReviewRow key={i} item={r} />)}
          </div>
        )}

        {/* keywords */}
        {hasKeywords && (
          <div style={{ marginBottom: 20 }}>
            <SectionLabel>Trending Keywords</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {keywords.map((k, i) => (
                <span key={i} style={{
                  background: 'rgba(91,99,235,0.15)',
                  color: '#5B63EB',
                  border: '1px solid rgba(91,99,235,0.3)',
                  borderRadius: '999px',
                  padding: '3px 12px',
                  fontSize: 12,
                }}>
                  {k}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* watch out */}
        {digest.watch_out && (
          <div style={{
            background: 'rgba(250,204,21,0.1)',
            border: '1px solid #facc15',
            borderRadius: 10,
            padding: '12px 16px',
          }}>
            <strong style={{ color: '#facc15' }}>Watch Out:</strong>{' '}
            <span style={{ color: '#FFFFFF' }}>{digest.watch_out}</span>
          </div>
        )}

      </div>
    </div>
  );
}

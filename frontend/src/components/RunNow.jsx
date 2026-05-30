import { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext.jsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const BORDER_COLOR = {
  news:   '#1d9bf0',
  social: '#a855f7',
  review: '#22c55e',
};

// decode email from JWT for success message
function getEmail() {
  try {
    const t = localStorage.getItem('bm_token');
    if (!t) return null;
    return JSON.parse(atob(t.split('.')[1])).email;
  } catch { return null; }
}

// map HTTP status codes and network errors to friendly messages
function friendlyError(err) {
  const msg = err?.message || '';
  if (msg.includes('401')) return 'Your session has expired. Logging you out…';
  if (msg.includes('403')) return 'This feature requires a Pro plan upgrade.';
  if (msg.includes('404')) return 'Not found — please try again.';
  if (msg.includes('500')) return 'Something went wrong on our end. Please try again in a moment.';
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('Load failed'))
    return 'Cannot reach the server. Check your internet connection.';
  return msg || 'An unexpected error occurred.';
}

// one news / social row
function ResultRow({ item, type }) {
  const sentColor = item.sentiment === 'positive' ? '#22c55e'
    : item.sentiment === 'negative' ? '#ef4444' : '#6B7A99';
  return (
    <div style={{ padding: '8px 0 8px 10px', borderBottom: '1px solid #1e2a44',
      borderLeft: `3px solid ${BORDER_COLOR[type] || '#2A3858'}` }}>
      <div style={{ minWidth: 0 }}>
        {item.url
          ? <a href={item.url} target="_blank" rel="noreferrer"
              style={{ color: '#E2E8F0', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              {item.title}
            </a>
          : <span style={{ color: '#E2E8F0', fontSize: 13, fontWeight: 600 }}>{item.title}</span>}
        {item.snippet && <p style={{ color: '#7A8BAA', fontSize: 12, margin: '3px 0 0', lineHeight: 1.4 }}>{item.snippet}</p>}
        <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
          <span style={{ color: '#4A5A7A', fontSize: 11 }}>{item.source}</span>
          {item.sentiment && <span style={{ color: sentColor, fontSize: 11 }}>{item.sentiment}</span>}
        </div>
      </div>
    </div>
  );
}

// full digest rendered below the button
function DigestDisplay({ digest }) {
  if (!digest) return null;
  const { news = [], social = [], reviews = [], crisis_flag, watch_out, keywords = [], model_used, timezone_label, date } = digest;

  return (
    <div style={{ marginTop: 24, background: '#111830', borderRadius: 12, padding: 20, border: '1px solid #2A3858' }}>
      {crisis_flag?.triggered && (
        <div style={{ background: '#450a0a', border: '1px solid #ef4444', borderRadius: 8,
          padding: '10px 14px', marginBottom: 16 }}>
          <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 13 }}>⚠ Crisis Alert: </span>
          <span style={{ color: '#fca5a5', fontSize: 13 }}>{crisis_flag.reason}</span>
        </div>
      )}
      {watch_out && (
        <div style={{ background: '#1c1a2e', borderRadius: 8, padding: '8px 14px',
          marginBottom: 16, fontSize: 13, color: '#c4b5fd' }}>
          <strong style={{ color: '#A855F7' }}>Watch Out: </strong>{watch_out}
        </div>
      )}
      {keywords.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
          {keywords.slice(0, 10).map(k => (
            <span key={k} style={{ background: '#1e2a44', color: '#7B9CCC', fontSize: 11,
              padding: '2px 8px', borderRadius: 4 }}>{k}</span>
          ))}
        </div>
      )}
      {news.length > 0 && (
        <section style={{ marginBottom: 16 }}>
          <h4 style={{ color: '#3B9EFF', fontSize: 12, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px' }}>
            News ({news.length})
          </h4>
          {news.map((item, i) => <ResultRow key={i} item={item} type="news" />)}
        </section>
      )}
      {social.length > 0 && (
        <section style={{ marginBottom: 16 }}>
          <h4 style={{ color: '#A855F7', fontSize: 12, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px' }}>
            Social ({social.length})
          </h4>
          {social.map((item, i) => <ResultRow key={i} item={item} type="social" />)}
        </section>
      )}
      {reviews.length > 0 && (
        <section>
          <h4 style={{ color: '#22c55e', fontSize: 12, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px' }}>
            Reviews ({reviews.length})
          </h4>
          {reviews.map((item, i) => (
            <div key={i} style={{ padding: '8px 0 8px 10px', borderBottom: '1px solid #1e2a44',
              borderLeft: `3px solid ${BORDER_COLOR.review}` }}>
              <div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ color: '#E2E8F0', fontSize: 13, fontWeight: 600 }}>{item.platform}</span>
                  {item.rating > 0 && (
                    <span style={{ color: '#fbbf24', fontSize: 12 }}>{'★'.repeat(Math.min(5, Math.round(item.rating)))}</span>
                  )}
                  {item.urgency && (
                    <span style={{ color: item.urgency === 'high' ? '#ef4444' : item.urgency === 'medium' ? '#f97316' : '#22c55e', fontSize: 11 }}>
                      {item.urgency}
                    </span>
                  )}
                </div>
                {item.excerpt && <p style={{ color: '#7A8BAA', fontSize: 12, margin: '4px 0 0' }}>{item.excerpt}</p>}
              </div>
            </div>
          ))}
        </section>
      )}
      <p style={{ marginTop: 14, color: '#4A5A7A', fontSize: 11 }}>
        {model_used} · {timezone_label || date}
      </p>
    </div>
  );
}

// streams SSE from /api/run-now, calls onDigest when done
export default function RunNow({ company, dateFrom, dateTo, onDigest }) {
  const { activeWorkspaceId } = useWorkspace();
  const [state,      setState]      = useState('idle'); // idle | running | done | error
  const [step,       setStep]       = useState('');     // searching | generating | validating
  const [log,        setLog]        = useState([]);
  const [err,        setErr]        = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [digest,     setDigest]     = useState(null);

  const handleRun = async () => {
    if (!company?.trim()) return;
    setState('running');
    setStep('searching');
    setLog([]);
    setErr('');
    setSuccessMsg('');
    setDigest(null);

    try {
      const res = await fetch(`${API}/api/run-now`, {
        method: 'POST',
        headers: {
          'Content-Type':   'application/json',
          'Authorization':  'Bearer ' + localStorage.getItem('bm_token'),
          'X-Workspace-Id': String(activeWorkspaceId || ''),
        },
        body: JSON.stringify({
          company: company.trim(),
          ...(dateFrom && { date_from: dateFrom }),
          ...(dateTo   && { date_to:   dateTo   }),
        }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        if (res.status === 401) {
          setErr('Your session has expired. Logging you out…');
          setState('error');
          setTimeout(() => { localStorage.removeItem('bm_token'); window.location.href = '/login'; }, 2000);
          return;
        }
        throw new Error(j.error || `HTTP ${res.status}`);
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buf     = '';

      // read SSE stream line by line
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const payload = JSON.parse(line.slice(5).trim());

          if (payload.error) {
            setErr(friendlyError(new Error(payload.error)));
            setState('error');
            return;
          }
          if (payload.message) {
            setLog(prev => [...prev, payload.message]);
            // update step label from progress messages
            const m = payload.message.toLowerCase();
            if (m.includes('searching'))                           setStep('searching');
            else if (m.includes('generating') || m.includes('found')) setStep('generating');
            else if (m.includes('validating'))                     setStep('validating');
          }
          if (payload.done) {
            setState('done');
            setDigest(payload.digest);
            // build delivery success message
            const delivered = Object.entries(payload.delivery || {}).filter(([, v]) => v?.ok).map(([k]) => k);
            const email = getEmail();
            if (delivered.includes('email') && email) {
              setSuccessMsg(`Digest emailed to ${email} ✓`);
            } else if (delivered.length > 0) {
              setSuccessMsg(`Digest sent via ${delivered.join(', ')} ✓`);
            } else {
              setSuccessMsg('Digest generated ✓ — configure a delivery channel in Settings to receive it');
            }
            onDigest?.(payload.digest, payload.delivery);
          }
        }
      }
    } catch (e) {
      setErr(friendlyError(e));
      setState('error');
    }
  };

  const isRunning = state === 'running';

  // button label shows current step when running
  const btnLabel = isRunning
    ? (step === 'generating' ? 'Generating…'
      : step === 'validating' ? 'Validating…'
      : 'Searching…')
    : state === 'done' ? 'Run Again' : 'Run Now';

  return (
    <div>
      <button
        onClick={handleRun}
        disabled={isRunning || !company?.trim()}
        style={{
          background: isRunning ? '#2A3858' : 'linear-gradient(135deg,#5B63EB,#E91E8C)',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: 10,
          padding: '12px 28px',
          fontSize: 15,
          fontWeight: 700,
          cursor: isRunning || !company?.trim() ? 'not-allowed' : 'pointer',
          opacity: !company?.trim() ? 0.5 : 1,
          transition: 'opacity 0.2s',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {isRunning && (
          <span style={{
            width: 14, height: 14, border: '2px solid #fff',
            borderTopColor: 'transparent', borderRadius: '50%',
            display: 'inline-block', animation: 'spin 0.7s linear infinite',
          }} />
        )}
        {btnLabel}
      </button>

      {/* success message after digest completes */}
      {successMsg && state === 'done' && (
        <div style={{ marginTop: 10, color: '#22c55e', fontSize: 13, fontWeight: 600 }}>
          {successMsg}
        </div>
      )}

      {/* progress log */}
      {log.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 13, color: '#B4B4B4', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {log.map((msg, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#22c55e', fontSize: 10 }}>✓</span>
              {msg}
            </div>
          ))}
        </div>
      )}

      {/* error state with retry button */}
      {err && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ color: '#ef4444', fontSize: 13 }}>✗ {err}</span>
          {state !== 'running' && (
            <button
              onClick={handleRun}
              style={{
                background: '#2A3858', color: '#B4B4B4', border: 'none',
                borderRadius: 6, padding: '4px 12px', fontSize: 12,
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              Retry
            </button>
          )}
        </div>
      )}

      <DigestDisplay digest={digest} />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

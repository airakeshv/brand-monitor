import { useState } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// streams SSE from /api/run-now, calls onDigest when done
export default function RunNow({ company, dateFrom, dateTo, onDigest }) {
  const [state, setState] = useState('idle'); // idle | running | done | error
  const [log,   setLog]   = useState([]);
  const [err,   setErr]   = useState('');

  const handleRun = async () => {
    if (!company?.trim()) return;
    setState('running');
    setLog([]);
    setErr('');

    try {
      const res = await fetch(`${API}/api/run-now`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: company.trim(),
          ...(dateFrom && { date_from: dateFrom }),
          ...(dateTo   && { date_to:   dateTo   }),
        }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
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
            setErr(payload.error);
            setState('error');
            return;
          }
          if (payload.message) {
            setLog(prev => [...prev, payload.message]);
          }
          if (payload.done) {
            setState('done');
            onDigest?.(payload.digest, payload.delivery);
          }
        }
      }
    } catch (e) {
      setErr(e.message);
      setState('error');
    }
  };

  const isRunning = state === 'running';

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
        {isRunning ? 'Running…' : state === 'done' ? 'Run Again' : 'Run Now'}
      </button>

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

      {/* error state with retry */}
      {err && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ color: '#ef4444', fontSize: 13 }}>✗ {err}</span>
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
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

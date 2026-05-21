import { useState, useEffect } from 'react';
import RunNow from '../components/RunNow.jsx';
import DigestPreview from '../components/DigestPreview.jsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// main dashboard — company input, run button, live digest preview
export default function Dashboard() {
  const [company, setCompany]   = useState('');
  const [digest,  setDigest]    = useState(null);
  const [delivery, setDelivery] = useState(null);

  // load saved company name from settings on mount
  useEffect(() => {
    fetch(`${API}/api/settings`)
      .then(r => r.json())
      .then(s => { if (s.company_name) setCompany(s.company_name); })
      .catch(() => {});
  }, []);

  // called by RunNow when digest is ready
  const handleDigest = (d, del) => {
    setDigest(d);
    setDelivery(del);
  };

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>

      {/* page title */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: '#FFFFFF', fontSize: 24, fontWeight: 700, margin: 0 }}>
          Brand Intelligence Dashboard
        </h1>
        <p style={{ color: '#B4B4B4', fontSize: 14, marginTop: 6 }}>
          Enter a company name, hit Run Now to generate a fresh digest.
        </p>
      </div>

      {/* company input + run */}
      <div style={{
        background: '#111830',
        border: '1px solid #2A3858',
        borderRadius: 14,
        padding: '20px 24px',
        marginBottom: 28,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        alignItems: 'flex-end',
      }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <label style={{ color: '#B4B4B4', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>
            COMPANY NAME
          </label>
          <input
            type="text"
            value={company}
            onChange={e => setCompany(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && document.getElementById('run-btn')?.click()}
            placeholder="e.g. Tata Motors"
            style={{
              background: '#0A0E27',
              border: '1px solid #2A3858',
              borderRadius: 8,
              padding: '10px 14px',
              color: '#FFFFFF',
              fontSize: 15,
              width: '100%',
              outline: 'none',
            }}
          />
        </div>
        <div id="run-btn">
          <RunNow company={company} onDigest={handleDigest} />
        </div>
      </div>

      {/* delivery status chips */}
      {delivery && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {Object.entries(delivery).map(([ch, result]) => (
            <span key={ch} style={{
              background: result?.ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
              color: result?.ok ? '#22c55e' : '#ef4444',
              border: `1px solid ${result?.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              borderRadius: '999px',
              padding: '3px 12px',
              fontSize: 12,
              fontWeight: 600,
            }}>
              {ch}: {result?.ok ? 'sent ✓' : `failed — ${result?.error}`}
            </span>
          ))}
        </div>
      )}

      {/* digest preview */}
      {digest && <DigestPreview digest={digest} />}

      {/* empty state */}
      {!digest && (
        <div style={{
          background: '#111830',
          border: '1px dashed #2A3858',
          borderRadius: 14,
          padding: '48px 24px',
          textAlign: 'center',
          color: '#6B7A99',
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#B4B4B4' }}>No digest yet</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Enter a company name above and click Run Now</div>
        </div>
      )}
    </div>
  );
}

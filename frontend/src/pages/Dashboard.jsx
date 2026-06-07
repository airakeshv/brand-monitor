import { useState, useEffect } from 'react';
import RunNow from '../components/RunNow.jsx';
import DigestPreview from '../components/DigestPreview.jsx';
import { useWorkspace } from '../context/WorkspaceContext.jsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// return auth + workspace headers for every fetch
const apiHeaders = (wsId) => ({
  Authorization:    `Bearer ${localStorage.getItem('bm_token') || ''}`,
  'X-Workspace-Id': String(wsId || ''),
});

const inputStyle = {
  background: '#0A0E27',
  border: '1px solid #2A3858',
  borderRadius: 8,
  padding: '10px 14px',
  color: '#FFFFFF',
  fontSize: 14,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
};

const labelStyle = {
  color: '#B4B4B4',
  fontSize: 11,
  fontWeight: 600,
  display: 'block',
  marginBottom: 6,
  letterSpacing: '0.05em',
};

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: '7d',    label: 'Last 7 Days' },
  { key: '30d',   label: 'Last 30 Days' },
  { key: 'custom', label: 'Custom Range' },
];

// compute ISO date strings for the selected preset
function getPeriodDates(period, customFrom, customTo) {
  const today = new Date().toISOString().slice(0, 10);
  const ago   = (days) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  if (period === 'today')  return { dateFrom: ago(1),  dateTo: today };
  if (period === '7d')     return { dateFrom: ago(7),  dateTo: today };
  if (period === '30d')    return { dateFrom: ago(30), dateTo: today };
  if (period === 'custom') return { dateFrom: customFrom || undefined, dateTo: customTo || undefined };
  return {};
}

// main dashboard — company input, period selector, run button, live digest preview
export default function Dashboard() {
  const { activeWorkspaceId } = useWorkspace();
  const [company,     setCompany]     = useState('');
  const [digest,      setDigest]      = useState(null);
  const [delivery,    setDelivery]    = useState(null);
  const [period,      setPeriod]      = useState('7d');
  const [customFrom,  setCustomFrom]  = useState('');
  const [customTo,    setCustomTo]    = useState('');

  // load saved company name from workspace settings — reload when workspace changes
  useEffect(() => {
    if (!activeWorkspaceId) return;
    fetch(`${API}/api/settings`, { headers: apiHeaders(activeWorkspaceId) })
      .then(r => r.json())
      .then(s => { if (s.company_name) setCompany(s.company_name); else setCompany(''); })
      .catch(() => {});
    // clear digest when switching workspaces
    setDigest(null); setDelivery(null);
  }, [activeWorkspaceId]);

  const handleDigest = (d, del) => {
    setDigest(d);
    setDelivery(del);
  };

  const { dateFrom, dateTo } = getPeriodDates(period, customFrom, customTo);

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>

      {/* page title */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ color: '#FFFFFF', fontSize: 24, fontWeight: 700, margin: 0 }}>
          Brand Intelligence Dashboard
        </h1>
        <p style={{ color: '#B4B4B4', fontSize: 14, marginTop: 6 }}>
          Choose a company and time period, then hit Run Now to generate and email a digest.
        </p>
      </div>

      {/* control card */}
      <div style={{
        background: '#111830',
        border: '1px solid #2A3858',
        borderRadius: 14,
        padding: '24px',
        marginBottom: 28,
      }}>

        {/* company name */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>COMPANY NAME</label>
          <input
            type="text"
            value={company}
            onChange={e => setCompany(e.target.value)}
            placeholder="e.g. Tata Motors"
            style={inputStyle}
          />
        </div>

        {/* period selector */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>SEARCH PERIOD — fetch news from this date range</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PERIODS.map(({ key, label }) => (
              <button key={key} onClick={() => setPeriod(key)} style={{
                background: period === key ? 'rgba(91,99,235,0.25)' : '#0A0E27',
                color:      period === key ? '#5B63EB' : '#B4B4B4',
                border:     `1px solid ${period === key ? '#5B63EB' : '#2A3858'}`,
                borderRadius: 8,
                padding: '8px 18px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}>
                {label}
              </button>
            ))}
          </div>

          {/* custom date pickers — only visible when Custom Range is selected */}
          {period === 'custom' && (
            <div style={{ display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <label style={labelStyle}>FROM DATE</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <label style={labelStyle}>TO DATE</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>
          )}
        </div>

        {/* run button — right-aligned */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <RunNow
            company={company}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDigest={handleDigest}
          />
        </div>
      </div>

      {/* delivery status chips */}
      {delivery && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {Object.entries(delivery).map(([ch, result]) => (
            <span key={ch} style={{
              background: result?.ok ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
              color:      result?.ok ? '#22c55e' : '#ef4444',
              border:     `1px solid ${result?.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
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
          <div style={{ fontSize: 13, marginTop: 6 }}>
            Enter a company name, pick a period, and click Run Now
          </div>
        </div>
      )}
    </div>
  );
}

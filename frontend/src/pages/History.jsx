import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DigestPreview from '../components/DigestPreview.jsx';
import { useWorkspace } from '../context/WorkspaceContext.jsx';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// urgency color for review badge
function crisisColor(triggered) {
  return triggered ? '#ef4444' : '#22c55e';
}

// format SQLite UTC timestamp for display in user's local timezone
// SQLite datetime('now') → "YYYY-MM-DD HH:MM:SS" with no Z suffix;
// without the Z the browser treats it as local time — appending Z forces UTC parse
function fmtDate(iso) {
  try {
    const utc = iso.includes('T') || iso.includes('+') ? iso : iso.replace(' ', 'T') + 'Z';
    return new Date(utc).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  } catch { return iso; }
}

// single digest row in the list
function DigestRow({ row, onSelect, isSelected }) {
  // digest is pre-parsed by the API; fall back to row.company for old records
  const digest  = row.digest || {};
  const company = row.company || digest.company || '(no company)';
  const crisis  = digest?.crisis_flag?.triggered;

  return (
    <div
      onClick={() => onSelect(row)}
      style={{
        background: isSelected ? 'rgba(91,99,235,0.1)' : '#0A0E27',
        border: `1px solid ${isSelected ? '#5B63EB' : '#2A3858'}`,
        borderRadius: 10, padding: '14px 18px', cursor: 'pointer',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        transition: 'border-color 0.15s',
        marginBottom: 8,
      }}
    >
      <div>
        <div style={{ color: '#FFFFFF', fontWeight: 600, fontSize: 14 }}>
          {company}
          {crisis && <span style={{ marginLeft: 8, color: '#ef4444', fontSize: 11, fontWeight: 700 }}>⚠ CRISIS</span>}
        </div>
        <div style={{ color: '#6B7A99', fontSize: 12, marginTop: 3 }}>
          {fmtDate(row.created_at)} · {digest?.model_used || row.model_used || ''}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {row.delivered && (
          <span style={{ color: '#22c55e', fontSize: 11, fontWeight: 600 }}>Delivered ✓</span>
        )}
        <span style={{
          background: crisis ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
          color: crisisColor(crisis),
          border: `1px solid ${crisisColor(crisis)}33`,
          borderRadius: '999px', padding: '2px 10px', fontSize: 11, fontWeight: 600,
        }}>
          {crisis ? 'Crisis' : 'Normal'}
        </span>
      </div>
    </div>
  );
}

// past digests list + inline preview
export default function History() {
  const { activeWorkspaceId } = useWorkspace();
  const navigate = useNavigate();
  const [rows,     setRows]     = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading,  setLoading]  = useState(true);

  // load history — reload when workspace changes
  useEffect(() => {
    if (!activeWorkspaceId) return;
    setLoading(true); setSelected(null);
    fetch(`${API}/api/history`, {
      headers: {
        'Content-Type':   'application/json',
        'Authorization':  'Bearer ' + localStorage.getItem('bm_token'),
        'X-Workspace-Id': String(activeWorkspaceId),
      },
    })
      .then(r => r.json())
      .then(data => { setRows(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [activeWorkspaceId]);

  const handleSelect = row => {
    setSelected(selected?.id === row.id ? null : row);
  };

  const selectedDigest = selected?.digest || null;

  return (
    <>
      {/* responsive layout: side-by-side on desktop, stacked on mobile */}
      <div className="history-layout" style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', gap: 28, alignItems: 'flex-start' }}>

        {/* list column */}
        <div className="history-list-col" style={{ flex: '0 0 380px' }}>
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ color: '#FFFFFF', fontSize: 24, fontWeight: 700, margin: 0 }}>Digest History</h1>
            <p style={{ color: '#B4B4B4', fontSize: 14, marginTop: 6 }}>
              {rows.length} digest{rows.length !== 1 ? 's' : ''} · click to preview
            </p>
          </div>

          {loading && (
            <div style={{ color: '#6B7A99', fontSize: 14 }}>Loading…</div>
          )}

          {/* empty state — shown when no digests exist */}
          {!loading && rows.length === 0 && (
            <div style={{
              background: '#111830', border: '1px dashed #2A3858', borderRadius: 12,
              padding: '48px 24px', textAlign: 'center', color: '#6B7A99',
            }}>
              <div style={{ fontSize: 48, marginBottom: 14 }}>📊</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#FFFFFF', marginBottom: 8 }}>No digests yet</div>
              <div style={{ fontSize: 13, color: '#B4B4B4', lineHeight: 1.6, marginBottom: 20 }}>
                Run your first search from the Dashboard<br />to see your digest history here.
              </div>
              <button
                onClick={() => navigate('/dashboard')}
                style={{
                  background: 'linear-gradient(135deg,#5B63EB,#E91E8C)',
                  color: '#fff', border: 'none', borderRadius: 8,
                  padding: '10px 22px', fontSize: 14, fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Go to Dashboard
              </button>
            </div>
          )}

          {rows.map(row => (
            <DigestRow
              key={row.id}
              row={row}
              onSelect={handleSelect}
              isSelected={selected?.id === row.id}
            />
          ))}
        </div>

        {/* preview column */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {selectedDigest ? (
            <DigestPreview digest={selectedDigest} />
          ) : (
            <div style={{
              background: '#111830', border: '1px dashed #2A3858', borderRadius: 14,
              padding: '60px 24px', textAlign: 'center', color: '#6B7A99',
            }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>👈</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#B4B4B4' }}>Select a digest to preview it</div>
            </div>
          )}
        </div>

      </div>

      {/* mobile responsive: stack list and preview vertically below sm */}
      <style>{`
        @media (max-width: 640px) {
          .history-layout { flex-direction: column !important; }
          .history-list-col { flex: 1 1 100% !important; width: 100%; }
        }
      `}</style>
    </>
  );
}

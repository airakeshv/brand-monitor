import { useState, useRef, useEffect } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';

// dropdown to switch between workspaces and create new ones
export default function WorkspaceSwitcher() {
  const { workspaces, activeWorkspaceId, setActiveWorkspace, addWorkspace, removeWorkspace } = useWorkspace();
  const [open, setOpen]       = useState(false);
  const [adding, setAdding]   = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError]     = useState('');
  const [busy, setBusy]       = useState(false);
  const ref = useRef(null);

  const active = workspaces.find(w => w.id === activeWorkspaceId);

  // close dropdown on outside click
  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // create new workspace
  async function handleAdd() {
    if (!newName.trim()) { setError('Enter a name'); return; }
    setBusy(true); setError('');
    try {
      await addWorkspace(newName.trim());
      setNewName(''); setAdding(false); setOpen(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // delete a workspace
  async function handleRemove(e, id) {
    e.stopPropagation();
    if (!confirm('Delete this workspace and all its data?')) return;
    setBusy(true);
    try {
      await removeWorkspace(id);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      {/* trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(91,99,235,0.12)', border: '1px solid rgba(91,99,235,0.35)',
          borderRadius: 8, padding: '6px 12px', color: '#FFFFFF', cursor: 'pointer',
          fontSize: 13, fontWeight: 600, minWidth: 120,
        }}
      >
        <span style={{ color: '#5B63EB' }}>🏢</span>
        <span style={{ flex: 1, textAlign: 'left', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {active?.name || 'Workspace'}
        </span>
        <span style={{ color: '#6B7A99', fontSize: 10 }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 999,
          background: '#111830', border: '1px solid #2A3858', borderRadius: 10,
          minWidth: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.4)', overflow: 'hidden',
        }}>
          {/* workspace list */}
          {workspaces.map(ws => (
            <div
              key={ws.id}
              onClick={() => { setActiveWorkspace(ws.id); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', cursor: 'pointer', gap: 8,
                background: ws.id === activeWorkspaceId ? 'rgba(91,99,235,0.15)' : 'transparent',
                borderLeft: ws.id === activeWorkspaceId ? '2px solid #5B63EB' : '2px solid transparent',
              }}
              onMouseEnter={e => { if (ws.id !== activeWorkspaceId) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={e => { if (ws.id !== activeWorkspaceId) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ color: '#FFFFFF', fontSize: 13, fontWeight: ws.id === activeWorkspaceId ? 700 : 400 }}>
                {ws.id === activeWorkspaceId && <span style={{ color: '#5B63EB', marginRight: 6 }}>✓</span>}
                {ws.name}
              </span>
              {workspaces.length > 1 && (
                <button
                  onClick={e => handleRemove(e, ws.id)}
                  disabled={busy}
                  style={{ background: 'none', border: 'none', color: '#6B7A99', cursor: 'pointer', fontSize: 14, padding: '0 2px', lineHeight: 1 }}
                  title="Delete workspace"
                >×</button>
              )}
            </div>
          ))}

          <div style={{ borderTop: '1px solid #2A3858' }} />

          {/* add new workspace */}
          {adding ? (
            <div style={{ padding: '10px 14px' }}>
              <input
                autoFocus
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAdding(false); setNewName(''); } }}
                placeholder="Workspace name"
                style={{
                  width: '100%', background: '#0A0E27', border: '1px solid #2A3858',
                  borderRadius: 6, padding: '6px 10px', color: '#FFFFFF', fontSize: 13,
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
              {error && <div style={{ color: '#ef4444', fontSize: 11, marginTop: 4 }}>{error}</div>}
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button
                  onClick={handleAdd}
                  disabled={busy}
                  style={{ flex: 1, background: '#5B63EB', border: 'none', borderRadius: 6, padding: '6px 0', color: '#FFFFFF', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  {busy ? '…' : 'Create'}
                </button>
                <button
                  onClick={() => { setAdding(false); setNewName(''); setError(''); }}
                  style={{ flex: 1, background: 'transparent', border: '1px solid #2A3858', borderRadius: 6, padding: '6px 0', color: '#6B7A99', fontSize: 12, cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setAdding(true)}
              style={{ padding: '10px 14px', cursor: 'pointer', color: '#5B63EB', fontSize: 13, fontWeight: 600 }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(91,99,235,0.08)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              ＋ New workspace
            </div>
          )}
        </div>
      )}
    </div>
  );
}

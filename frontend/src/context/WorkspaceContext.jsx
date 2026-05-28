import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const WorkspaceContext = createContext(null);

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const LS_KEY = 'bm_workspace_id';

// provide workspace list + active workspace to the entire app
export function WorkspaceProvider({ children }) {
  const [workspaces, setWorkspaces]         = useState([]);
  const [activeWorkspaceId, setActiveWsId]  = useState(null);
  const [loading, setLoading]               = useState(true);

  // fetch workspace list from backend and restore last-used workspace
  const refreshWorkspaces = useCallback(async () => {
    try {
      const token = localStorage.getItem('bm_token');
      if (!token) { setLoading(false); return; }

      const res  = await fetch(`${API}/api/workspaces`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { setLoading(false); return; }

      const list = await res.json();
      setWorkspaces(list);

      // restore saved active workspace, fall back to first in list
      const saved = parseInt(localStorage.getItem(LS_KEY));
      const found = list.find(w => w.id === saved);
      setActiveWsId(found ? found.id : list[0]?.id ?? null);
    } catch (err) {
      console.error('Failed to load workspaces:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshWorkspaces(); }, [refreshWorkspaces]);

  // switch active workspace and persist choice to localStorage
  const setActiveWorkspace = useCallback((id) => {
    setActiveWsId(id);
    localStorage.setItem(LS_KEY, String(id));
    // dispatch a custom event so pages re-fetch their data
    window.dispatchEvent(new CustomEvent('workspace-changed', { detail: { id } }));
  }, []);

  // create a new workspace and switch to it
  const addWorkspace = useCallback(async (name) => {
    const token = localStorage.getItem('bm_token');
    const res   = await fetch(`${API}/api/workspaces`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error('Failed to create workspace');
    const ws = await res.json();
    await refreshWorkspaces();
    setActiveWorkspace(ws.id);
    return ws;
  }, [refreshWorkspaces, setActiveWorkspace]);

  // delete a workspace — cannot delete the last one
  const removeWorkspace = useCallback(async (id) => {
    const token = localStorage.getItem('bm_token');
    const res   = await fetch(`${API}/api/workspaces/${id}`, {
      method:  'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to delete workspace');
    }
    await refreshWorkspaces();
    // if deleted workspace was active, switch to first remaining
    if (activeWorkspaceId === id) {
      const remaining = workspaces.filter(w => w.id !== id);
      if (remaining.length > 0) setActiveWorkspace(remaining[0].id);
    }
  }, [activeWorkspaceId, workspaces, refreshWorkspaces, setActiveWorkspace]);

  return (
    <WorkspaceContext.Provider value={{
      workspaces, activeWorkspaceId, loading,
      setActiveWorkspace, addWorkspace, removeWorkspace, refreshWorkspaces,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

// hook to consume workspace context — throws if used outside WorkspaceProvider
export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return ctx;
}

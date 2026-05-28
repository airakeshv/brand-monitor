import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function AuthVerify() {
  const [state,  setState]  = useState('loading'); // loading | error
  const [errMsg, setErrMsg] = useState('');
  const navigate            = useNavigate();

  // on mount: read ?token from URL, verify with backend, store JWT and redirect
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setState('error');
      setErrMsg('No token found in the link. Please request a new one.');
      return;
    }

    fetch(`${API}/api/auth/verify?token=${encodeURIComponent(token)}`)
      .then(async res => {
        const j = await res.json();
        if (!res.ok) throw new Error(j.error || `Error ${res.status}`);
        localStorage.setItem('bm_token', j.token);
        // full page reload — forces WorkspaceContext to re-initialise with the new token
        window.location.href = '/dashboard';
      })
      .catch(err => {
        setState('error');
        setErrMsg(err.message);
      });
  }, []);

  return (
    <div style={{
      minHeight: '100vh', background: '#0A0E27',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        textAlign: 'center', background: '#111830',
        border: '1px solid #2A3858', borderRadius: 16,
        padding: '48px 40px', maxWidth: 400, width: '100%',
      }}>

        {/* Logo */}
        <div style={{ marginBottom: 32 }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#FFFFFF' }}>
            Brand<span style={{ color: '#E91E8C' }}>Monitor</span>
          </span>
        </div>

        {/* Loading state */}
        {state === 'loading' && (
          <>
            <div style={{
              width: 40, height: 40,
              border: '3px solid #2A3858', borderTopColor: '#5B63EB',
              borderRadius: '50%', animation: 'spin 0.8s linear infinite',
              margin: '0 auto 20px',
            }} />
            <div style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              Logging you in…
            </div>
            <div style={{ color: '#6B7A99', fontSize: 13 }}>Verifying your magic link</div>
          </>
        )}

        {/* Error state */}
        {state === 'error' && (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🔗</div>
            <div style={{ color: '#ef4444', fontSize: 16, fontWeight: 700, marginBottom: 8 }}>
              This link has expired or is invalid
            </div>
            <div style={{ color: '#6B7A99', fontSize: 13, marginBottom: 24 }}>{errMsg}</div>
            <button
              onClick={() => window.location.href = '/login'}
              style={{
                background: 'linear-gradient(135deg,#5B63EB,#E91E8C)',
                color: '#FFFFFF', border: 'none',
                borderRadius: 8, padding: '11px 24px',
                fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Request a new link
            </button>
          </>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

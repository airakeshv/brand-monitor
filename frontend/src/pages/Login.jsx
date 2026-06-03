import { useState, useEffect } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function Login() {
  const [email,     setEmail]     = useState('');
  const [state,     setState]     = useState('idle'); // idle | loading | success | error
  const [error,     setError]     = useState('');
  const [countdown, setCountdown] = useState(0);

  // redirect to dashboard if already logged in
  useEffect(() => {
    if (localStorage.getItem('bm_token')) window.location.href = '/dashboard';
  }, []);

  // count down from 30 before showing the Resend button
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // POST /api/auth/request-link with the entered email
  const handleSend = async () => {
    if (!email.trim()) return;
    setState('loading');
    setError('');
    try {
      const res = await fetch(`${API}/api/auth/request-link`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Error ${res.status}`);
      }
      setState('success');
      setCountdown(30);
    } catch (err) {
      setError(err.message);
      setState('error');
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#0A0E27',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 420,
        background: '#111830', border: '1px solid #2A3858',
        borderRadius: 16, padding: '40px 36px',
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.5px' }}>
            Brand<span style={{ color: '#E91E8C' }}>Monitor</span>
          </span>
        </div>

        <h1 style={{ color: '#FFFFFF', fontSize: 22, fontWeight: 700, textAlign: 'center', margin: '0 0 8px' }}>
          Sign in to BrandMonitor
        </h1>
        <p style={{ color: '#6B7A99', fontSize: 14, textAlign: 'center', margin: '0 0 28px', lineHeight: 1.5 }}>
          No password needed. We email you a secure one-time login link.
        </p>

        {/* Input + button — hidden in success state */}
        {state !== 'success' && (
          <>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && state !== 'loading' && handleSend()}
              placeholder="you@example.com"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: '#0A0E27',
                border: `1px solid ${state === 'error' ? '#ef4444' : '#2A3858'}`,
                borderRadius: 8, padding: '11px 14px',
                color: '#FFFFFF', fontSize: 15, outline: 'none',
                marginBottom: 12, fontFamily: 'inherit',
              }}
            />

            {state === 'error' && error && (
              <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</div>
            )}

            <button
              onClick={handleSend}
              disabled={state === 'loading' || !email.trim()}
              style={{
                width: '100%',
                background: state === 'loading' ? '#2A3858' : 'linear-gradient(135deg,#5B63EB,#E91E8C)',
                color: '#FFFFFF', border: 'none', borderRadius: 8,
                padding: '12px', fontSize: 15, fontWeight: 700,
                cursor: state === 'loading' || !email.trim() ? 'not-allowed' : 'pointer',
                opacity: !email.trim() ? 0.5 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'opacity 0.2s',
              }}
            >
              {state === 'loading' && (
                <span style={{
                  width: 14, height: 14, border: '2px solid #fff',
                  borderTopColor: 'transparent', borderRadius: '50%',
                  display: 'inline-block', animation: 'spin 0.7s linear infinite',
                }} />
              )}
              {state === 'loading' ? 'Sending…' : 'Send me a login link'}
            </button>
          </>
        )}

        {/* Success state */}
        {state === 'success' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✉️</div>
            <div style={{ color: '#22c55e', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              ✓ Check your inbox
            </div>
            <div style={{ color: '#B4B4B4', fontSize: 13, marginBottom: 4 }}>
              Sent to <strong style={{ color: '#FFFFFF' }}>{email}</strong>
            </div>
            <div style={{ color: '#6B7A99', fontSize: 13, marginBottom: 28 }}>
              Link expires in 15 minutes
            </div>

            {countdown > 0 ? (
              <div style={{ color: '#6B7A99', fontSize: 13 }}>Resend available in {countdown}s</div>
            ) : (
              <button
                onClick={handleSend}
                style={{
                  background: 'none', border: '1px solid #2A3858',
                  color: '#B4B4B4', borderRadius: 6,
                  padding: '8px 20px', fontSize: 13,
                  cursor: 'pointer', fontWeight: 600,
                }}
              >
                Resend
              </button>
            )}
          </div>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

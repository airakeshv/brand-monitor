import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import WorkspaceSwitcher from './WorkspaceSwitcher.jsx';

const navClass = ({ isActive }) =>
  `px-4 py-2 text-sm font-medium rounded-md transition-colors ${
    isActive ? 'bg-[#5B63EB] text-white' : 'text-[#B4B4B4] hover:text-white'
  }`;

// mobile nav link — full-width, slightly larger tap target
const mobileNavClass = ({ isActive }) =>
  `block px-4 py-3 text-sm font-medium rounded-md transition-colors ${
    isActive ? 'bg-[#5B63EB] text-white' : 'text-[#B4B4B4] hover:text-white'
  }`;

// decode email from JWT payload without an extra library
function getUserEmail() {
  try {
    const token = localStorage.getItem('bm_token');
    if (!token) return null;
    return JSON.parse(atob(token.split('.')[1])).email;
  } catch {
    return null;
  }
}

// clear JWT and redirect to login
function handleLogout() {
  localStorage.removeItem('bm_token');
  window.location.href = '/login';
}

export default function Navbar() {
  const email = getUserEmail();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="border-b border-[#2A3858] px-4 sm:px-8 h-16 flex items-center justify-between relative bg-[#0A0E27]"
      style={{ zIndex: 40 }}>

      {/* Logo */}
      <span className="text-lg font-bold text-white flex-shrink-0">
        Brand<span className="text-[#E91E8C]">Monitor</span>
      </span>

      {/* Desktop nav links — hidden on mobile */}
      <div className="hidden sm:flex gap-2">
        <NavLink to="/dashboard" className={navClass}>Dashboard</NavLink>
        <NavLink to="/settings"  className={navClass}>Settings</NavLink>
        <NavLink to="/history"   className={navClass}>History</NavLink>
        <NavLink to="/pricing" className={({ isActive }) =>
          `px-4 py-2 text-sm font-semibold rounded-md transition-colors border ${
            isActive
              ? 'bg-[#5B63EB] text-white border-[#5B63EB]'
              : 'border-[#5B63EB] text-[#A78BFA] hover:bg-[#5B63EB] hover:text-white'
          }`
        }>Pricing</NavLink>
      </div>

      {/* Right side: workspace switcher, email (desktop only), logout, hamburger (mobile only) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <WorkspaceSwitcher />

        {/* Email — hidden on small screens */}
        {email && (
          <span className="hidden sm:inline" style={{ color: '#6B7A99', fontSize: 13 }}>{email}</span>
        )}

        {/* Logout button — always visible */}
        <button
          onClick={handleLogout}
          style={{
            background: 'none', border: '1px solid #2A3858',
            color: '#B4B4B4', borderRadius: 6,
            padding: '6px 14px', fontSize: 13,
            cursor: 'pointer', fontWeight: 600,
          }}
        >
          Logout
        </button>

        {/* Hamburger button — only on mobile */}
        <button
          onClick={() => setMenuOpen(p => !p)}
          className="sm:hidden"
          aria-label="Toggle navigation menu"
          style={{
            background: 'none', border: '1px solid #2A3858',
            color: '#B4B4B4', borderRadius: 6,
            padding: '5px 9px', fontSize: 18,
            cursor: 'pointer', lineHeight: 1, fontWeight: 400,
          }}
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile dropdown menu — slides in below navbar */}
      {menuOpen && (
        <div
          className="sm:hidden"
          style={{
            position: 'absolute', top: '64px', left: 0, right: 0,
            background: '#111830', borderBottom: '1px solid #2A3858',
            zIndex: 50, padding: '8px 12px 12px',
            display: 'flex', flexDirection: 'column', gap: 2,
          }}
        >
          <NavLink to="/dashboard" className={mobileNavClass} onClick={() => setMenuOpen(false)}>Dashboard</NavLink>
          <NavLink to="/settings"  className={mobileNavClass} onClick={() => setMenuOpen(false)}>Settings</NavLink>
          <NavLink to="/history"   className={mobileNavClass} onClick={() => setMenuOpen(false)}>History</NavLink>
          <NavLink to="/pricing"   className={mobileNavClass} onClick={() => setMenuOpen(false)}>Pricing</NavLink>
          {email && (
            <div style={{
              color: '#6B7A99', fontSize: 12, padding: '8px 16px 4px',
              borderTop: '1px solid #2A3858', marginTop: 4,
            }}>
              {email}
            </div>
          )}
        </div>
      )}
    </nav>
  );
}

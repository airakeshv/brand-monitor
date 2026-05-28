import { NavLink } from 'react-router-dom';
import WorkspaceSwitcher from './WorkspaceSwitcher.jsx';

const navClass = ({ isActive }) =>
  `px-4 py-2 text-sm font-medium rounded-md transition-colors ${
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

  return (
    <nav className="border-b border-[#2A3858] px-8 h-16 flex items-center justify-between">
      {/* Logo */}
      <span className="text-lg font-bold text-white">
        Brand<span className="text-[#E91E8C]">Monitor</span>
      </span>

      {/* Nav links */}
      <div className="flex gap-2">
        <NavLink to="/dashboard" className={navClass}>Dashboard</NavLink>
        <NavLink to="/settings"  className={navClass}>Settings</NavLink>
        <NavLink to="/history"   className={navClass}>History</NavLink>
      </div>

      {/* User + logout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <WorkspaceSwitcher />
        {email && (
          <span style={{ color: '#6B7A99', fontSize: 13 }}>{email}</span>
        )}
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
      </div>
    </nav>
  );
}

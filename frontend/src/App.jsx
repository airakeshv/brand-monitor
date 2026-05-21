import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import Settings from './pages/Settings.jsx';
import History from './pages/History.jsx';
import './index.css';

// nav link style helper
const navClass = ({ isActive }) =>
  `px-4 py-2 text-sm font-medium rounded-md transition-colors ${
    isActive ? 'bg-[#5B63EB] text-white' : 'text-[#B4B4B4] hover:text-white'
  }`;

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#0A0E27] text-white">
        <nav className="border-b border-[#2A3858] px-8 h-16 flex items-center justify-between">
          <span className="text-lg font-bold text-white">
            Brand<span className="text-[#E91E8C]">Monitor</span>
          </span>
          <div className="flex gap-2">
            <NavLink to="/" end className={navClass}>Dashboard</NavLink>
            <NavLink to="/settings" className={navClass}>Settings</NavLink>
            <NavLink to="/history" className={navClass}>History</NavLink>
          </div>
        </nav>
        <main className="max-w-[1280px] mx-auto px-6 py-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/history" element={<History />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

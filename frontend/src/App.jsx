import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard  from './pages/Dashboard.jsx';
import Settings   from './pages/Settings.jsx';
import History    from './pages/History.jsx';
import Login      from './pages/Login.jsx';
import AuthVerify from './pages/AuthVerify.jsx';
import Navbar     from './components/Navbar.jsx';
import './index.css';

// wraps authenticated pages — redirects to /login if no JWT in localStorage
function ProtectedRoute({ children }) {
  const token = localStorage.getItem('bm_token');
  if (!token) return <Navigate to="/login" replace />;
  return (
    <div className="min-h-screen bg-[#0A0E27] text-white">
      <Navbar />
      <main className="max-w-[1280px] mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* public routes */}
        <Route path="/login"       element={<Login />} />
        <Route path="/auth/verify" element={<AuthVerify />} />

        {/* root redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* protected routes */}
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/settings"  element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/history"   element={<ProtectedRoute><History /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

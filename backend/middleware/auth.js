import { verifyJWT } from '../services/authService.js';

// validate JWT from Authorization header — attaches req.userId and req.userEmail or returns 401
export function requireAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) return res.status(401).json({ error: 'Authentication required' });

  const payload = verifyJWT(token);
  if (!payload)  return res.status(401).json({ error: 'Invalid or expired token' });

  req.userId    = payload.userId;
  req.userEmail = payload.email;
  next();
}

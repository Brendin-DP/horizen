import jwt from 'jsonwebtoken';
import supabase from '../db.js';
import { mapMember } from '../utils/mappers.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'gymapp-dev-secret-change-in-production';

export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }

  // #region agent log
  fetch('http://127.0.0.1:7613/ingest/647d3ca5-187f-4bcf-aae1-ccc3f04a480d', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '7fe38e' },
    body: JSON.stringify({
      sessionId: '7fe38e',
      location: 'auth.js:requireAuth:entry',
      message: 'requireAuth entry',
      data: {
        hypothesisId: 'H0',
        path: req.originalUrl || req.path,
        method: req.method,
        tokenLen: token.length,
        hasJwtSecretEnv: !!process.env.JWT_SECRET,
      },
      timestamp: Date.now(),
      hypothesisId: 'H0',
    }),
  }).catch(() => {});
  // #endregion

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { data: member, error } = await supabase
      .from('members')
      .select('*')
      .eq('id', decoded.memberId)
      .single();
    if (error || !member) {
      // #region agent log
      fetch('http://127.0.0.1:7613/ingest/647d3ca5-187f-4bcf-aae1-ccc3f04a480d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '7fe38e' },
        body: JSON.stringify({
          sessionId: '7fe38e',
          location: 'auth.js:requireAuth:memberLookup',
          message: 'member missing or db error',
          data: {
            hypothesisId: 'H4',
            hasMemberIdInPayload: decoded.memberId != null,
            supabaseError: error ? String(error.message || error.code || 'err').slice(0, 80) : null,
          },
          timestamp: Date.now(),
          hypothesisId: 'H4',
        }),
      }).catch(() => {});
      // #endregion
      return res.status(401).json({ error: 'Member not found' });
    }
    req.member = mapMember(member);
    // #region agent log
    fetch('http://127.0.0.1:7613/ingest/647d3ca5-187f-4bcf-aae1-ccc3f04a480d', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '7fe38e' },
      body: JSON.stringify({
        sessionId: '7fe38e',
        location: 'auth.js:requireAuth:ok',
        message: 'auth ok',
        data: { hypothesisId: 'H-ok', path: req.originalUrl || req.path },
        timestamp: Date.now(),
        hypothesisId: 'H-ok',
      }),
    }).catch(() => {});
    // #endregion
    next();
  } catch (err) {
    console.error('[requireAuth]', err?.name, typeof err?.message === 'string' ? err.message.slice(0, 120) : err);
    // #region agent log
    fetch('http://127.0.0.1:7613/ingest/647d3ca5-187f-4bcf-aae1-ccc3f04a480d', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '7fe38e' },
      body: JSON.stringify({
        sessionId: '7fe38e',
        location: 'auth.js:requireAuth:catch',
        message: 'requireAuth catch (JWT or unexpected)',
        data: {
          hypothesisId: 'H1',
          errName: err?.name,
          errMsg: typeof err?.message === 'string' ? err.message.slice(0, 120) : String(err),
        },
        timestamp: Date.now(),
        hypothesisId: 'H1',
      }),
    }).catch(() => {});
    // #endregion
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.member) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.member.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

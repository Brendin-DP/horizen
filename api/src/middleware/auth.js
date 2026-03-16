const jwt = require('jsonwebtoken');
const { getDb } = require('../db.js');
const { toPublicMember } = require('../utils/members.js');

const JWT_SECRET = process.env.JWT_SECRET || 'gymapp-dev-secret-change-in-production';

/**
 * Verify JWT and attach req.member for protected routes.
 * Returns 401 if invalid or member not found.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const db = getDb();
    db.read();
    const member = db.get('members').find({ id: decoded.memberId }).value();
    if (!member) {
      return res.status(401).json({ error: 'Member not found' });
    }
    req.member = toPublicMember(member);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { requireAuth, JWT_SECRET };

const jwt = require('jsonwebtoken');
const { supabase } = require('../db.js');
const { mapMember } = require('../utils/mappers.js');

const JWT_SECRET = process.env.JWT_SECRET || 'gymapp-dev-secret-change-in-production';

async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { data: member, error } = await supabase
      .from('members')
      .select('*')
      .eq('id', decoded.memberId)
      .single();
    if (error || !member) {
      return res.status(401).json({ error: 'Member not found' });
    }
    req.member = mapMember(member);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(...roles) {
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

module.exports = { requireAuth, requireRole, JWT_SECRET };

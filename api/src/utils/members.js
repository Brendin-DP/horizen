/**
 * Returns a member object safe for client consumption (no passwordHash).
 */
function toPublicMember(member) {
  if (!member) return null;
  const { passwordHash, ...publicMember } = member;
  return publicMember;
}

module.exports = { toPublicMember };

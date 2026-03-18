import { mapMember } from './mappers.js';

/**
 * Returns a member object safe for client consumption (no password).
 * Handles both snake_case DB rows and camelCase in-memory objects.
 */
export function toPublicMember(member) {
  if (!member) return null;
  if (member.password_hash !== undefined) {
    return mapMember(member);
  }
  const { passwordHash, ...publicMember } = member;
  return publicMember;
}

/**
 * Optional dev-only member id from env (e.g. local API tests). Prefer AuthContext `member.id`.
 * TODO: remove; use auth only in production builds.
 */
export const DEV_MEMBER_ID_FROM_ENV =
  typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_DEV_MEMBER_ID
    ? process.env.EXPO_PUBLIC_DEV_MEMBER_ID.trim() || undefined
    : undefined;

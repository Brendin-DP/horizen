import { useEffect } from 'react';
import { usePostHog } from 'posthog-react-native';
import { useAuth } from '../contexts/AuthContext';

/**
 * Syncs auth state with PostHog: identifies user when logged in, resets on logout.
 * Renders nothing.
 */
export function PostHogAuthSync() {
  const { token, member } = useAuth();
  const posthog = usePostHog();

  useEffect(() => {
    if (!posthog) return;

    if (!token) {
      posthog.reset();
      return;
    }

    if (member) {
      posthog.identify(member.id, {
        email: member.email,
        name: member.name,
        role: member.role,
      });
    }
  }, [token, member, posthog]);

  return null;
}

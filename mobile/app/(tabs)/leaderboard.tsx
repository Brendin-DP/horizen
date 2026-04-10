import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { usePostHog } from 'posthog-react-native';
import { LeaderboardView } from '../../components/LeaderboardView';
import { trackLeaderboardViewed } from '../../lib/analytics';

export default function LeaderboardScreen() {
  const posthog = usePostHog();

  useFocusEffect(
    useCallback(() => {
      trackLeaderboardViewed(posthog);
    }, [posthog])
  );

  return <LeaderboardView />;
}

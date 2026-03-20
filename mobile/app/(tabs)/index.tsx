import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { SHOW_WORKOUTS } from '../../lib/featureFlags';

export default function HomeScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace(SHOW_WORKOUTS ? '/(tabs)/workouts' : '/(tabs)/exercises');
  }, [router]);

  return null;
}

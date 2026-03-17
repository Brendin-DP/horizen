import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../constants/theme';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { token, isLoading, hasCompletedWelcome } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (isLoading) return;

    const inAuth = segments[0] === 'login' || segments[0] === 'register';
    const inLoading = segments[0] === 'loading';
    const inWelcome = segments[0] === 'welcome';

    if (!token) {
      if (!inAuth && !inLoading) {
        router.replace('/login');
      }
      return;
    }

    if (token && !hasCompletedWelcome && !inWelcome) {
      router.replace('/welcome');
    }
  }, [token, isLoading, hasCompletedWelcome, segments]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});

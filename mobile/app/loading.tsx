import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { usePostHog } from 'posthog-react-native';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../constants/theme';

export default function LoadingScreen() {
  const router = useRouter();
  const posthog = usePostHog();
  const { authRequest, executeAuthRequest } = useAuth();
  const executed = useRef(false);

  useEffect(() => {
    if (!authRequest) {
      const t = setTimeout(() => router.replace('/login'), 100);
      return () => clearTimeout(t);
    }
    if (executed.current) return;
    executed.current = true;
    executeAuthRequest(authRequest)
      .then(() => {
        const event = authRequest.type === 'register' ? 'signed_up' : 'logged_in';
        posthog?.capture(event, { email: authRequest.email, name: authRequest.name });
        router.replace('/welcome');
      })
      .catch(() => router.replace('/login'));
  }, [authRequest, executeAuthRequest, router, posthog]);

  return (
    <LinearGradient
      colors={[colors.textPrimary, colors.textSecondary]}
      style={styles.container}
    >
      <ActivityIndicator size="large" color={colors.white} />
      <Text style={styles.text}>Signing you in...</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    marginTop: 16,
    color: colors.white,
    fontSize: 16,
  },
});

import { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, BackHandler } from 'react-native';
import { useRouter } from 'expo-router';
import { usePostHog } from 'posthog-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, shell, typography, borderRadius } from '../constants/theme';
import { trackFeatureRequestSuccessViewed } from '../lib/analytics';

export default function FeatureRequestSuccessScreen() {
  const router = useRouter();
  const posthog = usePostHog();

  useEffect(() => {
    trackFeatureRequestSuccessViewed(posthog);
  }, [posthog]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      router.replace('/(tabs)/profile');
      return true;
    });
    return () => sub.remove();
  }, [router]);

  function handleSubmitAnother() {
    router.replace({
      pathname: '/feature-request',
      params: { reset: String(Date.now()) },
    });
  }

  function handleBackToProfile() {
    router.replace('/(tabs)/profile');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.center}>
        <View style={styles.iconCircle}>
          <Ionicons name="checkmark" size={40} color={colors.primary} />
        </View>
        <Text style={styles.title}>Request Submitted!</Text>
        <Text style={styles.body}>
          Thanks for your feedback. We review all requests and update our roadmap regularly.
        </Text>

        <View style={styles.buttons}>
          <Pressable
            style={styles.primaryBtn}
            onPress={handleSubmitAnother}
            accessibilityRole="button"
            accessibilityLabel="Submit another request"
          >
            <Text style={styles.primaryBtnText}>Submit Another</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryBtn}
            onPress={handleBackToProfile}
            accessibilityRole="button"
            accessibilityLabel="Back to Profile"
          >
            <Text style={styles.secondaryBtnText}>Back to Profile</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: shell.body,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.recordModalCircle,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    color: colors.textPrimary,
    fontFamily: typography.heading,
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 16,
    color: colors.textMuted,
    fontFamily: typography.body,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  buttons: {
    width: '100%',
    maxWidth: 360,
    gap: 12,
  },
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 16,
    fontFamily: typography.bodySemibold,
  },
  secondaryBtn: {
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 16,
    fontFamily: typography.bodySemibold,
  },
});

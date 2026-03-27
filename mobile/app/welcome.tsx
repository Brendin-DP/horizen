import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ImageBackground,
  Dimensions,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { SHOW_WORKOUTS } from '../lib/featureFlags';
import { colors, typography } from '../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

const { height: WINDOW_HEIGHT } = Dimensions.get('window');
const CARD_INITIAL_OFFSET = Math.min(480, WINDOW_HEIGHT * 0.45);

export default function WelcomeScreen() {
  const router = useRouter();
  const { member, completeWelcome } = useAuth();
  const translateY = useSharedValue(CARD_INITIAL_OFFSET);
  const opacity = useSharedValue(0);
  const [isExiting, setIsExiting] = useState(false);

  const navigateAfterExit = useCallback(() => {
    completeWelcome();
    const role = member?.role;
    if (role === 'admin' || role === 'instructor') {
      router.replace('/(admin)/members');
    } else {
      router.replace(SHOW_WORKOUTS ? '/(tabs)/workouts' : '/(tabs)/exercises');
    }
  }, [member?.role, router, completeWelcome]);

  const runExit = useCallback(() => {
    if (isExiting) return;
    setIsExiting(true);
    translateY.value = withTiming(
      -WINDOW_HEIGHT,
      { duration: 380, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) {
          runOnJS(navigateAfterExit)();
        }
      }
    );
    opacity.value = withTiming(0, {
      duration: 320,
      easing: Easing.in(Easing.cubic),
    });
  }, [isExiting, navigateAfterExit, translateY, opacity]);

  useEffect(() => {
    translateY.value = withTiming(0, {
      duration: 520,
      easing: Easing.out(Easing.cubic),
    });
    opacity.value = withTiming(1, { duration: 500 });
  }, [translateY, opacity]);

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const firstName =
    member?.name?.trim().split(/\s+/).filter(Boolean)[0] ?? 'there';

  return (
    <ImageBackground
      source={require('../assets/gym-bg.png')}
      style={styles.bg}
      resizeMode="cover"
    >
      <View style={styles.overlay} pointerEvents="none" />
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <Animated.View style={[styles.card, animatedCardStyle]}>
          <Image source={require('../assets/logo.png')} style={styles.logo} />
          <Text style={styles.greeting}>Welcome back {firstName}</Text>
          <Text style={styles.sub}>We're so glad you're here.</Text>
          <Pressable
            style={[styles.button, isExiting && styles.buttonDisabled]}
            onPress={() => runExit()}
            disabled={isExiting}
          >
            <Text style={styles.buttonText}>Let's Go</Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  safe: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 8,
    overflow: 'visible',
  },
  card: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    marginBottom: 16,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 24,
  },
  greeting: {
    fontSize: 24,
    color: colors.textPrimary,
    fontFamily: typography.heading,
    textAlign: 'center',
  },
  sub: {
    fontSize: 16,
    color: colors.textMuted,
    marginTop: 8,
    textAlign: 'center',
  },
  button: {
    marginTop: 32,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 16,
  },
});

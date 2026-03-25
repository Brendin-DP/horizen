import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ImageBackground,
  Dimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { SHOW_WORKOUTS } from '../lib/featureFlags';
import { colors } from '../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

const { height: WINDOW_HEIGHT } = Dimensions.get('window');
const CARD_INITIAL_OFFSET = Math.min(480, WINDOW_HEIGHT * 0.45);
const DISMISS_DISTANCE_PX = -72;
const DISMISS_VELOCITY_Y = -650;

export default function WelcomeScreen() {
  const router = useRouter();
  const { member, completeWelcome } = useAuth();
  const translateY = useSharedValue(CARD_INITIAL_OFFSET);
  const dragY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const [isExiting, setIsExiting] = useState(false);
  const [entryDone, setEntryDone] = useState(false);

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
    translateY.value = translateY.value + dragY.value;
    dragY.value = 0;
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
  }, [isExiting, navigateAfterExit, translateY, dragY, opacity]);

  useEffect(() => {
    translateY.value = withTiming(
      0,
      { duration: 520, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) {
          runOnJS(setEntryDone)(true);
        }
      }
    );
    opacity.value = withTiming(1, { duration: 500 });
  }, [translateY, opacity]);

  const animatedCardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value + dragY.value }],
    opacity: opacity.value,
  }));

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(entryDone && !isExiting)
        .activeOffsetY([-12, 12])
        .failOffsetX([-28, 28])
        .onUpdate((e) => {
          const ty = Math.min(0, e.translationY);
          dragY.value = ty;
        })
        .onEnd((e) => {
          const ty = Math.min(0, e.translationY);
          const vy = e.velocityY;
          if (ty <= DISMISS_DISTANCE_PX || vy < DISMISS_VELOCITY_Y) {
            runOnJS(runExit)();
          } else {
            dragY.value = withSpring(0, { damping: 18, stiffness: 220 });
          }
        }),
    [entryDone, isExiting, runExit]
  );

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
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.card, animatedCardStyle]}>
            <View style={styles.sheetHandle} />
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
        </GestureDetector>
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
    paddingTop: 12,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    marginBottom: 16,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
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
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  sub: {
    fontSize: 16,
    color: colors.textMuted,
    marginTop: 8,
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

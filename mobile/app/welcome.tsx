import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Image, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { SHOW_WORKOUTS } from '../lib/featureFlags';
import { colors } from '../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function WelcomeScreen() {
  const router = useRouter();
  const { member, completeWelcome } = useAuth();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  function handleLetsGo() {
    completeWelcome();
    const role = member?.role;
    if (role === 'admin' || role === 'instructor') {
      router.replace('/(admin)/members');
    } else {
      router.replace(SHOW_WORKOUTS ? '/(tabs)/workouts' : '/(tabs)/exercises');
    }
  }

  return (
    <ImageBackground
      source={require('../assets/gym-bg.png')}
      style={styles.bg}
      resizeMode="cover"
    >
      <View style={styles.overlay} pointerEvents="none" />
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
          <View style={styles.sheetHandle} />
          <Image source={require('../assets/logo.png')} style={styles.logo} />
          <Text style={styles.greeting}>Welcome, {member?.name ?? 'there'}</Text>
          <Text style={styles.sub}>We're so glad you're here.</Text>
          <Pressable style={styles.button} onPress={handleLetsGo}>
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
  buttonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 16,
  },
});

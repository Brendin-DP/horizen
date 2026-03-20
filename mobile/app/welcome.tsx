import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
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
    <LinearGradient
      colors={[colors.textPrimary, colors.textSecondary]}
      style={styles.bg}
    >
      <SafeAreaView style={styles.safe}>
        <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
          <Image source={require('../assets/logo.png')} style={styles.logo} />
          <Text style={styles.greeting}>Welcome, {member?.name ?? 'there'}</Text>
          <Text style={styles.sub}>We're so glad you're here.</Text>
          <Pressable style={styles.button} onPress={handleLetsGo}>
            <Text style={styles.buttonText}>Let's Go</Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },
  safe: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
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

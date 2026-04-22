import { useState, useCallback, useRef } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as ExpoSplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Montserrat_700Bold,
  Montserrat_600SemiBold,
  Montserrat_500Medium,
} from '@expo-google-fonts/montserrat';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { PostHogProvider } from 'posthog-react-native';
import { AuthProvider } from '../contexts/AuthContext';
import { AuthGate } from '../components/AuthGate';
import { PostHogAuthSync } from '../components/PostHogAuthSync';
import SplashScreen from './splash';
import { colors } from '../constants/theme';
import { applyTypographyDefaults } from '../constants/typographyDefaults';

const POSTHOG_KEY =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_POSTHOG_KEY) ||
  'phc_gqrnkTfUwzZb1xT25vBQjFppfg2ko5RsFCYQnWUAaQP';

ExpoSplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [splashDone, setSplashDone] = useState(false);
  const handleSplashComplete = useCallback(() => setSplashDone(true), []);
  const typographyReady = useRef(false);
  const [fontsLoaded] = useFonts({
    Montserrat_700Bold,
    Montserrat_600SemiBold,
    Montserrat_500Medium,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
  });

  if (fontsLoaded && !typographyReady.current) {
    typographyReady.current = true;
    applyTypographyDefaults();
  }

  if (!fontsLoaded) {
    return (
      <>
        <StatusBar style="light" />
        <View style={{ flex: 1, backgroundColor: colors.splashBg }} />
      </>
    );
  }

  return (
    <SafeAreaProvider>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <PostHogProvider
        apiKey={POSTHOG_KEY}
        options={{
          host: 'https://us.i.posthog.com',
          disabled: __DEV__,
        }}
      >
        <AuthProvider>
          <PostHogAuthSync />
          {!splashDone ? (
            <SplashScreen onComplete={handleSplashComplete} />
          ) : (
            <AuthGate>
              <Stack
                screenOptions={{
                  headerShown: false,
                  animation: 'slide_from_right',
                }}
              >
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="(admin)" />
                <Stack.Screen name="workout/[id]" options={{ presentation: 'card' }} />
                <Stack.Screen name="exercise/[id]" options={{ presentation: 'card' }} />
                <Stack.Screen name="exercise/log" options={{ presentation: 'card' }} />
                <Stack.Screen name="exercise-log/[workoutExerciseId]" options={{ presentation: 'card' }} />
                <Stack.Screen name="log/[id]" options={{ presentation: 'card' }} />
                <Stack.Screen name="log/edit/[id]" options={{ presentation: 'card' }} />
                <Stack.Screen name="login" />
                <Stack.Screen name="register" />
                <Stack.Screen name="loading" />
                <Stack.Screen name="welcome" />
                <Stack.Screen name="privacy" options={{ presentation: 'card' }} />
                <Stack.Screen name="account" options={{ presentation: 'card' }} />
                <Stack.Screen name="roadmap" options={{ presentation: 'card' }} />
                <Stack.Screen name="feature-request" options={{ presentation: 'card' }} />
                <Stack.Screen
                  name="feature-request-success"
                  options={{ presentation: 'card', gestureEnabled: false }}
                />
              </Stack>
            </AuthGate>
          )}
        </AuthProvider>
      </PostHogProvider>
    </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}

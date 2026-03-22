import { useState, useCallback } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { PostHogProvider } from 'posthog-react-native';
import { AuthProvider } from '../contexts/AuthContext';
import { AuthGate } from '../components/AuthGate';
import { PostHogAuthSync } from '../components/PostHogAuthSync';
import SplashScreen from './splash';

const POSTHOG_KEY =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_POSTHOG_KEY) ||
  'phc_gqrnkTfUwzZb1xT25vBQjFppfg2ko5RsFCYQnWUAaQP';

ExpoSplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [splashDone, setSplashDone] = useState(false);
  const handleSplashComplete = useCallback(() => setSplashDone(true), []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
                <Stack.Screen name="log/edit/[id]" options={{ presentation: 'card' }} />
                <Stack.Screen name="login" />
                <Stack.Screen name="register" />
                <Stack.Screen name="loading" />
                <Stack.Screen name="welcome" />
              </Stack>
            </AuthGate>
          )}
        </AuthProvider>
      </PostHogProvider>
    </GestureHandlerRootView>
  );
}

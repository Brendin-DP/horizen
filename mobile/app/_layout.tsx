import { useState, useCallback } from 'react';
import { Stack } from 'expo-router';
import { AuthProvider } from '../contexts/AuthContext';
import { AuthGate } from '../components/AuthGate';
import SplashScreen from './splash';

export default function RootLayout() {
  const [splashDone, setSplashDone] = useState(false);
  const handleSplashComplete = useCallback(() => setSplashDone(true), []);

  return (
    <AuthProvider>
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
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="loading" />
          <Stack.Screen name="welcome" />
        </Stack>
      </AuthGate>
      )}
    </AuthProvider>
  );
}

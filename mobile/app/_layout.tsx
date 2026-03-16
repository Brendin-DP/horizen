import { Stack } from 'expo-router';
import { AuthProvider } from '../contexts/AuthContext';
import { AuthGate } from '../components/AuthGate';

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthGate>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
        </Stack>
      </AuthGate>
    </AuthProvider>
  );
}

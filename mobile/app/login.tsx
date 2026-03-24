import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const { setAuthRequest, authError, clearAuthError } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authError) {
      setError(authError);
      clearAuthError();
    }
  }, [authError]);

  const displayError = error || authError;
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  function handleSubmit() {
    if (!email.trim() || !password) {
      setError('Email and password are required');
      return;
    }
    setError(null);
    setLoading(true);
    setAuthRequest({
      email: email.trim(),
      password,
      type: 'login',
    });
    router.replace('/loading');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Image source={require('../assets/logo.png')} style={styles.logo} />
        <Text style={styles.title}>Sign in</Text>
        <Text style={styles.subtitle}>Use your email and password</Text>

        {displayError && <Text style={styles.error}>{displayError}</Text>}

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={[
            styles.input,
            emailFocused && styles.inputFocused,
          ]}
          placeholder="you@example.com"
          placeholderTextColor={colors.textMuted}
          value={email}
          onChangeText={setEmail}
          onFocus={() => setEmailFocused(true)}
          onBlur={() => setEmailFocused(false)}
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={[
            styles.input,
            passwordFocused && styles.inputFocused,
          ]}
          placeholder="Your password"
          placeholderTextColor={colors.textMuted}
          value={password}
          onChangeText={setPassword}
          onFocus={() => setPasswordFocused(true)}
          onBlur={() => setPasswordFocused(false)}
          secureTextEntry
        />

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Signing in…' : 'Sign in'}</Text>
        </Pressable>

        <Pressable style={styles.forgotLink}>
          <Text style={styles.forgotText}>Forgot password?</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 32,
    paddingBottom: 48,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignSelf: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 8,
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  error: {
    color: colors.primary,
    marginBottom: 16,
  },
  input: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    color: colors.textPrimary,
    marginBottom: 20,
    fontSize: 16,
  },
  inputFocused: {
    borderColor: colors.borderFocus,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 16,
  },
  forgotLink: {
    marginTop: 16,
    alignSelf: 'center',
  },
  forgotText: {
    color: colors.textMuted,
    fontSize: 14,
  },
});

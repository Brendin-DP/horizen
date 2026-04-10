import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../contexts/AuthContext';
import { submitFeatureRequest } from '../lib/api';
import { colors, shell, typography, borderRadius } from '../constants/theme';
import { DrillDownHeader } from '../components/DrillDownHeader';

const TITLE_MAX = 100;
const DESCRIPTION_MAX = 500;

export default function FeatureRequestScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuth();
  const params = useLocalSearchParams<{ reset?: string }>();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const clearForm = useCallback(() => {
    setTitle('');
    setDescription('');
    setSubmitError(null);
  }, []);

  useEffect(() => {
    if (params.reset) {
      clearForm();
    }
  }, [params.reset, clearForm]);

  const canSubmit =
    !!token &&
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    !saving;

  async function handleSubmit() {
    if (!token || !canSubmit) return;
    setSaving(true);
    setSubmitError(null);
    try {
      await submitFeatureRequest(
        { title: title.trim(), description: description.trim() },
        token
      );
      router.replace('/feature-request-success');
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <DrillDownHeader
          title="Request a Feature"
          onBack={() => router.back()}
        />
        <View style={styles.bodyFill}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.hero}>
              <View style={styles.heroIconCircle} accessibilityElementsHidden>
                <Ionicons name="sparkles-outline" size={36} color={colors.primary} />
              </View>
              <Text style={styles.heroHeadline}>Have an idea or found a bug?</Text>
              <Text style={styles.heroSubtext}>
                Let us know — we read every submission and use feedback to shape what we build next.
              </Text>
            </View>

            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={(t) => setTitle(t.slice(0, TITLE_MAX))}
              placeholder="Give your request a short title"
              placeholderTextColor={colors.textMuted}
              maxLength={TITLE_MAX}
              editable={!saving}
            />
            <Text style={styles.charCount}>
              {title.length}/{TITLE_MAX}
            </Text>

            <Text style={[styles.label, styles.labelSpacing]}>Description</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={description}
              onChangeText={(t) => setDescription(t.slice(0, DESCRIPTION_MAX))}
              placeholder="Describe what you'd like to see and why it would be helpful"
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              maxLength={DESCRIPTION_MAX}
              editable={!saving}
            />
            <Text style={styles.charCount}>
              {description.length}/{DESCRIPTION_MAX}
            </Text>
          </ScrollView>

          <View
            style={[
              styles.footerCtaContainer,
              { paddingBottom: 12 + insets.bottom + 8 },
            ]}
          >
            {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
            <Pressable
              style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              accessibilityRole="button"
              accessibilityLabel="Submit Request"
            >
              {saving ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.submitBtnText}>Submit Request</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: shell.header },
  flex: { flex: 1 },
  bodyFill: { flex: 1 },
  scroll: { flex: 1, backgroundColor: shell.body },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 28,
    paddingHorizontal: 4,
  },
  heroIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.emptyStateCircle,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  heroHeadline: {
    fontSize: 19,
    lineHeight: 26,
    textAlign: 'center',
    color: colors.textPrimary,
    fontFamily: typography.headingSemibold,
    marginBottom: 10,
  },
  heroSubtext: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    color: colors.textSecondary,
    fontFamily: typography.body,
  },
  footerCtaContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: shell.footer,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
    fontFamily: typography.bodySemibold,
  },
  labelSpacing: { marginTop: 8 },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textPrimary,
    fontFamily: typography.body,
  },
  inputMultiline: {
    minHeight: 120,
    paddingTop: 12,
  },
  charCount: {
    alignSelf: 'flex-end',
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
    fontFamily: typography.body,
  },
  error: {
    color: colors.primary,
    fontSize: 14,
    marginBottom: 12,
    fontFamily: typography.body,
  },
  submitBtn: {
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  submitBtnDisabled: {
    opacity: 0.45,
  },
  submitBtnText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 16,
    fontFamily: typography.bodySemibold,
  },
});

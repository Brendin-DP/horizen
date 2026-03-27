import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { changePassword, updateProfile } from '../lib/api';
import { colors, shell, typography } from '../constants/theme';
import { DrillDownHeader } from '../components/DrillDownHeader';

const MIN_PASSWORD_LENGTH = 8;

function splitName(full: string): { first: string; last: string } {
  const t = full.trim();
  if (!t) return { first: '', last: '' };
  const i = t.indexOf(' ');
  if (i === -1) return { first: t, last: '' };
  return { first: t.slice(0, i), last: t.slice(i + 1).trim() };
}

export default function AccountScreen() {
  const router = useRouter();
  const { member, token, updateMember } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [surname, setSurname] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    if (!member) return;
    const { first, last } = splitName(member.name);
    setFirstName(first);
    setSurname(last);
  }, [member?.id, member?.name]);

  const closePasswordModal = useCallback(() => {
    setPasswordModalOpen(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }, []);

  async function handleSave() {
    if (!token || !member) return;
    const trimmedFirst = firstName.trim();
    if (!trimmedFirst) {
      Alert.alert('Missing name', 'Please enter your first name.');
      return;
    }
    const name = `${trimmedFirst} ${surname.trim()}`.trim();
    setSaveLoading(true);
    try {
      const updated = await updateProfile({ name }, token);
      await updateMember(updated);
      Alert.alert('Saved', 'Your account details were updated.');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaveLoading(false);
    }
  }

  async function handleChangePasswordSubmit() {
    if (!token) return;
    const cur = currentPassword.trim();
    if (!cur) {
      Alert.alert('Required', 'Enter your current password.');
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      Alert.alert(
        'Password too short',
        `Your new password must be at least ${MIN_PASSWORD_LENGTH} characters.`
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'New password and confirmation do not match.');
      return;
    }
    if (newPassword === cur) {
      Alert.alert('Invalid password', 'Choose a new password that is different from your current one.');
      return;
    }
    setPasswordLoading(true);
    try {
      await changePassword({ currentPassword: cur, newPassword }, token);
      Alert.alert('Success', 'Your password was changed.');
      closePasswordModal();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not change password');
    } finally {
      setPasswordLoading(false);
    }
  }

  if (!member) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <DrillDownHeader title="Account" onBack={() => router.back()} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <DrillDownHeader title="Account" onBack={() => router.back()} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.label}>First name</Text>
          <TextInput
            style={styles.input}
            placeholder="First name"
            placeholderTextColor={colors.textMuted}
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
          />

          <Text style={styles.label}>Surname</Text>
          <TextInput
            style={styles.input}
            placeholder="Surname"
            placeholderTextColor={colors.textMuted}
            value={surname}
            onChangeText={setSurname}
            autoCapitalize="words"
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={member.email}
            editable={false}
            selectTextOnFocus={false}
          />

          <Pressable
            style={[styles.primaryButton, saveLoading && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saveLoading}
          >
            {saveLoading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.primaryButtonText}>Save</Text>
            )}
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={() => setPasswordModalOpen(true)}>
            <Text style={styles.secondaryButtonText}>Change password</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={passwordModalOpen}
        animationType="slide"
        transparent
        onRequestClose={closePasswordModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closePasswordModal}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalAvoid}
          >
            <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
              <Text style={styles.modalTitle}>Change password</Text>

              <Text style={styles.label}>Current password</Text>
              <TextInput
                style={styles.input}
                placeholder="Current password"
                placeholderTextColor={colors.textMuted}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                autoCapitalize="none"
              />

              <Text style={styles.label}>New password</Text>
              <TextInput
                style={styles.input}
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                placeholderTextColor={colors.textMuted}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                autoCapitalize="none"
              />

              <Text style={styles.label}>Confirm new password</Text>
              <TextInput
                style={styles.input}
                placeholder="Confirm new password"
                placeholderTextColor={colors.textMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoCapitalize="none"
              />

              <View style={styles.modalActions}>
                <Pressable style={styles.modalCancel} onPress={closePasswordModal}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.primaryButton, styles.modalSubmit, passwordLoading && styles.buttonDisabled]}
                  onPress={handleChangePasswordSubmit}
                  disabled={passwordLoading}
                >
                  {passwordLoading ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Update password</Text>
                  )}
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: shell.body,
  },
  flex: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    padding: 24,
    paddingBottom: 48,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 8,
    fontFamily: typography.bodyMedium,
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
    fontFamily: typography.body,
  },
  inputDisabled: {
    backgroundColor: shell.body,
    color: colors.textMuted,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 16,
    fontFamily: typography.bodySemibold,
  },
  secondaryButton: {
    marginTop: 16,
    padding: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: typography.bodySemibold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalAvoid: {
    width: '100%',
  },
  modalCard: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
  },
  modalTitle: {
    fontSize: 18,
    color: colors.textPrimary,
    fontFamily: typography.heading,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    alignItems: 'center',
  },
  modalCancel: {
    paddingVertical: 14,
    paddingHorizontal: 8,
  },
  modalCancelText: {
    color: colors.textMuted,
    fontSize: 16,
    fontFamily: typography.body,
  },
  modalSubmit: {
    flex: 1,
    marginTop: 0,
  },
});

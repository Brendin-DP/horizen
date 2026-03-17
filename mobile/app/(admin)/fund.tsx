import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Switch,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../contexts/AuthContext';
import { getFund, updateFund } from '../../lib/api';
import { colors } from '../../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AdminFundScreen() {
  const { member, token, logout } = useAuth();
  const [fund, setFund] = useState<{ target: number; raised: number; visible: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [raisedInput, setRaisedInput] = useState('');
  const [visible, setVisible] = useState(true);

  const fetchFund = useCallback(async () => {
    setError(null);
    try {
      const data = await getFund();
      setFund(data);
      setRaisedInput(String(data.raised));
      setVisible(data.visible !== false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
      setFund({ target: 6000, raised: 0, visible: true });
      setRaisedInput('0');
      setVisible(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFund();
  }, [fetchFund]);

  async function handleSave() {
    if (!token || saving) return;
    const cleaned = raisedInput.replace(/\D/g, '') || '0';
    const raisedNum = parseInt(cleaned, 10);
    if (Number.isNaN(raisedNum) || raisedNum < 0) {
      setError('Enter a valid amount');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateFund({ raised: raisedNum, visible }, token);
      setFund((f) => (f ? { ...f, raised: raisedNum, visible } : null));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Fund Settings</Text>
        <Pressable onPress={logout} style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(member?.name ?? '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
          </Text>
        </Pressable>
      </View>

      {error && <Text style={styles.errorBanner}>{error}</Text>}

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Fundraising</Text>
          <Text style={styles.cardDesc}>
            Target: ZAR {(fund?.target ?? 6000).toLocaleString()} per year
          </Text>

          <View style={styles.row}>
            <Text style={styles.label}>Show on Home page</Text>
            <Switch
              value={visible}
              onValueChange={setVisible}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={visible ? colors.primary : colors.textMuted}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Raised (ZAR)</Text>
            <TextInput
              style={styles.input}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              value={raisedInput}
              onChangeText={(t) => setRaisedInput(t.replace(/\D/g, ''))}
              keyboardType="number-pad"
            />
          </View>

          <Pressable
            style={[styles.saveBtn, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundDark },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { color: colors.textMuted, marginTop: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '600', color: colors.textPrimary, flex: 1 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: colors.white, fontWeight: '600', fontSize: 14 },
  errorBanner: { color: colors.primary, padding: 12, backgroundColor: colors.accent },
  content: { flex: 1, padding: 24 },
  card: {
    backgroundColor: colors.white,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  cardDesc: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  label: { fontSize: 16, color: colors.textPrimary, fontWeight: '500' },
  inputGroup: { marginTop: 16 },
  input: {
    backgroundColor: colors.backgroundDark,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: colors.textPrimary,
    marginTop: 8,
  },
  saveBtn: {
    marginTop: 24,
    padding: 14,
    backgroundColor: colors.primary,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveBtnText: { color: colors.white, fontWeight: '600', fontSize: 16 },
  buttonDisabled: { opacity: 0.6 },
});

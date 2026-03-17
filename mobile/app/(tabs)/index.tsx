import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, StyleSheet, Pressable, Modal, TextInput, Linking, ActivityIndicator } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { createWorkout, getFund, type FundData } from '../../lib/api';
import { FALLBACK_DONATE_URL } from '../../constants/fund';
import { colors } from '../../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const { member, token, logout } = useAuth();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [workoutName, setWorkoutName] = useState('');
  const [fund, setFund] = useState<FundData | null>(null);
  const [fundLoading, setFundLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getFund()
      .then((data) => {
        if (!cancelled) setFund(data);
      })
      .catch(() => {
        if (!cancelled) {
          setFund({
            target: 6000,
            raised: 0,
            donateUrl: FALLBACK_DONATE_URL,
            visible: true,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setFundLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  function openCreateModal() {
    setWorkoutName('');
    setNameModalVisible(true);
  }

  async function handleCreateWorkout() {
    if (!member?.id || creating) return;
    setCreating(true);
    setNameModalVisible(false);
    const name = workoutName.trim() || undefined;
    try {
      const workout = await createWorkout(member.id, name || null, token);
      router.push(`/workout/${workout.id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Horizen Gym</Text>
          <Pressable onPress={logout} style={styles.logout}>
            <Text style={styles.logoutText}>Log out</Text>
          </Pressable>
        </View>

        <Text style={styles.greeting}>Hey, {member?.name ?? 'there'}!</Text>
        <Text style={styles.sub}>Ready to train?</Text>

        <Pressable
          style={[styles.startWorkoutBtn, creating && styles.buttonDisabled]}
          onPress={openCreateModal}
          disabled={creating}
        >
          <Text style={styles.startWorkoutText}>
            {creating ? 'Creating...' : 'Start New Workout'}
          </Text>
        </Pressable>

        {fund?.visible !== false && (
        <View style={styles.fundCard}>
          <Text style={styles.fundTitle}>Help keep Horizen alive by donating something</Text>
          {fundLoading ? (
            <ActivityIndicator size="small" color={colors.primary} style={styles.fundLoader} />
          ) : fund ? (
            <>
              <Text style={styles.cardDesc}>
                ZAR {fund.raised.toLocaleString()} of ZAR {fund.target.toLocaleString()} raised this year
              </Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.min(100, (fund.raised / fund.target) * 100)}%` },
                  ]}
                />
              </View>
              <Pressable
                style={styles.donateBtn}
                onPress={() => fund.donateUrl && Linking.openURL(fund.donateUrl)}
                disabled={!fund.donateUrl}
              >
                <Text style={styles.donateBtnText}>Donate</Text>
              </Pressable>
            </>
          ) : null}
        </View>
        )}
      </View>

      <Modal visible={nameModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Workout</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Workout name (optional)"
              value={workoutName}
              onChangeText={setWorkoutName}
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <View style={styles.modalRow}>
              <Pressable style={styles.modalCancel} onPress={() => setNameModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalCreate, creating && styles.buttonDisabled]}
                onPress={handleCreateWorkout}
                disabled={creating}
              >
                <Text style={styles.modalCreateText}>{creating ? 'Creating...' : 'Create'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  sub: {
    fontSize: 16,
    color: colors.textMuted,
    marginTop: 8,
  },
  cardDesc: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
  fundCard: {
    marginTop: 24,
    backgroundColor: colors.white,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fundLoader: {
    marginTop: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.backgroundDark,
    borderRadius: 4,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  fundTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 22,
  },
  donateBtn: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: 8,
    alignItems: 'center',
  },
  donateBtnText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 16,
  },
  logout: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  logoutText: {
    color: colors.primary,
    fontSize: 14,
  },
  startWorkoutBtn: {
    marginTop: 24,
    padding: 16,
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: 'center',
  },
  startWorkoutText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '600', color: colors.textPrimary, marginBottom: 16 },
  modalInput: {
    backgroundColor: colors.backgroundDark,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
    color: colors.textPrimary,
    fontSize: 16,
    marginBottom: 20,
  },
  modalRow: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  modalCancel: { paddingVertical: 12, paddingHorizontal: 20 },
  modalCancelText: { color: colors.textMuted },
  modalCreate: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  modalCreateText: { color: colors.white, fontWeight: '600' },
});

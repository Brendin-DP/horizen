import { useState, useEffect, useCallback } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { View, Text, StyleSheet, Pressable, Modal, TextInput } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { createWorkout, getExerciseLogs } from '../../lib/api';
import { colors } from '../../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SHOW_WORKOUTS } from '../../lib/featureFlags';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function HomeScreen() {
  const { member, token, logout } = useAuth();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [workoutName, setWorkoutName] = useState('');
  const [recentLogs, setRecentLogs] = useState<Awaited<ReturnType<typeof getExerciseLogs>>>([]);

  const fetchRecentLogs = useCallback(async () => {
    if (!member?.id) return;
    try {
      const logs = await getExerciseLogs(member.id, token);
      setRecentLogs(logs.slice(0, 3));
    } catch {
      setRecentLogs([]);
    }
  }, [member?.id, token]);

  useEffect(() => {
    fetchRecentLogs();
  }, [fetchRecentLogs]);

  useFocusEffect(
    useCallback(() => {
      fetchRecentLogs();
    }, [fetchRecentLogs])
  );

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
          style={styles.logExerciseBtn}
          onPress={() => router.push('/exercise/log')}
        >
          <Text style={styles.logExerciseText}>Log an Exercise</Text>
        </Pressable>

        {SHOW_WORKOUTS && (
          <Pressable
            style={[styles.startWorkoutBtn, creating && styles.buttonDisabled]}
            onPress={openCreateModal}
            disabled={creating}
          >
            <Text style={styles.startWorkoutText}>
              {creating ? 'Creating...' : 'Start New Workout'}
            </Text>
          </Pressable>
        )}

        {recentLogs.length > 0 && (
          <View style={styles.recentSection}>
            <Text style={styles.recentTitle}>Recent logs</Text>
            {recentLogs.map((log) => (
              <View key={log.id} style={styles.recentCard}>
                <Text style={styles.recentName}>{log.exercise?.name ?? 'Exercise'}</Text>
                <Text style={styles.recentDate}>{formatDate(log.loggedAt)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {SHOW_WORKOUTS && (
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
      )}
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
  logout: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  logoutText: {
    color: colors.primary,
    fontSize: 14,
  },
  logExerciseBtn: {
    marginTop: 24,
    padding: 16,
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: 'center',
  },
  logExerciseText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 16,
  },
  startWorkoutBtn: {
    marginTop: 12,
    padding: 16,
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: 'center',
  },
  recentSection: {
    marginTop: 24,
  },
  recentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  recentCard: {
    backgroundColor: colors.backgroundDark,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recentName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  recentDate: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
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

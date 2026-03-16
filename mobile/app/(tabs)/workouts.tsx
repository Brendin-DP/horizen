import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { getWorkouts, createWorkout } from '../../lib/api';
import type { Workout } from '../../types';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function WorkoutsScreen() {
  const { member, token } = useAuth();
  const router = useRouter();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [workoutName, setWorkoutName] = useState('');

  const fetchWorkouts = useCallback(async () => {
    if (!member?.id) return;
    setError(null);
    try {
      const data = await getWorkouts(member.id, token);
      setWorkouts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workouts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [member?.id, token]);

  useEffect(() => {
    fetchWorkouts();
  }, [fetchWorkouts]);

  useFocusEffect(
    useCallback(() => {
      if (member?.id) fetchWorkouts();
    }, [member?.id, fetchWorkouts])
  );

  function openCreateModal() {
    setWorkoutName('');
    setNameModalVisible(true);
  }

  async function handleCreateWorkout() {
    if (!member?.id || creating) return;
    setCreating(true);
    setError(null);
    setNameModalVisible(false);
    const name = workoutName.trim() || undefined;
    try {
      const workout = await createWorkout(member.id, name || null, token);
      router.push(`/workout/${workout.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workout');
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#fbbf24" />
        <Text style={styles.loadingText}>Loading workouts...</Text>
      </View>
    );
  }

  if (error && workouts.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity onPress={() => { setLoading(true); fetchWorkouts(); }} style={styles.retry}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable
        style={[styles.newButton, creating && styles.buttonDisabled]}
        onPress={openCreateModal}
        disabled={creating}
      >
        <Text style={styles.newButtonText}>{creating ? 'Creating...' : 'Start New Workout'}</Text>
      </Pressable>

      <Modal visible={nameModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Workout</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Workout name (optional)"
              value={workoutName}
              onChangeText={setWorkoutName}
              placeholderTextColor="#64748b"
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

      {error && <Text style={styles.errorBanner}>{error}</Text>}

      <FlatList
        data={workouts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchWorkouts(); }} tintColor="#fbbf24" />
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/workout/${item.id}`)}
          >
            <Text style={styles.cardName}>{item.name || 'Untitled Workout'}</Text>
            <Text style={styles.cardDate}>{formatDate(item.startedAt)}</Text>
            <View style={styles.cardMeta}>
              <View style={[styles.badge, item.status === 'completed' ? styles.badgeComplete : styles.badgeProgress]}>
                <Text style={styles.badgeText}>{item.status === 'completed' ? 'Completed' : 'In progress'}</Text>
              </View>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No workouts yet. Start your first one!</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  center: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: { color: '#94a3b8', marginTop: 12 },
  errorText: { color: '#f87171', textAlign: 'center' },
  retry: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#334155',
    borderRadius: 8,
  },
  retryText: { color: '#f8fafc' },
  newButton: {
    margin: 16,
    padding: 14,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  newButtonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  errorBanner: { color: '#f87171', paddingHorizontal: 16, marginBottom: 8 },
  list: { padding: 16, paddingTop: 0 },
  card: {
    backgroundColor: '#1e293b',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardName: { fontSize: 18, fontWeight: '600', color: '#f8fafc' },
  cardDate: { fontSize: 14, color: '#94a3b8', marginTop: 4 },
  cardMeta: { flexDirection: 'row', marginTop: 8 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeProgress: { backgroundColor: '#fbbf24' },
  badgeComplete: { backgroundColor: '#22c55e' },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#0f172a' },
  empty: { color: '#94a3b8', textAlign: 'center', padding: 32 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#f8fafc', marginBottom: 16 },
  modalInput: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 14,
    color: '#f8fafc',
    fontSize: 16,
    marginBottom: 20,
  },
  modalRow: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  modalCancel: { paddingVertical: 12, paddingHorizontal: 20 },
  modalCancelText: { color: '#94a3b8' },
  modalCreate: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
  },
  modalCreateText: { color: '#fff', fontWeight: '600' },
});

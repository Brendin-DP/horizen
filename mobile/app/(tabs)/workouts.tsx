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
  Image,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../contexts/AuthContext';
import { getWorkouts, createWorkout } from '../../lib/api';
import type { Workout } from '../../types';
import { colors } from '../../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

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
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading workouts...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && workouts.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => { setLoading(true); fetchWorkouts(); }} style={styles.retry}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Image source={require('../../assets/logo.png')} style={styles.logo} />
        <Text style={styles.headerTitle}>Your Workouts</Text>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{member?.name?.charAt(0) ?? '?'}</Text>
        </View>
      </View>

      {error && <Text style={styles.errorBanner}>{error}</Text>}

      {workouts.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconContainer}>
            <View style={styles.emptyCircle1} />
            <View style={styles.emptyCircle2} />
            <View style={styles.emptyIcon}>
              <Ionicons name="barbell-outline" size={64} color={colors.accentDark} />
            </View>
          </View>
          <Text style={styles.emptyTitle}>Add Workouts</Text>
          <Text style={styles.emptyText}>
            You currently have no workouts yet. Click the add button to get started.
          </Text>
          <Pressable
            style={[styles.addButton, creating && styles.buttonDisabled]}
            onPress={openCreateModal}
            disabled={creating}
          >
            <Ionicons name="add" size={20} color={colors.white} />
            <Text style={styles.addButtonText}>Add</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Pressable
            style={[styles.newButton, creating && styles.buttonDisabled]}
            onPress={openCreateModal}
            disabled={creating}
          >
            <Ionicons name="add" size={20} color={colors.white} />
            <Text style={styles.newButtonText}>{creating ? 'Creating...' : 'Start New Workout'}</Text>
          </Pressable>

          <FlatList
            data={workouts}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); fetchWorkouts(); }}
                tintColor={colors.primary}
              />
            }
            renderItem={({ item }) => (
              <Pressable
                style={styles.card}
                onPress={() => router.push(`/workout/${item.id}`)}
              >
                <Text style={styles.cardName}>{item.name || 'Untitled Workout'}</Text>
                <Text style={styles.cardDate}>{formatDate(item.startedAt)}</Text>
                <View style={styles.cardMeta}>
                  <View
                    style={[
                      styles.badge,
                      item.status === 'completed' ? styles.badgeComplete : styles.badgeProgress,
                    ]}
                  >
                    <Text style={styles.badgeText}>
                      {item.status === 'completed' ? 'Completed' : 'In progress'}
                    </Text>
                  </View>
                </View>
              </Pressable>
            )}
          />
        </>
      )}

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: { color: colors.textMuted, marginTop: 12 },
  errorText: { color: colors.primary, textAlign: 'center' },
  retry: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  retryText: { color: colors.white },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIconContainer: {
    position: 'relative',
    marginBottom: 24,
  },
  emptyCircle1: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.accent,
    top: -20,
    left: -20,
  },
  emptyCircle2: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accentDark,
    top: 0,
    left: 0,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  addButtonText: { color: colors.white, fontWeight: '600', fontSize: 16 },
  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    margin: 16,
    padding: 14,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  buttonDisabled: { opacity: 0.6 },
  newButtonText: { color: colors.white, fontWeight: '600', fontSize: 16 },
  errorBanner: { color: colors.primary, paddingHorizontal: 16, marginBottom: 8 },
  list: { padding: 16, paddingTop: 0 },
  card: {
    backgroundColor: colors.background,
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardName: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  cardDate: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  cardMeta: { flexDirection: 'row', marginTop: 8 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeProgress: { backgroundColor: colors.accent },
  badgeComplete: { backgroundColor: '#22c55e' },
  badgeText: { fontSize: 12, fontWeight: '600', color: colors.textPrimary },
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

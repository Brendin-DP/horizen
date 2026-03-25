import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Modal,
  Image,
} from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { usePostHog } from 'posthog-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { getExerciseLogs, deleteExerciseLog } from '../../lib/api';
import type { ExerciseLog, Set as LogSet } from '../../types';
import { colors, shell, typography } from '../../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function pickBetterPb(
  best: { reps: number; weightKg: number } | undefined,
  s: LogSet
): { reps: number; weightKg: number } | undefined {
  if (s.reps == null || s.weightKg == null || !(s.weightKg > 0)) return best;
  if (!best) return { reps: s.reps, weightKg: s.weightKg };
  if (s.weightKg > best.weightKg) return { reps: s.reps, weightKg: s.weightKg };
  if (s.weightKg === best.weightKg && s.reps > best.reps) return { reps: s.reps, weightKg: s.weightKg };
  return best;
}

/** Best weight set within a single exercise log session (not lifetime). */
function sessionBestFromSets(sets: LogSet[] | undefined): { reps: number; weightKg: number } | undefined {
  let best: { reps: number; weightKg: number } | undefined;
  for (const s of sets ?? []) {
    const next = pickBetterPb(best, s);
    if (next) best = next;
  }
  return best;
}

function sessionMaxReps(sets: LogSet[] | undefined): number | undefined {
  let best: number | undefined;
  for (const s of sets ?? []) {
    if (s.reps != null) {
      if (best == null || s.reps > best) best = s.reps;
    }
  }
  return best;
}

export default function ExercisesScreen() {
  const posthog = usePostHog();
  const { member, token } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState<ExerciseLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [logToDelete, setLogToDelete] = useState<ExerciseLog | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!member?.id) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const data = await getExerciseLogs(member.id, token);
      setLogs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exercises');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [member?.id, token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  function openDeleteModal(log: ExerciseLog) {
    setLogToDelete(log);
    setDeleteModalVisible(true);
  }

  async function handleConfirmDelete() {
    if (!logToDelete || deleting) return;
    setDeleting(true);
    try {
      await deleteExerciseLog(logToDelete.id, token);
      posthog?.capture('deleted_exercise_log', {
        logId: logToDelete.id,
        exerciseName: logToDelete.exercise?.name,
      });
      setLogs((prev) => prev.filter((l) => l.id !== logToDelete.id));
      setDeleteModalVisible(false);
      setLogToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  }

  function renderRightActions(log: ExerciseLog) {
    return (
      <Pressable
        style={styles.deleteAction}
        onPress={() => openDeleteModal(log)}
      >
        <Ionicons name="trash-outline" size={22} color={colors.white} />
        <Text style={styles.deleteActionText}>Delete</Text>
      </Pressable>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeOuter} edges={['top']}>
        <View style={styles.bodyFill}>
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading exercises...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeOuter} edges={['top']}>
      <View style={styles.header}>
        <Image source={require('../../assets/logo.png')} style={styles.logo} />
      </View>

      <View style={styles.bodyFill}>
        <View style={styles.titleRow}>
          <Ionicons name="barbell-outline" size={24} color={colors.primary} />
          <Text style={styles.titleRowText}>Your Exercises</Text>
        </View>

        {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

        <FlatList
          style={styles.listContainer}
          data={logs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, logs.length === 0 && styles.listEmpty]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchData();
              }}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => {
            const sessionPb = sessionBestFromSets(item.sets);
            const maxReps = sessionMaxReps(item.sets);
            const lt = item.exercise?.loggingType ?? 'weighted';
            let metaLine = '';
            if (item.exercise?.unit === 'time' || item.exercise?.unit === 'distance') {
              metaLine = 'See history';
            } else if (lt === 'bodyweight') {
              metaLine = maxReps != null ? `${maxReps} reps` : 'No sets yet';
            } else if (lt === 'weighted') {
              metaLine = sessionPb
                ? `${sessionPb.reps} reps @ ${sessionPb.weightKg}kg`
                : 'No sets yet';
            } else {
              metaLine = sessionPb
                ? `${sessionPb.reps} reps @ ${sessionPb.weightKg}kg`
                : maxReps != null
                  ? `${maxReps} reps (bodyweight)`
                  : 'No sets yet';
            }
            return (
            <Swipeable
              renderRightActions={() => renderRightActions(item)}
              friction={2}
            >
              <Pressable
                style={styles.card}
                onPress={() => router.push(`/exercise/${item.exerciseId}`)}
              >
                <View style={styles.cardMain}>
                  <Text style={styles.cardName}>{item.exercise?.name ?? 'Exercise'}</Text>
                  <View style={styles.cardMetaRow}>
                    <Ionicons name="trophy-outline" size={16} color={colors.textMuted} style={styles.cardMetaIcon} />
                    <Text style={styles.cardMeta} numberOfLines={2}>
                      {metaLine}
                      <Text style={styles.cardMetaDate}> · {formatDate(item.loggedAt)}</Text>
                    </Text>
                  </View>
                </View>
                <View style={styles.chevronWrap}>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </View>
              </Pressable>
            </Swipeable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <View style={styles.emptyCircle1} />
                <View style={styles.emptyCircle2} />
                <View style={styles.emptyIcon}>
                  <Ionicons name="barbell-outline" size={64} color={colors.accentDark} />
                </View>
              </View>
              <Text style={styles.emptyTitle}>Log Exercises</Text>
              <Text style={styles.emptyText}>
                You have no exercises logged yet. Tap the button below to log your first exercise and start
                tracking your progress.
              </Text>
            </View>
          }
        />
      </View>

      <View style={styles.addCtaContainer}>
        <Pressable
          style={styles.addCta}
          onPress={() => router.push('/exercise/log')}
        >
          <Text style={styles.addCtaText}>Add Exercise</Text>
          <Ionicons name="add" size={20} color={colors.white} />
        </Pressable>
      </View>

      <Modal visible={deleteModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Delete log?</Text>
            <Text style={styles.modalSub}>
              This will remove {logToDelete?.exercise?.name ?? 'this exercise'} from{' '}
              {logToDelete ? formatDate(logToDelete.loggedAt) : ''}.
            </Text>
            <View style={styles.modalRow}>
              <Pressable
                style={styles.modalCancel}
                onPress={() => {
                  setDeleteModalVisible(false);
                  setLogToDelete(null);
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalDelete, deleting && styles.buttonDisabled]}
                onPress={handleConfirmDelete}
                disabled={deleting}
              >
                <Text style={styles.modalDeleteText}>{deleting ? 'Deleting...' : 'Delete'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeOuter: { flex: 1, backgroundColor: shell.header },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: shell.header,
  },
  bodyFill: {
    flex: 1,
    backgroundColor: shell.body,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: shell.body,
  },
  titleRowText: {
    fontSize: 22,
    color: colors.textPrimary,
    fontFamily: typography.heading,
  },
  listContainer: { flex: 1 },
  addCtaContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: shell.footer,
  },
  addCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  addCtaText: {
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
  errorBanner: { color: colors.primary, paddingHorizontal: 16, marginBottom: 8 },
  list: { padding: 16, paddingBottom: 32 },
  listEmpty: { flexGrow: 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardMain: { flex: 1 },
  cardName: {
    fontSize: 18,
    color: colors.textPrimary,
    fontFamily: typography.heading,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  cardMetaIcon: { marginTop: 1 },
  cardMeta: {
    fontSize: 14,
    color: colors.textMuted,
    fontFamily: typography.body,
    flex: 1,
  },
  cardMetaDate: {
    fontSize: 14,
    color: colors.textMuted,
    fontFamily: typography.body,
    opacity: 0.92,
  },
  chevronWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  deleteAction: {
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    marginBottom: 12,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  deleteActionText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  modalSub: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 24,
    lineHeight: 20,
  },
  modalRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  modalCancel: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  modalCancelText: { color: colors.textMuted, fontWeight: '500' },
  modalDelete: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#dc2626',
    borderRadius: 12,
  },
  modalDeleteText: { color: colors.white, fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    minHeight: 400,
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
    color: colors.textPrimary,
    marginBottom: 8,
    fontFamily: typography.heading,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
});

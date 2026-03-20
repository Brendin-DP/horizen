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
} from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../contexts/AuthContext';
import { getExerciseLogs, deleteExerciseLog } from '../../lib/api';
import type { ExerciseLog } from '../../types';
import { colors } from '../../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function ExercisesScreen() {
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
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading exercises...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.logoPlaceholder} />
        <Text style={styles.headerTitle}>Exercises</Text>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{member?.name?.charAt(0) ?? '?'}</Text>
        </View>
      </View>

      {error && <Text style={styles.errorBanner}>{error}</Text>}

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
        renderItem={({ item }) => (
          <Swipeable
            renderRightActions={() => renderRightActions(item)}
            friction={2}
          >
            <View style={styles.card}>
              <Pressable
                style={styles.cardMain}
                onPress={() => router.push(`/exercise/${item.exerciseId}`)}
              >
                <Text style={styles.cardName}>{item.exercise?.name ?? 'Exercise'}</Text>
                <Text style={styles.cardMeta}>{formatDate(item.loggedAt)}</Text>
              </Pressable>
              <Pressable
                style={styles.editBtn}
                onPress={() => router.push(`/log/edit/${item.id}`)}
                hitSlop={8}
              >
                <Ionicons name="pencil-outline" size={20} color={colors.primary} />
              </Pressable>
            </View>
          </Swipeable>
        )}
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
              You have no exercises logged yet. Tap the button below to log your first exercise and start tracking your progress.
            </Text>
          </View>
        }
      />

      <View style={styles.addCtaContainer}>
        <Pressable
          style={styles.addCta}
          onPress={() => router.push('/exercise/log')}
        >
          <Ionicons name="add" size={20} color={colors.white} />
          <Text style={styles.addCtaText}>Add Exercise</Text>
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
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logoPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
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
  listContainer: { flex: 1 },
  addCtaContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
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
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardMain: { flex: 1 },
  cardName: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  cardMeta: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  editBtn: {
    padding: 8,
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
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
});

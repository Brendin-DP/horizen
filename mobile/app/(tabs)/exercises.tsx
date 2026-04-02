import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Image,
  Alert,
} from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { usePostHog } from 'posthog-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { trackStartedStandaloneLog, trackExerciseDeleted } from '../../lib/analytics';
import { getLoggedExercises, deleteAllSessionsForExercise } from '../../lib/api';
import type { LoggedExercise } from '../../types';
import { colors, shell, typography } from '../../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

function formatDate(iso: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Subtitle from lifetime best set + last session date (GET /exercises/logged). */
function formatLoggedSubtitle(ex: LoggedExercise): string {
  const unit = ex.unit;
  const lt = ex.loggingType;
  const best = ex.bestSet;
  if (unit === 'time') {
    if (best?.durationSeconds != null) return `${best.durationSeconds}s`;
    return 'No sets yet';
  }
  if (unit === 'distance') {
    if (best?.distanceMeters != null) return `${best.distanceMeters} m`;
    return 'No sets yet';
  }
  if (lt === 'bodyweight') {
    if (best?.reps != null) return `${best.reps} reps`;
    return 'No sets yet';
  }
  if (lt === 'weighted') {
    if (best?.weightKg != null && best.weightKg > 0 && best.reps != null) {
      return `${best.reps} reps @ ${best.weightKg}kg`;
    }
    if (best?.reps != null) return `${best.reps} reps`;
    return 'No sets yet';
  }
  if (best?.weightKg != null && best.weightKg > 0 && best.reps != null) {
    return `${best.reps} reps @ ${best.weightKg}kg`;
  }
  if (best?.reps != null) return `${best.reps} reps (bodyweight)`;
  return 'No sets yet';
}

export default function ExercisesScreen() {
  const { member, token } = useAuth();
  const posthog = usePostHog();
  const router = useRouter();
  const [items, setItems] = useState<LoggedExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingExerciseId, setDeletingExerciseId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!member?.id) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const data = await getLoggedExercises(member.id);
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exercises');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [member?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const confirmDeleteExercise = useCallback(
    (item: LoggedExercise) => {
      Alert.alert(
        'Delete exercise?',
        `This removes "${item.name}" and all sessions you logged for it. This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              if (!member?.id) {
                setError('Not signed in');
                return;
              }
              setError(null);
              try {
                setDeletingExerciseId(item.id);
                const sessionCount = await deleteAllSessionsForExercise(member.id, item.id, token);
                trackExerciseDeleted(posthog, {
                  exerciseId: item.id,
                  exerciseName: item.name,
                  sessionCount,
                  source: 'exercises_tab_swipe',
                });
                setItems((prev) => prev.filter((x) => x.id !== item.id));
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to delete exercise');
              } finally {
                setDeletingExerciseId(null);
              }
            },
          },
        ]
      );
    },
    [member?.id, token, posthog]
  );

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
          <Text style={styles.titleRowText}>Your Exercises</Text>
        </View>

        {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

        <FlatList
          style={styles.listContainer}
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, items.length === 0 && styles.listEmpty]}
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
            const metaLine = formatLoggedSubtitle(item);
            const dateStr = formatDate(item.lastLoggedAt);
            const busy = deletingExerciseId === item.id;
            return (
              <Swipeable
                enabled={!busy}
                friction={2}
                renderRightActions={() => (
                  <Pressable
                    style={styles.exerciseDeleteAction}
                    onPress={() => confirmDeleteExercise(item)}
                    accessibilityRole="button"
                    accessibilityLabel="Delete exercise and all sessions"
                  >
                    <Ionicons name="trash-outline" size={22} color={colors.white} />
                    <Text style={styles.exerciseDeleteActionText}>Delete</Text>
                  </Pressable>
                )}
              >
                <Pressable
                  style={[styles.card, busy && styles.cardDeleting]}
                  onPress={() => router.push(`/exercise/${item.id}`)}
                  disabled={busy}
                >
                  <View style={styles.cardMain}>
                    <Text style={styles.cardName}>{item.name}</Text>
                    <View style={styles.cardMetaRow}>
                      <Ionicons name="trophy-outline" size={16} color={colors.textMuted} style={styles.cardMetaIcon} />
                      <Text style={styles.cardMeta} numberOfLines={2}>
                        {metaLine}
                        {dateStr ? (
                          <Text style={styles.cardMetaDate}> · {dateStr}</Text>
                        ) : null}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.chevronWrap}>
                    {busy ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                    )}
                  </View>
                </Pressable>
              </Swipeable>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <View style={styles.emptyCirclePink}>
                  <Ionicons name="barbell-outline" size={36} color={colors.primary} />
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
          onPress={() => {
            trackStartedStandaloneLog(posthog, { source: 'exercises_tab' });
            router.push('/exercise/log');
          }}
        >
          <Ionicons name="add" size={20} color={colors.white} />
          <Text style={styles.addCtaText}>Add Exercise</Text>
        </Pressable>
      </View>
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
    paddingHorizontal: 16,
    paddingVertical: 24,
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
  list: {
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 32,
  },
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
  cardDeleting: { opacity: 0.7 },
  exerciseDeleteAction: {
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    marginBottom: 12,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  exerciseDeleteActionText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
    marginTop: 4,
  },
  cardMain: { flex: 1 },
  cardName: {
    fontSize: 18,
    color: colors.textPrimary,
    fontFamily: typography.headingSemibold,
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    minHeight: 320,
  },
  emptyIconContainer: {
    marginBottom: 24,
    alignItems: 'center',
  },
  emptyCirclePink: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.emptyStateCircle,
    justifyContent: 'center',
    alignItems: 'center',
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

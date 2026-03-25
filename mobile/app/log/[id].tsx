import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../contexts/AuthContext';
import { getExerciseLog } from '../../lib/api';
import type { Exercise, ExerciseLog, Set } from '../../types';
import { colors, shell, typography } from '../../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

function formatSetSummary(set: Set, exercise: Exercise): string {
  if (exercise.unit === 'weight_reps') {
    const w = set.weightKg;
    const r = set.reps;
    if (w != null && w > 0) return `${r ?? 0} reps @ ${w}kg`;
    if (r != null) return `${r} reps (bodyweight)`;
    return '—';
  }
  if (exercise.unit === 'time') {
    return `${set.durationSeconds ?? 0}s`;
  }
  if (exercise.unit === 'distance') {
    return `${set.distanceMeters ?? 0} m`;
  }
  return '—';
}

export default function LogDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const [log, setLog] = useState<ExerciseLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setError(null);
    getExerciseLog(id, token)
      .then(setLog)
      .catch(() => setError('Log not found'))
      .finally(() => setLoading(false));
  }, [id, token]);

  if (loading || (!log && !error)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>{loading ? 'Loading...' : ''}</Text>
      </View>
    );
  }

  if (error || !log) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>{error ?? 'Log not found'}</Text>
      </View>
    );
  }

  const exercise = log.exercise;
  if (!exercise) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Exercise not found</Text>
      </View>
    );
  }

  const sets = log.sets ?? [];

  return (
    <SafeAreaView style={styles.safeOuter} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {exercise.name}
        </Text>
        <Pressable
          onPress={() => router.push(`/log/edit/${log.id}`)}
          hitSlop={8}
          style={styles.editLink}
        >
          <Text style={styles.editLinkText}>Edit</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleRow}>
          <Ionicons name="barbell-outline" size={24} color={colors.primary} />
          <Text style={styles.titleRowText}>Sets</Text>
        </View>
        <Text style={styles.subtitle}>
          {sets.length} set{sets.length === 1 ? '' : 's'} logged
        </Text>

        {sets.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No sets in this log</Text>
          </View>
        ) : (
          sets.map((s, index) => (
            <View key={s.id} style={styles.setCard}>
              <View style={styles.setCardMain}>
                <Text style={styles.setLabel}>Set {index + 1}</Text>
                <Text style={styles.setValue}>{formatSetSummary(s, exercise)}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeOuter: { flex: 1, backgroundColor: shell.header },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.backgroundDark,
  },
  loadingText: { color: colors.textMuted, marginTop: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: shell.header,
  },
  backBtn: { paddingRight: 16 },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: typography.headingSemibold,
  },
  editLink: { paddingVertical: 4, paddingLeft: 8 },
  editLinkText: { color: colors.primary, fontSize: 16, fontWeight: '600', fontFamily: typography.bodySemibold },
  scroll: { flex: 1, backgroundColor: shell.body },
  scrollContent: { padding: 16, paddingBottom: 32 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  titleRowText: {
    fontSize: 22,
    color: colors.textPrimary,
    fontFamily: typography.heading,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    fontFamily: typography.body,
    marginBottom: 16,
  },
  setCard: {
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
  setCardMain: { flex: 1 },
  setLabel: {
    fontSize: 18,
    color: colors.textPrimary,
    fontFamily: typography.heading,
    marginBottom: 4,
  },
  setValue: {
    fontSize: 14,
    color: colors.textMuted,
    fontFamily: typography.body,
  },
  emptyCard: {
    backgroundColor: colors.white,
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  emptyText: { fontSize: 14, color: colors.textMuted, fontFamily: typography.body },
});

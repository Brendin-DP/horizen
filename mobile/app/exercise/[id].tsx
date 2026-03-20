import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ScrollView,
  Dimensions,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { getExercise, getExerciseHistory } from '../../lib/api';
import type { Exercise, ExerciseHistory } from '../../types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

const CHART_WIDTH = Dimensions.get('window').width - 64;
const CHART_HEIGHT = 180;

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function formatSetSummary(log: ExerciseHistory): string {
  const n = log.sets.length;
  const best = log.bestSet;
  if (best?.weightKg != null && best?.reps != null) {
    return `${n} set${n === 1 ? '' : 's'} — best: ${best.weightKg}kg × ${best.reps}`;
  }
  return `${n} set${n === 1 ? '' : 's'}`;
}

function ProgressChart({ history }: { history: ExerciseHistory[] }) {
  const chartData = useMemo(() => {
    const withWeight = history.filter((h) => h.bestSet?.weightKg != null);
    if (withWeight.length === 0) return null;
    const weights = withWeight.map((h) => h.bestSet!.weightKg!);
    const minW = Math.min(...weights);
    const maxW = Math.max(...weights);
    const range = maxW - minW || 1;
    const padding = range * 0.1 || 1;
    const yMin = Math.max(0, minW - padding);
    const yMax = maxW + padding;
    const yRange = yMax - yMin;

    const points = withWeight.map((h, i) => ({
      x: (i / (withWeight.length - 1 || 1)) * CHART_WIDTH,
      y: CHART_HEIGHT - ((h.bestSet!.weightKg! - yMin) / yRange) * CHART_HEIGHT,
      weight: h.bestSet!.weightKg!,
      date: h.loggedAt,
    }));
    return { points, yMin, yMax };
  }, [history]);

  if (!chartData || chartData.points.length === 0) {
    return (
      <View style={styles.chartPlaceholder}>
        <Text style={styles.chartPlaceholderText}>No weight data yet</Text>
        <Text style={styles.chartPlaceholderSub}>Add sets with weight to see progress</Text>
      </View>
    );
  }

  const { points } = chartData;
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const fillPath = `${linePath} L ${points[points.length - 1].x} ${CHART_HEIGHT} L 0 ${CHART_HEIGHT} Z`;

  return (
    <View style={styles.chartContainer}>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
        <Path d={fillPath} fill="rgba(254, 205, 211, 0.6)" />
        <Path d={linePath} stroke={colors.primary} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      <View style={styles.chartLabels}>
        <Text style={styles.chartLabelLeft}>{chartData.yMin} kg</Text>
        <Text style={styles.chartLabelRight}>{chartData.yMax} kg</Text>
      </View>
    </View>
  );
}

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { member, token } = useAuth();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [history, setHistory] = useState<ExerciseHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !member?.id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      getExercise(id),
      getExerciseHistory(member.id, id, token),
    ])
      .then(([ex, hist]) => {
        if (cancelled) return;
        setExercise(ex);
        setHistory(hist);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id, member?.id, token]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  const pastLogs = [...history].sort(
    (a, b) => (b.bestSet?.weightKg ?? -1) - (a.bestSet?.weightKg ?? -1)
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {exercise?.name ?? 'Exercise'}
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {error && <Text style={styles.error}>{error}</Text>}

        {exercise && (
          <View style={styles.metaSection}>
            <Text style={styles.metaText}>{exercise.category} · {exercise.equipment ?? '—'}</Text>
            {exercise.muscleGroups?.length > 0 && (
              <Text style={styles.metaSub}>{exercise.muscleGroups.join(', ')}</Text>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Progress</Text>
          <View style={styles.card}>
            <ProgressChart history={history} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Past Logs</Text>
          {pastLogs.length === 0 ? (
            <View style={styles.pbEmpty}>
              <Text style={styles.pbEmptyText}>No logs yet</Text>
              <Text style={styles.pbEmptySub}>Add from the Exercises tab to track your progress</Text>
            </View>
          ) : (
            pastLogs.map((log) => (
              <View key={log.logId} style={styles.pbCard}>
                <Text style={styles.pbWeight}>{formatDate(log.loggedAt)}</Text>
                <Text style={styles.pbMeta}>{formatSetSummary(log)}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.backgroundDark },
  center: {
    flex: 1,
    backgroundColor: colors.backgroundDark,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
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
  backBtn: { paddingRight: 16 },
  title: { fontSize: 20, fontWeight: '600', color: colors.textPrimary, flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  error: { color: colors.primary, marginBottom: 16 },
  metaSection: { marginBottom: 16 },
  metaText: { fontSize: 14, color: colors.textMuted },
  metaSub: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartContainer: { position: 'relative' },
  chartPlaceholder: {
    height: CHART_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chartPlaceholderText: { fontSize: 16, color: colors.textMuted },
  chartPlaceholderSub: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  chartLabelLeft: { fontSize: 11, color: colors.textMuted },
  chartLabelRight: { fontSize: 11, color: colors.textMuted },
  pbEmpty: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  pbEmptyText: { fontSize: 16, color: colors.textMuted },
  pbEmptySub: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  pbCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pbWeight: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  pbMeta: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
});

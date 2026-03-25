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
import type { Exercise, ExerciseHistory, LoggingType } from '../../types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

const CHART_WIDTH = Dimensions.get('window').width - 64;
const CHART_HEIGHT = 180;

function formatLogDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Bold primary line: PB headline (kg, reps, or sets for time/distance). */
function formatPbHeadline(log: ExerciseHistory, ex: Exercise): string {
  const n = log.sets.length;
  const best = log.bestSet;
  if (ex.unit === 'time' || ex.unit === 'distance') {
    return `${n} set${n === 1 ? '' : 's'}`;
  }
  const lt = ex.loggingType;
  if (lt === 'bodyweight') {
    if (best?.reps != null) return `${best.reps} reps`;
    return n > 0 ? `${n} set${n === 1 ? '' : 's'}` : '—';
  }
  if (lt === 'weighted') {
    if (best?.weightKg != null && best.weightKg > 0) return `${best.weightKg}kg`;
    if (best?.reps != null) return `${best.reps} reps`;
    return n > 0 ? `${n} set${n === 1 ? '' : 's'}` : '—';
  }
  const w = best?.weightKg;
  if (w != null && w > 0) return `${w}kg`;
  if (best?.reps != null) return `${best.reps} reps`;
  return n > 0 ? `${n} set${n === 1 ? '' : 's'}` : '—';
}

/** Subline: reps and session date (or sets · date for time/distance). */
function formatPbSubline(log: ExerciseHistory, ex: Exercise): string {
  const dateStr = formatLogDateShort(log.loggedAt);
  const best = log.bestSet;
  const n = log.sets.length;
  if (ex.unit === 'time' || ex.unit === 'distance') {
    return dateStr;
  }
  const lt = ex.loggingType;
  if (lt === 'bodyweight') {
    if (best?.reps != null) return `${best.reps} reps · ${dateStr}`;
    return dateStr;
  }
  if (lt === 'weighted') {
    if (best?.reps != null) return `${best.reps} reps · ${dateStr}`;
    return dateStr;
  }
  if (best?.weightKg != null && best.weightKg > 0 && best?.reps != null) {
    return `${best.reps} reps · ${dateStr}`;
  }
  if (best?.reps != null) return `${best.reps} reps · ${dateStr}`;
  return dateStr;
}

function compareHistoryLogs(a: ExerciseHistory, b: ExerciseHistory, lt: LoggingType): number {
  if (lt === 'bodyweight') {
    return (b.bestSet?.reps ?? 0) - (a.bestSet?.reps ?? 0);
  }
  if (lt === 'weighted') {
    return (b.bestSet?.weightKg ?? -1) - (a.bestSet?.weightKg ?? -1);
  }
  const aw = a.bestSet?.weightKg;
  const bw = b.bestSet?.weightKg;
  const aHas = aw != null && aw > 0;
  const bHas = bw != null && bw > 0;
  if (aHas && bHas) return (bw ?? 0) - (aw ?? 0);
  if (aHas && !bHas) return -1;
  if (!aHas && bHas) return 1;
  return (b.bestSet?.reps ?? 0) - (a.bestSet?.reps ?? 0);
}

/** Chronological order for time-series charts (API usually returns ascending loggedAt). */
function historyChronological(history: ExerciseHistory[]): ExerciseHistory[] {
  return [...history].sort(
    (a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime()
  );
}

type ChartSeries = {
  points: { x: number; y: number }[];
  yMin: number;
  yMax: number;
  labelSuffix: string;
};

function buildSeriesFromValues(values: number[], labelSuffix: string): ChartSeries | null {
  if (values.length === 0) return null;
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;
  const padding = range * 0.1 || 1;
  const yMin = Math.max(0, minV - padding);
  const yMax = maxV + padding;
  const yRange = Math.max(yMax - yMin, 1e-6);
  const points = values.map((v, i) => ({
    x: (i / (values.length - 1 || 1)) * CHART_WIDTH,
    y: CHART_HEIGHT - ((v - yMin) / yRange) * CHART_HEIGHT,
  }));
  return { points, yMin, yMax, labelSuffix };
}

function LineChartSvg({ series }: { series: ChartSeries }) {
  let pts = series.points;
  if (pts.length === 1) {
    const p = pts[0];
    pts = [p, { x: p.x, y: p.y }];
  }
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const fillPath = `${linePath} L ${pts[pts.length - 1].x} ${CHART_HEIGHT} L 0 ${CHART_HEIGHT} Z`;

  return (
    <View style={styles.chartContainer}>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
        <Path d={fillPath} fill="rgba(254, 205, 211, 0.6)" />
        <Path
          d={linePath}
          stroke={colors.primary}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      <View style={styles.chartLabels}>
        <Text style={styles.chartLabelLeft}>
          {Math.round(series.yMin * 10) / 10}
          {series.labelSuffix}
        </Text>
        <Text style={styles.chartLabelRight}>
          {Math.round(series.yMax * 10) / 10}
          {series.labelSuffix}
        </Text>
      </View>
    </View>
  );
}

function ProgressChart({ history, exercise }: { history: ExerciseHistory[]; exercise: Exercise }) {
  const chartContent = useMemo(() => {
    if (exercise.unit !== 'weight_reps') {
      return { kind: 'unsupported' as const };
    }

    const sorted = historyChronological(history);
    const lt = exercise.loggingType;

    if (lt === 'bodyweight') {
      const vals = sorted
        .map((h) => h.bestSet?.reps)
        .filter((r): r is number => r != null);
      const series = buildSeriesFromValues(vals, ' reps');
      return series ? { kind: 'single' as const, series } : { kind: 'empty' as const, empty: 'reps' as const };
    }

    if (lt === 'weighted') {
      const vals = sorted
        .map((h) => h.bestSet?.weightKg)
        .filter((w): w is number => w != null && w > 0);
      const series = buildSeriesFromValues(vals, ' kg');
      return series ? { kind: 'single' as const, series } : { kind: 'empty' as const, empty: 'weight' as const };
    }

    // weighted_or_bodyweight: server picks loaded sets when present, else max reps bodyweight-only.
    const weightVals = sorted
      .filter((h) => h.bestSet?.weightKg != null && h.bestSet.weightKg > 0)
      .map((h) => h.bestSet!.weightKg!);
    const repVals = sorted
      .filter(
        (h) =>
          (h.bestSet?.weightKg == null || h.bestSet.weightKg === 0) &&
          h.bestSet?.reps != null
      )
      .map((h) => h.bestSet!.reps!);

    const weightSeries = buildSeriesFromValues(weightVals, ' kg');
    const repSeries = buildSeriesFromValues(repVals, ' reps');

    if (!weightSeries && !repSeries) {
      return { kind: 'empty' as const, empty: 'mixed' as const };
    }
    return { kind: 'dual' as const, weightSeries, repSeries };
  }, [history, exercise]);

  if (chartContent.kind === 'unsupported') {
    return (
      <View style={styles.chartPlaceholder}>
        <Text style={styles.chartPlaceholderText}>No chart for this metric</Text>
        <Text style={styles.chartPlaceholderSub}>
          Progress charts apply to rep and weight exercises
        </Text>
      </View>
    );
  }

  if (chartContent.kind === 'empty') {
    const e = chartContent.empty;
    const title =
      e === 'reps'
        ? 'No rep data yet'
        : e === 'weight'
          ? 'No weight data yet'
          : 'No progress data yet';
    const sub =
      e === 'reps'
        ? 'Log sets to see rep progress'
        : e === 'weight'
          ? 'Add sets with weight to see progress'
          : 'Log bodyweight or weighted sets to see progress';
    return (
      <View style={styles.chartPlaceholder}>
        <Text style={styles.chartPlaceholderText}>{title}</Text>
        <Text style={styles.chartPlaceholderSub}>{sub}</Text>
      </View>
    );
  }

  if (chartContent.kind === 'single') {
    return <LineChartSvg series={chartContent.series} />;
  }

  return (
    <View>
      {chartContent.weightSeries ? (
        <View>
          <Text style={styles.chartBlockTitle}>Weight (loaded sets)</Text>
          <LineChartSvg series={chartContent.weightSeries} />
        </View>
      ) : null}
      {chartContent.repSeries ? (
        <View style={chartContent.weightSeries ? styles.chartBlockSpaced : undefined}>
          <Text style={styles.chartBlockTitle}>Reps (bodyweight)</Text>
          <LineChartSvg series={chartContent.repSeries} />
        </View>
      ) : null}
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

  const pastLogs = useMemo(() => {
    if (!exercise) return [];
    return [...history].sort((a, b) => compareHistoryLogs(a, b, exercise.loggingType));
  }, [history, exercise]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Progress</Text>
          <View style={styles.card}>
            {exercise ? <ProgressChart history={history} exercise={exercise} /> : null}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your PB Logs</Text>
          {pastLogs.length === 0 ? (
            <View style={styles.pbEmpty}>
              <Text style={styles.pbEmptyText}>No logs yet</Text>
              <Text style={styles.pbEmptySub}>Add from the Exercises tab to track your progress</Text>
            </View>
          ) : (
            pastLogs.map((log, index) => {
              const isPb =
                index === 0 &&
                exercise &&
                (log.bestSet?.reps != null ||
                  (log.bestSet?.weightKg != null && log.bestSet.weightKg > 0));
              const setCount = log.sets?.length ?? 0;
              return (
                <Pressable
                  key={log.logId}
                  style={[styles.pbCard, isPb && styles.pbCardHighlight]}
                  onPress={() => router.push(`/log/${log.logId}`)}
                  android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
                >
                  <View style={styles.pbCardHeader}>
                    <View style={styles.pbCardHeaderLeft}>
                      <Text style={styles.pbHeadline} numberOfLines={1}>
                        {exercise ? formatPbHeadline(log, exercise) : ''}
                      </Text>
                      {isPb ? (
                        <View style={styles.pbBadge}>
                          <Text style={styles.pbBadgeText}>PB</Text>
                        </View>
                      ) : null}
                    </View>
                    {setCount > 1 ? (
                      <View style={styles.pbSetChip} accessibilityLabel={`${setCount} sets`}>
                        <Text style={styles.pbSetChipText}>{setCount}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.pbMeta}>
                    {exercise ? formatPbSubline(log, exercise) : ''}
                  </Text>
                </Pressable>
              );
            })
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
  chartBlockSpaced: { marginTop: 20 },
  chartBlockTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 8,
  },
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
  pbCardHighlight: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: 'rgba(254, 205, 211, 0.35)',
  },
  pbCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 4,
  },
  pbCardHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  pbHeadline: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  pbSetChip: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pbSetChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  pbBadge: {
    backgroundColor: colors.primary,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  pbBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: 0.5,
  },
  pbMeta: { fontSize: 14, color: colors.textMuted },
});

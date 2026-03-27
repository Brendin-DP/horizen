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
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { getExercise, getExerciseHistory } from '../../lib/api';
import type { Exercise, ExerciseHistory, LoggingType } from '../../types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, typography } from '../../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DrillDownHeader } from '../../components/DrillDownHeader';

const CHART_WIDTH = Dimensions.get('window').width - 64;
const CHART_HEIGHT = 180;
/** Inset plot so line / circle markers (r≈6) aren’t clipped at SVG edges */
const CHART_PAD_H = 10;
const CHART_PAD_V = 8;
const CHART_INNER_W = CHART_WIDTH - 2 * CHART_PAD_H;
const CHART_INNER_H = CHART_HEIGHT - 2 * CHART_PAD_V;

function chartXForIndex(i: number, count: number): number {
  if (count <= 1) return CHART_PAD_H + CHART_INNER_W / 2;
  return CHART_PAD_H + (i / (count - 1)) * CHART_INNER_W;
}

function chartYForValue(v: number, yMin: number, yRange: number): number {
  return CHART_PAD_V + CHART_INNER_H - ((v - yMin) / yRange) * CHART_INNER_H;
}

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
  /** Arithmetic mean of the plotted values (same units as the series). */
  avg: number;
};

function formatAvgCaption(avg: number, labelSuffix: string): string {
  const isKg = labelSuffix.includes('kg');
  const rounded = isKg ? (Math.round(avg * 10) / 10).toFixed(1) : String(Math.round(avg * 10) / 10);
  return `Avg ${rounded}${labelSuffix}`;
}

function buildSeriesFromValues(values: number[], labelSuffix: string): ChartSeries | null {
  if (values.length === 0) return null;
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;
  const padding = range * 0.1 || 1;
  const yMin = Math.max(0, minV - padding);
  const yMax = maxV + padding;
  const yRange = Math.max(yMax - yMin, 1e-6);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const n = values.length;
  const points = values.map((v, i) => ({
    x: chartXForIndex(i, n),
    y: chartYForValue(v, yMin, yRange),
  }));
  return { points, yMin, yMax, labelSuffix, avg };
}

function LineChartSvg({ series }: { series: ChartSeries }) {
  const singlePoint = series.points.length === 1 ? series.points[0] : null;

  let pts = series.points;
  if (pts.length === 1) {
    const p = pts[0];
    pts = [p, { x: p.x, y: p.y }];
  }
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const fillPath = `${linePath} L ${pts[pts.length - 1].x} ${CHART_HEIGHT} L ${pts[0].x} ${CHART_HEIGHT} Z`;

  const yRange = Math.max(series.yMax - series.yMin, 1e-6);
  const avgY = chartYForValue(series.avg, series.yMin, yRange);

  return (
    <View style={styles.chartContainer}>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
        <Path d={fillPath} fill="rgba(254, 205, 211, 0.6)" />
        <Line
          x1={CHART_PAD_H}
          y1={avgY}
          x2={CHART_WIDTH - CHART_PAD_H}
          y2={avgY}
          stroke={colors.textSecondary}
          strokeWidth={1.5}
          strokeDasharray="6 5"
          opacity={0.85}
        />
        <Path
          d={linePath}
          stroke={colors.primary}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {singlePoint ? (
          <Circle
            cx={singlePoint.x}
            cy={singlePoint.y}
            r={6}
            fill={colors.white}
            stroke={colors.primary}
            strokeWidth={2.5}
          />
        ) : null}
      </Svg>
      <View style={styles.chartLabels}>
        <Text style={styles.chartLabelLeft}>
          {Math.round(series.yMin * 10) / 10}
          {series.labelSuffix}
        </Text>
        <Text style={styles.chartAvgCaption}>{formatAvgCaption(series.avg, series.labelSuffix)}</Text>
        <Text style={styles.chartLabelRight}>
          {Math.round(series.yMax * 10) / 10}
          {series.labelSuffix}
        </Text>
      </View>
    </View>
  );
}

type DualTab = 'weight' | 'bodyweight';

function DualChartTabs({
  weightSeries,
  repSeries,
}: {
  weightSeries: ChartSeries | null;
  repSeries: ChartSeries | null;
}) {
  const [tab, setTab] = useState<DualTab>('weight');

  useEffect(() => {
    if (weightSeries && !repSeries) setTab('weight');
    else if (!weightSeries && repSeries) setTab('bodyweight');
  }, [weightSeries, repSeries]);

  if (weightSeries && repSeries) {
    return (
      <View>
        <View style={styles.chartTabRow}>
          <Pressable
            onPress={() => setTab('weight')}
            style={[styles.chartTab, tab === 'weight' && styles.chartTabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === 'weight' }}
            accessibilityLabel="Loaded weight chart"
          >
            <Text style={[styles.chartTabText, tab === 'weight' && styles.chartTabTextActive]}>
              Loaded weight
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setTab('bodyweight')}
            style={[styles.chartTab, tab === 'bodyweight' && styles.chartTabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === 'bodyweight' }}
            accessibilityLabel="Bodyweight chart"
          >
            <Text style={[styles.chartTabText, tab === 'bodyweight' && styles.chartTabTextActive]}>
              Bodyweight
            </Text>
          </Pressable>
        </View>
        {tab === 'weight' ? <LineChartSvg series={weightSeries} /> : <LineChartSvg series={repSeries} />}
      </View>
    );
  }

  if (weightSeries) return <LineChartSvg series={weightSeries} />;
  if (repSeries) return <LineChartSvg series={repSeries} />;
  return null;
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

  if (chartContent.kind === 'dual') {
    return (
      <DualChartTabs
        weightSeries={chartContent.weightSeries}
        repSeries={chartContent.repSeries}
      />
    );
  }

  return null;
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

  /** Best-performing session (for PB badge), independent of list order */
  const pbLogId = useMemo(() => {
    if (!exercise || history.length === 0) return null;
    const sorted = [...history].sort((a, b) =>
      compareHistoryLogs(a, b, exercise.loggingType)
    );
    const top = sorted[0];
    if (!top) return null;
    const hasPb =
      top.bestSet?.reps != null ||
      (top.bestSet?.weightKg != null && top.bestSet.weightKg > 0);
    return hasPb ? top.logId : null;
  }, [history, exercise]);

  const pastLogs = useMemo(() => {
    if (!exercise) return [];
    return [...history].sort(
      (a, b) =>
        new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime()
    );
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
      <DrillDownHeader
        title={exercise?.name ?? 'Exercise'}
        onBack={() => router.back()}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Progress</Text>
          <View style={styles.card}>
            {exercise ? <ProgressChart history={history} exercise={exercise} /> : null}
          </View>
        </View>

        <View style={[styles.section, styles.sectionSpaced]}>
          <Text style={styles.sectionTitle}>Your PB Logs</Text>
          {pastLogs.length === 0 ? (
            <View style={styles.pbEmpty}>
              <Text style={styles.pbEmptyText}>No logs yet</Text>
              <Text style={styles.pbEmptySub}>Add from the Exercises tab to track your progress</Text>
            </View>
          ) : (
            pastLogs.map((log) => {
              const isPb =
                exercise != null && pbLogId != null && log.logId === pbLogId;
              const setCount = log.sets?.length ?? 0;
              return (
                <Pressable
                  key={log.logId}
                  style={[styles.pbCard, isPb && styles.pbCardClip]}
                  onPress={() => router.push(`/log/${log.logId}`)}
                  android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
                >
                  {isPb ? (
                    <View style={styles.pbRibbonWrap} pointerEvents="none">
                      <View style={styles.pbRibbon}>
                        <Ionicons name="trophy-outline" size={11} color={colors.white} />
                        <Text style={styles.pbRibbonText}>Your Best</Text>
                      </View>
                    </View>
                  ) : null}
                  <View style={styles.pbCardRow}>
                    <View style={styles.pbCardTextBlock}>
                      <Text style={styles.pbHeadline} numberOfLines={2}>
                        {exercise ? formatPbHeadline(log, exercise) : ''}
                      </Text>
                      <Text style={styles.pbMeta}>
                        {exercise ? formatPbSubline(log, exercise) : ''}
                      </Text>
                    </View>
                    {setCount > 1 ? (
                      <View style={styles.pbSetChip} accessibilityLabel={`${setCount} sets`}>
                        <Text style={styles.pbSetChipText}>{setCount}</Text>
                      </View>
                    ) : null}
                  </View>
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
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 32,
  },
  error: { color: colors.primary, marginBottom: 16 },
  section: { marginBottom: 0 },
  sectionSpaced: { marginTop: 24 },
  sectionTitle: {
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: 24,
    fontFamily: typography.heading,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartContainer: { position: 'relative' },
  chartTabRow: {
    flexDirection: 'row',
    marginBottom: 12,
    borderRadius: 10,
    backgroundColor: colors.backgroundDark,
    padding: 3,
    gap: 4,
  },
  chartTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  chartTabActive: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartTabText: {
    fontSize: 14,
    color: colors.textMuted,
    fontFamily: typography.body,
  },
  chartTabTextActive: {
    color: colors.textPrimary,
    fontFamily: typography.bodySemibold,
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
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  chartLabelLeft: { fontSize: 11, color: colors.textMuted, flexShrink: 0 },
  chartAvgCaption: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
    flex: 1,
    paddingHorizontal: 8,
  },
  chartLabelRight: { fontSize: 11, color: colors.textMuted, flexShrink: 0 },
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
  pbCardClip: {
    overflow: 'hidden',
  },
  /** Vertical center in card + inset from right so ribbon clears set chip; inner strip rotates */
  pbRibbonWrap: {
    position: 'absolute',
    top: 10,
    bottom: 10,
    right: '8%',
    width: 148,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  pbRibbon: {
    width: 148,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    transform: [{ rotate: '45deg' }],
  },
  pbRibbonText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  pbCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pbCardTextBlock: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  pbHeadline: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
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
  pbMeta: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
});

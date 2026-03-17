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
import { getExercise, getMemberProgress, type ProgressHistoryEntry } from '../../lib/api';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors } from '../../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

const CHART_WIDTH = Dimensions.get('window').width - 64;
const CHART_HEIGHT = 180;

interface PBLogEntry {
  weightKg: number;
  reps: number;
  date: string;
  isMostRecent: boolean;
  isYourBest: boolean;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function ProgressChart({ history }: { history: ProgressHistoryEntry[] }) {
  const chartData = useMemo(() => {
    const withWeight = history.filter((h) => h.bestSet?.weightKg != null);
    if (withWeight.length === 0) return null;
    const weights = withWeight.map((h) => h.bestSet!.weightKg);
    const minW = Math.min(...weights);
    const maxW = Math.max(...weights);
    const range = maxW - minW || 1;
    const padding = range * 0.1 || 1;
    const yMin = Math.max(0, minW - padding);
    const yMax = maxW + padding;
    const yRange = yMax - yMin;

    const points = withWeight.map((h, i) => ({
      x: (i / (withWeight.length - 1 || 1)) * CHART_WIDTH,
      y: CHART_HEIGHT - ((h.bestSet!.weightKg - yMin) / yRange) * CHART_HEIGHT,
      weight: h.bestSet!.weightKg,
      date: h.workoutDate,
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

export default function ExerciseHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { member, token } = useAuth();
  const [exerciseName, setExerciseName] = useState<string | null>(null);
  const [history, setHistory] = useState<ProgressHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pbLogs = useMemo<PBLogEntry[]>(() => {
    const entries: PBLogEntry[] = [];
    for (const h of history) {
      if (h.bestSet?.weightKg != null && h.bestSet.reps != null) {
        entries.push({
          weightKg: h.bestSet.weightKg,
          reps: h.bestSet.reps,
          date: h.workoutDate,
          isMostRecent: false,
          isYourBest: false,
        });
      }
    }
    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (entries.length > 0) {
      entries[0].isMostRecent = true;
      const best = entries.reduce((acc, e) => (e.weightKg > acc.weightKg ? e : acc), entries[0]);
      best.isYourBest = true;
    }
    return entries;
  }, [history]);

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
      getMemberProgress(member.id, id, token),
    ])
      .then(([ex, prog]) => {
        if (cancelled) return;
        setExerciseName(ex.name);
        setHistory(prog);
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {exerciseName ?? 'Exercise'}
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Progress</Text>
          <View style={styles.card}>
            <ProgressChart history={history} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your PB Logs</Text>
          {pbLogs.length === 0 ? (
            <View style={styles.pbEmpty}>
              <Text style={styles.pbEmptyText}>No logged sets yet</Text>
              <Text style={styles.pbEmptySub}>Complete sets with weight to track PBs</Text>
            </View>
          ) : (
            pbLogs.map((log, idx) => (
              <View key={`${log.date}-${log.weightKg}-${idx}`} style={styles.pbCard}>
                <View style={styles.pbMain}>
                  <Text style={styles.pbWeight}>{log.weightKg}kg</Text>
                  <Text style={styles.pbMeta}>
                    {log.reps} reps • {formatDate(log.date)}
                  </Text>
                </View>
                <View style={styles.pbTags}>
                  {log.isMostRecent && (
                    <View style={styles.tagGrey}>
                      <Text style={styles.tagGreyText}>Most Recent</Text>
                    </View>
                  )}
                  {log.isYourBest && (
                    <View style={styles.tagRed}>
                      <Text style={styles.tagRedText}>Your Best</Text>
                    </View>
                  )}
                </View>
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
  scrollContent: { padding: 16 },
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
  pbMain: { marginBottom: 8 },
  pbWeight: { fontSize: 22, fontWeight: 'bold', color: colors.textPrimary },
  pbMeta: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  pbTags: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tagGrey: {
    backgroundColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tagGreyText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  tagRed: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tagRedText: { fontSize: 12, color: colors.white, fontWeight: '600' },
});

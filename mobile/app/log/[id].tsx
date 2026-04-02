import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { DrillDownHeader } from '../../components/DrillDownHeader';
import { useAuth } from '../../contexts/AuthContext';
import { getSession, getExerciseHistory } from '../../lib/api';
import type { Exercise, ExerciseHistory, Session, LoggingType, Set } from '../../types';
import { colors, shell, typography } from '../../constants/theme';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

function formatLogDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
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

/** Headline row: weight / distance / duration primary (matches exercise PB cards). */
function formatSetHeadline(s: Set, ex: Exercise): string {
  if (ex.unit === 'time') return `${s.durationSeconds ?? 0}s`;
  if (ex.unit === 'distance') return `${s.distanceMeters ?? 0} m`;
  const lt = ex.loggingType;
  const w = s.weightKg;
  const r = s.reps;
  if (lt === 'bodyweight') {
    if (r != null) return `${r} reps`;
    return '—';
  }
  if (lt === 'weighted') {
    if (w != null && w > 0) return `${w}kg`;
    if (r != null) return `${r} reps`;
    return '—';
  }
  if (w != null && w > 0) return `${w}kg`;
  if (r != null) return `${r} reps`;
  return '—';
}

/** Subline: reps when headline is weight (or bodyweight label when needed). */
function formatSetSubline(s: Set, ex: Exercise): string | null {
  if (ex.unit === 'time' || ex.unit === 'distance') return null;
  const lt = ex.loggingType;
  const w = s.weightKg;
  const r = s.reps;
  if (lt === 'bodyweight') return null;
  if (lt === 'weighted') {
    if (r != null) return `${r} reps`;
    return null;
  }
  if (w != null && w > 0 && r != null) return `${r} reps`;
  if (r != null && (w == null || w === 0)) return 'Bodyweight';
  return null;
}

function setMatchesSessionBest(
  set: Set,
  best: { reps: number | null; weightKg: number | null } | undefined,
  ex: Exercise
): boolean {
  if (!best || ex.unit !== 'weight_reps') return false;
  const br = best.reps;
  const bw = best.weightKg;
  const sr = set.reps;
  const sw = set.weightKg;
  const wMatch =
    bw == null || bw === 0
      ? sw == null || sw === 0
      : sw != null && Math.abs(sw - bw) < 0.001;
  const rMatch = (br ?? 0) === (sr ?? 0);
  return wMatch && rMatch;
}

export default function LogDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { member, token } = useAuth();
  const [log, setLog] = useState<Session | null>(null);
  const [history, setHistory] = useState<ExerciseHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isFirstFocusForSessionRef = useRef(true);

  useEffect(() => {
    isFirstFocusForSessionRef.current = true;
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let cancelled = false;
      const showSpinner = isFirstFocusForSessionRef.current;
      if (showSpinner) setLoading(true);
      setError(null);
      getSession(id, token)
        .then((data) => {
          if (!cancelled) setLog(data);
        })
        .catch(() => {
          if (!cancelled) setError('Log not found');
        })
        .finally(() => {
          if (!cancelled) {
            if (showSpinner) setLoading(false);
            isFirstFocusForSessionRef.current = false;
          }
        });
      return () => {
        cancelled = true;
      };
    }, [id, token])
  );

  const exercise = log?.exercise ?? null;

  useEffect(() => {
    if (!member?.id || !exercise?.id) return;
    let cancelled = false;
    getExerciseHistory(member.id, exercise.id, token)
      .then((h) => {
        if (!cancelled) setHistory(h);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      });
    return () => {
      cancelled = true;
    };
  }, [member?.id, exercise?.id, token]);

  const pbLogId = useMemo(() => {
    if (!exercise || history.length === 0) return null;
    const sorted = [...history].sort((a, b) => compareHistoryLogs(a, b, exercise.loggingType));
    const top = sorted[0];
    if (!top) return null;
    const hasPb =
      top.bestSet?.reps != null || (top.bestSet?.weightKg != null && top.bestSet.weightKg > 0);
    return hasPb ? top.logId : null;
  }, [history, exercise]);

  const sessionBest = useMemo(() => {
    if (!log?.id) return undefined;
    return history.find((h) => h.logId === log.id)?.bestSet;
  }, [history, log?.id]);

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

  if (!exercise) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Exercise not found</Text>
      </View>
    );
  }

  const sets = [...(log.sets ?? [])].sort((a, b) => a.setNumber - b.setNumber);
  const isPbLog = pbLogId != null && log.id === pbLogId;

  return (
    <SafeAreaView style={styles.safeOuter} edges={['top']}>
      <DrillDownHeader
        title={exercise.name}
        titleExtra={formatLogDateShort(log.loggedAt)}
        onBack={() => router.back()}
      />

      <View style={styles.bodyFill}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.titleRow}>
            <Text style={styles.titleRowText}>Session Sets</Text>
          </View>

          {sets.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No sets in this session yet</Text>
            </View>
          ) : (
            sets.map((s) => {
              const showRibbon =
                isPbLog && sessionBest != null && setMatchesSessionBest(s, sessionBest, exercise);
              const sub = formatSetSubline(s, exercise);
              return (
                <View key={s.id} style={[styles.setCard, showRibbon && styles.setCardClip]}>
                  {showRibbon ? (
                    <View style={styles.pbRibbonWrap} pointerEvents="none">
                      <View style={styles.pbRibbon}>
                        <Ionicons name="trophy-outline" size={11} color={colors.white} />
                        <Text style={styles.pbRibbonText}>Your Best</Text>
                      </View>
                    </View>
                  ) : null}
                  <View style={styles.setCardRow}>
                    <View style={styles.setCardTextBlock}>
                      <Text style={styles.setHeadline} numberOfLines={2}>
                        {formatSetHeadline(s, exercise)}
                      </Text>
                      {sub ? <Text style={styles.setMeta}>{sub}</Text> : null}
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>

      <View
        style={[
          styles.footerCtaContainer,
          { paddingBottom: 12 + insets.bottom + 8 },
        ]}
      >
        <Pressable
          style={styles.footerCta}
          onPress={() => router.push(`/log/edit/${log.id}`)}
          accessibilityRole="button"
          accessibilityLabel="Add set"
        >
          <Text style={styles.footerCtaText}>Add Set</Text>
          <Ionicons name="add" size={20} color={colors.white} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeOuter: { flex: 1, backgroundColor: shell.header },
  bodyFill: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: colors.backgroundDark,
  },
  loadingText: { color: colors.textMuted, marginTop: 12 },
  scroll: { flex: 1, backgroundColor: shell.body },
  scrollContent: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 24 },
  titleRow: {
    marginBottom: 24,
  },
  titleRowText: {
    fontSize: 22,
    color: colors.textPrimary,
    fontFamily: typography.heading,
  },
  setCard: {
    backgroundColor: colors.white,
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  setCardClip: {
    overflow: 'hidden',
  },
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
  setCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  setCardTextBlock: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  setHeadline: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
    fontFamily: typography.bodySemibold,
  },
  setMeta: {
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
  footerCtaContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: shell.footer,
  },
  footerCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  footerCtaText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 16,
  },
});

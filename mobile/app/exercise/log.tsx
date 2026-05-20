import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
  FlatList,
  Modal,
  Dimensions,
  InteractionManager,
} from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { usePostHog } from 'posthog-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../contexts/AuthContext';
import {
  getExercise,
  getExercises,
  createSession,
  addSetsBatchToSession,
  getExerciseMaxWeight,
  getExerciseMaxReps,
  getExerciseHistory,
} from '../../lib/api';
import type { Exercise } from '../../types';
import { formatExerciseCategoryType } from '../../lib/exerciseDisplay';
import { weightOptional, weightRequired } from '../../lib/loggingType';
import { colors, shell, typography } from '../../constants/theme';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { DrillDownHeader } from '../../components/DrillDownHeader';
import { RequestExerciseModal } from '../../components/RequestExerciseModal';
import { SetLogModal } from '../../components/SetLogModal';
import {
  type SetEntry,
  createEmptySet,
  validateSetEntry,
  setEntryToAddSessionBody,
} from '../../lib/setEntryForm';
import { trackLoggedExercise, trackPersonalBest } from '../../lib/analytics';

function formatSetEntrySummary(s: SetEntry, exercise: Exercise): string {
  let base: string;
  if (exercise.unit === 'weight_reps') {
    const r = parseInt(s.reps, 10);
    const lt = exercise.loggingType;
    if (lt === 'bodyweight') {
      base = !isNaN(r) ? `${r} reps (bodyweight)` : '—';
    } else if (weightRequired(lt)) {
      const w = parseFloat(s.weight);
      base =
        !isNaN(r) && !isNaN(w) && w > 0 ? `${r} reps @ ${w}kg` : '—';
    } else if (weightOptional(lt)) {
      if (!s.addedWeight) {
        base = !isNaN(r) ? `${r} reps (bodyweight)` : '—';
      } else {
        const trimmed = s.weight.trim();
        if (trimmed === '') {
          base = !isNaN(r) ? `${r} reps (bodyweight)` : '—';
        } else {
          const w = parseFloat(trimmed);
          base =
            !isNaN(r) && !isNaN(w) && w > 0
              ? `${r} reps @ ${w}kg`
              : !isNaN(r)
                ? `${r} reps (bodyweight)`
                : '—';
        }
      }
    } else {
      base = '—';
    }
  } else if (exercise.unit === 'time') {
    const d = parseInt(s.duration, 10);
    base = !isNaN(d) ? `${d}s` : '—';
  } else if (exercise.unit === 'distance') {
    const d = parseFloat(s.distance);
    base = !isNaN(d) ? `${d} m` : '—';
  } else {
    base = '—';
  }
  return base;
}

/** Max reps among bodyweight-only sets (no added weight) for weighted_or_bodyweight exercises. */
function getSessionMaxBodyweightReps(sets: SetEntry[], exercise: Exercise): number {
  if (exercise.loggingType !== 'weighted_or_bodyweight') return 0;
  const repVals = sets
    .filter((s) => {
      if (!s.addedWeight) return true;
      return s.weight.trim() === '';
    })
    .map((s) => parseInt(s.reps, 10))
    .filter((n) => !isNaN(n) && n > 0);
  return repVals.length > 0 ? Math.max(...repVals) : 0;
}

/**
 * All-time max reps on bodyweight-only sets (null/zero weight), excluding the current log.
 * Uses API when it returns a number; if null (no prior data or older API), computes from history — never treat null as 0 without checking history (avoids false PBs for weighted_or_bodyweight).
 */
async function getPreviousMaxBodyweightReps(
  memberId: string,
  exerciseId: string,
  excludeLogId: string,
  token: string | null
): Promise<number> {
  try {
    const { maxReps } = await getExerciseMaxReps(memberId, exerciseId, { excludeLogId }, token);
    if (maxReps != null) return maxReps;
  } catch {
    // network / route error — try history below
  }

  try {
    const hist = await getExerciseHistory(memberId, exerciseId, token);
    let max = 0;
    for (const h of hist) {
      if (h.logId === excludeLogId) continue;
      for (const s of h.sets ?? []) {
        if (s.reps != null && (s.weightKg == null || s.weightKg === 0)) {
          if (s.reps > max) max = s.reps;
        }
      }
    }
    return max;
  } catch {
    return 0;
  }
}

export default function LogExerciseScreen() {
  const insets = useSafeAreaInsets();
  const { exerciseId } = useLocalSearchParams<{ exerciseId?: string }>();
  const router = useRouter();
  const posthog = usePostHog();
  const { member, token } = useAuth();
  const [step, setStep] = useState<'pick' | 'sets'>('pick');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [sets, setSets] = useState<SetEntry[]>([]);
  const [addSetModalVisible, setAddSetModalVisible] = useState(false);
  /** When set, modal updates this set instead of appending a new one */
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SetEntry | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [prKind, setPrKind] = useState<'weight' | 'reps'>('weight');
  const [prValue, setPrValue] = useState(0);
  const confettiRef = useRef<ConfettiCannon>(null);
  const pendingNavigationRef = useRef<string | null>(null);
  const [requestModalVisible, setRequestModalVisible] = useState(false);

  /** When logging from the exercises tab (no exerciseId), stack exercise overview under session so Back works. */
  const navigateToSessionAfterSave = useCallback(
    (logId: string) => {
      if (exerciseId) {
        router.replace(`/log/${logId}`);
      } else {
        if (!selectedExercise) return;
        router.replace(`/exercise/${selectedExercise.id}`);
        router.push(`/log/${logId}`);
      }
    },
    [exerciseId, router, selectedExercise]
  );

  useEffect(() => {
    if (exerciseId) {
      getExercise(exerciseId)
        .then((ex) => {
          setSelectedExercise(ex);
          setSets([]);
          setStep('sets');
        })
        .catch(() => setError('Exercise not found'))
        .finally(() => setLoading(false));
    } else {
      getExercises()
        .then(setExercises)
        .catch(() => setError('Failed to load exercises'))
        .finally(() => setLoading(false));
    }
  }, [exerciseId]);

  const filteredExercises = exercises.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.name.toLowerCase().includes(q) ||
      (e.category || '').toLowerCase().includes(q) ||
      (e.type || '').toLowerCase().includes(q)
    );
  });

  function openAddSetModal() {
    if (!selectedExercise) return;
    setEditingSetId(null);
    setDraft(createEmptySet(selectedExercise));
    setModalError(null);
    setAddSetModalVisible(true);
  }

  function openEditSetModal(s: SetEntry) {
    if (!selectedExercise) return;
    setEditingSetId(s.id);
    setDraft({ ...s });
    setModalError(null);
    setAddSetModalVisible(true);
  }

  function closeAddSetModal() {
    setAddSetModalVisible(false);
    setDraft(null);
    setModalError(null);
    setEditingSetId(null);
  }

  function handleConfirmAddSet() {
    if (!selectedExercise || !draft) return;
    const err = validateSetEntry(draft, selectedExercise);
    if (err) {
      setModalError(err);
      return;
    }
    if (editingSetId) {
      setSets((prev) =>
        prev.map((row) => (row.id === editingSetId ? { ...draft, id: editingSetId } : row))
      );
    } else {
      setSets((prev) => [...prev, { ...draft, id: createEmptySet(selectedExercise).id }]);
    }
    closeAddSetModal();
  }

  function patchDraft(field: keyof SetEntry, value: string | boolean) {
    setDraft((d) => (d ? { ...d, [field]: value } : d));
  }

  function removeSet(id: string) {
    setSets((prev) => prev.filter((s) => s.id !== id));
  }

  function handlePrModalOkay() {
    setSuccessModalVisible(false);
    const target = pendingNavigationRef.current;
    pendingNavigationRef.current = null;
    if (!target) return;
    const match = target.match(/^\/log\/(.+)$/);
    if (match) navigateToSessionAfterSave(match[1]);
  }

  async function handleSaveLog() {
    if (!member?.id || !selectedExercise || saving) return;
    const exercise = selectedExercise;

    if (sets.length === 0) {
      setError('Add at least one set');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const setsPayload = [];

      for (let i = 0; i < sets.length; i++) {
        const s = sets[i];
        const verr = validateSetEntry(s, exercise);
        if (verr) {
          setError(verr);
          setSaving(false);
          return;
        }
        setsPayload.push(setEntryToAddSessionBody(s, exercise, i + 1));
      }

      const log = await createSession(
        { memberId: member.id, exerciseId: exercise.id },
        token
      );

      await addSetsBatchToSession(log.id, setsPayload, token);

      trackLoggedExercise(posthog, {
        sessionId: log.id,
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        setCount: sets.length,
        source: 'standalone_log',
      });

      const targetRoute = `/log/${log.id}`;

      const goAfterSave = () => navigateToSessionAfterSave(log.id);

      if (exercise.unit === 'weight_reps' && exercise.loggingType !== 'bodyweight') {
        const weights = sets
          .map((s) => {
            if (weightOptional(exercise.loggingType) && !s.addedWeight) return NaN;
            const w = parseFloat(s.weight);
            return w;
          })
          .filter((w) => !isNaN(w) && w > 0);
        const newMaxWeight = weights.length > 0 ? Math.max(...weights) : 0;

        let showedPr = false;

        if (newMaxWeight > 0) {
          const { maxWeightKg: previousMax } = await getExerciseMaxWeight(
            member.id,
            exercise.id,
            { excludeLogId: log.id },
            token
          );
          const prevW = previousMax ?? 0;

          if (newMaxWeight > prevW) {
            trackPersonalBest(posthog, {
              exerciseId: exercise.id,
              exerciseName: exercise.name,
              pbType: 'weight',
              weightKg: newMaxWeight,
              sessionId: log.id,
              source: 'standalone_log',
            });
            pendingNavigationRef.current = targetRoute;
            setPrKind('weight');
            setPrValue(newMaxWeight);
            setSuccessModalVisible(true);
            InteractionManager.runAfterInteractions(() => {
              setTimeout(() => confettiRef.current?.start(), 80);
            });
            showedPr = true;
          }
        }

        if (
          !showedPr &&
          exercise.loggingType === 'weighted_or_bodyweight'
        ) {
          const newMaxReps = getSessionMaxBodyweightReps(sets, exercise);
          if (newMaxReps > 0) {
            const prev = await getPreviousMaxBodyweightReps(
              member.id,
              exercise.id,
              log.id,
              token
            );
            if (newMaxReps > prev) {
              trackPersonalBest(posthog, {
                exerciseId: exercise.id,
                exerciseName: exercise.name,
                pbType: 'reps',
                reps: newMaxReps,
                sessionId: log.id,
                source: 'standalone_log',
              });
              pendingNavigationRef.current = targetRoute;
              setPrKind('reps');
              setPrValue(newMaxReps);
              setSuccessModalVisible(true);
              InteractionManager.runAfterInteractions(() => {
                setTimeout(() => confettiRef.current?.start(), 80);
              });
              showedPr = true;
            }
          }
        }

        if (!showedPr) {
          goAfterSave();
        }
      } else if (exercise.unit === 'weight_reps' && exercise.loggingType === 'bodyweight') {
        const repVals = sets
          .map((s) => parseInt(s.reps, 10))
          .filter((n) => !isNaN(n) && n > 0);
        const newMaxReps = repVals.length > 0 ? Math.max(...repVals) : 0;

        if (newMaxReps > 0) {
          const prev = await getPreviousMaxBodyweightReps(
            member.id,
            exercise.id,
            log.id,
            token
          );

          if (newMaxReps > prev) {
            trackPersonalBest(posthog, {
              exerciseId: exercise.id,
              exerciseName: exercise.name,
              pbType: 'reps',
              reps: newMaxReps,
              sessionId: log.id,
              source: 'standalone_log',
            });
            pendingNavigationRef.current = targetRoute;
            setPrKind('reps');
            setPrValue(newMaxReps);
            setSuccessModalVisible(true);
            InteractionManager.runAfterInteractions(() => {
              setTimeout(() => confettiRef.current?.start(), 80);
            });
          } else {
            goAfterSave();
          }
        } else {
          goAfterSave();
        }
      } else {
        goAfterSave();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save log');
    } finally {
      setSaving(false);
    }
  }

  if (loading && exerciseId) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  function openRequestModal() {
    if (!member?.id) return;
    setRequestModalVisible(true);
  }

  function handleRequestSuccess() {
    getExercises()
      .then(setExercises)
      .catch(() => {});
  }

  if (step === 'pick') {
    const searchTrimmed = search.trim();
    const showRequestEmpty = searchTrimmed.length > 0 && filteredExercises.length === 0;

    return (
      <SafeAreaView style={styles.pickContainer} edges={['top']}>
        <DrillDownHeader title="Add Exercise" onBack={() => router.back()} />
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={20} color={colors.textMuted} style={styles.searchRowIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search exercises..."
            value={search}
            onChangeText={setSearch}
            placeholderTextColor={colors.textMuted}
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>
        <View style={styles.searchDivider} />
        <FlatList
          data={filteredExercises}
          keyExtractor={(item) => item.id}
          style={styles.pickList}
          contentContainerStyle={
            filteredExercises.length === 0 ? styles.pickListContentEmpty : styles.pickListContent
          }
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              style={styles.pickerRow}
              onPress={() => {
                setSelectedExercise(item);
                setSets([]);
                setStep('sets');
              }}
            >
              <View style={styles.pickerTitleRow}>
                <Text style={styles.pickerName}>{item.name}</Text>
                {item.loggingType === 'bodyweight' ? (
                  <View style={styles.loggingBadge}>
                    <Text style={styles.loggingBadgeText}>BW</Text>
                  </View>
                ) : item.loggingType === 'weighted_or_bodyweight' ? (
                  <View style={styles.loggingBadge}>
                    <Text style={styles.loggingBadgeText}>BW+</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.pickerMeta}>{formatExerciseCategoryType(item)}</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            showRequestEmpty ? (
              <View style={styles.requestEmptyState}>
                <View style={styles.requestEmptyIconWrap}>
                  <View style={styles.emptyCirclePink}>
                    <View style={styles.requestDumbbellTilt}>
                      <Ionicons name="barbell-outline" size={36} color={colors.primary} />
                    </View>
                  </View>
                </View>
                <Text style={styles.requestEmptyTitle}>Request Exercises</Text>
                <Text style={styles.requestEmptyBody}>
                  This exercise does currently not exist in this list. Click the button below to request it.
                </Text>
                <Pressable
                  style={styles.requestPrimaryBtn}
                  onPress={openRequestModal}
                  accessibilityRole="button"
                  accessibilityLabel="Request exercise"
                >
                  <Ionicons name="add-circle" size={22} color={colors.white} />
                  <Text style={styles.requestPrimaryBtnText}>Request</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={styles.pickEmptyFallback}>No exercises available yet.</Text>
            )
          }
          ListFooterComponent={
            member && filteredExercises.length > 0 ? (
              <Pressable
                style={styles.requestListFooterBtn}
                onPress={openRequestModal}
                accessibilityRole="button"
                accessibilityLabel="Request a missing exercise"
              >
                <Text style={styles.requestListFooterText}>Can't find an exercise? Request one</Text>
              </Pressable>
            ) : null
          }
        />
        {member ? (
          <RequestExerciseModal
            visible={requestModalVisible}
            onClose={() => setRequestModalVisible(false)}
            memberId={member.id}
            token={token}
            initialName={searchTrimmed}
            onSuccess={handleRequestSuccess}
          />
        ) : null}
      </SafeAreaView>
    );
  }

  const exercise = selectedExercise!;
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <DrillDownHeader
        title={`Log ${exercise.name}`}
        onBack={() => (exerciseId ? router.back() : setStep('pick'))}
      />

      {sets.length === 0 ? (
        <View style={styles.emptySetsScreen}>
          {error ? <Text style={[styles.error, styles.emptySetsError]}>{error}</Text> : null}
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <View style={styles.emptyCirclePink}>
                <Ionicons name="barbell-outline" size={36} color={colors.primary} />
              </View>
            </View>
            <Text style={styles.emptySetsTitle}>Add Sets</Text>
            <Text style={styles.emptySetsBody}>
              You have not added a set yet. Tap the button below to get started.
            </Text>
          </View>
          <View style={[styles.emptySetsFooter, { paddingBottom: Math.max(16, insets.bottom) }]}>
            <Pressable style={[styles.addSetTextBtn, styles.addSetTextBtnInFooter]} onPress={openAddSetModal}>
              <View style={styles.addSetTextBtnInner}>
                <Ionicons name="add" size={20} color={colors.primary} />
                <Text style={styles.addSetTextBtnLabel}>Add Set</Text>
              </View>
            </Pressable>
            <Pressable
              style={[styles.saveBtn, saving && styles.buttonDisabled, styles.emptySetsFooterSave]}
              onPress={handleSaveLog}
              disabled={saving}
            >
              <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save Exercise'}</Text>
              {!saving ? <Ionicons name="arrow-forward" size={20} color={colors.white} /> : null}
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.setsWithListLayout}>
          <ScrollView
            style={[styles.scroll, { backgroundColor: shell.body }]}
            contentContainerStyle={styles.scrollContentSetsList}
            keyboardShouldPersistTaps="handled"
          >
            {error && <Text style={styles.error}>{error}</Text>}

            <View style={styles.setsHeadingRow}>
              <Text style={styles.setsHeadingText}>Sets</Text>
            </View>

            {sets.map((s) => (
              <Swipeable
                key={s.id}
                renderRightActions={() => (
                  <Pressable
                    style={styles.setDeleteAction}
                    onPress={() => removeSet(s.id)}
                    accessibilityRole="button"
                    accessibilityLabel="Delete set"
                  >
                    <Ionicons name="trash-outline" size={22} color={colors.white} />
                    <Text style={styles.setDeleteActionText}>Delete</Text>
                  </Pressable>
                )}
                friction={2}
              >
                <View style={styles.setPanel}>
                  <View style={styles.setPanelRow}>
                    <View style={styles.setPanelTextBlock}>
                      <Text style={styles.setPanelLabel}>Set {sets.indexOf(s) + 1}</Text>
                      <Text style={styles.setPanelValue}>{formatSetEntrySummary(s, exercise)}</Text>
                      {s.description.trim() ? (
                        <Text style={styles.setPanelDescription} numberOfLines={3}>
                          {s.description.trim()}
                        </Text>
                      ) : null}
                    </View>
                    <Pressable
                      style={styles.setPanelEditBtn}
                      onPress={() => openEditSetModal(s)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Edit set"
                    >
                      <Ionicons name="pencil" size={22} color={colors.textMuted} />
                    </Pressable>
                  </View>
                </View>
              </Swipeable>
            ))}
          </ScrollView>

          <View style={[styles.emptySetsFooter, { paddingBottom: Math.max(16, insets.bottom) }]}>
            <Pressable style={[styles.addSetTextBtn, styles.addSetTextBtnInFooter]} onPress={openAddSetModal}>
              <View style={styles.addSetTextBtnInner}>
                <Ionicons name="add" size={20} color={colors.primary} />
                <Text style={styles.addSetTextBtnLabel}>Add Set</Text>
              </View>
            </Pressable>
            <Pressable
              style={[styles.saveBtn, saving && styles.buttonDisabled, styles.emptySetsFooterSave]}
              onPress={handleSaveLog}
              disabled={saving}
            >
              <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save Exercise'}</Text>
              {!saving ? <Ionicons name="arrow-forward" size={20} color={colors.white} /> : null}
            </Pressable>
          </View>
        </View>
      )}

      {selectedExercise ? (
        <SetLogModal
          visible={addSetModalVisible}
          onRequestClose={closeAddSetModal}
          exercise={selectedExercise}
          draft={draft}
          onPatch={patchDraft}
          mode={editingSetId ? 'edit' : 'add'}
          modalError={modalError}
          onConfirm={handleConfirmAddSet}
        />
      ) : null}

      <Modal visible={successModalVisible} animationType="fade" transparent>
        <View style={styles.successModalOverlay}>
          <ConfettiCannon
            ref={confettiRef}
            count={80}
            origin={{ x: Dimensions.get('window').width / 2 - 20, y: 200 }}
            autoStart={false}
            fadeOut
            colors={[colors.primary, colors.accent, colors.accentDark, '#22c55e', '#fbbf24']}
          />
          <View style={styles.successCard}>
            <View style={styles.successIconCircle}>
              <Ionicons name="trophy-outline" size={40} color={colors.primary} />
            </View>
            <Text style={styles.successTitle}>
              {prKind === 'reps' ? 'Rep record!' : 'Record Broken!'}
            </Text>
            <Text style={styles.successSub}>
              {prKind === 'weight'
                ? `That's your heaviest ${exercise.name} yet! ${prValue}kg`
                : `That's your best ${exercise.name} set yet — ${prValue} reps.`}
            </Text>
            <Pressable style={styles.successOkay} onPress={handlePrModalOkay}>
              <Text style={styles.successOkayText}>Okay</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  pickContainer: { flex: 1, backgroundColor: colors.white },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 0,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.backgroundDark,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  searchRowIcon: { marginTop: 1 },
  searchInput: {
    flex: 1,
    paddingVertical: 2,
    fontSize: 16,
    color: colors.textPrimary,
    fontFamily: typography.body,
  },
  searchDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: 12,
    marginHorizontal: 0,
  },
  pickList: { flex: 1, backgroundColor: colors.white },
  pickListContent: {
    paddingBottom: 24,
  },
  pickListContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 32,
  },
  requestEmptyState: {
    alignItems: 'center',
    paddingHorizontal: 28,
    maxWidth: 400,
    alignSelf: 'center',
  },
  requestEmptyIconWrap: {
    marginBottom: 24,
  },
  requestDumbbellTilt: {
    transform: [{ rotate: '45deg' }],
  },
  requestEmptyTitle: {
    fontSize: 22,
    color: colors.textPrimary,
    fontFamily: typography.heading,
    textAlign: 'center',
    marginBottom: 12,
  },
  requestEmptyBody: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
    fontFamily: typography.body,
  },
  requestPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 28,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  requestPrimaryBtnText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 16,
    fontFamily: typography.bodySemibold,
  },
  requestListFooterBtn: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  requestListFooterText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '600',
    fontFamily: typography.bodySemibold,
  },
  pickEmptyFallback: {
    padding: 24,
    color: colors.textMuted,
    textAlign: 'center',
    fontFamily: typography.body,
  },
  pickerRow: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  pickerName: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, flex: 1 },
  loggingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.backgroundDark,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loggingBadgeText: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  pickerMeta: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  /** Sets list only (Add Set / Save Exercise live in fixed footer below) */
  scrollContentSetsList: { padding: 16, paddingBottom: 24 },
  setsWithListLayout: {
    flex: 1,
    backgroundColor: shell.body,
  },
  setsHeadingRow: {
    marginBottom: 24,
  },
  setsHeadingText: {
    fontSize: 22,
    color: colors.textPrimary,
    fontFamily: typography.heading,
  },
  error: { color: colors.primary, marginBottom: 16 },
  emptySetsError: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  emptySetsScreen: {
    flex: 1,
    backgroundColor: shell.body,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    minHeight: 280,
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
  emptySetsTitle: {
    fontSize: 22,
    color: colors.textPrimary,
    marginBottom: 8,
    fontFamily: typography.heading,
    textAlign: 'center',
  },
  emptySetsBody: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
    fontFamily: typography.body,
  },
  emptySetsFooter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: shell.footer,
    gap: 12,
  },
  emptySetsFooterSave: {
    alignSelf: 'stretch',
  },
  setPanel: {
    backgroundColor: colors.white,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  setPanelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  setPanelTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  setPanelLabel: {
    fontSize: 18,
    color: colors.textPrimary,
    fontFamily: typography.bodyMedium,
    marginBottom: 4,
  },
  setPanelEditBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    paddingVertical: 4,
    paddingLeft: 4,
  },
  setPanelValue: {
    fontSize: 14,
    color: colors.textMuted,
    fontFamily: typography.body,
  },
  setPanelDescription: {
    fontSize: 14,
    color: colors.textMuted,
    fontFamily: typography.body,
    lineHeight: 20,
    marginTop: 6,
  },
  setDeleteAction: {
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    marginBottom: 12,
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  setDeleteActionText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
    marginTop: 4,
  },
  addSetTextBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginBottom: 16,
  },
  addSetTextBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  /** Tertiary “Add Set” in empty-state footer (no extra bottom margin; sits above Save Exercise) */
  addSetTextBtnInFooter: {
    marginBottom: 0,
  },
  addSetTextBtnLabel: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 16,
    fontFamily: typography.bodySemibold,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  saveText: { color: colors.white, fontWeight: '600', fontSize: 16 },
  buttonDisabled: { opacity: 0.6 },
  successModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  successIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.recordModalCircle,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    color: colors.textPrimary,
    marginBottom: 8,
    fontFamily: typography.heading,
  },
  successSub: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  successOkay: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 12,
  },
  successOkayText: { color: colors.white, fontWeight: '600', fontSize: 16 },
});

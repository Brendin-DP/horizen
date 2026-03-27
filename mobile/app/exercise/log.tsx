import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
  FlatList,
  Switch,
  Modal,
  Dimensions,
  InteractionManager,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { usePostHog } from 'posthog-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../contexts/AuthContext';
import {
  getExercise,
  getExercises,
  createExerciseLog,
  addSetsBatchToExerciseLog,
  getExerciseMaxWeight,
  getExerciseMaxReps,
  getExerciseHistory,
} from '../../lib/api';
import type { Exercise } from '../../types';
import { formatExerciseCategoryType } from '../../lib/exerciseDisplay';
import { weightOptional, weightRequired } from '../../lib/loggingType';
import { colors, shell, typography } from '../../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DrillDownHeader } from '../../components/DrillDownHeader';

interface SetEntry {
  id: string;
  reps: string;
  weight: string;
  duration: string;
  distance: string;
  /** For weighted_or_bodyweight: true = loaded/weight mode, false = bodyweight-only */
  addedWeight: boolean;
}

function createEmptySet(ex: Exercise): SetEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    reps: '',
    weight: '',
    duration: '',
    distance: '',
    /** Hybrid exercises: start in loaded mode (Bodyweight switch off). */
    addedWeight: weightOptional(ex.loggingType),
  };
}

function validateSetEntry(s: SetEntry, exercise: Exercise): string | null {
  if (exercise.unit === 'weight_reps') {
    const r = parseInt(s.reps, 10);
    if (isNaN(r)) return 'Enter valid reps';
    const lt = exercise.loggingType;
    if (lt === 'bodyweight') return null;
    if (weightRequired(lt)) {
      const w = parseFloat(s.weight);
      if (isNaN(w) || w <= 0) return 'Enter weight greater than 0';
      return null;
    }
    if (weightOptional(lt)) {
      if (!s.addedWeight) return null;
      const trimmed = s.weight.trim();
      if (trimmed === '') return null;
      const w = parseFloat(trimmed);
      if (isNaN(w) || w < 0) return 'Enter valid weight or leave blank for bodyweight';
      return null;
    }
    return null;
  }
  if (exercise.unit === 'time') {
    const d = parseInt(s.duration, 10);
    if (isNaN(d) || d < 0) return 'Enter valid duration';
    return null;
  }
  if (exercise.unit === 'distance') {
    const d = parseFloat(s.distance);
    if (isNaN(d) || d < 0) return 'Enter valid distance';
    return null;
  }
  return null;
}

function formatSetEntrySummary(s: SetEntry, exercise: Exercise): string {
  if (exercise.unit === 'weight_reps') {
    const r = parseInt(s.reps, 10);
    const lt = exercise.loggingType;
    if (lt === 'bodyweight') {
      return !isNaN(r) ? `${r} reps (bodyweight)` : '—';
    }
    if (weightRequired(lt)) {
      const w = parseFloat(s.weight);
      if (!isNaN(r) && !isNaN(w) && w > 0) return `${r} reps @ ${w}kg`;
      return '—';
    }
    if (weightOptional(lt)) {
      if (!s.addedWeight) {
        return !isNaN(r) ? `${r} reps (bodyweight)` : '—';
      }
      const trimmed = s.weight.trim();
      if (trimmed === '') return !isNaN(r) ? `${r} reps (bodyweight)` : '—';
      const w = parseFloat(trimmed);
      if (!isNaN(r) && !isNaN(w) && w > 0) return `${r} reps @ ${w}kg`;
      return !isNaN(r) ? `${r} reps (bodyweight)` : '—';
    }
    return '—';
  }
  if (exercise.unit === 'time') {
    const d = parseInt(s.duration, 10);
    return !isNaN(d) ? `${d}s` : '—';
  }
  if (exercise.unit === 'distance') {
    const d = parseFloat(s.distance);
    return !isNaN(d) ? `${d} m` : '—';
  }
  return '—';
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
    setDraft(createEmptySet(selectedExercise));
    setModalError(null);
    setAddSetModalVisible(true);
  }

  function handleConfirmAddSet() {
    if (!selectedExercise || !draft) return;
    const err = validateSetEntry(draft, selectedExercise);
    if (err) {
      setModalError(err);
      return;
    }
    setSets((prev) => [...prev, { ...draft, id: createEmptySet(selectedExercise).id }]);
    setAddSetModalVisible(false);
    setDraft(null);
    setModalError(null);
  }

  function patchDraft(field: keyof SetEntry, value: string | boolean) {
    setDraft((d) => (d ? { ...d, [field]: value } : d));
  }

  function removeSet(id: string) {
    setSets((prev) => (prev.length > 1 ? prev.filter((s) => s.id !== id) : prev));
  }

  function handlePrModalOkay() {
    setSuccessModalVisible(false);
    const target = pendingNavigationRef.current;
    pendingNavigationRef.current = null;
    if (target) router.replace(target as '/exercise/[id]' | '/(tabs)/exercises');
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
      const setsPayload: Array<{
        setNumber: number;
        reps?: number;
        weightKg?: number | null;
        durationSeconds?: number;
        distanceMeters?: number;
        completed: boolean;
      }> = [];

      for (let i = 0; i < sets.length; i++) {
        const s = sets[i];
        const verr = validateSetEntry(s, exercise);
        if (verr) {
          setError(verr);
          setSaving(false);
          return;
        }
        const body: Record<string, number | boolean | null> = { setNumber: i + 1, completed: true };
        if (exercise.unit === 'weight_reps') {
          const r = parseInt(s.reps, 10);
          body.reps = r;
          const lt = exercise.loggingType;
          if (lt === 'bodyweight') {
            body.weightKg = null;
          } else if (weightRequired(lt)) {
            const w = parseFloat(s.weight);
            body.weightKg = w;
          } else if (weightOptional(lt)) {
            if (!s.addedWeight) {
              body.weightKg = null;
            } else {
              const trimmed = s.weight.trim();
              if (trimmed === '') {
                body.weightKg = null;
              } else {
                const w = parseFloat(trimmed);
                body.weightKg = w === 0 ? null : w;
              }
            }
          }
        } else if (exercise.unit === 'time') {
          body.durationSeconds = parseInt(s.duration, 10);
        } else if (exercise.unit === 'distance') {
          body.distanceMeters = parseFloat(s.distance);
        }
        setsPayload.push(body as (typeof setsPayload)[0]);
      }

      const log = await createExerciseLog(
        { memberId: member.id, exerciseId: exercise.id },
        token
      );

      await addSetsBatchToExerciseLog(log.id, setsPayload, token);

      posthog?.capture('logged_exercise', {
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        setCount: sets.length,
      });

      const targetRoute = exerciseId ? `/exercise/${exercise.id}` : '/(tabs)/exercises';

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
            posthog?.capture('personal_best_achieved', {
              exerciseId: exercise.id,
              exerciseName: exercise.name,
              weightKg: newMaxWeight,
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
              posthog?.capture('personal_best_achieved', {
                exerciseId: exercise.id,
                exerciseName: exercise.name,
                reps: newMaxReps,
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
          router.replace(targetRoute as '/exercise/[id]' | '/(tabs)/exercises');
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
            posthog?.capture('personal_best_achieved', {
              exerciseId: exercise.id,
              exerciseName: exercise.name,
              reps: newMaxReps,
            });
            pendingNavigationRef.current = targetRoute;
            setPrKind('reps');
            setPrValue(newMaxReps);
            setSuccessModalVisible(true);
            InteractionManager.runAfterInteractions(() => {
              setTimeout(() => confettiRef.current?.start(), 80);
            });
          } else {
            router.replace(targetRoute as '/exercise/[id]' | '/(tabs)/exercises');
          }
        } else {
          router.replace(targetRoute as '/exercise/[id]' | '/(tabs)/exercises');
        }
      } else {
        router.replace(targetRoute as '/exercise/[id]' | '/(tabs)/exercises');
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

  if (step === 'pick') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <DrillDownHeader title="Select Exercise" onBack={() => router.back()} />
        <TextInput
          style={styles.search}
          placeholder="Search exercises..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor={colors.textMuted}
        />
        <FlatList
          data={filteredExercises}
          keyExtractor={(item) => item.id}
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
          ListEmptyComponent={<Text style={styles.empty}>No exercises found</Text>}
        />
      </SafeAreaView>
    );
  }

  const exercise = selectedExercise!;
  const isWeightReps = exercise.unit === 'weight_reps';
  const isTime = exercise.unit === 'time';
  const isDistance = exercise.unit === 'distance';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <DrillDownHeader
        title={`Log: ${exercise.name}`}
        onBack={() => (exerciseId ? router.back() : setStep('pick'))}
      />

      <ScrollView
        style={[styles.scroll, { backgroundColor: shell.body }]}
        contentContainerStyle={styles.scrollContent}
      >
        {error && <Text style={styles.error}>{error}</Text>}

        {sets.length === 0 ? (
          <View style={styles.emptySetsHint}>
            <Text style={styles.emptySetsText}>
              No sets yet. Tap &quot;+ Add Set&quot; to log reps, weight, or time.
            </Text>
          </View>
        ) : null}

        {sets.map((s) => (
          <View key={s.id} style={styles.setPanel}>
            <View style={styles.setPanelHeader}>
              <Text style={styles.setPanelLabel}>Set {sets.indexOf(s) + 1}</Text>
              {sets.length > 1 ? (
                <Pressable onPress={() => removeSet(s.id)} hitSlop={8}>
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.setPanelValue}>{formatSetEntrySummary(s, exercise)}</Text>
          </View>
        ))}

        <Pressable style={styles.addSetTextBtn} onPress={openAddSetModal}>
          <Text style={styles.addSetTextBtnLabel}>+ Add Set</Text>
        </Pressable>

        <Pressable
          style={[styles.saveBtn, saving && styles.buttonDisabled]}
          onPress={handleSaveLog}
          disabled={saving}
        >
          <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save Log'}</Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={addSetModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => {
          setAddSetModalVisible(false);
          setDraft(null);
          setModalError(null);
        }}
      >
        <KeyboardAvoidingView
          style={styles.addSetModalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.addSetModalScroll}
          >
            <View style={styles.addSetModalCard}>
              <Text style={styles.addSetModalTitle}>Add set</Text>
              {modalError ? <Text style={styles.modalErrorText}>{modalError}</Text> : null}
              {draft && isWeightReps && (
                <>
                  {exercise.loggingType === 'bodyweight' ? (
                    <>
                      <Text style={styles.fieldLabel}>Reps</Text>
                      <View style={styles.inputWithSuffixRow}>
                        <TextInput
                          style={styles.inputSuffixField}
                          placeholder="Add reps"
                          value={draft.reps}
                          onChangeText={(v) => patchDraft('reps', v)}
                          keyboardType="number-pad"
                          placeholderTextColor={colors.textMuted}
                        />
                        <Text style={styles.inputSuffix}>reps</Text>
                      </View>
                      <Text style={styles.bodyweightHint}>
                        Bodyweight only—log your reps. No added weight for this exercise.
                      </Text>
                    </>
                  ) : weightOptional(exercise.loggingType) ? (
                    <>
                      <View style={styles.weightHeaderRow}>
                        <Text style={styles.weightHeaderTitle}>Weight</Text>
                        <View style={styles.bodyweightToggleRight}>
                          <Text style={styles.bodyweightLabel}>Bodyweight</Text>
                          <View style={styles.switchCompact}>
                            <Switch
                              value={!draft.addedWeight}
                              onValueChange={(v) => {
                                patchDraft('addedWeight', !v);
                                if (v) patchDraft('weight', '');
                              }}
                              trackColor={{ false: colors.border, true: colors.accent }}
                              thumbColor={!draft.addedWeight ? colors.primary : colors.white}
                            />
                          </View>
                        </View>
                      </View>
                      <View
                        style={[
                          styles.inputWithSuffixRow,
                          !draft.addedWeight && styles.inputWithSuffixRowDisabled,
                        ]}
                      >
                        <TextInput
                          style={[styles.inputSuffixField, !draft.addedWeight && styles.inputSuffixFieldDisabled]}
                          placeholder={draft.addedWeight ? 'Add weight' : ''}
                          value={draft.weight}
                          onChangeText={(v) => patchDraft('weight', v)}
                          keyboardType="decimal-pad"
                          placeholderTextColor={colors.textMuted}
                          editable={draft.addedWeight}
                        />
                        <Text style={styles.inputSuffix}>kg</Text>
                      </View>
                      <Text style={styles.fieldLabel}>Reps</Text>
                      <View style={styles.inputWithSuffixRow}>
                        <TextInput
                          style={styles.inputSuffixField}
                          placeholder="Add reps"
                          value={draft.reps}
                          onChangeText={(v) => patchDraft('reps', v)}
                          keyboardType="number-pad"
                          placeholderTextColor={colors.textMuted}
                        />
                        <Text style={styles.inputSuffix}>reps</Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={styles.fieldLabel}>Weight</Text>
                      <View style={styles.inputWithSuffixRow}>
                        <TextInput
                          style={styles.inputSuffixField}
                          placeholder="Add weight"
                          value={draft.weight}
                          onChangeText={(v) => patchDraft('weight', v)}
                          keyboardType="decimal-pad"
                          placeholderTextColor={colors.textMuted}
                        />
                        <Text style={styles.inputSuffix}>kg</Text>
                      </View>
                      <Text style={styles.fieldLabel}>Reps</Text>
                      <View style={styles.inputWithSuffixRow}>
                        <TextInput
                          style={styles.inputSuffixField}
                          placeholder="Add reps"
                          value={draft.reps}
                          onChangeText={(v) => patchDraft('reps', v)}
                          keyboardType="number-pad"
                          placeholderTextColor={colors.textMuted}
                        />
                        <Text style={styles.inputSuffix}>reps</Text>
                      </View>
                    </>
                  )}
                </>
              )}
              {draft && isTime && (
                <TextInput
                  style={styles.input}
                  placeholder="Duration (seconds)"
                  value={draft.duration}
                  onChangeText={(v) => patchDraft('duration', v)}
                  keyboardType="number-pad"
                  placeholderTextColor={colors.textMuted}
                />
              )}
              {draft && isDistance && (
                <TextInput
                  style={styles.input}
                  placeholder="Distance (meters)"
                  value={draft.distance}
                  onChangeText={(v) => patchDraft('distance', v)}
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.textMuted}
                />
              )}
              <View style={styles.addSetModalActions}>
                <Pressable
                  style={styles.addSetModalCancel}
                  onPress={() => {
                    setAddSetModalVisible(false);
                    setDraft(null);
                    setModalError(null);
                  }}
                >
                  <Text style={styles.addSetModalCancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.addSetModalConfirm} onPress={handleConfirmAddSet}>
                  <Text style={styles.addSetModalConfirmText}>Add</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  search: {
    margin: 16,
    padding: 14,
    backgroundColor: colors.backgroundDark,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.textPrimary,
    fontSize: 16,
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
  empty: { padding: 24, color: colors.textMuted, textAlign: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },
  error: { color: colors.primary, marginBottom: 16 },
  emptySetsHint: {
    paddingVertical: 24,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  emptySetsText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: typography.body,
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
  setPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  setPanelLabel: {
    fontSize: 18,
    color: colors.textPrimary,
    fontFamily: typography.heading,
  },
  setPanelValue: {
    fontSize: 14,
    color: colors.textMuted,
    fontFamily: typography.body,
  },
  removeText: { color: colors.primary, fontSize: 14 },
  input: {
    backgroundColor: colors.backgroundDark,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
    color: colors.textPrimary,
    fontSize: 16,
    marginBottom: 12,
  },
  bodyweightHint: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: 12,
    marginTop: -4,
  },
  fieldLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 6,
    fontFamily: typography.body,
  },
  weightHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  weightHeaderTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: typography.bodySemibold,
  },
  bodyweightToggleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  switchCompact: {
    transform: [{ scale: 0.82 }],
  },
  inputWithSuffixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundDark,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    marginBottom: 12,
    paddingLeft: 14,
    paddingRight: 12,
    minHeight: 48,
  },
  inputWithSuffixRowDisabled: {
    backgroundColor: colors.border,
    opacity: 0.9,
  },
  inputSuffixField: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.textPrimary,
    fontFamily: typography.body,
  },
  inputSuffixFieldDisabled: {
    color: colors.textMuted,
  },
  inputSuffix: {
    fontSize: 15,
    color: colors.textMuted,
    fontFamily: typography.body,
    paddingLeft: 4,
  },
  bodyweightLabel: { fontSize: 14, color: colors.textPrimary },
  addSetTextBtn: {
    paddingVertical: 14,
    marginBottom: 16,
    alignItems: 'center',
  },
  addSetTextBtnLabel: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 16,
    fontFamily: typography.bodySemibold,
  },
  addSetModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  addSetModalScroll: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  addSetModalCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  addSetModalTitle: {
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: 12,
    fontFamily: typography.heading,
  },
  modalErrorText: {
    color: colors.primary,
    fontSize: 14,
    marginBottom: 12,
    fontFamily: typography.body,
  },
  addSetModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  addSetModalCancel: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  addSetModalCancelText: {
    color: colors.textMuted,
    fontWeight: '600',
    fontSize: 16,
  },
  addSetModalConfirm: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  addSetModalConfirmText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 16,
  },
  saveBtn: {
    padding: 16,
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: 'center',
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
    backgroundColor: colors.accent,
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

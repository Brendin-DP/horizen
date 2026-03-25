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
import { colors } from '../../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

interface SetEntry {
  id: string;
  reps: string;
  weight: string;
  duration: string;
  distance: string;
  /** For weighted_or_bodyweight: show weight field when true */
  addedWeight: boolean;
}

function createEmptySet(_ex: Exercise): SetEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    reps: '',
    weight: '',
    duration: '',
    distance: '',
    addedWeight: false,
  };
}

/** Matches server max-reps: bodyweight sets (no weight), excluding a log. Falls back to history only if the request fails (e.g. older API without the route). */
async function getPreviousMaxBodyweightReps(
  memberId: string,
  exerciseId: string,
  excludeLogId: string,
  token: string | null
): Promise<number> {
  try {
    const { maxReps } = await getExerciseMaxReps(memberId, exerciseId, { excludeLogId }, token);
    return maxReps ?? 0;
  } catch {
    // fall through
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
  const [sets, setSets] = useState<SetEntry[]>([
    { id: '1', reps: '', weight: '', duration: '', distance: '', addedWeight: false },
  ]);
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
          setSets([createEmptySet(ex)]);
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

  function addSet() {
    if (!selectedExercise) return;
    setSets((prev) => [...prev, createEmptySet(selectedExercise)]);
  }

  function removeSet(id: string) {
    setSets((prev) => (prev.length > 1 ? prev.filter((s) => s.id !== id) : prev));
  }

  function updateSet(id: string, field: keyof SetEntry, value: string | boolean) {
    setSets((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
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
        const body: Record<string, number | boolean | null> = { setNumber: i + 1, completed: true };
        if (exercise.unit === 'weight_reps') {
          const r = parseInt(s.reps, 10);
          if (isNaN(r)) {
            setError('Enter valid reps for all sets');
            setSaving(false);
            return;
          }
          body.reps = r;
          const lt = exercise.loggingType;
          if (lt === 'bodyweight') {
            body.weightKg = null;
          } else if (weightRequired(lt)) {
            const w = parseFloat(s.weight);
            if (isNaN(w) || w <= 0) {
              setError('Enter weight greater than 0 for all sets');
              setSaving(false);
              return;
            }
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
                if (isNaN(w) || w < 0) {
                  setError('Enter valid weight or leave blank for bodyweight');
                  setSaving(false);
                  return;
                }
                body.weightKg = w === 0 ? null : w;
              }
            }
          }
        } else if (exercise.unit === 'time') {
          const d = parseInt(s.duration, 10);
          if (isNaN(d) || d < 0) {
            setError('Enter valid duration');
            setSaving(false);
            return;
          }
          body.durationSeconds = d;
        } else if (exercise.unit === 'distance') {
          const d = parseFloat(s.distance);
          if (isNaN(d) || d < 0) {
            setError('Enter valid distance');
            setSaving(false);
            return;
          }
          body.distanceMeters = d;
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
        const newMax = weights.length > 0 ? Math.max(...weights) : 0;

        if (newMax > 0) {
          const { maxWeightKg: previousMax } = await getExerciseMaxWeight(
            member.id,
            exercise.id,
            { excludeLogId: log.id },
            token
          );
          const prev = previousMax ?? 0;

          if (newMax > prev) {
            posthog?.capture('personal_best_achieved', {
              exerciseId: exercise.id,
              exerciseName: exercise.name,
              weightKg: newMax,
            });
            pendingNavigationRef.current = targetRoute;
            setPrKind('weight');
            setPrValue(newMax);
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
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
          <Text style={styles.title}>Select Exercise</Text>
        </View>
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
                setSets([createEmptySet(item)]);
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
      <View style={styles.header}>
        <Pressable onPress={() => (exerciseId ? router.back() : setStep('pick'))} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Log: {exercise.name}</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {error && <Text style={styles.error}>{error}</Text>}

        {sets.map((s) => (
          <View key={s.id} style={styles.setBlock}>
            <View style={styles.setHeader}>
              <Text style={styles.setLabel}>Set {sets.indexOf(s) + 1}</Text>
              {sets.length > 1 && (
                <Pressable onPress={() => removeSet(s.id)}>
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              )}
            </View>
            {isWeightReps && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Reps"
                  value={s.reps}
                  onChangeText={(v) => updateSet(s.id, 'reps', v)}
                  keyboardType="number-pad"
                  placeholderTextColor={colors.textMuted}
                />
                {exercise.loggingType === 'bodyweight' && sets[0]?.id === s.id ? (
                  <Text style={styles.bodyweightHint}>
                    Bodyweight only—log your reps. No added weight for this exercise.
                  </Text>
                ) : null}
                {exercise.loggingType !== 'bodyweight' && weightOptional(exercise.loggingType) && (
                  <View style={styles.bodyweightRow}>
                    <Text style={styles.bodyweightLabel}>Added weight</Text>
                    <Switch
                      value={s.addedWeight}
                      onValueChange={(v) => {
                        updateSet(s.id, 'addedWeight', v);
                        if (!v) updateSet(s.id, 'weight', '');
                      }}
                      trackColor={{ false: colors.border, true: colors.accent }}
                      thumbColor={s.addedWeight ? colors.primary : colors.white}
                    />
                  </View>
                )}
                {(weightRequired(exercise.loggingType) ||
                  (weightOptional(exercise.loggingType) && s.addedWeight)) && (
                  <TextInput
                    style={styles.input}
                    placeholder={
                      weightOptional(exercise.loggingType) ? 'Weight (kg), optional' : 'Weight (kg)'
                    }
                    value={s.weight}
                    onChangeText={(v) => updateSet(s.id, 'weight', v)}
                    keyboardType="decimal-pad"
                    placeholderTextColor={colors.textMuted}
                  />
                )}
              </>
            )}
            {isTime && (
              <TextInput
                style={styles.input}
                placeholder="Duration (seconds)"
                value={s.duration}
                onChangeText={(v) => updateSet(s.id, 'duration', v)}
                keyboardType="number-pad"
                placeholderTextColor={colors.textMuted}
              />
            )}
            {isDistance && (
              <TextInput
                style={styles.input}
                placeholder="Distance (meters)"
                value={s.distance}
                onChangeText={(v) => updateSet(s.id, 'distance', v)}
                keyboardType="decimal-pad"
                placeholderTextColor={colors.textMuted}
              />
            )}
          </View>
        ))}

        <Pressable style={styles.addSetBtn} onPress={addSet}>
          <Ionicons name="add" size={20} color={colors.primary} />
          <Text style={styles.addSetText}>Add Set</Text>
        </Pressable>

        <Pressable
          style={[styles.saveBtn, saving && styles.buttonDisabled]}
          onPress={handleSaveLog}
          disabled={saving}
        >
          <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save Log'}</Text>
        </Pressable>
      </ScrollView>

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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { paddingRight: 16 },
  backText: { color: colors.primary, fontSize: 16 },
  title: { fontSize: 18, fontWeight: '600', color: colors.textPrimary, flex: 1 },
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
  setBlock: {
    backgroundColor: colors.white,
    padding: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  setHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  setLabel: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
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
  bodyweightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bodyweightLabel: { fontSize: 14, color: colors.textPrimary },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    borderStyle: 'dashed',
  },
  addSetText: { color: colors.primary, fontWeight: '600' },
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
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
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

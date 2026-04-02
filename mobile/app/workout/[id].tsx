import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
  Modal,
  FlatList,
  Alert,
  Switch,
  Dimensions,
} from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { usePostHog } from 'posthog-react-native';
import { trackSavedSet } from '../../lib/analytics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import {
  getWorkout,
  updateWorkout,
  deleteWorkout,
  addWorkoutExercise,
  addSet,
  getExercises,
} from '../../lib/api';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { WorkoutWithDetails, Exercise } from '../../types';
import { formatExerciseCategoryType } from '../../lib/exerciseDisplay';
import { weightOptional, weightRequired } from '../../lib/loggingType';
import { colors, typography } from '../../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Toast } from '../../components/Toast';
import { DrillDownHeader } from '../../components/DrillDownHeader';

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const posthog = usePostHog();
  const { token } = useAuth();
  const [workout, setWorkout] = useState<WorkoutWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [addingExercise, setAddingExercise] = useState(false);
  const [setModalVisible, setSetModalVisible] = useState(false);
  const [selectedWe, setSelectedWe] = useState<WorkoutWithDetails['workoutExercises'][0] | null>(null);
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');
  /** Default true so hybrid “Add set” opens with Bodyweight switch off (loaded mode). */
  const [addedWeight, setAddedWeight] = useState(true);
  const [savingSet, setSavingSet] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const confettiRef = useRef<ConfettiCannon>(null);

  const fetchWorkout = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const data = await getWorkout(id, token);
      setWorkout(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workout');
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    fetchWorkout();
  }, [fetchWorkout]);

  async function handleAddExercise(exerciseId: string) {
    if (!id || addingExercise) return;
    setAddingExercise(true);
    try {
      await addWorkoutExercise(id, exerciseId, undefined, token);
      const exercise = exercises.find((e) => e.id === exerciseId);
      posthog?.capture('added_exercise_to_workout', {
        workoutId: id,
        exerciseId,
        ...(exercise?.name != null && exercise.name !== '' ? { exerciseName: exercise.name } : {}),
      });
      setPickerVisible(false);
      fetchWorkout();
      setToastMessage('Exercise added');
      setToastVisible(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add exercise');
    } finally {
      setAddingExercise(false);
    }
  }

  function openSetModal(we: WorkoutWithDetails['workoutExercises'][0]) {
    setSelectedWe(we);
    setReps('');
    setWeight('');
    setDuration('');
    setDistance('');
    const ex = we.exercise;
    setAddedWeight(ex != null && weightOptional(ex.loggingType));
    setSetModalVisible(true);
  }

  async function handleSaveSet() {
    if (!selectedWe || savingSet) return;
    const exercise = selectedWe.exercise;
    if (!exercise) return;

    const previousSetsCount = selectedWe.sets?.length ?? 0;
    const isFirstSet = previousSetsCount === 0;

    setSavingSet(true);
    setError(null);
    try {
      const body: Record<string, number | boolean | null> = { completed: true };
      if (exercise.unit === 'weight_reps') {
        const r = parseInt(reps, 10);
        if (isNaN(r)) {
          setError('Enter valid reps');
          setSavingSet(false);
          return;
        }
        body.reps = r;
        const lt = exercise.loggingType;
        if (lt === 'bodyweight') {
          body.weightKg = null;
        } else if (weightRequired(lt)) {
          const w = parseFloat(weight);
          if (isNaN(w) || w <= 0) {
            setError('Enter weight greater than 0');
            setSavingSet(false);
            return;
          }
          body.weightKg = w;
        } else if (weightOptional(lt)) {
          if (!addedWeight) {
            body.weightKg = null;
          } else {
            const trimmed = weight.trim();
            if (trimmed === '') {
              body.weightKg = null;
            } else {
              const w = parseFloat(trimmed);
              if (isNaN(w) || w < 0) {
                setError('Enter valid weight or leave blank');
                setSavingSet(false);
                return;
              }
              body.weightKg = w === 0 ? null : w;
            }
          }
        }
      } else if (exercise.unit === 'time') {
        const d = parseInt(duration, 10);
        if (isNaN(d) || d < 0) {
          setError('Enter valid duration (seconds)');
          setSavingSet(false);
          return;
        }
        body.durationSeconds = d;
      } else if (exercise.unit === 'distance') {
        const d = parseFloat(distance);
        if (isNaN(d) || d < 0) {
          setError('Enter valid distance (meters)');
          setSavingSet(false);
          return;
        }
        body.distanceMeters = d;
      }

      await addSet(selectedWe.id, body, token);
      trackSavedSet(posthog, {
        workoutId: id,
        exerciseName: exercise.name,
        workoutExerciseId: selectedWe.id,
        context: 'workout_detail',
      });
      setSetModalVisible(false);
      setSelectedWe(null);
      fetchWorkout();

      if (isFirstSet) {
        setTimeout(() => confettiRef.current?.start(), 100);
        setSuccessModalVisible(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save set');
    } finally {
      setSavingSet(false);
    }
  }

  async function handleComplete() {
    if (!id) return;
    try {
      await updateWorkout(
        id,
        { status: 'completed', completedAt: new Date().toISOString() },
        token
      );
      posthog?.capture('completed_workout', {
        workoutId: id,
        ...(workout?.name != null && workout.name !== '' ? { workoutName: workout.name } : {}),
      });
      fetchWorkout();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete');
    }
  }

  function handleDelete() {
    Alert.alert('Delete Workout', 'Are you sure? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteWorkout(id!, token);
            router.back();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete');
          }
        },
      },
    ]);
  }

  async function loadExercises() {
    try {
      const data = await getExercises();
      setExercises(data);
    } catch {
      setExercises([]);
    }
  }

  if (loading || !workout) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#fbbf24" />
        <Text style={styles.loadingText}>{loading ? 'Loading...' : 'Workout not found'}</Text>
      </View>
    );
  }

  const isInProgress = workout.status === 'in_progress';

  const existingExerciseIds = new Set(workout.workoutExercises?.map((we) => we.exerciseId) ?? []);
  const availableExercises = exercises.filter((e) => !existingExerciseIds.has(e.id));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <DrillDownHeader
        title={workout.name || 'Workout'}
        onBack={() => router.back()}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.status}>{workout.status === 'completed' ? 'Completed' : 'In progress'}</Text>

        {error && <Text style={styles.error}>{error}</Text>}

        {isInProgress &&
        (!workout.workoutExercises || workout.workoutExercises.length === 0) ? (
          <View style={styles.exercisesEmptyState}>
            <View style={styles.emptyIconContainer}>
              <View style={styles.emptyCircle1} />
              <View style={styles.emptyCircle2} />
              <View style={styles.emptyIcon}>
                <Ionicons name="barbell-outline" size={28} color={colors.primary} />
              </View>
            </View>
            <Text style={styles.emptyTitle}>Add Exercises</Text>
            <Text style={styles.emptyText}>
              You currently have no exercises yet. Click the add button to get started.
            </Text>
            <Pressable
              style={[styles.addButton, addingExercise && styles.buttonDisabled]}
              onPress={() => {
                loadExercises();
                setPickerVisible(true);
              }}
              disabled={addingExercise}
            >
              <Ionicons name="add" size={20} color={colors.white} />
              <Text style={styles.addButtonText}>Add</Text>
            </Pressable>
          </View>
        ) : null}

        {workout.workoutExercises?.map((we) => (
          <Pressable
            key={we.id}
            style={styles.exerciseBlock}
            onPress={() =>
              we.exerciseId && router.push(`/exercise/${we.exerciseId}`)
            }
          >
            <View style={styles.exerciseHeader}>
              <Text style={styles.exerciseName}>{we.exercise?.name ?? 'Exercise'}</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </View>
            <Text style={styles.setCountSummary}>
              {we.sets?.length === 1
                ? '1 set'
                : `${we.sets?.length ?? 0} sets`}
            </Text>
            {we.sets?.map((s) => (
              <View key={s.id} style={styles.setRow}>
                <Text style={styles.setNum}>Set {s.setNumber}</Text>
                {s.reps != null && we.exercise?.unit === 'weight_reps' && (
                  <Text style={styles.setDetail}>
                    {s.weightKg != null && s.weightKg > 0
                      ? `${s.reps} reps × ${s.weightKg} kg`
                      : `${s.reps} reps`}
                  </Text>
                )}
                {s.durationSeconds != null && (
                  <Text style={styles.setDetail}>{s.durationSeconds}s</Text>
                )}
                {s.distanceMeters != null && (
                  <Text style={styles.setDetail}>{s.distanceMeters} m</Text>
                )}
              </View>
            ))}
            {isInProgress && we.exercise && (
              <Pressable
                style={styles.addSetBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  openSetModal(we);
                }}
              >
                <Ionicons name="add" size={20} color={colors.primary} />
                <Text style={styles.addSetText}>Add Set</Text>
              </Pressable>
            )}
          </Pressable>
        ))}

        {isInProgress && (
          <>
            <Pressable
              style={styles.addExerciseBtn}
              onPress={() => {
                loadExercises();
                setPickerVisible(true);
              }}
            >
              <Ionicons name="add" size={20} color={colors.textMuted} />
              <Text style={styles.addExerciseText}>Add Exercise</Text>
            </Pressable>

            <Pressable style={styles.completeBtn} onPress={handleComplete}>
              <Text style={styles.completeText}>Complete Workout</Text>
            </Pressable>
          </>
        )}

        <Pressable style={styles.deleteBtn} onPress={handleDelete}>
          <Text style={styles.deleteText}>Delete Workout</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={pickerVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Exercise</Text>
            <FlatList
              data={availableExercises}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={
                <Text style={styles.pickerEmpty}>No more exercises to add</Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  style={styles.pickerItem}
                  onPress={() => handleAddExercise(item.id)}
                  disabled={addingExercise}
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
            />
            <Pressable style={styles.closeBtn} onPress={() => setPickerVisible(false)}>
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={successModalVisible} animationType="fade" transparent>
        <View style={styles.successModalOverlay}>
          <ConfettiCannon
            ref={confettiRef}
            count={150}
            origin={{ x: Dimensions.get('window').width / 2 - 20, y: 200 }}
            autoStart={false}
            fadeOut
            colors={[colors.primary, colors.accent, colors.accentDark, '#22c55e', '#fbbf24']}
          />
          <View style={styles.successCard}>
            <View style={styles.successIconCircle}>
              <Ionicons name="gift-outline" size={40} color={colors.primary} />
            </View>
            <Text style={styles.successTitle}>Well Done!</Text>
            <Text style={styles.successSub}>
              Your first set has been logged. Keep crushing it!
            </Text>
            <Pressable
              style={styles.successOkay}
              onPress={() => setSuccessModalVisible(false)}
            >
              <Text style={styles.successOkayText}>Okay</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={setModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Add Set {selectedWe?.exercise?.name ? `— ${selectedWe.exercise.name}` : ''}
            </Text>
            {selectedWe?.exercise?.unit === 'weight_reps' &&
              (() => {
                const ex = selectedWe.exercise!;
                if (ex.loggingType === 'bodyweight') {
                  return (
                    <>
                      <Text style={styles.fieldLabel}>Reps</Text>
                      <View style={styles.inputWithSuffixRow}>
                        <TextInput
                          style={styles.inputSuffixField}
                          placeholder="Add reps"
                          value={reps}
                          onChangeText={setReps}
                          keyboardType="number-pad"
                          placeholderTextColor={colors.textMuted}
                        />
                        <Text style={styles.inputSuffix}>reps</Text>
                      </View>
                    </>
                  );
                }
                if (weightOptional(ex.loggingType)) {
                  return (
                    <>
                      <View style={styles.weightHeaderRow}>
                        <Text style={styles.weightHeaderTitle}>Weight</Text>
                        <View style={styles.bodyweightToggleRight}>
                          <Text style={styles.bodyweightLabelStrong}>Bodyweight</Text>
                          <View style={styles.switchCompact}>
                            <Switch
                              value={!addedWeight}
                              onValueChange={(v) => {
                                setAddedWeight(!v);
                                if (v) setWeight('');
                              }}
                              trackColor={{ false: colors.border, true: colors.accent }}
                              thumbColor={!addedWeight ? colors.primary : colors.white}
                            />
                          </View>
                        </View>
                      </View>
                      <View
                        style={[
                          styles.inputWithSuffixRow,
                          !addedWeight && styles.inputWithSuffixRowDisabled,
                        ]}
                      >
                        <TextInput
                          style={[styles.inputSuffixField, !addedWeight && styles.inputSuffixFieldDisabled]}
                          placeholder={addedWeight ? 'Add weight' : ''}
                          value={weight}
                          onChangeText={setWeight}
                          keyboardType="decimal-pad"
                          placeholderTextColor={colors.textMuted}
                          editable={addedWeight}
                        />
                        <Text style={styles.inputSuffix}>kg</Text>
                      </View>
                      <Text style={styles.fieldLabel}>Reps</Text>
                      <View style={styles.inputWithSuffixRow}>
                        <TextInput
                          style={styles.inputSuffixField}
                          placeholder="Add reps"
                          value={reps}
                          onChangeText={setReps}
                          keyboardType="number-pad"
                          placeholderTextColor={colors.textMuted}
                        />
                        <Text style={styles.inputSuffix}>reps</Text>
                      </View>
                    </>
                  );
                }
                return (
                  <>
                    <Text style={styles.fieldLabel}>Weight</Text>
                    <View style={styles.inputWithSuffixRow}>
                      <TextInput
                        style={styles.inputSuffixField}
                        placeholder="Add weight"
                        value={weight}
                        onChangeText={setWeight}
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
                        value={reps}
                        onChangeText={setReps}
                        keyboardType="number-pad"
                        placeholderTextColor={colors.textMuted}
                      />
                      <Text style={styles.inputSuffix}>reps</Text>
                    </View>
                  </>
                );
              })()}
            {selectedWe?.exercise?.unit === 'time' && (
              <>
                <Text style={styles.label}>Duration (seconds)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Add duration"
                  value={duration}
                  onChangeText={setDuration}
                  keyboardType="number-pad"
                  placeholderTextColor={colors.textMuted}
                />
              </>
            )}
            {selectedWe?.exercise?.unit === 'distance' && (
              <>
                <Text style={styles.label}>Distance (meters)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Add distance"
                  value={distance}
                  onChangeText={setDistance}
                  keyboardType="decimal-pad"
                  placeholderTextColor={colors.textMuted}
                />
              </>
            )}
            <Pressable
              style={[styles.saveSetBtn, savingSet && styles.buttonDisabled]}
              onPress={handleSaveSet}
              disabled={savingSet}
            >
              <Text style={styles.saveSetText}>{savingSet ? 'Saving...' : 'Save Exercise'} →</Text>
            </Pressable>
            <Pressable style={styles.closeBtn} onPress={() => setSetModalVisible(false)}>
              <Text style={styles.closeText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Toast
        visible={toastVisible}
        message={toastMessage}
        onDismiss={() => setToastVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: { color: colors.textMuted, marginTop: 12 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  status: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  error: { color: colors.primary, marginTop: 12 },
  exerciseBlock: {
    backgroundColor: colors.white,
    padding: 16,
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exerciseName: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  setCountSummary: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
  setRow: { flexDirection: 'row', marginTop: 8, gap: 12 },
  setNum: { color: colors.textMuted, width: 60 },
  setDetail: { color: colors.textPrimary },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.accent,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  addSetText: { color: colors.primary, fontWeight: '500' },
  addExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    padding: 14,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  addExerciseText: { color: colors.textMuted },
  completeBtn: {
    marginTop: 16,
    padding: 14,
    backgroundColor: '#22c55e',
    borderRadius: 12,
    alignItems: 'center',
  },
  completeText: { color: colors.white, fontWeight: '600' },
  deleteBtn: {
    marginTop: 24,
    padding: 14,
    alignItems: 'center',
  },
  deleteText: { color: colors.primary, fontSize: 14 },
  buttonDisabled: { opacity: 0.6 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    maxHeight: '80%',
  },
  modalTitle: { fontSize: 18, fontWeight: '600', color: colors.textPrimary, marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', color: colors.textPrimary, marginBottom: 8 },
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
  bodyweightLabelStrong: { fontSize: 14, color: colors.textPrimary },
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
  pickerItem: {
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
  pickerMeta: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  pickerEmpty: { color: colors.textMuted, textAlign: 'center', padding: 24 },
  closeBtn: { marginTop: 16, padding: 12, alignItems: 'center' },
  closeText: { color: colors.textMuted },
  input: {
    backgroundColor: colors.backgroundDark,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  saveSetBtn: {
    padding: 14,
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  saveSetText: { color: colors.white, fontWeight: '600' },
  exercisesEmptyState: {
    marginTop: 32,
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyIconContainer: {
    position: 'relative',
    marginBottom: 24,
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCircle1: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.emptyStateCircle,
    top: 0,
    left: 0,
  },
  emptyCircle2: {
    position: 'absolute',
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.emptyStateCircle,
    top: 13,
    left: 13,
  },
  emptyIcon: {
    width: 53,
    height: 53,
    borderRadius: 27,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
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
    marginBottom: 24,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  addButtonText: { color: colors.white, fontWeight: '600', fontSize: 16 },
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

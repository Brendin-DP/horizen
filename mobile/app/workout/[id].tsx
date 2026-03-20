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
import { colors } from '../../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Toast } from '../../components/Toast';

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
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
  const [bodyweight, setBodyweight] = useState(false);
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
    setBodyweight(false);
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
      const body: Record<string, number | boolean> = { completed: true };
      if (exercise.unit === 'weight_reps') {
        const r = parseInt(reps, 10);
        if (isNaN(r)) {
          setError('Enter valid reps');
          setSavingSet(false);
          return;
        }
        body.reps = r;
        body.weightKg = bodyweight ? 0 : parseFloat(weight);
        if (!bodyweight && (isNaN(body.weightKg as number) || (body.weightKg as number) < 0)) {
          setError('Enter valid weight');
          setSavingSet(false);
          return;
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
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{workout.name || 'Untitled Workout'}</Text>
        <Text style={styles.status}>{workout.status === 'completed' ? 'Completed' : 'In progress'}</Text>

        {error && <Text style={styles.error}>{error}</Text>}

        {isInProgress &&
        (!workout.workoutExercises || workout.workoutExercises.length === 0) ? (
          <View style={styles.exercisesEmptyState}>
            <View style={styles.emptyIconContainer}>
              <View style={styles.emptyCircle1} />
              <View style={styles.emptyCircle2} />
              <View style={styles.emptyIcon}>
                <Ionicons name="barbell-outline" size={36} color={colors.accentDark} />
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
                {s.reps != null && s.weightKg != null && (
                  <Text style={styles.setDetail}>{s.reps} reps × {s.weightKg} kg</Text>
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
                <Text style={styles.addSetText}>+ Add Set</Text>
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
              <Text style={styles.addExerciseText}>+ Add Exercise</Text>
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
                  <Text style={styles.pickerName}>{item.name}</Text>
                  <Text style={styles.pickerMeta}>{item.category} · {item.equipment ?? '—'}</Text>
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
            {selectedWe?.exercise?.unit === 'weight_reps' && (
              <>
                <Text style={styles.label}>Reps</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Add reps"
                  value={reps}
                  onChangeText={setReps}
                  keyboardType="number-pad"
                  placeholderTextColor={colors.textMuted}
                />
                <View style={styles.weightRow}>
                  <Text style={styles.label}>Weight</Text>
                  <View style={styles.bodyweightToggle}>
                    <Text style={styles.bodyweightLabel}>Bodyweight</Text>
                    <Switch
                      value={bodyweight}
                      onValueChange={setBodyweight}
                      trackColor={{ false: colors.border, true: colors.accent }}
                      thumbColor={bodyweight ? colors.primary : colors.white}
                    />
                  </View>
                </View>
                {!bodyweight && (
                  <TextInput
                    style={styles.input}
                    placeholder="Add weight (kg)"
                    value={weight}
                    onChangeText={setWeight}
                    keyboardType="decimal-pad"
                    placeholderTextColor={colors.textMuted}
                  />
                )}
              </>
            )}
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
  header: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { paddingVertical: 8, paddingRight: 16 },
  backText: { color: colors.primary, fontSize: 16 },
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
  title: { fontSize: 24, fontWeight: 'bold', color: colors.textPrimary },
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
    marginTop: 12,
    padding: 10,
    backgroundColor: colors.accent,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  addSetText: { color: colors.primary, fontWeight: '500' },
  addExerciseBtn: {
    marginTop: 24,
    padding: 14,
    backgroundColor: colors.white,
    borderRadius: 12,
    alignItems: 'center',
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
  weightRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  bodyweightToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bodyweightLabel: { fontSize: 14, color: colors.textSecondary },
  pickerItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerName: { fontSize: 16, color: colors.textPrimary },
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
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCircle1: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.accent,
    top: 0,
    left: 0,
  },
  emptyCircle2: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.accentDark,
    top: 15,
    left: 15,
  },
  emptyIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: { fontSize: 22, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 8 },
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

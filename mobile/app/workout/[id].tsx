import { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
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
import type { WorkoutWithDetails, Exercise } from '../../types';

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
  const [savingSet, setSavingSet] = useState(false);

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
    setSetModalVisible(true);
  }

  async function handleSaveSet() {
    if (!selectedWe || savingSet) return;
    const exercise = selectedWe.exercise;
    if (!exercise) return;

    setSavingSet(true);
    setError(null);
    try {
      const body: Record<string, number | boolean> = { completed: true };
      if (exercise.unit === 'weight_reps') {
        const r = parseInt(reps, 10);
        const w = parseFloat(weight);
        if (isNaN(r) || isNaN(w)) {
          setError('Enter valid reps and weight');
          setSavingSet(false);
          return;
        }
        body.reps = r;
        body.weightKg = w;
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>{workout.name || 'Untitled Workout'}</Text>
        <Text style={styles.status}>{workout.status === 'completed' ? 'Completed' : 'In progress'}</Text>

        {error && <Text style={styles.error}>{error}</Text>}

        {workout.workoutExercises?.map((we) => (
          <View key={we.id} style={styles.exerciseBlock}>
            <Text style={styles.exerciseName}>{we.exercise?.name ?? 'Exercise'}</Text>
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
              <Pressable style={styles.addSetBtn} onPress={() => openSetModal(we)}>
                <Text style={styles.addSetText}>+ Add Set</Text>
              </Pressable>
            )}
          </View>
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

      <Modal visible={setModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Add Set {selectedWe?.exercise?.name ? `— ${selectedWe.exercise.name}` : ''}
            </Text>
            {selectedWe?.exercise?.unit === 'weight_reps' && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Reps"
                  value={reps}
                  onChangeText={setReps}
                  keyboardType="number-pad"
                  placeholderTextColor="#64748b"
                />
                <TextInput
                  style={styles.input}
                  placeholder="Weight (kg)"
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="decimal-pad"
                  placeholderTextColor="#64748b"
                />
              </>
            )}
            {selectedWe?.exercise?.unit === 'time' && (
              <TextInput
                style={styles.input}
                placeholder="Duration (seconds)"
                value={duration}
                onChangeText={setDuration}
                keyboardType="number-pad"
                placeholderTextColor="#64748b"
              />
            )}
            {selectedWe?.exercise?.unit === 'distance' && (
              <TextInput
                style={styles.input}
                placeholder="Distance (meters)"
                value={distance}
                onChangeText={setDistance}
                keyboardType="decimal-pad"
                placeholderTextColor="#64748b"
              />
            )}
            <Pressable
              style={[styles.saveSetBtn, savingSet && styles.buttonDisabled]}
              onPress={handleSaveSet}
              disabled={savingSet}
            >
              <Text style={styles.saveSetText}>{savingSet ? 'Saving...' : 'Save Set'}</Text>
            </Pressable>
            <Pressable style={styles.closeBtn} onPress={() => setSetModalVisible(false)}>
              <Text style={styles.closeText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 8 },
  backBtn: { paddingVertical: 8, paddingRight: 16 },
  backText: { color: '#fbbf24', fontSize: 16 },
  center: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: { color: '#94a3b8', marginTop: 12 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#f8fafc' },
  status: { fontSize: 14, color: '#94a3b8', marginTop: 4 },
  error: { color: '#f87171', marginTop: 12 },
  exerciseBlock: {
    backgroundColor: '#1e293b',
    padding: 16,
    marginTop: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  exerciseName: { fontSize: 18, fontWeight: '600', color: '#f8fafc' },
  setRow: { flexDirection: 'row', marginTop: 8, gap: 12 },
  setNum: { color: '#94a3b8', width: 60 },
  setDetail: { color: '#f8fafc' },
  addSetBtn: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#334155',
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  addSetText: { color: '#fbbf24', fontWeight: '500' },
  addExerciseBtn: {
    marginTop: 24,
    padding: 14,
    backgroundColor: '#334155',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#475569',
    borderStyle: 'dashed',
  },
  addExerciseText: { color: '#94a3b8' },
  completeBtn: {
    marginTop: 16,
    padding: 14,
    backgroundColor: '#22c55e',
    borderRadius: 8,
    alignItems: 'center',
  },
  completeText: { color: '#fff', fontWeight: '600' },
  deleteBtn: {
    marginTop: 24,
    padding: 14,
    alignItems: 'center',
  },
  deleteText: { color: '#f87171', fontSize: 14 },
  buttonDisabled: { opacity: 0.6 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    maxHeight: '80%',
  },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#f8fafc', marginBottom: 16 },
  pickerItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  pickerName: { fontSize: 16, color: '#f8fafc' },
  pickerMeta: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  pickerEmpty: { color: '#94a3b8', textAlign: 'center', padding: 24 },
  closeBtn: { marginTop: 16, padding: 12, alignItems: 'center' },
  closeText: { color: '#94a3b8' },
  input: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 14,
    color: '#f8fafc',
    marginBottom: 12,
  },
  saveSetBtn: {
    padding: 14,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  saveSetText: { color: '#fff', fontWeight: '600' },
});

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  TextInput,
  Modal,
  ScrollView,
  Switch,
  Dimensions,
} from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { usePostHog } from 'posthog-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../contexts/AuthContext';
import { getWorkoutExercise, addSet } from '../../lib/api';
import type { WorkoutExercise } from '../../types';
import { colors } from '../../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ExerciseLogScreen() {
  const { workoutExerciseId } = useLocalSearchParams<{ workoutExerciseId: string }>();
  const router = useRouter();
  const posthog = usePostHog();
  const { token } = useAuth();
  const [we, setWe] = useState<WorkoutExercise | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [setModalVisible, setSetModalVisible] = useState(false);
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');
  const [bodyweight, setBodyweight] = useState(false);
  const [savingSet, setSavingSet] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const confettiRef = useRef<ConfettiCannon>(null);

  const fetchData = useCallback(async () => {
    if (!workoutExerciseId) return;
    setError(null);
    try {
      const data = await getWorkoutExercise(workoutExerciseId, token);
      setWe(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exercise');
    } finally {
      setLoading(false);
    }
  }, [workoutExerciseId, token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function openSetModal() {
    setReps('');
    setWeight('');
    setDuration('');
    setDistance('');
    setBodyweight(false);
    setSetModalVisible(true);
  }

  async function handleSaveSet() {
    if (!we || savingSet) return;
    const exercise = we.exercise;
    if (!exercise) return;

    const previousSetsCount = we.sets?.length ?? 0;
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

      await addSet(we.id, body, token);
      posthog?.capture('saved_set', {
        workoutId: we.workoutId,
        workoutExerciseId: we.id,
        exerciseName: exercise?.name,
      });
      setSetModalVisible(false);
      fetchData();

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

  if (loading || !we) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>
          {loading ? 'Loading...' : 'Exercise not found'}
        </Text>
      </View>
    );
  }

  const exercise = we.exercise;
  const sets = we.sets ?? [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.exerciseBlock}>
          <View style={styles.exerciseHeader}>
            <Text style={styles.exerciseName}>{exercise?.name ?? 'Exercise'}</Text>
          </View>
          <Text style={styles.setCountSummary}>
            {sets.length} set{sets.length === 1 ? '' : 's'}
          </Text>

          {sets.map((s) => (
            <View key={s.id} style={styles.setRow}>
              <Text style={styles.setNum}>Set {s.setNumber}</Text>
              <Text style={styles.setDetail}>
                {s.reps != null && `${s.reps} reps`}
                {s.weightKg != null && s.weightKg > 0 && ` @ ${s.weightKg} kg`}
                {s.durationSeconds != null && ` ${s.durationSeconds}s`}
                {s.distanceMeters != null && ` ${s.distanceMeters}m`}
              </Text>
            </View>
          ))}

          <Pressable
            style={styles.addSetBtn}
            onPress={openSetModal}
          >
            <Text style={styles.addSetText}>+ Add Set</Text>
          </Pressable>
        </View>
      </ScrollView>

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
              Add Set {exercise?.name ? `— ${exercise.name}` : ''}
            </Text>
            {exercise?.unit === 'weight_reps' && (
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
            {exercise?.unit === 'time' && (
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
            {exercise?.unit === 'distance' && (
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
              <Text style={styles.saveSetText}>
                {savingSet ? 'Saving...' : 'Save Set'} →
              </Text>
            </Pressable>
            <Pressable style={styles.closeBtn} onPress={() => setSetModalVisible(false)}>
              <Text style={styles.closeText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  setCountSummary: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
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
  closeBtn: { marginTop: 16, padding: 12, alignItems: 'center' },
  closeText: { color: colors.textMuted },
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

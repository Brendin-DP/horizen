import { useState, useEffect } from 'react';
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
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../contexts/AuthContext';
import { getExercise, getExercises, createExerciseLog, addSetToExerciseLog } from '../../lib/api';
import type { Exercise } from '../../types';
import { colors } from '../../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

interface SetEntry {
  id: string;
  reps: string;
  weight: string;
  duration: string;
  distance: string;
  bodyweight: boolean;
}

export default function LogExerciseScreen() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId?: string }>();
  const router = useRouter();
  const { member, token } = useAuth();
  const [step, setStep] = useState<'pick' | 'sets'>('pick');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [sets, setSets] = useState<SetEntry[]>([{ id: '1', reps: '', weight: '', duration: '', distance: '', bodyweight: false }]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (exerciseId) {
      getExercise(exerciseId)
        .then((ex) => {
          setSelectedExercise(ex);
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

  const filteredExercises = exercises.filter(
    (e) =>
      !search ||
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      (e.category || '').toLowerCase().includes(search.toLowerCase())
  );

  function addSet() {
    setSets((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        reps: '',
        weight: '',
        duration: '',
        distance: '',
        bodyweight: false,
      },
    ]);
  }

  function removeSet(id: string) {
    setSets((prev) => (prev.length > 1 ? prev.filter((s) => s.id !== id) : prev));
  }

  function updateSet(id: string, field: keyof SetEntry, value: string | boolean) {
    setSets((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  }

  async function handleSaveLog() {
    if (!member?.id || !selectedExercise || saving) return;
    const exercise = selectedExercise;

    setSaving(true);
    setError(null);
    try {
      const log = await createExerciseLog(
        { memberId: member.id, exerciseId: exercise.id },
        token
      );

      for (let i = 0; i < sets.length; i++) {
        const s = sets[i];
        const body: Record<string, number | boolean> = { setNumber: i + 1, completed: true };
        if (exercise.unit === 'weight_reps') {
          const r = parseInt(s.reps, 10);
          if (isNaN(r)) {
            setError('Enter valid reps for all sets');
            setSaving(false);
            return;
          }
          body.reps = r;
          body.weightKg = s.bodyweight ? 0 : parseFloat(s.weight);
          if (!s.bodyweight && (isNaN(body.weightKg as number) || (body.weightKg as number) < 0)) {
            setError('Enter valid weight');
            setSaving(false);
            return;
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
        await addSetToExerciseLog(log.id, body, token);
      }

      if (exerciseId) {
        router.replace(`/exercise/${exercise.id}`);
      } else {
        router.replace('/(tabs)/exercises');
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
                setStep('sets');
              }}
            >
              <Text style={styles.pickerName}>{item.name}</Text>
              <Text style={styles.pickerMeta}>{item.category} · {item.equipment ?? '—'}</Text>
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
                <View style={styles.bodyweightRow}>
                  <Text style={styles.bodyweightLabel}>Bodyweight</Text>
                  <Switch
                    value={s.bodyweight}
                    onValueChange={(v) => updateSet(s.id, 'bodyweight', v)}
                    trackColor={{ false: colors.border, true: colors.accent }}
                    thumbColor={s.bodyweight ? colors.primary : colors.white}
                  />
                </View>
                {!s.bodyweight && (
                  <TextInput
                    style={styles.input}
                    placeholder="Weight (kg)"
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
  pickerName: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
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
});

import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
  Switch,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../../contexts/AuthContext';
import {
  getExerciseLog,
  updateSet,
  addSetToExerciseLog,
  deleteSet,
} from '../../../lib/api';
import type { ExerciseLog, Set } from '../../../types';
import { colors } from '../../../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

interface SetEntry {
  id: string;
  reps: string;
  weight: string;
  duration: string;
  distance: string;
  bodyweight: boolean;
  isNew: boolean;
}

function setToEntry(s: Set): SetEntry {
  return {
    id: s.id,
    reps: s.reps != null ? String(s.reps) : '',
    weight: s.weightKg != null ? String(s.weightKg) : '',
    duration: s.durationSeconds != null ? String(s.durationSeconds) : '',
    distance: s.distanceMeters != null ? String(s.distanceMeters) : '',
    bodyweight: s.weightKg === 0,
    isNew: false,
  };
}

export default function EditLogScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token } = useAuth();
  const [log, setLog] = useState<ExerciseLog | null>(null);
  const [sets, setSets] = useState<SetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getExerciseLog(id, token)
      .then((data) => {
        setLog(data);
        const entries =
          data.sets && data.sets.length > 0
            ? data.sets.map(setToEntry)
            : [{ id: 'new-1', reps: '', weight: '', duration: '', distance: '', bodyweight: false, isNew: true }];
        setSets(entries);
      })
      .catch(() => setError('Log not found'))
      .finally(() => setLoading(false));
  }, [id, token]);

  function addSet() {
    setSets((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        reps: '',
        weight: '',
        duration: '',
        distance: '',
        bodyweight: false,
        isNew: true,
      },
    ]);
  }

  function removeSet(setId: string) {
    setSets((prev) => (prev.length > 1 ? prev.filter((s) => s.id !== setId) : prev));
  }

  function updateSetEntry(setId: string, field: keyof SetEntry, value: string | boolean) {
    setSets((prev) =>
      prev.map((s) => (s.id === setId ? { ...s, [field]: value } : s))
    );
  }

  async function handleSave() {
    if (!log?.exercise || saving) return;
    const exercise = log.exercise;

    setSaving(true);
    setError(null);
    try {
      const originalSetIds = new Set(
        (log.sets ?? []).map((s) => s.id)
      );
      const currentSetIds = new Set(sets.map((s) => s.id));
      const removedIds = [...originalSetIds].filter((i) => !currentSetIds.has(i));

      for (const setId of removedIds) {
        if (!setId.startsWith('new-')) {
          await deleteSet(setId, token);
        }
      }

      let setNumber = 0;
      for (const s of sets) {
        setNumber++;
        if (s.isNew) {
          const body: Record<string, number | boolean> = { setNumber, completed: true };
          if (exercise.unit === 'weight_reps') {
            const r = parseInt(s.reps, 10);
            body.reps = isNaN(r) ? 0 : r;
            body.weightKg = s.bodyweight ? 0 : parseFloat(s.weight) || 0;
          } else if (exercise.unit === 'time') {
            body.durationSeconds = parseInt(s.duration, 10) || 0;
          } else if (exercise.unit === 'distance') {
            body.distanceMeters = parseFloat(s.distance) || 0;
          }
          await addSetToExerciseLog(log.id, body, token);
        } else {
          const updates: Partial<Set> = {};
          if (exercise.unit === 'weight_reps') {
            const r = parseInt(s.reps, 10);
            updates.reps = isNaN(r) ? null : r;
            updates.weightKg = s.bodyweight ? 0 : parseFloat(s.weight) || null;
          } else if (exercise.unit === 'time') {
            updates.durationSeconds = parseInt(s.duration, 10) || null;
          } else if (exercise.unit === 'distance') {
            updates.distanceMeters = parseFloat(s.distance) || null;
          }
          if (Object.keys(updates).length > 0) {
            await updateSet(s.id, updates, token);
          }
        }
      }

      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !log) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>{loading ? 'Loading...' : 'Log not found'}</Text>
      </View>
    );
  }

  const exercise = log.exercise;
  if (!exercise) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Exercise not found</Text>
      </View>
    );
  }

  const isWeightReps = exercise.unit === 'weight_reps';
  const isTime = exercise.unit === 'time';
  const isDistance = exercise.unit === 'distance';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Edit: {exercise.name}</Text>
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
                  onChangeText={(v) => updateSetEntry(s.id, 'reps', v)}
                  keyboardType="number-pad"
                  placeholderTextColor={colors.textMuted}
                />
                <View style={styles.bodyweightRow}>
                  <Text style={styles.bodyweightLabel}>Bodyweight</Text>
                  <Switch
                    value={s.bodyweight}
                    onValueChange={(v) => updateSetEntry(s.id, 'bodyweight', v)}
                    trackColor={{ false: colors.border, true: colors.accent }}
                    thumbColor={s.bodyweight ? colors.primary : colors.white}
                  />
                </View>
                {!s.bodyweight && (
                  <TextInput
                    style={styles.input}
                    placeholder="Weight (kg)"
                    value={s.weight}
                    onChangeText={(v) => updateSetEntry(s.id, 'weight', v)}
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
                onChangeText={(v) => updateSetEntry(s.id, 'duration', v)}
                keyboardType="number-pad"
                placeholderTextColor={colors.textMuted}
              />
            )}
            {isDistance && (
              <TextInput
                style={styles.input}
                placeholder="Distance (meters)"
                value={s.distance}
                onChangeText={(v) => updateSetEntry(s.id, 'distance', v)}
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
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { paddingRight: 16 },
  backText: { color: colors.primary, fontSize: 16 },
  title: { fontSize: 18, fontWeight: '600', color: colors.textPrimary, flex: 1 },
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
  setHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
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

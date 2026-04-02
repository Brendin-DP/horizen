import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { requestExercise } from '../lib/api';
import type { ExerciseCategory, ExerciseRequestPayload, ExerciseType } from '../types';
import { colors, typography } from '../constants/theme';

/** Matches `ENUMS.categories` / Postgres `exercise_category`. */
export const EXERCISE_REQUEST_CATEGORIES: readonly ExerciseCategory[] = [
  'Upper Body',
  'Lower Body',
  'Full Body',
  'Core',
  'Cardio',
  'Mobility',
] as const;

/** Matches `ENUMS.types` / Postgres `exercise_type` (order per schema). */
export const EXERCISE_REQUEST_TYPES: readonly ExerciseType[] = [
  'Push',
  'Pull',
  'Squat',
  'Hinge',
  'Lunge',
  'Isolation',
  'Core',
  'Cardio',
  'Olympic',
  'Compound',
  'Carry',
  'Mobility',
  'Plyometric',
] as const;

type Props = {
  visible: boolean;
  onClose: () => void;
  memberId: string;
  /** Prefills the name field (e.g. current search query). */
  initialName?: string;
  token: string | null;
  onSuccess?: () => void;
};

export function RequestExerciseModal({
  visible,
  onClose,
  memberId,
  initialName = '',
  token,
  onSuccess,
}: Props) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ExerciseCategory | null>(null);
  const [exerciseType, setExerciseType] = useState<ExerciseType | null>(null);
  const [requestNotes, setRequestNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState<null | 'category' | 'type'>(null);

  useEffect(() => {
    if (visible) {
      setName(initialName.trim());
      setCategory(null);
      setExerciseType(null);
      setRequestNotes('');
      setError(null);
      setSubmitting(false);
      setPickerOpen(null);
    }
  }, [visible, initialName]);

  const handleSubmit = useCallback(async () => {
    if (!token) {
      setError('You must be signed in to request an exercise.');
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Exercise name is required.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const payload: ExerciseRequestPayload = {
        memberId,
        name: trimmed,
        ...(category ? { category } : {}),
        ...(exerciseType ? { type: exerciseType } : {}),
        ...(requestNotes.trim() ? { requestNotes: requestNotes.trim() } : {}),
      };
      await requestExercise(payload, token);
      Alert.alert(
        'Exercise requested!',
        "We'll review it and add it to the library soon.",
        [{ text: 'OK', onPress: () => {
          onClose();
          onSuccess?.();
        }}]
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }, [token, memberId, name, category, exerciseType, requestNotes, onClose, onSuccess]);

  const nameOk = name.trim().length > 0;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable
            style={styles.backdrop}
            onPress={onClose}
            pointerEvents={pickerOpen ? 'none' : 'auto'}
          />
          <View style={styles.sheet} pointerEvents={pickerOpen ? 'box-none' : 'auto'}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Request exercise</Text>
              <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </Pressable>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="always"
              contentContainerStyle={styles.sheetScroll}
              showsVerticalScrollIndicator={false}
            >
              {error ? <Text style={styles.inlineError}>{error}</Text> : null}

              <Text style={styles.label}>Exercise name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Name"
                placeholderTextColor={colors.textMuted}
                autoFocus
                autoCapitalize="words"
              />

              <Text style={styles.label}>Category</Text>
              <Pressable
                style={styles.selectBtn}
                onPress={() => setPickerOpen('category')}
                accessibilityRole="button"
                accessibilityLabel="Choose category"
              >
                <Text style={[styles.selectBtnText, !category && styles.selectBtnPlaceholder]}>
                  {category ?? 'Optional'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
              </Pressable>

              <Text style={styles.label}>Type</Text>
              <Pressable
                style={styles.selectBtn}
                onPress={() => setPickerOpen('type')}
                accessibilityRole="button"
                accessibilityLabel="Choose movement type"
              >
                <Text style={[styles.selectBtnText, !exerciseType && styles.selectBtnPlaceholder]}>
                  {exerciseType ?? 'Optional'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
              </Pressable>

              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={requestNotes}
                onChangeText={setRequestNotes}
                placeholder="Describe the exercise or how it differs from similar ones"
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <Pressable
                style={[
                  styles.submitBtn,
                  (submitting || !nameOk) && styles.submitBtnDisabled,
                ]}
                onPress={handleSubmit}
                disabled={submitting || !nameOk}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.submitBtnText}>Submit request</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>

        {pickerOpen ? (
          <View style={styles.categoryOverlayRoot} pointerEvents="box-none">
            <Pressable
              style={styles.categoryPickerBackdrop}
              onPress={() => setPickerOpen(null)}
              accessibilityLabel="Close picker"
            />
            <View style={styles.pickerCard} pointerEvents="auto">
              <Text style={styles.pickerTitle}>
                {pickerOpen === 'category' ? 'Category' : 'Type'}
              </Text>
              <ScrollView
                keyboardShouldPersistTaps="always"
                style={styles.pickerList}
                nestedScrollEnabled
              >
                <Pressable
                  style={styles.pickerRow}
                  onPress={() => {
                    if (pickerOpen === 'category') setCategory(null);
                    else setExerciseType(null);
                    setPickerOpen(null);
                  }}
                >
                  <Text style={styles.pickerRowMuted}>Clear selection</Text>
                </Pressable>
                {pickerOpen === 'category'
                  ? EXERCISE_REQUEST_CATEGORIES.map((item) => (
                      <Pressable
                        key={item}
                        style={styles.pickerRow}
                        onPress={() => {
                          setCategory(item);
                          setPickerOpen(null);
                        }}
                      >
                        <Text style={styles.pickerRowText}>{item}</Text>
                      </Pressable>
                    ))
                  : EXERCISE_REQUEST_TYPES.map((item) => (
                      <Pressable
                        key={item}
                        style={styles.pickerRow}
                        onPress={() => {
                          setExerciseType(item);
                          setPickerOpen(null);
                        }}
                      >
                        <Text style={styles.pickerRowText}>{item}</Text>
                      </Pressable>
                    ))}
              </ScrollView>
              <Pressable style={styles.pickerCancel} onPress={() => setPickerOpen(null)}>
                <Text style={styles.pickerCancelText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '92%',
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    zIndex: 1,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: {
    fontSize: 18,
    fontFamily: typography.heading,
    color: colors.textPrimary,
  },
  sheetScroll: {
    padding: 20,
    paddingBottom: 32,
  },
  inlineError: {
    color: colors.primary,
    marginBottom: 12,
    fontFamily: typography.body,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
    fontFamily: typography.bodyMedium,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 16,
    fontFamily: typography.body,
    backgroundColor: colors.background,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 16,
    backgroundColor: colors.background,
  },
  selectBtnText: {
    fontSize: 16,
    color: colors.textPrimary,
    fontFamily: typography.body,
  },
  selectBtnPlaceholder: {
    color: colors.textMuted,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitBtnText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 16,
    fontFamily: typography.bodySemibold,
  },
  categoryOverlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  categoryPickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  pickerCard: {
    zIndex: 1001,
    elevation: 1001,
    width: '100%',
    maxWidth: 400,
    maxHeight: '70%',
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 8,
  },
  pickerList: {
    maxHeight: 280,
  },
  pickerTitle: {
    fontSize: 17,
    fontFamily: typography.heading,
    color: colors.textPrimary,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pickerRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pickerRowText: {
    fontSize: 16,
    color: colors.textPrimary,
    fontFamily: typography.body,
  },
  pickerRowMuted: {
    fontSize: 16,
    color: colors.textMuted,
    fontFamily: typography.body,
  },
  pickerCancel: {
    padding: 16,
    alignItems: 'center',
  },
  pickerCancelText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
    fontFamily: typography.bodySemibold,
  },
});

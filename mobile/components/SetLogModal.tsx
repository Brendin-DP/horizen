import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Switch,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { Exercise } from '../types';
import { weightOptional, weightRequired } from '../lib/loggingType';
import { colors, typography } from '../constants/theme';
import { SetDatePicker } from './SetDatePicker';
import type { SetEntry } from '../lib/setEntryForm';

type Props = {
  visible: boolean;
  onRequestClose: () => void;
  exercise: Exercise;
  draft: SetEntry | null;
  onPatch: (field: keyof SetEntry, value: string | boolean) => void;
  mode: 'add' | 'edit';
  modalError: string | null;
  onConfirm: () => void;
  /** When true, actions are disabled and confirm shows a saving label. */
  saving?: boolean;
};

export function SetLogModal({
  visible,
  onRequestClose,
  exercise,
  draft,
  onPatch,
  mode,
  modalError,
  onConfirm,
  saving = false,
}: Props) {
  const isWeightReps = exercise.unit === 'weight_reps';
  const isTime = exercise.unit === 'time';
  const isDistance = exercise.unit === 'distance';

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={() => {
        if (!saving) onRequestClose();
      }}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scroll}
        >
          <View style={styles.card}>
            <Text style={styles.title}>{mode === 'edit' ? 'Edit set' : 'Add set'}</Text>
            {modalError ? <Text style={styles.modalErrorText}>{modalError}</Text> : null}
            {draft ? (
              <SetDatePicker
                valueIso={draft.loggedAtIso}
                onChangeIso={(iso) => onPatch('loggedAtIso', iso)}
              />
            ) : null}
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
                        onChangeText={(v) => onPatch('reps', v)}
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
                              onPatch('addedWeight', !v);
                              if (v) onPatch('weight', '');
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
                        style={[
                          styles.inputSuffixField,
                          !draft.addedWeight && styles.inputSuffixFieldDisabled,
                        ]}
                        placeholder={draft.addedWeight ? 'Add weight' : ''}
                        value={draft.weight}
                        onChangeText={(v) => onPatch('weight', v)}
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
                        onChangeText={(v) => onPatch('reps', v)}
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
                        onChangeText={(v) => onPatch('weight', v)}
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
                        onChangeText={(v) => onPatch('reps', v)}
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
                onChangeText={(v) => onPatch('duration', v)}
                keyboardType="number-pad"
                placeholderTextColor={colors.textMuted}
              />
            )}
            {draft && isDistance && (
              <TextInput
                style={styles.input}
                placeholder="Distance (meters)"
                value={draft.distance}
                onChangeText={(v) => onPatch('distance', v)}
                keyboardType="decimal-pad"
                placeholderTextColor={colors.textMuted}
              />
            )}
            <View style={styles.actions}>
              <Pressable
                style={[styles.cancelBtn, saving && styles.actionDisabled]}
                onPress={onRequestClose}
                disabled={saving}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmBtn, saving && styles.actionDisabled]}
                onPress={onConfirm}
                disabled={saving}
              >
                <Text style={styles.confirmText}>
                  {saving ? 'Saving...' : mode === 'edit' ? 'Save' : 'Add'}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  title: {
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
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  cancelText: {
    color: colors.textMuted,
    fontWeight: '600',
    fontSize: 16,
  },
  confirmBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  actionDisabled: {
    opacity: 0.55,
  },
  confirmText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 16,
  },
});

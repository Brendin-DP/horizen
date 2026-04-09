import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, typography } from '../constants/theme';

function formatDateShort(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

/** End of local calendar day — max selectable date (no tomorrow). */
function endOfLocalToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function clampDateToMax(d: Date, max: Date): Date {
  return d.getTime() > max.getTime() ? new Date(max) : d;
}

export function SetDatePicker({
  valueIso,
  onChangeIso,
  label = 'Log date',
}: {
  valueIso: string;
  onChangeIso: (iso: string) => void;
  /** e.g. "Session date" when editing session only */
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  /** iOS: working value while the spinner is open (commit on Done). */
  const [pendingDate, setPendingDate] = useState(() =>
    clampDateToMax(new Date(valueIso), endOfLocalToday())
  );

  const maxDate = endOfLocalToday();

  useEffect(() => {
    if (!open) {
      setPendingDate(clampDateToMax(new Date(valueIso), endOfLocalToday()));
    }
  }, [valueIso, open]);

  function openPicker() {
    setPendingDate(clampDateToMax(new Date(valueIso), maxDate));
    setOpen(true);
  }

  function commitIos() {
    onChangeIso(clampDateToMax(pendingDate, maxDate).toISOString());
    setOpen(false);
  }

  function cancelIos() {
    setOpen(false);
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={styles.field}
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text style={styles.dateText}>{formatDateShort(valueIso)}</Text>
      </Pressable>

      {Platform.OS === 'ios' ? (
        <Modal visible={open} transparent animationType="slide" onRequestClose={cancelIos}>
          <Pressable style={styles.modalBackdrop} onPress={cancelIos}>
            <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalToolbar}>
                <Pressable onPress={cancelIos} hitSlop={12}>
                  <Text style={styles.modalToolbarBtn}>Cancel</Text>
                </Pressable>
                <Text style={styles.modalToolbarTitle}>Date</Text>
                <Pressable onPress={commitIos} hitSlop={12}>
                  <Text style={[styles.modalToolbarBtn, styles.modalToolbarDone]}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={pendingDate}
                mode="date"
                display="spinner"
                themeVariant="light"
                maximumDate={maxDate}
                onChange={(_, d) => {
                  if (d) setPendingDate(clampDateToMax(d, maxDate));
                }}
                style={styles.iosSpinner}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : (
        open && (
          <DateTimePicker
            value={clampDateToMax(new Date(valueIso), maxDate)}
            mode="date"
            display="spinner"
            maximumDate={maxDate}
            onChange={(event, date) => {
              setOpen(false);
              if (event.type === 'dismissed') return;
              if (date) onChangeIso(clampDateToMax(date, maxDate).toISOString());
            }}
          />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 6,
    fontFamily: typography.body,
  },
  field: {
    backgroundColor: colors.backgroundDark,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
  },
  dateText: {
    fontSize: 16,
    color: colors.textPrimary,
    fontFamily: typography.body,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  modalToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalToolbarTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: typography.bodySemibold,
  },
  modalToolbarBtn: {
    fontSize: 17,
    color: colors.textMuted,
    fontFamily: typography.body,
  },
  modalToolbarDone: {
    color: colors.primary,
    fontWeight: '600',
  },
  iosSpinner: {
    height: 216,
    width: '100%',
  },
});

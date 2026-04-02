import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Platform,
  StyleSheet,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, typography } from '../constants/theme';

function formatDateShort(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

function clampPastDate(selected: Date): Date {
  const noon = new Date(selected);
  noon.setHours(12, 0, 0, 0);
  const now = Date.now();
  if (noon.getTime() > now) {
    const start = new Date(selected);
    start.setHours(0, 0, 0, 0);
    if (start.getTime() <= now) {
      return start;
    }
    return new Date();
  }
  return noon;
}

/** Date-only control for when a set was performed (maps to `createdAt`). Max: today. */
export function SetDatePicker({
  valueIso,
  onChangeIso,
  label = 'Log date',
}: {
  valueIso: string;
  onChangeIso: (iso: string) => void;
  label?: string;
}) {
  const [show, setShow] = useState(false);

  const parsed = new Date(valueIso);
  const safeValue = Number.isNaN(parsed.getTime()) ? new Date() : parsed;

  const onChange = (_event: unknown, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShow(false);
    }
    if (selectedDate) {
      const d = clampPastDate(selectedDate);
      onChangeIso(d.toISOString());
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={styles.press}
        onPress={() => setShow(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${formatDateShort(valueIso)}`}
      >
        <Text style={styles.dateText}>{formatDateShort(valueIso)}</Text>
        <Text style={styles.changeHint}>Change</Text>
      </Pressable>
      {show ? (
        <>
          <DateTimePicker
            value={safeValue}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={new Date()}
            onChange={onChange}
          />
          {Platform.OS === 'ios' ? (
            <Pressable style={styles.doneBtn} onPress={() => setShow(false)}>
              <Text style={styles.doneText}>Done</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 8,
    fontFamily: typography.bodyMedium,
  },
  press: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.backgroundDark,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  dateText: {
    fontSize: 16,
    color: colors.textPrimary,
    fontFamily: typography.body,
  },
  changeHint: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    fontFamily: typography.bodySemibold,
  },
  doneBtn: {
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  doneText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 16,
    fontFamily: typography.bodySemibold,
  },
});

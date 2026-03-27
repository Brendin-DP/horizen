import type { ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, shell, typography } from '../constants/theme';

const SIDE_MIN = 44;

type DrillDownHeaderProps = {
  title: string;
  onBack: () => void;
  /** e.g. Edit link — keep narrow so title stays centered */
  right?: ReactNode;
};

export function DrillDownHeader({ title, onBack, right }: DrillDownHeaderProps) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} style={styles.sideLeft} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back">
        <Ionicons name="chevron-back" size={22} color={colors.textMuted} />
      </Pressable>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.sideRight}>{right != null ? right : <View style={styles.rightSpacer} />}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: shell.header,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sideLeft: {
    minWidth: SIDE_MIN,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingLeft: 4,
  },
  sideRight: {
    minWidth: SIDE_MIN,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 4,
  },
  rightSpacer: {
    width: 1,
    height: 1,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    fontFamily: typography.headingSemibold,
  },
});

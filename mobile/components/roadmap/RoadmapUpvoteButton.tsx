import { Pressable, Text, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { colors, typography, borderRadius } from '../../constants/theme';

type Props = {
  hasVoted: boolean;
  upvotes: number;
  onPress: () => void;
};

export function RoadmapUpvoteButton({ hasVoted, upvotes, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        hasVoted && styles.btnActive,
        pressed && styles.btnPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={hasVoted ? 'Remove upvote' : 'Upvote'}
    >
      <Ionicons
        name={hasVoted ? 'thumbs-up' : 'thumbs-up-outline'}
        size={20}
        color={hasVoted ? colors.white : colors.textMuted}
      />
      <View style={styles.labelRow}>
        <Text style={[styles.label, hasVoted && styles.labelActive]}>
          {hasVoted ? 'Upvoted' : 'Upvote'}
        </Text>
        <Text style={[styles.count, hasVoted && styles.countActive]}>· {upvotes}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  btnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  btnPressed: { opacity: 0.88 },
  labelRow: { flexDirection: 'row', alignItems: 'center' },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: typography.bodySemibold,
  },
  labelActive: { color: colors.white },
  count: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
    fontFamily: typography.bodySemibold,
  },
  countActive: { color: 'rgba(255,255,255,0.9)' },
});

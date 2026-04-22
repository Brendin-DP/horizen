import type { FeatureRequestTag } from '../../types';
import { colors } from '../../constants/theme';

export function tagBadgeColors(tag: FeatureRequestTag): { bg: string; text: string } {
  switch (tag) {
    case 'Bug':
      return { bg: '#fee2e2', text: '#991b1b' };
    case 'Feature Request':
      return { bg: '#dbeafe', text: '#1e40af' };
    case 'Improvement':
      return { bg: '#dcfce7', text: '#166534' };
    default:
      return { bg: colors.border, text: colors.textSecondary };
  }
}

import { Text, TextInput } from 'react-native';
import { typography } from './theme';

let applied = false;

type WithDefaultProps = {
  defaultProps?: { style?: unknown };
};

export function applyTypographyDefaults() {
  if (applied) return;
  applied = true;

  const T = Text as typeof Text & WithDefaultProps;
  const TI = TextInput as typeof TextInput & WithDefaultProps;

  T.defaultProps = {
    ...T.defaultProps,
    style: [{ fontFamily: typography.body }, T.defaultProps?.style].filter(Boolean),
  };

  TI.defaultProps = {
    ...TI.defaultProps,
    style: [{ fontFamily: typography.body }, TI.defaultProps?.style].filter(Boolean),
  };
}

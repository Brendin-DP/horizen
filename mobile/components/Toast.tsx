import { useEffect, useRef } from 'react';
import { Text, StyleSheet, Animated } from 'react-native';
import { colors } from '../constants/theme';

interface ToastProps {
  visible: boolean;
  message: string;
  onDismiss: () => void;
}

export function Toast({ visible, message, onDismiss }: ToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible || !message) return;
    opacity.setValue(0);
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onDismiss());
  }, [visible, message, onDismiss]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    left: 24,
    right: 24,
    backgroundColor: colors.textPrimary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    zIndex: 9999,
  },
  text: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '500',
  },
});

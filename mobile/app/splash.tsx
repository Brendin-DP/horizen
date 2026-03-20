import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Image } from 'react-native';
import { colors } from '../constants/theme';

const SPLASH_DURATION = 2000;
const { width } = Dimensions.get('window');

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const circle1 = useRef(new Animated.Value(0)).current;
  const circle2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(circle1, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(circle1, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.loop(
        Animated.sequence([
          Animated.timing(circle2, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(circle2, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ),
    ]).start();
  }, []);

  useEffect(() => {
    const t = setTimeout(onComplete, SPLASH_DURATION);
    return () => clearTimeout(t);
  }, [onComplete]);

  const circle1Opacity = circle1.interpolate({
    inputRange: [0, 1],
    outputRange: [0.1, 0.25],
  });
  const circle2Opacity = circle2.interpolate({
    inputRange: [0, 1],
    outputRange: [0.05, 0.15],
  });

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.circle,
          {
            width: width * 0.6,
            height: width * 0.6,
            borderRadius: (width * 0.6) / 2,
            opacity: circle1Opacity,
          },
        ]}
      />
      <Animated.View
        style={[
          styles.circle,
          {
            width: width * 0.8,
            height: width * 0.8,
            borderRadius: (width * 0.8) / 2,
            opacity: circle2Opacity,
          },
        ]}
      />
      <Animated.View style={[styles.content, { opacity, transform: [{ scale }] }]}>
        <Image source={require('../assets/logo.png')} style={styles.logo} />
      </Animated.View>
      <Animated.Text style={[styles.tagline, { opacity }]}>
        BETTER THAN YESTERDAY
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.splashBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circle: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  content: {
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 120,
  },
  tagline: {
    position: 'absolute',
    bottom: 80,
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 2,
  },
});

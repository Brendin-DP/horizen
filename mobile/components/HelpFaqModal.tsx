import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StatusBar } from 'expo-status-bar';
import { initialWindowMetrics, SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { DrillDownHeader } from './DrillDownHeader';
import { colors, shell, typography } from '../constants/theme';

const faqs = [
  {
    id: '1',
    question: 'How do I log an exercise?',
    answer:
      'Tap the Exercises tab, then tap "Add Exercise" to choose from the exercise library. Select your exercise, add your sets with reps and weight, then save. Your session will appear in your exercise history.',
  },
  {
    id: '2',
    question: "I don't see an exercise I'm looking for",
    answer:
      'Our exercise library is curated to cover the most common movements. If something is missing, tap "Can\'t find an exercise?" at the bottom of the exercise list and submit a request. We review all requests and add approved exercises to the library regularly.',
  },
  {
    id: '3',
    question: "Why can't I find an exercise I'm looking for?",
    answer:
      'Our exercise library covers a wide range of movements but may not include everything. If an exercise is missing, you can submit a request directly from the exercise library screen by tapping "Can\'t find an exercise?" at the bottom of the list.',
  },
  {
    id: '9',
    question: "How do I request an exercise that's not in the library?",
    answer:
      'If you can\'t find an exercise, scroll to the bottom of the exercise library and tap "Can\'t find an exercise?". You\'ll be able to submit the exercise name and a short description. Our team reviews all requests and approved exercises are added to the library for everyone to use.',
  },
  {
    id: '5',
    question: 'How do I track my progress over time?',
    answer:
      "Tap any exercise on your Exercises screen to open its detail view. You'll see a progress chart showing your best weight over time, plus a history of every session you've logged for that exercise.",
  },
  {
    id: '6',
    question: 'Can I log a session from a previous day?',
    answer:
      'Yes. When logging an exercise, you can edit the session date to reflect when the workout actually happened. This is useful if you forgot to log a session on the day.',
  },
  {
    id: '7',
    question: 'How do I update my profile or profile picture?',
    answer:
      'Go to the Profile tab and tap your avatar or name to edit your details. You can upload a profile photo directly from your camera roll.',
  },
  {
    id: '8',
    question: 'I have an idea for the app — how do I share it?',
    answer:
      "We'd love to hear it. Go to Profile → Request a Feature, fill in a short title and description, and submit. We review every request and use them to shape our product roadmap.",
  },
];

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function Chevron({ expanded }: { expanded: boolean }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: expanded ? 1 : 0,
      useNativeDriver: true,
      friction: 8,
    }).start();
  }, [expanded, anim]);

  const rotate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
    </Animated.View>
  );
}

type HelpFaqModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function HelpFaqModal({ visible, onClose }: HelpFaqModalProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setOpenId(null);
    }
  }, [visible]);

  function toggle(id: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenId((prev) => (prev === id ? null : id));
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      {/* Modal is not under the root SafeAreaProvider context — provide metrics so top/bottom insets apply */}
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <View style={styles.modalRoot}>
          <StatusBar style="dark" />
          <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
            <DrillDownHeader title="Help & FAQ" onBack={onClose} />
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
              bounces
            >
              {faqs.map((item) => {
                const expanded = openId === item.id;
                return (
                  <View key={item.id} style={styles.itemWrap}>
                    <Pressable
                      style={({ pressed }) => [styles.questionRow, pressed && styles.questionPressed]}
                      onPress={() => toggle(item.id)}
                    >
                      <Text style={styles.questionText}>{item.question}</Text>
                      <Chevron expanded={expanded} />
                    </Pressable>
                    {expanded ? (
                      <View style={styles.answerBlock}>
                        <Text style={styles.answerText}>{item.answer}</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </ScrollView>
          </SafeAreaView>
        </View>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    backgroundColor: shell.body,
  },
  safe: {
    flex: 1,
    backgroundColor: shell.body,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 8,
    paddingBottom: 40,
  },
  itemWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
    gap: 12,
  },
  questionPressed: {
    opacity: 0.85,
  },
  questionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
    fontFamily: typography.bodyMedium,
  },
  answerBlock: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  answerText: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.textSecondary,
    fontFamily: typography.body,
    lineHeight: 20,
  },
});

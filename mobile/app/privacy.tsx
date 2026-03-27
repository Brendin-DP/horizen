import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography } from '../constants/theme';
import { DrillDownHeader } from '../components/DrillDownHeader';

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: 'Who we are',
    body: [
      'This Privacy Policy applies to the Horizen gym app and its associated services. We are committed to protecting your personal information and being transparent about how we use it.',
    ],
  },
  {
    title: 'What information we collect',
    body: [
      'Information you provide:',
      '• Name and email address when you create an account',
      '• Profile photo if you choose to upload one',
      '• Exercise data including logs, sets, weights, and reps you record',
      '• Any notes you add to your workouts or exercises',
      '',
      'Information collected automatically:',
      '• App usage patterns such as which features you use and how often',
      '• Device type and operating system',
      '• App version and performance data',
      '• Crash reports and error logs',
    ],
  },
  {
    title: 'How we use your information',
    body: [
      'Your personal data is used solely to:',
      '• Provide and personalise your experience in the app',
      '• Display your exercise history and progress',
      '• Calculate your position on the rewards leaderboard',
      '• Send you relevant notifications about your activity',
      '',
      'Your usage data is used to:',
      '• Understand how features are being used across the app',
      '• Identify trends to improve the product',
      '• Fix bugs and improve performance',
    ],
  },
  {
    title: 'What we do not do',
    body: [
      'We want to be explicit about this:',
      '• We do not sell your personal data to any third party',
      '• We do not share your individual data with other users',
      '• We do not use your personal information for advertising purposes',
      '• We do not share your exercise or health data with external organisations',
      '• Leaderboard rankings show only your display name and star count — no personal contact details are ever visible to other users',
    ],
  },
  {
    title: 'The rewards and leaderboard system',
    body: [
      'The star rewards and leaderboard features are designed purely for motivation and to make your fitness journey more engaging. Your position on the leaderboard reflects stars awarded by your instructor and is visible to other members of your gym. No personal contact information, health data, or exercise logs are shared as part of this feature.',
    ],
  },
  {
    title: 'Analytics and improvement',
    body: [
      'We use anonymised, aggregated analytics to understand how the app is being used. This includes things like which screens are visited most, which features are popular, and where users encounter friction. This data is reported in aggregate — it cannot be used to identify you as an individual.',
    ],
  },
  {
    title: 'Data storage and security',
    body: [
      'Your data is stored securely using industry-standard cloud infrastructure. We use encryption in transit and at rest. Access to your data is restricted to authorised personnel only and only where necessary to operate the service.',
    ],
  },
  {
    title: 'How long we keep your data',
    body: [
      'We retain your data for as long as your account is active. If you delete your account, your personal data will be removed from our systems within 30 days. Anonymised, aggregated analytics data may be retained indefinitely as it cannot be linked back to you.',
    ],
  },
  {
    title: 'Your rights',
    body: [
      'You have the right to:',
      '• Access the personal data we hold about you',
      '• Request corrections to inaccurate data',
      '• Request deletion of your account and associated data',
      '• Export your exercise data at any time',
      '• Opt out of analytics tracking',
      '',
      'To exercise any of these rights, contact us at the email address below.',
    ],
  },
  {
    title: "Children's privacy",
    body: [
      'This app is not intended for use by children under the age of 13. We do not knowingly collect personal information from children.',
    ],
  },
  {
    title: 'Changes to this policy',
    body: [
      'We may update this Privacy Policy from time to time. We will notify you of any significant changes through the app. Continued use of the app after changes are posted constitutes your acceptance of the updated policy.',
    ],
  },
  {
    title: 'Contact us',
    body: [
      'If you have any questions about this Privacy Policy or how we handle your data, please contact us at:',
      'privacy@horizenapp.com',
    ],
  },
];

export default function PrivacyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <DrillDownHeader title="Privacy" onBack={() => router.back()} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.docTitle}>Privacy Policy</Text>
        <Text style={styles.updated}>Last updated: March 2026</Text>

        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.block}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.body.map((line, i) => (
              <Text
                key={`${section.title}-${i}`}
                style={[styles.paragraph, line === '' && styles.paragraphSpacer]}
              >
                {line === '' ? ' ' : line}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundDark },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  docTitle: {
    fontSize: 26,
    color: colors.textPrimary,
    marginBottom: 8,
    fontFamily: typography.heading,
  },
  updated: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 24,
    fontFamily: typography.body,
  },
  block: { marginBottom: 28 },
  sectionTitle: {
    fontSize: 17,
    color: colors.textPrimary,
    marginBottom: 10,
    fontFamily: typography.heading,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.textSecondary,
    fontFamily: typography.body,
  },
  paragraphSpacer: {
    lineHeight: 12,
    fontSize: 4,
  },
});

import { Link } from 'expo-router';
import { View, Text, StyleSheet, Pressable } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to GymApp</Text>
      <Text style={styles.subtitle}>Logged in as Neal Oberholster</Text>
      <Link href="/(tabs)/leaderboard" asChild>
        <Pressable style={styles.card}>
          <Text style={styles.cardTitle}>View Leaderboard</Text>
          <Text style={styles.cardDesc}>See who's leading the star rankings</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 24,
    paddingTop: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#f8fafc',
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 8,
  },
  card: {
    marginTop: 32,
    backgroundColor: '#1e293b',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f8fafc',
  },
  cardDesc: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
});

import { useState } from 'react';
import { Link, useRouter } from 'expo-router';
import { View, Text, StyleSheet, Pressable, Modal, TextInput } from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { createWorkout } from '../../lib/api';

export default function HomeScreen() {
  const { member, token, logout } = useAuth();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [workoutName, setWorkoutName] = useState('');

  function openCreateModal() {
    setWorkoutName('');
    setNameModalVisible(true);
  }

  async function handleCreateWorkout() {
    if (!member?.id || creating) return;
    setCreating(true);
    setNameModalVisible(false);
    const name = workoutName.trim() || undefined;
    try {
      const workout = await createWorkout(member.id, name || null, token);
      router.push(`/workout/${workout.id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to GymApp</Text>
      <Text style={styles.subtitle}>Logged in as {member?.name ?? 'Unknown'}</Text>
      <Text style={styles.role}>Role: {member?.role ?? 'member'}</Text>
      <Pressable onPress={logout} style={styles.logout}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>

      <Pressable
        style={[styles.startWorkoutBtn, creating && styles.buttonDisabled]}
        onPress={openCreateModal}
        disabled={creating}
      >
        <Text style={styles.startWorkoutText}>
          {creating ? 'Creating...' : 'Start New Workout'}
        </Text>
      </Pressable>

      <Modal visible={nameModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Workout</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Workout name (optional)"
              value={workoutName}
              onChangeText={setWorkoutName}
              placeholderTextColor="#64748b"
              autoFocus
            />
            <View style={styles.modalRow}>
              <Pressable style={styles.modalCancel} onPress={() => setNameModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalCreate, creating && styles.buttonDisabled]}
                onPress={handleCreateWorkout}
                disabled={creating}
              >
                <Text style={styles.modalCreateText}>{creating ? 'Creating...' : 'Create'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

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
  role: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  logout: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  logoutText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  startWorkoutBtn: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    alignItems: 'center',
  },
  startWorkoutText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#f8fafc', marginBottom: 16 },
  modalInput: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 14,
    color: '#f8fafc',
    fontSize: 16,
    marginBottom: 20,
  },
  modalRow: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  modalCancel: { paddingVertical: 12, paddingHorizontal: 20 },
  modalCancelText: { color: '#94a3b8' },
  modalCreate: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
  },
  modalCreateText: { color: '#fff', fontWeight: '600' },
});

import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../contexts/AuthContext';
import { getExerciseLogs } from '../../lib/api';
import type { ExerciseLog } from '../../types';
import { colors } from '../../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function ExercisesScreen() {
  const { member, token } = useAuth();
  const router = useRouter();
  const [logs, setLogs] = useState<ExerciseLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!member?.id) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const data = await getExerciseLogs(member.id, token);
      setLogs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exercises');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [member?.id, token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading exercises...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.logoPlaceholder} />
        <Text style={styles.headerTitle}>Exercises</Text>
        <Pressable
          style={styles.addBtn}
          onPress={() => router.push('/exercise/log')}
        >
          <Ionicons name="add" size={24} color={colors.white} />
        </Pressable>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{member?.name?.charAt(0) ?? '?'}</Text>
        </View>
      </View>

      {error && <Text style={styles.errorBanner}>{error}</Text>}

      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchData();
            }}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push(`/exercise/${item.exerciseId}`)}
          >
            <Text style={styles.cardName}>{item.exercise?.name ?? 'Exercise'}</Text>
            <Text style={styles.cardMeta}>{formatDate(item.loggedAt)}</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No exercises logged yet</Text>
            <Text style={styles.emptySub}>Tap Add to log your first exercise</Text>
            <Pressable
              style={styles.emptyAddBtn}
              onPress={() => router.push('/exercise/log')}
            >
              <Text style={styles.emptyAddText}>Add exercise</Text>
            </Pressable>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logoPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    marginRight: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: { color: colors.textMuted, marginTop: 12 },
  errorBanner: { color: colors.primary, paddingHorizontal: 16, marginBottom: 8 },
  list: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: colors.white,
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardName: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  cardMeta: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  empty: {
    padding: 24,
    alignItems: 'center',
    marginTop: 48,
  },
  emptyText: { fontSize: 16, color: colors.textMuted },
  emptySub: { fontSize: 14, color: colors.textMuted, marginTop: 8 },
  emptyAddBtn: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  emptyAddText: { color: colors.white, fontWeight: '600', fontSize: 16 },
});

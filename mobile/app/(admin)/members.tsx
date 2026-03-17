import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../../contexts/AuthContext';
import { getMembers, getLeaderboard, awardStar, type Member, type LeaderboardEntry } from '../../lib/api';
import { colors } from '../../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

interface MemberWithStars extends Member {
  starCount: number;
}

export default function AdminMembersScreen() {
  const { member, token, logout } = useAuth();
  const [members, setMembers] = useState<MemberWithStars[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awardModalVisible, setAwardModalVisible] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberWithStars | null>(null);
  const [reason, setReason] = useState('');
  const [awarding, setAwarding] = useState(false);

  const fetchData = useCallback(async () => {
    setError(null);
    try {
      const [participants, leaderboard] = await Promise.all([
        getMembers({ role: 'member', token }),
        getLeaderboard(token),
      ]);
      const starMap = new Map<string, number>();
      for (const e of leaderboard) {
        starMap.set(e.memberId, e.starCount);
      }
      const merged: MemberWithStars[] = participants.map((m) => ({
        ...m,
        starCount: starMap.get(m.id) ?? 0,
      }));
      setMembers(merged);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function openAwardModal(m: MemberWithStars) {
    setSelectedMember(m);
    setReason('');
    setAwardModalVisible(true);
  }

  async function handleAwardStar() {
    if (!selectedMember || awarding || !token) return;
    setAwarding(true);
    setError(null);
    try {
      await awardStar(selectedMember.id, reason.trim() || null, token);
      setAwardModalVisible(false);
      setSelectedMember(null);
      setReason('');
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to award star');
    } finally {
      setAwarding(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading members...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Award Stars</Text>
        <Pressable onPress={logout} style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(member?.name ?? '?')}</Text>
        </Pressable>
      </View>

      {error && <Text style={styles.errorBanner}>{error}</Text>}

      {members.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={64} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No participants yet</Text>
          <Text style={styles.emptyText}>Members will appear here when they join.</Text>
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor={colors.primary} />
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <View style={styles.avatarSmall}>
                  <Text style={styles.avatarSmallText}>{getInitials(item.name)}</Text>
                </View>
                <View style={styles.rowInfo}>
                  <Text style={styles.name}>{item.name}</Text>
                  <View style={styles.starRow}>
                    <Ionicons name="star" size={16} color={colors.gold} />
                    <Text style={styles.starCount}>{item.starCount}</Text>
                  </View>
                </View>
              </View>
              <Pressable
                style={[styles.awardBtn, awarding && styles.buttonDisabled]}
                onPress={() => openAwardModal(item)}
                disabled={awarding}
              >
                <Ionicons name="add" size={20} color={colors.white} />
                <Text style={styles.awardBtnText}>Star</Text>
              </Pressable>
            </View>
          )}
        />
      )}

      <Modal visible={awardModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Award star to {selectedMember?.name}
            </Text>
            <Text style={styles.modalLabel}>Reason (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Great form this week"
              value={reason}
              onChangeText={setReason}
              placeholderTextColor={colors.textMuted}
            />
            <View style={styles.modalRow}>
              <Pressable style={styles.cancelBtn} onPress={() => { setAwardModalVisible(false); setSelectedMember(null); }}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.submitBtn, awarding && styles.buttonDisabled]}
                onPress={handleAwardStar}
                disabled={awarding}
              >
                <Text style={styles.submitBtnText}>{awarding ? 'Awarding...' : 'Award'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundDark },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { color: colors.textMuted, marginTop: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '600', color: colors.textPrimary, flex: 1 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: colors.white, fontWeight: '600', fontSize: 14 },
  errorBanner: { color: colors.primary, padding: 12, backgroundColor: colors.accent },
  list: { padding: 16 },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: colors.textPrimary, marginTop: 16 },
  emptyText: { fontSize: 14, color: colors.textMuted, marginTop: 8, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatarSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarSmallText: { color: colors.primary, fontWeight: '600', fontSize: 16 },
  rowInfo: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  starRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  starCount: { fontSize: 14, color: colors.textMuted },
  awardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  awardBtnText: { color: colors.white, fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '600', color: colors.textPrimary, marginBottom: 16 },
  modalLabel: { fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginBottom: 8 },
  input: {
    backgroundColor: colors.backgroundDark,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
    color: colors.textPrimary,
    fontSize: 16,
    marginBottom: 20,
  },
  modalRow: { flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  cancelBtn: { paddingVertical: 12, paddingHorizontal: 20 },
  cancelBtnText: { color: colors.textMuted },
  submitBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  submitBtnText: { color: colors.white, fontWeight: '600' },
});

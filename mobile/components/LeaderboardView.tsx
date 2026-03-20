import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Image,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getLeaderboard, type LeaderboardEntry } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { colors } from '../constants/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function Top3Podium({ data }: { data: LeaderboardEntry[] }) {
  const order =
    data.length >= 3 ? [data[1], data[0], data[2]] : data.length === 2 ? [data[1], data[0]] : data;
  const sizes = data.length >= 3 ? [56, 72, 56] : data.length === 2 ? [56, 72] : [72];
  const ranks = data.length >= 3 ? [2, 1, 3] : data.map((e) => e.rank);

  return (
    <View style={styles.top3}>
      {order.map((entry, i) => (
        <View key={entry.memberId} style={styles.podiumSlot}>
          {entry.rank === 1 && (
            <View style={styles.crown}>
              <Ionicons name="medal" size={28} color={colors.gold} />
            </View>
          )}
          <View
            style={[
              styles.podiumAvatar,
              { width: sizes[i], height: sizes[i], borderRadius: sizes[i] / 2 },
            ]}
          >
            <Text style={[styles.podiumInitials, { fontSize: sizes[i] * 0.4 }]}>
              {getInitials(entry.name)}
            </Text>
            <View style={[styles.rankBadge, entry.rank === 1 && styles.rankBadgeFirst]}>
              <Text style={styles.rankBadgeText}>{ranks[i]}</Text>
            </View>
          </View>
          <Text style={styles.podiumName} numberOfLines={1}>
            {entry.name}
          </Text>
          <Text style={styles.podiumScore}>{entry.starCount}</Text>
        </View>
      ))}
    </View>
  );
}

function ListRow({
  item,
  isCurrentUser,
}: {
  item: LeaderboardEntry;
  isCurrentUser: boolean;
}) {
  return (
    <View style={styles.listRow}>
      <Text style={styles.listRank}>{item.rank}</Text>
      <View style={styles.listAvatar}>
        <Text style={styles.listAvatarText}>{getInitials(item.name)}</Text>
      </View>
      <View style={styles.listNameContainer}>
        <Text style={styles.listName} numberOfLines={1}>
          {item.name}
        </Text>
        {isCurrentUser && (
          <View style={styles.youTag}>
            <Text style={styles.youTagText}>You</Text>
          </View>
        )}
      </View>
      <View style={styles.listScore}>
        <Ionicons name="star" size={18} color={colors.gold} />
        <Text style={styles.listScoreText}>{item.starCount}</Text>
      </View>
    </View>
  );
}

export function LeaderboardView() {
  const { member, token } = useAuth();
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchLeaderboard() {
    setError(null);
    try {
      const result = await getLeaderboard(token);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  function onRefresh() {
    setRefreshing(true);
    fetchLeaderboard();
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading leaderboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            onPress={() => {
              setLoading(true);
              fetchLeaderboard();
            }}
            style={styles.retry}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const top3 = data.slice(0, 3);
  const rest = data.slice(3);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Image source={require('../assets/logo.png')} style={styles.logo} />
        <Ionicons name="search-outline" size={22} color={colors.textMuted} style={styles.searchIcon} />
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(member?.name ?? '?')}</Text>
        </View>
      </View>

      <View style={styles.titleRow}>
        <Ionicons name="trophy" size={24} color={colors.primary} />
        <Text style={styles.title}>Leaderboard</Text>
      </View>

      <FlatList
        data={rest}
        keyExtractor={(item) => item.memberId}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={top3.length >= 1 ? <Top3Podium data={top3} /> : null}
        renderItem={({ item }) => (
          <ListRow item={item} isCurrentUser={item.memberId === member?.id} />
        )}
        ListEmptyComponent={
          top3.length === 0 ? (
            <Text style={styles.empty}>No rankings yet.</Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundDark },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: { color: colors.textMuted, marginTop: 12 },
  errorText: { color: colors.primary, textAlign: 'center' },
  retry: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  retryText: { color: colors.white, fontWeight: '600' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  searchIcon: { marginLeft: 'auto', marginRight: 12 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: colors.white, fontWeight: '600', fontSize: 14 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: colors.white,
  },
  title: { fontSize: 22, fontWeight: 'bold', color: colors.textPrimary },
  list: { padding: 16, paddingTop: 0 },
  top3: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    paddingVertical: 24,
    paddingHorizontal: 8,
    marginBottom: 16,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  podiumSlot: { alignItems: 'center', flex: 1 },
  crown: { marginBottom: 8 },
  podiumAvatar: {
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  podiumInitials: { color: colors.primary, fontWeight: '600' },
  rankBadge: {
    position: 'absolute',
    bottom: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankBadgeFirst: { width: 28, height: 28, borderRadius: 14 },
  rankBadgeText: { color: colors.white, fontWeight: 'bold', fontSize: 12 },
  podiumName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 8,
    textAlign: 'center',
  },
  podiumScore: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 2,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 14,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listRank: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMuted,
    width: 28,
  },
  listAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  listAvatarText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  listNameContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  listName: { fontSize: 16, fontWeight: '500', color: colors.textPrimary, flex: 1 },
  youTag: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  youTagText: { color: colors.white, fontSize: 11, fontWeight: '600' },
  listScore: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  listScoreText: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  empty: { color: colors.textMuted, textAlign: 'center', padding: 24 },
});

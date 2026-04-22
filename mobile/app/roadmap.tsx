import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../contexts/AuthContext';
import { getRoadmap, voteOnRequest, type RoadmapItem } from '../lib/api';
import type { FeatureRequestStatus, FeatureRequestTag } from '../types';
import { colors, shell, typography, borderRadius } from '../constants/theme';
import { DrillDownHeader } from '../components/DrillDownHeader';

const SECTION_ORDER: FeatureRequestStatus[] = [
  'In Progress',
  'Under Consideration',
  'Requested',
  'Done',
];

function tagBadgeColors(tag: FeatureRequestTag): { bg: string; text: string } {
  switch (tag) {
    case 'Bug':
      return { bg: '#fee2e2', text: '#991b1b' };
    case 'Feature Request':
      return { bg: '#dbeafe', text: '#1e40af' };
    case 'Improvement':
      return { bg: '#dcfce7', text: '#166534' };
    default:
      return { bg: colors.border, text: colors.textSecondary };
  }
}

function buildSections(items: RoadmapItem[]) {
  const byStatus = new Map<FeatureRequestStatus, RoadmapItem[]>();
  for (const s of SECTION_ORDER) {
    byStatus.set(s, []);
  }
  for (const item of items) {
    const bucket = byStatus.get(item.status as FeatureRequestStatus);
    if (bucket) bucket.push(item);
  }
  return SECTION_ORDER.filter((status) => (byStatus.get(status)?.length ?? 0) > 0).map(
    (status) => ({
      title: status,
      data: byStatus.get(status) ?? [],
    })
  );
}

export default function RoadmapScreen() {
  const router = useRouter();
  const { member } = useAuth();
  const memberId = member?.id;
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const votingRef = useRef<Set<string>>(new Set());

  const sections = useMemo(() => buildSections(items), [items]);

  const load = useCallback(
    async (isRefresh = false) => {
      if (!memberId) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setLoadError(null);
      try {
        const data = await getRoadmap(memberId);
        setItems(data);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load roadmap';
        setLoadError(msg);
        if (!isRefresh) setItems([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [memberId]
  );

  useEffect(() => {
    if (!memberId) {
      setLoading(false);
      return;
    }
    load(false);
  }, [memberId, load]);

  const handleVote = async (item: RoadmapItem) => {
    if (!memberId) return;
    if (votingRef.current.has(item.id)) return;
    votingRef.current.add(item.id);

    const prevHasVoted = item.hasVoted;
    const prevUpvotes = item.upvotes;

    setItems((prev) =>
      prev.map((r) =>
        r.id === item.id
          ? {
              ...r,
              hasVoted: !r.hasVoted,
              upvotes: r.hasVoted ? Math.max(0, r.upvotes - 1) : r.upvotes + 1,
            }
          : r
      )
    );

    try {
      const result = await voteOnRequest(item.id, memberId);
      setItems((prev) =>
        prev.map((r) =>
          r.id === item.id ? { ...r, hasVoted: result.hasVoted, upvotes: result.upvotes } : r
        )
      );
    } catch {
      setItems((prev) =>
        prev.map((r) =>
          r.id === item.id ? { ...r, hasVoted: prevHasVoted, upvotes: prevUpvotes } : r
        )
      );
      Alert.alert('Error', 'Could not save your vote. Please try again.');
    } finally {
      votingRef.current.delete(item.id);
    }
  };

  if (!memberId) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <DrillDownHeader title="Product Roadmap" onBack={() => router.back()} />
        <View style={styles.centered}>
          <Text style={styles.muted}>Sign in to view the roadmap.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading && items.length === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <DrillDownHeader title="Product Roadmap" onBack={() => router.back()} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <DrillDownHeader title="Product Roadmap" onBack={() => router.back()} />
      <Text style={styles.subtitle}>
        See what we&apos;re working on and vote for what matters to you
      </Text>
      {loadError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{loadError}</Text>
          <Pressable onPress={() => load(false)} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
      <SectionList
        sections={sections}
        keyExtractor={(row) => row.id}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeaderWrap}>
            <Text style={styles.sectionHeader}>
              {section.title}{' '}
              <Text style={styles.sectionCount}>({section.data.length})</Text>
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <RoadmapCard item={item} onVote={() => handleVote(item)} />
        )}
        contentContainerStyle={
          sections.length === 0 ? styles.listEmptyGrow : styles.listContent
        }
        ListEmptyComponent={
          !loading && !loadError ? (
            <Text style={styles.emptyText}>Nothing here yet — check back soon!</Text>
          ) : null
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={colors.primary} />
        }
        stickySectionHeadersEnabled={false}
      />
    </SafeAreaView>
  );
}

function RoadmapCard({ item, onVote }: { item: RoadmapItem; onVote: () => void }) {
  const tagStyle = tagBadgeColors(item.tag);
  return (
    <View style={styles.card}>
      <View style={styles.cardTopRow}>
        <View style={[styles.tagBadge, { backgroundColor: tagStyle.bg }]}>
          <Text style={[styles.tagText, { color: tagStyle.text }]}>{item.tag}</Text>
        </View>
      </View>
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardDesc} numberOfLines={2}>
        {item.description}
      </Text>
      <View style={styles.cardFooter}>
        <Pressable
          onPress={onVote}
          style={({ pressed }) => [
            styles.upvoteBtn,
            item.hasVoted && styles.upvoteBtnActive,
            pressed && styles.upvoteBtnPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={item.hasVoted ? 'Remove upvote' : 'Upvote'}
        >
          <Ionicons
            name="chevron-up"
            size={22}
            color={item.hasVoted ? colors.white : colors.textMuted}
          />
          <Text style={[styles.upvoteCount, item.hasVoted && styles.upvoteCountActive]}>
            {item.upvotes}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: shell.body },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  muted: { color: colors.textMuted, fontSize: 15 },
  subtitle: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    fontSize: 15,
    color: colors.textSecondary,
    fontFamily: typography.body,
    lineHeight: 22,
  },
  errorBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    borderRadius: borderRadius.md,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  errorText: { flex: 1, color: colors.primaryDark, fontSize: 14 },
  retryBtn: { paddingVertical: 6, paddingHorizontal: 10 },
  retryText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  listEmptyGrow: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 32 },
  sectionHeaderWrap: {
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: shell.body,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.headingSemibold,
  },
  sectionCount: {
    fontWeight: '600',
    color: colors.textMuted,
    fontFamily: typography.bodySemibold,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 48,
    fontSize: 16,
    color: colors.textMuted,
    fontFamily: typography.body,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  cardTopRow: { marginBottom: 8 },
  tagBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  tagText: { fontSize: 12, fontWeight: '600', fontFamily: typography.bodySemibold },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: typography.headingSemibold,
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    fontFamily: typography.body,
    lineHeight: 20,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  upvoteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  upvoteBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  upvoteBtnPressed: { opacity: 0.85 },
  upvoteCount: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: typography.bodySemibold,
    minWidth: 24,
  },
  upvoteCountActive: { color: colors.white },
});

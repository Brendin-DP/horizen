import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { getRoadmap, type RoadmapItem } from '../../lib/api';
import type { FeatureRequestStatus } from '../../types';
import { colors, shell, typography, borderRadius } from '../../constants/theme';
import { DrillDownHeader } from '../../components/DrillDownHeader';
import { KANBAN_TAB_ORDER } from '../../components/roadmap/constants';
import { tagBadgeColors } from '../../components/roadmap/tagStyles';
import { RoadmapUpvoteButton } from '../../components/roadmap/RoadmapUpvoteButton';
import { useRoadmapVoting } from '../../hooks/useRoadmapVoting';

export default function RoadmapListScreen() {
  const router = useRouter();
  const { member } = useAuth();
  const memberId = member?.id;
  const [items, setItems] = useState<RoadmapItem[]>([]);
  const [activeTab, setActiveTab] = useState<FeatureRequestStatus>(KANBAN_TAB_ORDER[0]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const skipNextFocusSilentFetch = useRef(true);

  const patchItem = useCallback((id: string, fn: (r: RoadmapItem) => RoadmapItem) => {
    setItems((prev) => prev.map((r) => (r.id === id ? fn(r) : r)));
  }, []);

  const vote = useRoadmapVoting(memberId, patchItem);

  const load = useCallback(
    async (mode: 'initial' | 'pull' | 'silent' = 'initial') => {
      if (!memberId) return;
      if (mode === 'initial') setLoading(true);
      if (mode === 'pull') setRefreshing(true);
      if (mode !== 'silent') setLoadError(null);
      try {
        const data = await getRoadmap(memberId);
        setItems(data);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load roadmap';
        if (mode !== 'silent') {
          setLoadError(msg);
          if (mode === 'initial') setItems([]);
        }
      } finally {
        if (mode === 'initial') setLoading(false);
        if (mode === 'pull') setRefreshing(false);
      }
    },
    [memberId]
  );

  useEffect(() => {
    if (!memberId) {
      setLoading(false);
      return;
    }
    load('initial');
  }, [memberId, load]);

  useFocusEffect(
    useCallback(() => {
      if (!memberId) return;
      if (skipNextFocusSilentFetch.current) {
        skipNextFocusSilentFetch.current = false;
        return;
      }
      load('silent');
    }, [memberId, load])
  );

  const tabCounts = useMemo(() => {
    const m = new Map<FeatureRequestStatus, number>();
    for (const s of KANBAN_TAB_ORDER) m.set(s, 0);
    for (const it of items) {
      const st = it.status as FeatureRequestStatus;
      if (m.has(st)) m.set(st, (m.get(st) ?? 0) + 1);
    }
    return m;
  }, [items]);

  const filteredItems = useMemo(
    () => items.filter((it) => (it.status as FeatureRequestStatus) === activeTab),
    [items, activeTab]
  );

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
      <View style={styles.subtitleWrap}>
        <Text style={styles.subtitle}>
          See what we&apos;re working on and vote for what matters to you
        </Text>
      </View>
      {loadError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{loadError}</Text>
          <Pressable onPress={() => load('initial')} style={styles.retryBtn}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : null}

      {!loadError && items.length === 0 ? (
        <View style={styles.emptyGlobalWrap}>
          <Text style={styles.emptyText}>Nothing here yet — check back soon!</Text>
        </View>
      ) : items.length > 0 ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsRow}
            style={styles.tabsScroll}
          >
            {KANBAN_TAB_ORDER.map((tab) => {
              const count = tabCounts.get(tab) ?? 0;
              const active = activeTab === tab;
              return (
                <Pressable
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={[styles.tabPill, active && styles.tabPillActive]}
                >
                  <Text style={[styles.tabLabel, active && styles.tabLabelActive]} numberOfLines={1}>
                    {tab} ({count})
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <FlatList
            data={filteredItems}
            keyExtractor={(row) => row.id}
            renderItem={({ item }) => (
              <RoadmapListCard
                item={item}
                onOpen={() => router.push(`/roadmap/${item.id}`)}
                onVote={() => vote(item)}
              />
            )}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.tabEmptyText}>No items in this column yet.</Text>
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => load('pull')}
                tintColor={colors.primary}
              />
            }
          />
        </>
      ) : null}
    </SafeAreaView>
  );
}

function RoadmapListCard({
  item,
  onOpen,
  onVote,
}: {
  item: RoadmapItem;
  onOpen: () => void;
  onVote: () => void;
}) {
  const tagStyle = tagBadgeColors(item.tag);
  return (
    <View style={styles.card}>
      <Pressable onPress={onOpen} style={styles.cardPressable}>
        <View style={styles.cardTopRow}>
          <View style={[styles.tagBadge, { backgroundColor: tagStyle.bg }]}>
            <Text style={[styles.tagText, { color: tagStyle.text }]}>{item.tag}</Text>
          </View>
        </View>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardDesc} numberOfLines={2}>
          {item.description}
        </Text>
      </Pressable>
      <View style={styles.cardFooter}>
        <RoadmapUpvoteButton hasVoted={item.hasVoted} upvotes={item.upvotes} onPress={onVote} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: shell.body },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  muted: { color: colors.textMuted, fontSize: 15 },
  subtitleWrap: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  subtitle: {
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
  tabsScroll: { flexGrow: 0, maxHeight: 52 },
  tabsRow: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabPill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: borderRadius.full,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    fontFamily: typography.bodySemibold,
    maxWidth: 200,
  },
  tabLabelActive: { color: colors.white },
  listContent: { paddingHorizontal: 16, paddingBottom: 32, flexGrow: 1 },
  emptyGlobalWrap: { flex: 1, padding: 24, justifyContent: 'center' },
  emptyText: {
    textAlign: 'center',
    fontSize: 16,
    color: colors.textMuted,
    fontFamily: typography.body,
  },
  tabEmptyText: {
    textAlign: 'center',
    marginTop: 32,
    fontSize: 15,
    color: colors.textMuted,
    fontFamily: typography.body,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardPressable: { padding: 16, paddingBottom: 8 },
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
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
});

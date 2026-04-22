import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { getRoadmap, type RoadmapItem } from '../../lib/api';
import { colors, shell, typography, borderRadius } from '../../constants/theme';
import { DrillDownHeader } from '../../components/DrillDownHeader';
import { tagBadgeColors } from '../../components/roadmap/tagStyles';
import { RoadmapUpvoteButton } from '../../components/roadmap/RoadmapUpvoteButton';
import { useRoadmapVoting } from '../../hooks/useRoadmapVoting';

export default function RoadmapDetailScreen() {
  const router = useRouter();
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const { member } = useAuth();
  const memberId = member?.id;
  const [item, setItem] = useState<RoadmapItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  const patchItem = useCallback((rowId: string, fn: (r: RoadmapItem) => RoadmapItem) => {
    setItem((prev) => (prev && prev.id === rowId ? fn(prev) : prev));
  }, []);

  const vote = useRoadmapVoting(memberId, patchItem);

  useEffect(() => {
    if (!memberId || !id) {
      setLoading(false);
      if (!memberId) setNotFound(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setNotFound(false);
      setFetchError(false);
      try {
        const data = await getRoadmap(memberId);
        if (cancelled) return;
        const found = data.find((r) => r.id === id) ?? null;
        setItem(found);
        setNotFound(!found);
      } catch {
        if (!cancelled) {
          setItem(null);
          setNotFound(false);
          setFetchError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [memberId, id]);

  if (!memberId) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <DrillDownHeader title="Roadmap" onBack={() => router.back()} />
        <View style={styles.centered}>
          <Text style={styles.muted}>Sign in to view this request.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <DrillDownHeader title="Roadmap" onBack={() => router.back()} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (fetchError) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <DrillDownHeader title="Roadmap" onBack={() => router.back()} />
        <View style={styles.centered}>
          <Text style={styles.muted}>Could not load this request. Try again later.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (notFound || !item) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <DrillDownHeader title="Roadmap" onBack={() => router.back()} />
        <View style={styles.centered}>
          <Text style={styles.muted}>This request could not be found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const tagStyle = tagBadgeColors(item.tag);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <DrillDownHeader title="Request" onBack={() => router.back()} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.tagBadge, { backgroundColor: tagStyle.bg }]}>
          <Text style={[styles.tagText, { color: tagStyle.text }]}>{item.tag}</Text>
        </View>
        <Text style={styles.statusLine}>{item.status}</Text>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.description}>{item.description}</Text>
        <View style={styles.voteRow}>
          <RoadmapUpvoteButton
            hasVoted={item.hasVoted}
            upvotes={item.upvotes}
            onPress={() => vote(item)}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: shell.body },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  muted: { color: colors.textMuted, fontSize: 15, textAlign: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  tagBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    marginBottom: 10,
  },
  tagText: { fontSize: 12, fontWeight: '600', fontFamily: typography.bodySemibold },
  statusLine: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    fontFamily: typography.bodySemibold,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.heading,
    marginBottom: 16,
    lineHeight: 28,
  },
  description: {
    fontSize: 16,
    color: colors.textSecondary,
    fontFamily: typography.body,
    lineHeight: 24,
    marginBottom: 24,
  },
  voteRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
});

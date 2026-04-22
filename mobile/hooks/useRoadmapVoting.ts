import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { voteOnRequest, type RoadmapItem } from '../lib/api';

type PatchFn = (row: RoadmapItem) => RoadmapItem;

/**
 * Optimistic vote toggle with revert on API failure.
 * @param patchItem - Update one item by id (list: map; detail: single state).
 */
export function useRoadmapVoting(
  memberId: string | undefined,
  patchItem: (id: string, fn: PatchFn) => void
) {
  const votingRef = useRef<Set<string>>(new Set());

  const vote = useCallback(
    async (item: RoadmapItem) => {
      if (!memberId) return;
      if (votingRef.current.has(item.id)) return;
      votingRef.current.add(item.id);

      const prevHasVoted = item.hasVoted;
      const prevUpvotes = item.upvotes;

      patchItem(item.id, (r) => ({
        ...r,
        hasVoted: !r.hasVoted,
        upvotes: r.hasVoted ? Math.max(0, r.upvotes - 1) : r.upvotes + 1,
      }));

      try {
        const result = await voteOnRequest(item.id, memberId);
        patchItem(item.id, (r) => ({
          ...r,
          hasVoted: result.hasVoted,
          upvotes: result.upvotes,
        }));
      } catch {
        patchItem(item.id, (r) => ({
          ...r,
          hasVoted: prevHasVoted,
          upvotes: prevUpvotes,
        }));
        Alert.alert('Error', 'Could not save your vote. Please try again.');
      } finally {
        votingRef.current.delete(item.id);
      }
    },
    [memberId, patchItem]
  );

  return vote;
}

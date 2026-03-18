import express from 'express';
import supabase from '../db.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const { data: starAwards, error: starsErr } = await supabase
    .from('star_awards')
    .select('member_id');
  if (starsErr) {
    console.error(starsErr);
    return res.status(500).json({ error: 'Database error', detail: starsErr.message });
  }

  const counts = {};
  for (const award of starAwards || []) {
    counts[award.member_id] = (counts[award.member_id] || 0) + 1;
  }

  const memberIds = Object.keys(counts);
  if (memberIds.length === 0) {
    return res.json([]);
  }

  const { data: members, error: membersErr } = await supabase
    .from('members')
    .select('id, name')
    .in('id', memberIds);
  if (membersErr) {
    console.error(membersErr);
    return res.status(500).json({ error: 'Database error', detail: membersErr.message });
  }

  const memberMap = {};
  for (const m of members || []) {
    memberMap[m.id] = m;
  }

  const leaderboard = Object.entries(counts)
    .map(([memberId, starCount]) => {
      const member = memberMap[memberId];
      if (!member) return null;
      return { memberId, name: member.name, starCount };
    })
    .filter(Boolean)
    .sort((a, b) => b.starCount - a.starCount)
    .map((entry, index) => ({ rank: index + 1, ...entry }));

  res.json(leaderboard);
});

export default router;

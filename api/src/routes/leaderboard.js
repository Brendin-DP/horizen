const express = require('express');
const { getDb } = require('../db.js');

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  db.read();

  const starAwards = db.get('starAwards').value();
  const members = db.get('members').value();

  const counts = {};
  for (const award of starAwards) {
    counts[award.memberId] = (counts[award.memberId] || 0) + 1;
  }

  const leaderboard = Object.entries(counts)
    .map(([memberId, starCount]) => {
      const member = members.find((m) => m.id === memberId);
      if (!member) return null;
      return {
        memberId,
        name: member.name,
        starCount,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.starCount - a.starCount)
    .map((entry, index) => ({
      rank: index + 1,
      ...entry,
    }));

  res.json(leaderboard);
});

module.exports = router;

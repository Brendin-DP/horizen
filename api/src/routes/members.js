const express = require('express');
const { getDb } = require('../db.js');
const { toPublicMember } = require('../utils/members.js');

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  db.read();
  const members = db.get('members').value();
  res.json(members.map(toPublicMember));
});

router.get('/:id', (req, res) => {
  const db = getDb();
  db.read();
  const member = db.get('members').find({ id: req.params.id }).value();
  if (!member) {
    return res.status(404).json({ error: 'Member not found' });
  }
  res.json(toPublicMember(member));
});

router.get('/:id/stars', (req, res) => {
  const db = getDb();
  db.read();

  const memberId = req.params.id;
  const awards = db
    .get('starAwards')
    .filter({ memberId })
    .orderBy(['createdAt'], ['desc'])
    .value();

  res.json(awards);
});

router.get('/:id/progress/:exerciseId', (req, res) => {
  const db = getDb();
  db.read();

  const memberId = req.params.id;
  const exerciseId = req.params.exerciseId;

  const exercise = db.get('exerciseLibrary').find({ id: exerciseId }).value();
  if (!exercise) {
    return res.status(404).json({ error: 'Exercise not found' });
  }

  const memberWorkouts = db.get('workouts').filter({ userId: memberId }).value();
  const workoutExercises = db
    .get('workoutExercises')
    .filter({ exerciseId })
    .value()
    .filter((we) => memberWorkouts.some((w) => w.id === we.workoutId));

  const history = [];

  for (const we of workoutExercises) {
    const workout = memberWorkouts.find((w) => w.id === we.workoutId);
    if (!workout) continue;

    const sets = db
      .get('sets')
      .filter({ workoutExerciseId: we.id })
      .orderBy(['setNumber'], ['asc'])
      .value();

    let bestSet = null;
    let totalVolume = 0;

    for (const s of sets) {
      if (s.reps != null && s.weightKg != null) {
        const volume = s.reps * s.weightKg;
        totalVolume += volume;
        if (!bestSet || s.weightKg > bestSet.weightKg || (s.weightKg === bestSet.weightKg && s.reps > bestSet.reps)) {
          bestSet = { reps: s.reps, weightKg: s.weightKg };
        }
      }
    }

    history.push({
      workoutId: workout.id,
      workoutName: workout.name,
      workoutDate: workout.startedAt,
      sets,
      bestSet,
      totalVolume,
    });
  }

  history.sort((a, b) => new Date(a.workoutDate) - new Date(b.workoutDate));

  res.json(history);
});

router.get('/:id/stats', (req, res) => {
  const db = getDb();
  db.read();

  const memberId = req.params.id;

  const workouts = db.get('workouts').filter({ userId: memberId }).value();
  const totalWorkouts = workouts.length;

  const workoutExercises = db
    .get('workoutExercises')
    .value()
    .filter((we) => workouts.some((w) => w.id === we.workoutId));

  let totalSets = 0;
  const exerciseBest = {};

  for (const we of workoutExercises) {
    const sets = db.get('sets').filter({ workoutExerciseId: we.id }).value();
    totalSets += sets.length;

    const exercise = db.get('exerciseLibrary').find({ id: we.exerciseId }).value();
    if (!exercise) continue;

    for (const s of sets) {
      if (s.reps != null && s.weightKg != null) {
        const key = we.exerciseId;
        if (!exerciseBest[key] || s.weightKg > exerciseBest[key].bestWeightKg) {
          exerciseBest[key] = {
            exerciseId: we.exerciseId,
            name: exercise.name,
            bestWeightKg: s.weightKg,
            bestReps: s.reps,
          };
        }
      }
    }
  }

  const personalBests = Object.values(exerciseBest);

  res.json({
    totalWorkouts,
    totalSets,
    personalBests,
  });
});

module.exports = router;

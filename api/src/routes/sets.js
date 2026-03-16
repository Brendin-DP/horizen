const express = require('express');
const { randomUUID } = require('crypto');
const { getDb } = require('../db.js');

const router = express.Router();

// POST /workout-exercises/:id/sets — mount this router at /workout-exercises
router.post('/:id/sets', (req, res) => {
  const db = getDb();
  db.read();

  const workoutExerciseId = req.params.id;
  const workoutExercise = db
    .get('workoutExercises')
    .find({ id: workoutExerciseId })
    .value();

  if (!workoutExercise) {
    return res.status(404).json({ error: 'Workout exercise not found' });
  }

  const {
    setNumber,
    reps,
    weightKg,
    durationSeconds,
    distanceMeters,
    completed,
  } = req.body;

  const maxSetNumber = db
    .get('sets')
    .filter({ workoutExerciseId })
    .map('setNumber')
    .max()
    .value() ?? 0;

  const set = {
    id: randomUUID(),
    workoutExerciseId,
    setNumber: setNumber !== undefined ? setNumber : maxSetNumber + 1,
    reps: reps ?? null,
    weightKg: weightKg ?? null,
    durationSeconds: durationSeconds ?? null,
    distanceMeters: distanceMeters ?? null,
    completed: completed !== undefined ? completed : true,
    createdAt: new Date().toISOString(),
  };

  db.get('sets').push(set).write();

  res.status(201).json(set);
});

// PATCH /sets/:id and DELETE /sets/:id — mount setsIdRouter at /sets
const setsIdRouter = express.Router();

setsIdRouter.patch('/:id', (req, res) => {
  const db = getDb();
  db.read();

  const set = db.get('sets').find({ id: req.params.id }).value();
  if (!set) {
    return res.status(404).json({ error: 'Set not found' });
  }

  const {
    setNumber,
    reps,
    weightKg,
    durationSeconds,
    distanceMeters,
    completed,
  } = req.body;

  if (setNumber !== undefined) set.setNumber = setNumber;
  if (reps !== undefined) set.reps = reps;
  if (weightKg !== undefined) set.weightKg = weightKg;
  if (durationSeconds !== undefined) set.durationSeconds = durationSeconds;
  if (distanceMeters !== undefined) set.distanceMeters = distanceMeters;
  if (completed !== undefined) set.completed = completed;

  db.write();

  res.json(set);
});

setsIdRouter.delete('/:id', (req, res) => {
  const db = getDb();
  db.read();

  const set = db.get('sets').find({ id: req.params.id }).value();
  if (!set) {
    return res.status(404).json({ error: 'Set not found' });
  }

  db.get('sets').remove({ id: set.id }).write();

  res.status(204).send();
});

module.exports = { workoutExercisesRouter: router, setsIdRouter };

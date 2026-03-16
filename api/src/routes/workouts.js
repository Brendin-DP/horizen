const express = require('express');
const { randomUUID } = require('crypto');
const { getDb } = require('../db.js');

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  db.read();

  const userId = req.query.userId;
  if (!userId) {
    return res.status(400).json({ error: 'userId query is required' });
  }

  const workouts = db
    .get('workouts')
    .filter({ userId })
    .orderBy(['startedAt'], ['desc'])
    .value();

  res.json(workouts);
});

router.post('/', (req, res) => {
  const db = getDb();
  db.read();

  const { userId, name } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const workout = {
    id: randomUUID(),
    userId,
    name: name || null,
    status: 'in_progress',
    startedAt: new Date().toISOString(),
    completedAt: null,
    notes: null,
    createdAt: new Date().toISOString(),
  };

  db.get('workouts').push(workout).write();

  res.status(201).json(workout);
});

router.get('/:id', (req, res) => {
  const db = getDb();
  db.read();

  const workout = db.get('workouts').find({ id: req.params.id }).value();
  if (!workout) {
    return res.status(404).json({ error: 'Workout not found' });
  }

  const workoutExercises = db
    .get('workoutExercises')
    .filter({ workoutId: workout.id })
    .orderBy(['order'], ['asc'])
    .value();

  const exercises = db.get('exerciseLibrary').value();

  const workoutExercisesWithDetails = workoutExercises.map((we) => {
    const exercise = exercises.find((e) => e.id === we.exerciseId);
    const sets = db
      .get('sets')
      .filter({ workoutExerciseId: we.id })
      .orderBy(['setNumber'], ['asc'])
      .value();

    return {
      ...we,
      exercise,
      sets,
    };
  });

  res.json({
    ...workout,
    workoutExercises: workoutExercisesWithDetails,
  });
});

router.patch('/:id', (req, res) => {
  const db = getDb();
  db.read();

  const workout = db.get('workouts').find({ id: req.params.id }).value();
  if (!workout) {
    return res.status(404).json({ error: 'Workout not found' });
  }

  const { name, status, completedAt, notes } = req.body;
  const updates = {};

  if (name !== undefined) updates.name = name;
  if (status !== undefined) updates.status = status;
  if (completedAt !== undefined) updates.completedAt = completedAt;
  if (notes !== undefined) updates.notes = notes;

  Object.assign(workout, updates);
  db.write();

  res.json(workout);
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.read();

  const workout = db.get('workouts').find({ id: req.params.id }).value();
  if (!workout) {
    return res.status(404).json({ error: 'Workout not found' });
  }

  const workoutExercises = db.get('workoutExercises').filter({ workoutId: workout.id }).value();

  for (const we of workoutExercises) {
    db.get('sets').remove({ workoutExerciseId: we.id }).write();
  }

  db.get('workoutExercises').remove({ workoutId: workout.id }).write();
  db.get('workouts').remove({ id: workout.id }).write();

  res.status(204).send();
});

router.post('/:id/exercises', (req, res) => {
  const db = getDb();
  db.read();

  const workout = db.get('workouts').find({ id: req.params.id }).value();
  if (!workout) {
    return res.status(404).json({ error: 'Workout not found' });
  }

  const { exerciseId, order } = req.body;

  if (!exerciseId) {
    return res.status(400).json({ error: 'exerciseId is required' });
  }

  const exercise = db.get('exerciseLibrary').find({ id: exerciseId }).value();
  if (!exercise) {
    return res.status(404).json({ error: 'Exercise not found' });
  }

  const existing = db
    .get('workoutExercises')
    .filter({ workoutId: workout.id, exerciseId })
    .value();
  if (existing.length > 0) {
    return res.status(409).json({ error: 'Exercise already added to workout' });
  }

  const maxOrder = db
    .get('workoutExercises')
    .filter({ workoutId: workout.id })
    .map('order')
    .max()
    .value() ?? 0;

  const workoutExercise = {
    id: randomUUID(),
    workoutId: workout.id,
    exerciseId,
    order: order !== undefined ? order : maxOrder + 1,
    notes: null,
    createdAt: new Date().toISOString(),
  };

  db.get('workoutExercises').push(workoutExercise).write();

  res.status(201).json(workoutExercise);
});

router.patch('/:workoutId/exercises/:id', (req, res) => {
  const db = getDb();
  db.read();

  const we = db
    .get('workoutExercises')
    .find({
      id: req.params.id,
      workoutId: req.params.workoutId,
    })
    .value();

  if (!we) {
    return res.status(404).json({ error: 'Workout exercise not found' });
  }

  const { order, notes } = req.body;
  if (order !== undefined) we.order = order;
  if (notes !== undefined) we.notes = notes;

  db.write();

  res.json(we);
});

router.delete('/:workoutId/exercises/:id', (req, res) => {
  const db = getDb();
  db.read();

  const we = db
    .get('workoutExercises')
    .find({
      id: req.params.id,
      workoutId: req.params.workoutId,
    })
    .value();

  if (!we) {
    return res.status(404).json({ error: 'Workout exercise not found' });
  }

  db.get('sets').remove({ workoutExerciseId: we.id }).write();
  db.get('workoutExercises').remove({ id: we.id }).write();

  res.status(204).send();
});

module.exports = router;

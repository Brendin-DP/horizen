const express = require('express');
const { getDb } = require('../db.js');

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDb();
  db.read();

  let exercises = db.get('exerciseLibrary').value();
  const category = req.query.category;
  if (category) {
    exercises = exercises.filter((e) => e.category === category);
  }

  res.json(exercises);
});

router.get('/:id', (req, res) => {
  const db = getDb();
  db.read();

  const exercise = db.get('exerciseLibrary').find({ id: req.params.id }).value();
  if (!exercise) {
    return res.status(404).json({ error: 'Exercise not found' });
  }

  res.json(exercise);
});

module.exports = router;

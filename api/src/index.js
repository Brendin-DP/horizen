import 'dotenv/config'
const express = require('express');
const cors = require('cors');
const membersRouter = require('./routes/members.js');
const starsRouter = require('./routes/stars.js');
const leaderboardRouter = require('./routes/leaderboard.js');
const authRouter = require('./routes/auth.js');
const adminRouter = require('./routes/admin.js');
const exercisesRouter = require('./routes/exercises.js');
const workoutsRouter = require('./routes/workouts.js');
const { workoutExercisesRouter, setsIdRouter } = require('./routes/sets.js');
const fundRouter = require('./routes/fund.js');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'GymApp API running' });
});

app.use('/auth', authRouter);
app.use('/admin', adminRouter);
app.use('/members', membersRouter);
app.use('/stars', starsRouter);
app.use('/leaderboard', leaderboardRouter);
app.use('/exercises', exercisesRouter);
app.use('/workouts', workoutsRouter);
app.use('/workout-exercises', workoutExercisesRouter);
app.use('/sets', setsIdRouter);
app.use('/fund', fundRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});

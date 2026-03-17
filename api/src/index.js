require('dotenv').config();
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

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: 'GymApp API',
    endpoints: {
      register: 'POST /auth/register',
      login: 'POST /auth/login',
      members: 'GET /members',
      member: 'GET /members/:id',
      memberStars: 'GET /members/:id/stars',
      memberProgress: 'GET /members/:id/progress/:exerciseId',
      memberStats: 'GET /members/:id/stats',
      exercises: 'GET /exercises',
      exercise: 'GET /exercises/:id',
      workouts: 'GET /workouts?userId=x',
      workout: 'GET /workouts/:id',
      createWorkout: 'POST /workouts',
      updateWorkout: 'PATCH /workouts/:id',
      deleteWorkout: 'DELETE /workouts/:id',
      addWorkoutExercise: 'POST /workouts/:id/exercises',
      addSet: 'POST /workout-exercises/:id/sets',
      updateSet: 'PATCH /sets/:id',
      deleteSet: 'DELETE /sets/:id',
      leaderboard: 'GET /leaderboard',
      awardStar: 'POST /stars',
    },
  });
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('API running on http://localhost:' + PORT);
});

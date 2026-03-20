import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import membersRouter from './routes/members.js';
import starsRouter from './routes/stars.js';
import leaderboardRouter from './routes/leaderboard.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import exercisesRouter from './routes/exercises.js';
import workoutsRouter from './routes/workouts.js';
import { workoutExercisesRouter, setsIdRouter } from './routes/sets.js';
import exerciseLogsRouter from './routes/exerciseLogs.js';
import fundRouter from './routes/fund.js';

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
app.use('/exercise-logs', exerciseLogsRouter);
app.use('/sets', setsIdRouter);
app.use('/fund', fundRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});

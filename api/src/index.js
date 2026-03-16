const express = require('express');
const cors = require('cors');
const membersRouter = require('./routes/members.js');
const starsRouter = require('./routes/stars.js');
const leaderboardRouter = require('./routes/leaderboard.js');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    message: 'GymApp API',
    endpoints: {
      members: 'GET /members',
      member: 'GET /members/:id',
      memberStars: 'GET /members/:id/stars',
      leaderboard: 'GET /leaderboard',
      awardStar: 'POST /stars',
    },
  });
});

app.use('/members', membersRouter);
app.use('/stars', starsRouter);
app.use('/leaderboard', leaderboardRouter);

const PORT = 3001;
app.listen(PORT, () => {
  console.log('API running on http://localhost:' + PORT);
});

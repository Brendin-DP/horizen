# GymApp — Railway Deployment Guide

## Overview

We are deploying the GymApp API to Railway. Railway runs Express as a proper long-lived server with no serverless function limits, no cold start issues, and a persistent environment. The web client stays on Vercel. The mobile app points at the Railway URL.

```
Mobile (Expo / TestFlight)     → Railway API
Web Back Office (Vercel)       → Railway API
Browser / Postman              → Railway API
```

---

## Part 1 — Prepare the API for Railway

### 1. Confirm `api/package.json` has a start script and engines field

```json
{
  "name": "gymapp-api",
  "version": "1.0.0",
  "type": "module",
  "main": "src/index.js",
  "scripts": {
    "dev": "node --watch src/index.js",
    "start": "node src/index.js"
  },
  "engines": {
    "node": ">=18"
  }
}
```

Railway uses `npm start` to run your app. Make sure this script exists.

### 2. Confirm `api/src/index.js` calls `app.listen()`

Unlike Vercel, Railway runs Express as a normal server. Your `index.js` should listen on the port Railway provides via environment variable:

```js
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

import membersRouter from './routes/members.js'
import starsRouter from './routes/stars.js'
import leaderboardRouter from './routes/leaderboard.js'
import exercisesRouter from './routes/exercises.js'
import workoutsRouter from './routes/workouts.js'
import workoutExercisesRouter from './routes/workoutExercises.js'
import setsRouter from './routes/sets.js'
import progressRouter from './routes/progress.js'

dotenv.config()

const app = express()

app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'GymApp API running' })
})

app.use('/members', membersRouter)
app.use('/stars', starsRouter)
app.use('/leaderboard', leaderboardRouter)
app.use('/exercises', exercisesRouter)
app.use('/workouts', workoutsRouter)
app.use('/workout-exercises', workoutExercisesRouter)
app.use('/sets', setsRouter)
app.use('/members', progressRouter)

// Railway injects PORT automatically — always use process.env.PORT
const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`)
})

export default app
```

**Important:** Railway injects a `PORT` environment variable automatically. You must use `process.env.PORT` — never hardcode `3001` as the listen port in production or Railway won't be able to route traffic to your app.

### 3. Confirm `.gitignore` includes `.env`

```
.env
node_modules/
```

Never commit secrets to GitHub. Railway reads env vars from its own dashboard.

### 4. If you have a `vercel.json` in the api folder

Railway ignores it, but it won't cause problems. You can leave it in place if you want to keep Vercel as an option later.

---

## Part 2 — Deploy to Railway

### Step 1 — Create a Railway account

Go to **railway.app** and sign in with your GitHub account.

### Step 2 — Create a new project

- Click **New Project**
- Select **Deploy from GitHub repo**
- Authorize Railway to access your GitHub if prompted
- Select your gymapp repository

### Step 3 — Configure the service

Railway will detect it's a Node.js project. You need to tell it where the API lives if your repo has multiple packages (api/, mobile/, web/).

In the Railway service settings:
- **Root Directory** → set to `api`
- **Start Command** → `npm start`
- **Watch Paths** → `api/**` (so only API changes trigger redeploys)

### Step 4 — Add environment variables

In Railway: **Your Service → Variables tab → Add Variable**

Add these:
```
SUPABASE_URL        = your supabase project url
SUPABASE_ANON_KEY   = your supabase anon key
NODE_ENV            = production
```

Do NOT add `PORT` — Railway injects this automatically.

### Step 5 — Generate a public domain

In Railway: **Your Service → Settings → Networking → Generate Domain**

Railway gives you a URL like:
```
https://gymapp-api.up.railway.app
```

This is your permanent API base URL. Copy it.

### Step 6 — Trigger a deploy

Railway auto-deploys when you push to GitHub. If it hasn't deployed yet, click **Deploy** manually in the Railway dashboard.

Watch the build logs — you should see:
```
API running on port XXXX
```

---

## Part 3 — Update Clients to Use Railway URL

### Mobile — `mobile/lib/api.ts`

```ts
const BASE_URL = __DEV__
  ? 'http://192.168.x.x:3001'                  // your LAN IP for local dev
  : 'https://gymapp-api.up.railway.app'         // Railway production URL
```

`__DEV__` is a global Expo provides — true during local development, false in production builds. This means local dev still hits your local API, but any EAS/TestFlight build hits Railway automatically.

### Web — `web/.env`

```
VITE_API_URL=https://gymapp-api.up.railway.app
```

If you have a `web/.env.production` file, add it there too. Vercel will use this when building the web client.

---

## Part 4 — Sanity Check

Once deployed, test these from your browser or terminal:

```bash
# Health check
curl https://gymapp-api.up.railway.app/

# Should return: { "status": "ok", "message": "GymApp API running" }

# Members list
curl https://gymapp-api.up.railway.app/members

# Leaderboard
curl https://gymapp-api.up.railway.app/leaderboard

# Exercise library
curl https://gymapp-api.up.railway.app/exercises

# Single workout
curl https://gymapp-api.up.railway.app/workouts/178fe517-95ec-4cbd-93b4-a18a2168e00e
```

All should return JSON with your seeded data.

---

## Part 5 — Full Deployed Stack

Once complete your stack looks like this:

| Layer | Platform | URL |
|---|---|---|
| API | Railway | https://gymapp-api.up.railway.app |
| Web back office | Vercel | https://gymapp-web.vercel.app |
| Database | Supabase | managed, no public URL needed |
| Mobile | Expo Go / TestFlight | points at Railway URL |

---

## Ongoing Workflow

- **Push to GitHub** → Railway auto-redeploys the API
- **Push to GitHub** → Vercel auto-redeploys the web client
- **Local mobile dev** → Expo Go hits your local API via LAN IP
- **TestFlight / production build** → hits Railway URL via `__DEV__` check

No manual deploys needed after initial setup.

---

## Railway Free Tier Limits

- **$5 of usage per month** included free
- A small Express API typically uses $0.50–$2.00/month at low traffic
- You will not hit the limit during development or early demo phase
- If you do exceed it, Railway's paid plan is $20/month with no usage cap

# GymApp — Architecture & Build Instructions v2

## What We're Building

A gym management app with two core feature areas:

1. **Workout Tracking** — users log workout sessions, each session contains exercises selected from a system-defined library, each exercise contains sets (reps + weight). Users can view their workout history, drill into a session, and track progress for any exercise over time.
2. **Stars & Leaderboard** — instructors award stars to members, members compete on a leaderboard. Leaderboard access will be PLG-gated later.

Three user roles: **Admin**, **Instructor**, **Member**

---

## Architecture

API-first. One central Express API serves all clients. The API owns all business logic. Clients only fetch data and send actions — no business logic in the client ever.

```
[ Mobile App — Expo React Native ]     [ Web App — React (future) ]
                  ↓                               ↓
         [ REST API — Express + lowdb ]
                  ↓
         [ db.json — local JSON database ]
```

**Why lowdb for now:** Fast to build and test without infrastructure setup. Data models are designed to migrate to Supabase Postgres cleanly — table names, field names, and relationships are production-ready. Migration path: extract `db.json` → create matching Supabase tables → swap lowdb calls for `@supabase/supabase-js` calls in `api/src/db.js`. API contract stays identical. Clients don't change.

---

## Folder Structure

```
gymapp/
├── api/
│   ├── src/
│   │   ├── config/
│   │   │   └── features.js          # PLG feature flags config
│   │   ├── routes/
│   │   │   ├── members.js
│   │   │   ├── stars.js
│   │   │   ├── leaderboard.js
│   │   │   ├── exercises.js         # Exercise library (read-only for users)
│   │   │   ├── workouts.js          # Workout sessions
│   │   │   ├── workoutExercises.js  # Exercises within a workout
│   │   │   ├── sets.js              # Sets within a workout exercise
│   │   │   └── progress.js          # Derived progress + stats queries
│   │   ├── middleware/
│   │   │   └── planCheck.js         # PLG middleware helper
│   │   ├── db.js                    # lowdb setup
│   │   └── index.js                 # Express entry point
│   ├── db.json
│   └── package.json
│
└── mobile/
    ├── app/
    │   ├── (tabs)/
    │   │   ├── _layout.tsx
    │   │   ├── index.tsx            # Dashboard / home
    │   │   ├── workouts.tsx         # Workout history list
    │   │   └── leaderboard.tsx      # Leaderboard (PLG gated later)
    │   ├── workout/
    │   │   └── [id].tsx             # Single workout detail
    │   ├── exercise/
    │   │   └── [id].tsx             # Exercise progress over time
    │   └── _layout.tsx
    ├── components/
    ├── lib/
    │   └── api.ts                   # All fetch calls — single file
    ├── types/
    │   └── index.ts                 # Shared TypeScript types
    └── package.json
```

---

## Data Models

### members
```json
{
  "id": "uuid",
  "name": "string",
  "email": "string",
  "role": "member | instructor | admin",
  "plan": "free | pro | elite",
  "planExpiresAt": "timestamp | null",
  "avatarUrl": "string | null",
  "createdAt": "timestamp"
}
```

### starAwards
```json
{
  "id": "uuid",
  "memberId": "string (ref: members.id)",
  "awardedBy": "string (ref: members.id)",
  "reason": "string | null",
  "createdAt": "timestamp"
}
```

### exerciseLibrary
```json
{
  "id": "uuid",
  "name": "string",
  "category": "Legs | Push | Pull | Core | Cardio | Olympic",
  "muscleGroups": ["string"],
  "equipment": "Barbell | Dumbbell | Bodyweight | Machine | Cable",
  "unit": "weight_reps | time | distance",
  "createdAt": "timestamp"
}
```

`unit` drives the logging UI:
- `weight_reps` → log reps + weightKg
- `time` → log durationSeconds
- `distance` → log distanceMeters

Users can NEVER add exercises. They only select from this system-managed list.

### workouts
```json
{
  "id": "uuid",
  "userId": "string (ref: members.id)",
  "name": "string | null",
  "status": "in_progress | completed",
  "startedAt": "timestamp",
  "completedAt": "timestamp | null",
  "notes": "string | null",
  "createdAt": "timestamp"
}
```

### workoutExercises
```json
{
  "id": "uuid",
  "workoutId": "string (ref: workouts.id)",
  "exerciseId": "string (ref: exerciseLibrary.id)",
  "order": "number",
  "notes": "string | null",
  "createdAt": "timestamp"
}
```

`order` allows exercises to be reordered within a session.

### sets
```json
{
  "id": "uuid",
  "workoutExerciseId": "string (ref: workoutExercises.id)",
  "setNumber": "number",
  "reps": "number | null",
  "weightKg": "number | null",
  "durationSeconds": "number | null",
  "distanceMeters": "number | null",
  "completed": "boolean",
  "createdAt": "timestamp"
}
```

Nullable fields handle different unit types. Only populate the fields relevant to the exercise's `unit`.

---

## API Routes

### Exercise Library
```
GET  /exercises              → full list. supports ?category=Legs
GET  /exercises/:id          → single exercise
```
No POST/PATCH/DELETE for users. Library is system-managed (admin only later).

### Workouts
```
GET    /workouts?userId=x         → user's workout history, sorted newest first
POST   /workouts                  → start a new workout { userId, name? }
GET    /workouts/:id              → single workout with nested exercises + sets
PATCH  /workouts/:id              → update name, status, completedAt, notes
DELETE /workouts/:id              → delete workout + cascade delete its exercises + sets
```

### Workout Exercises
```
POST   /workouts/:id/exercises              → add exercise to workout { exerciseId, order? }
PATCH  /workouts/:workoutId/exercises/:id   → update order or notes
DELETE /workouts/:workoutId/exercises/:id   → remove exercise + its sets
```

### Sets
```
POST   /workout-exercises/:id/sets    → log a set { setNumber, reps?, weightKg?, durationSeconds?, distanceMeters?, completed? }
PATCH  /sets/:id                      → update a set
DELETE /sets/:id                      → delete a set
```

### Progress (derived — never stored)
```
GET /members/:id/progress/:exerciseId   → history for one exercise across all workouts
                                           returns array of { workoutId, workoutDate, sets, bestSet, totalVolume }

GET /members/:id/stats                  → personal summary
                                           returns { totalWorkouts, totalSets, personalBests: { exerciseId, name, bestWeightKg, bestReps } }
```

### Stars & Leaderboard
```
POST /stars                        → award stars { memberId, awardedBy, reason? }
GET  /members/:id/stars            → star history for a member
GET  /leaderboard                  → computed ranking by star count (never stored)
```

### Members
```
GET  /members          → list all members
GET  /members/:id      → single member profile
```

---

## PLG Feature Flags

Create `api/src/config/features.js` exactly as follows. Do not implement enforcement yet — just wire up the structure so it's ready to drop into any route.

```js
// api/src/config/features.js

export const FEATURES = {
  MAX_WORKOUTS: {
    free: 10,
    pro: Infinity,
    elite: Infinity
  },
  LEADERBOARD_ACCESS: {
    free: false,
    pro: true,
    elite: true
  },
  EXERCISE_HISTORY_DAYS: {
    free: 30,       // only last 30 days of history
    pro: Infinity,
    elite: Infinity
  },
  ADVANCED_STATS: {
    free: false,
    pro: true,
    elite: true
  }
}

export function can(user, feature) {
  const rule = FEATURES[feature]
  if (!rule) return false
  const value = rule[user.plan ?? 'free']
  return value === true || value === Infinity
}

export function limit(user, feature) {
  const rule = FEATURES[feature]
  if (!rule) return 0
  return rule[user.plan ?? 'free']
}
```

Create `api/src/middleware/planCheck.js`:

```js
// api/src/middleware/planCheck.js
// Usage: router.post('/workouts', planCheck('MAX_WORKOUTS'), handler)
// Drop this into any route that needs PLG gating — not wired up yet, ready when needed

import { can, limit } from '../config/features.js'

export function planCheck(feature) {
  return (req, res, next) => {
    // TODO: replace with real auth user once auth is implemented
    // For now this middleware is a no-op placeholder — it passes through
    next()
  }
}
```

The error shape for when limits are enforced later:
```json
{
  "error": "LIMIT_REACHED | FEATURE_LOCKED",
  "feature": "MAX_WORKOUTS",
  "plan": "free",
  "upgradeRequired": true
}
```

Mobile reads `upgradeRequired: true` and shows an upsell screen. Logic never lives in the client.

---

## db.json — Seed Data

```json
{
  "members": [
    {
      "id": "m1",
      "name": "Sarah Jacobs",
      "email": "sarah@gym.com",
      "role": "member",
      "plan": "free",
      "planExpiresAt": null,
      "avatarUrl": null,
      "createdAt": "2025-01-01T00:00:00Z"
    },
    {
      "id": "m2",
      "name": "James Fortuin",
      "email": "james@gym.com",
      "role": "member",
      "plan": "pro",
      "planExpiresAt": "2026-01-01T00:00:00Z",
      "avatarUrl": null,
      "createdAt": "2025-01-01T00:00:00Z"
    },
    {
      "id": "m3",
      "name": "Aisha Davids",
      "email": "aisha@gym.com",
      "role": "member",
      "plan": "free",
      "planExpiresAt": null,
      "avatarUrl": null,
      "createdAt": "2025-01-01T00:00:00Z"
    },
    {
      "id": "i1",
      "name": "Neal Oberholster",
      "email": "neal@gym.com",
      "role": "instructor",
      "plan": "elite",
      "planExpiresAt": null,
      "avatarUrl": null,
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "starAwards": [
    {
      "id": "s1",
      "memberId": "m1",
      "awardedBy": "i1",
      "reason": "Best form this week",
      "createdAt": "2025-01-10T09:00:00Z"
    },
    {
      "id": "s2",
      "memberId": "m1",
      "awardedBy": "i1",
      "reason": "Most improved",
      "createdAt": "2025-01-12T09:00:00Z"
    },
    {
      "id": "s3",
      "memberId": "m2",
      "awardedBy": "i1",
      "reason": "100% attendance",
      "createdAt": "2025-01-11T09:00:00Z"
    }
  ],
  "exerciseLibrary": [
    {
      "id": "ex1",
      "name": "Back Squat",
      "category": "Legs",
      "muscleGroups": ["Quads", "Glutes", "Hamstrings"],
      "equipment": "Barbell",
      "unit": "weight_reps",
      "createdAt": "2025-01-01T00:00:00Z"
    },
    {
      "id": "ex2",
      "name": "Bench Press",
      "category": "Push",
      "muscleGroups": ["Chest", "Triceps", "Shoulders"],
      "equipment": "Barbell",
      "unit": "weight_reps",
      "createdAt": "2025-01-01T00:00:00Z"
    },
    {
      "id": "ex3",
      "name": "Deadlift",
      "category": "Pull",
      "muscleGroups": ["Hamstrings", "Glutes", "Back"],
      "equipment": "Barbell",
      "unit": "weight_reps",
      "createdAt": "2025-01-01T00:00:00Z"
    },
    {
      "id": "ex4",
      "name": "Overhead Press",
      "category": "Push",
      "muscleGroups": ["Shoulders", "Triceps"],
      "equipment": "Barbell",
      "unit": "weight_reps",
      "createdAt": "2025-01-01T00:00:00Z"
    },
    {
      "id": "ex5",
      "name": "Barbell Row",
      "category": "Pull",
      "muscleGroups": ["Lats", "Rhomboids", "Biceps"],
      "equipment": "Barbell",
      "unit": "weight_reps",
      "createdAt": "2025-01-01T00:00:00Z"
    },
    {
      "id": "ex6",
      "name": "Pull Up",
      "category": "Pull",
      "muscleGroups": ["Lats", "Biceps"],
      "equipment": "Bodyweight",
      "unit": "weight_reps",
      "createdAt": "2025-01-01T00:00:00Z"
    },
    {
      "id": "ex7",
      "name": "Dumbbell Curl",
      "category": "Pull",
      "muscleGroups": ["Biceps"],
      "equipment": "Dumbbell",
      "unit": "weight_reps",
      "createdAt": "2025-01-01T00:00:00Z"
    },
    {
      "id": "ex8",
      "name": "Tricep Pushdown",
      "category": "Push",
      "muscleGroups": ["Triceps"],
      "equipment": "Cable",
      "unit": "weight_reps",
      "createdAt": "2025-01-01T00:00:00Z"
    },
    {
      "id": "ex9",
      "name": "Leg Press",
      "category": "Legs",
      "muscleGroups": ["Quads", "Glutes"],
      "equipment": "Machine",
      "unit": "weight_reps",
      "createdAt": "2025-01-01T00:00:00Z"
    },
    {
      "id": "ex10",
      "name": "Plank",
      "category": "Core",
      "muscleGroups": ["Core"],
      "equipment": "Bodyweight",
      "unit": "time",
      "createdAt": "2025-01-01T00:00:00Z"
    },
    {
      "id": "ex11",
      "name": "Treadmill Run",
      "category": "Cardio",
      "muscleGroups": [],
      "equipment": "Machine",
      "unit": "distance",
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "workouts": [
    {
      "id": "w1",
      "userId": "m1",
      "name": "Monday Push",
      "status": "completed",
      "startedAt": "2025-01-13T08:00:00Z",
      "completedAt": "2025-01-13T09:15:00Z",
      "notes": null,
      "createdAt": "2025-01-13T08:00:00Z"
    },
    {
      "id": "w2",
      "userId": "m1",
      "name": "Wednesday Pull",
      "status": "completed",
      "startedAt": "2025-01-15T08:00:00Z",
      "completedAt": "2025-01-15T09:00:00Z",
      "notes": null,
      "createdAt": "2025-01-15T08:00:00Z"
    }
  ],
  "workoutExercises": [
    {
      "id": "we1",
      "workoutId": "w1",
      "exerciseId": "ex2",
      "order": 1,
      "notes": null,
      "createdAt": "2025-01-13T08:00:00Z"
    },
    {
      "id": "we2",
      "workoutId": "w1",
      "exerciseId": "ex1",
      "order": 2,
      "notes": null,
      "createdAt": "2025-01-13T08:05:00Z"
    },
    {
      "id": "we3",
      "workoutId": "w2",
      "exerciseId": "ex3",
      "order": 1,
      "notes": "Felt strong today",
      "createdAt": "2025-01-15T08:00:00Z"
    }
  ],
  "sets": [
    {
      "id": "set1",
      "workoutExerciseId": "we1",
      "setNumber": 1,
      "reps": 8,
      "weightKg": 80,
      "durationSeconds": null,
      "distanceMeters": null,
      "completed": true,
      "createdAt": "2025-01-13T08:10:00Z"
    },
    {
      "id": "set2",
      "workoutExerciseId": "we1",
      "setNumber": 2,
      "reps": 8,
      "weightKg": 82.5,
      "durationSeconds": null,
      "distanceMeters": null,
      "completed": true,
      "createdAt": "2025-01-13T08:15:00Z"
    },
    {
      "id": "set3",
      "workoutExerciseId": "we1",
      "setNumber": 3,
      "reps": 6,
      "weightKg": 85,
      "durationSeconds": null,
      "distanceMeters": null,
      "completed": true,
      "createdAt": "2025-01-13T08:20:00Z"
    },
    {
      "id": "set4",
      "workoutExerciseId": "we2",
      "setNumber": 1,
      "reps": 5,
      "weightKg": 100,
      "durationSeconds": null,
      "distanceMeters": null,
      "completed": true,
      "createdAt": "2025-01-13T08:35:00Z"
    },
    {
      "id": "set5",
      "workoutExerciseId": "we2",
      "setNumber": 2,
      "reps": 5,
      "weightKg": 102.5,
      "durationSeconds": null,
      "distanceMeters": null,
      "completed": true,
      "createdAt": "2025-01-13T08:40:00Z"
    },
    {
      "id": "set6",
      "workoutExerciseId": "we3",
      "setNumber": 1,
      "reps": 5,
      "weightKg": 120,
      "durationSeconds": null,
      "distanceMeters": null,
      "completed": true,
      "createdAt": "2025-01-15T08:10:00Z"
    },
    {
      "id": "set7",
      "workoutExerciseId": "we3",
      "setNumber": 2,
      "reps": 5,
      "weightKg": 125,
      "durationSeconds": null,
      "distanceMeters": null,
      "completed": true,
      "createdAt": "2025-01-15T08:15:00Z"
    }
  ]
}
```

---

## Key Rules — Do Not Deviate

1. **Exercise library is read-only for users.** No route allows a member to create, edit, or delete exercises. Only admin role can modify the library (not implemented yet — just no user-facing POST).

2. **Leaderboard is always computed.** Never store a star count. Always count `starAwards` grouped by `memberId` at query time.

3. **Progress is always computed.** Never store personal bests or totals. Compute from sets at query time.

4. **Cascade deletes.** Deleting a workout deletes its workoutExercises and their sets. Deleting a workoutExercise deletes its sets. Use a helper in `db.js` for this.

5. **All IDs are UUIDs.** Use `crypto.randomUUID()` (Node 18+).

6. **All timestamps are ISO 8601.** Always `new Date().toISOString()`.

7. **CORS open during development.** Both Expo and web clients need access.

8. **Hardcode current user as `m1` (Sarah) for now.** No auth yet. Add a `// TODO: replace with auth` comment wherever currentUser is assumed.

9. **API client is one file per client.** All fetch calls in `mobile/lib/api.ts`. Never call fetch directly in a component.

10. **Base URL from config.** Never hardcode `localhost:3001` inside a component or page. Use an env var or config file.

---

## Mobile Screen Map

```
Tab: Home (Dashboard)
  → Welcome, current user name
  → Quick stats: total workouts, total stars
  → CTA: Start New Workout

Tab: Workouts
  → List of past workouts (name, date, exercise count, status)
  → Tap workout → Workout Detail
       → List of exercises in this workout
       → Each exercise shows sets logged
       → Tap exercise → Exercise Progress screen
            → Line chart: best weight per session over time
            → List of every session this exercise was logged with sets

Tab: Leaderboard
  → Ranked list by stars
  → (Will be PLG gated later — build it open for now)
```

---

## Cursor Build Instructions

Read this entire document before writing any code.

Build the following in order:

### Step 1 — API

1. Set up Express + lowdb + CORS in `api/`
2. Create `db.json` with the seed data above exactly
3. Create `api/src/config/features.js` and `api/src/middleware/planCheck.js` as specified
4. Implement all routes in the order listed: members → exercises → workouts → workoutExercises → sets → progress → stars → leaderboard
5. For the `GET /workouts/:id` route, return the full nested object: workout + its workoutExercises (with exercise library data joined) + sets per workoutExercise
6. For `GET /members/:id/progress/:exerciseId`, return array of `{ workoutId, workoutName, workoutDate, sets, bestSet: { reps, weightKg }, totalVolume }` sorted oldest to newest (for charting)
7. Run on port 3001

### Step 2 — Mobile

1. Set up Expo with TypeScript and Expo Router in `mobile/`
2. Create `mobile/types/index.ts` with TypeScript interfaces matching all data models
3. Create `mobile/lib/api.ts` with typed fetch functions for all routes needed by the screens
4. Build screens in order: Dashboard → Workouts list → Workout detail → Exercise progress → Leaderboard
5. Use `FlatList` for all lists. Use `ActivityIndicator` for loading states. Handle errors with a retry button.
6. Add a comment in `api.ts` that the BASE_URL must use the machine's LAN IP for physical device testing, not localhost

### After scaffolding

Provide:
1. Exact terminal commands to install and start both packages
2. A list of API endpoints to test with curl to verify everything works
3. Note the LAN IP requirement for Expo and how to find it

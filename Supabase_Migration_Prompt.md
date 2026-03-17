# GymApp — Supabase Migration Prompt for Cursor

## Context

We are migrating the GymApp API from lowdb (local JSON file database) to Supabase (hosted Postgres). The Supabase database is already created and seeded. The API routes, request/response contracts, and mobile client do not change at all — only the data layer changes.

---

## What Supabase Tables Exist

These tables are live in Supabase and already seeded:

| Supabase Table | Was (lowdb) | Notes |
|---|---|---|
| `members` | `members` | `passwordHash` → `password_hash` |
| `plans` | `plans` | unchanged |
| `features` | `features` | unchanged |
| `plan_features` | `planFeatures` | `planId` → `plan_id`, `featureId` → `feature_id`, `limit` → `limit_value` |
| `star_awards` | `starAwards` | `memberId` → `member_id`, `awardedBy` → `awarded_by` |
| `exercise_library` | `exerciseLibrary` | `muscleGroups` → `muscle_groups` |
| `workouts` | `workouts` | `userId` → `user_id`, `startedAt` → `started_at`, `completedAt` → `completed_at` |
| `workout_exercises` | `workoutExercises` | `workoutId` → `workout_id`, `exerciseId` → `exercise_id`, `order` → `order_index` |
| `sets` | `sets` | `workoutExerciseId` → `workout_exercise_id`, `weightKg` → `weight_kg`, `durationSeconds` → `duration_seconds`, `distanceMeters` → `distance_meters` |

**Key rule:** Supabase uses snake_case column names. The API response should still return camelCase to the clients — map snake_case to camelCase in the route handlers or a helper.

---

## Instructions for Cursor

Read `GYMAPP_ARCHITECTURE_V2.md` first for full context. Then do the following:

### Step 1 — Install Supabase client

```bash
cd api && npm install @supabase/supabase-js
```

### Step 2 — Environment variables

Create or update `api/.env`:

```
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
PORT=3001
```

Add `api/.env` to `.gitignore` if not already there.

### Step 3 — Replace db.js

Delete the existing lowdb `db.js` and replace with a Supabase client setup:

```js
// api/src/db.js
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

export default supabase
```

### Step 4 — Migrate every route file

For each route file, replace all lowdb read/write calls with Supabase queries. Follow these patterns:

**Fetching all rows:**
```js
// lowdb (old)
const members = db.data.members

// Supabase (new)
const { data: members, error } = await supabase
  .from('members')
  .select('*')
```

**Fetching single row by id:**
```js
// lowdb (old)
const member = db.data.members.find(m => m.id === id)

// Supabase (new)
const { data: member, error } = await supabase
  .from('members')
  .select('*')
  .eq('id', id)
  .single()
```

**Filtering rows:**
```js
// lowdb (old)
const workouts = db.data.workouts.filter(w => w.userId === userId)

// Supabase (new)
const { data: workouts, error } = await supabase
  .from('workouts')
  .select('*')
  .eq('user_id', userId)
  .order('started_at', { ascending: false })
```

**Inserting a row:**
```js
// lowdb (old)
db.data.members.push(newMember)
await db.write()

// Supabase (new)
const { data: newMember, error } = await supabase
  .from('members')
  .insert(memberPayload)
  .select()
  .single()
```

**Updating a row:**
```js
// lowdb (old)
const idx = db.data.workouts.findIndex(w => w.id === id)
db.data.workouts[idx] = { ...db.data.workouts[idx], ...updates }
await db.write()

// Supabase (new)
const { data: updated, error } = await supabase
  .from('workouts')
  .update(updates)
  .eq('id', id)
  .select()
  .single()
```

**Deleting a row:**
```js
// lowdb (old)
db.data.workouts = db.data.workouts.filter(w => w.id !== id)
await db.write()

// Supabase (new)
const { error } = await supabase
  .from('workouts')
  .delete()
  .eq('id', id)
```

### Step 5 — Handle snake_case to camelCase mapping

Supabase returns snake_case column names. The API must return camelCase to clients so mobile and web don't break.

Create a helper file `api/src/utils/mappers.js` with mapping functions for each entity:

```js
export function mapMember(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    plan: row.plan,
    planExpiresAt: row.plan_expires_at,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at
  }
}

export function mapWorkout(row) {
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    notes: row.notes,
    createdAt: row.created_at
  }
}

export function mapWorkoutExercise(row) {
  if (!row) return null
  return {
    id: row.id,
    workoutId: row.workout_id,
    exerciseId: row.exercise_id,
    order: row.order_index,
    notes: row.notes,
    createdAt: row.created_at
  }
}

export function mapSet(row) {
  if (!row) return null
  return {
    id: row.id,
    workoutExerciseId: row.workout_exercise_id,
    setNumber: row.set_number,
    reps: row.reps,
    weightKg: row.weight_kg,
    durationSeconds: row.duration_seconds,
    distanceMeters: row.distance_meters,
    completed: row.completed,
    createdAt: row.created_at
  }
}

export function mapExercise(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    muscleGroups: row.muscle_groups,
    equipment: row.equipment,
    unit: row.unit,
    createdAt: row.created_at
  }
}

export function mapStarAward(row) {
  if (!row) return null
  return {
    id: row.id,
    memberId: row.member_id,
    awardedBy: row.awarded_by,
    reason: row.reason,
    createdAt: row.created_at
  }
}
```

Apply the relevant mapper before returning data from every route handler.

### Step 6 — Error handling pattern

Every Supabase call can return an error. Use this pattern consistently across all routes:

```js
const { data, error } = await supabase.from('members').select('*')

if (error) {
  console.error(error)
  return res.status(500).json({ error: 'Database error', detail: error.message })
}

if (!data) {
  return res.status(404).json({ error: 'Not found' })
}

return res.json(data.map(mapMember))
```

### Step 7 — Update features.js to read from Supabase

Replace the hardcoded `FEATURES` object in `api/src/config/features.js` with a function that reads from the `plan_features` table:

```js
// api/src/config/features.js
import supabase from '../db.js'

export async function can(user, featureId) {
  const { data, error } = await supabase
    .from('plan_features')
    .select('enabled')
    .eq('plan_id', user.plan ?? 'free')
    .eq('feature_id', featureId)
    .single()

  if (error || !data) return false
  return data.enabled === true
}

export async function limit(user, featureId) {
  const { data, error } = await supabase
    .from('plan_features')
    .select('limit_value')
    .eq('plan_id', user.plan ?? 'free')
    .eq('feature_id', featureId)
    .single()

  if (error || !data) return 0
  return data.limit_value === null ? Infinity : data.limit_value
}
```

This means feature rules are now live-editable in Supabase — no code deploys needed to change plan limits.

### Step 8 — Remove lowdb

Once all routes are migrated and tested:

```bash
npm uninstall lowdb
```

Delete `api/db.json`.

---

## Route Files to Migrate

Work through each of these in order:

1. `api/src/routes/members.js`
2. `api/src/routes/stars.js`
3. `api/src/routes/leaderboard.js`
4. `api/src/routes/exercises.js`
5. `api/src/routes/workouts.js`
6. `api/src/routes/workoutExercises.js`
7. `api/src/routes/sets.js`
8. `api/src/routes/progress.js`

---

## After Migration — Sanity Check

Test these endpoints to confirm everything works:

```bash
# Members
curl http://localhost:3001/members

# Leaderboard (computed from star_awards)
curl http://localhost:3001/leaderboard

# Single workout with nested exercises + sets
curl http://localhost:3001/workouts/178fe517-95ec-4cbd-93b4-a18a2168e00e

# Exercise progress for Sarah (m1) on Back Squat (ex1)
curl http://localhost:3001/members/m1/progress/ex1

# Exercise library
curl http://localhost:3001/exercises
```

All responses should return camelCase JSON matching the same shape as before. The mobile app and web client should require zero changes.

---

## What Does NOT Change

- All API route paths stay identical
- All request body shapes stay identical
- All response JSON shapes stay identical (thanks to mappers)
- Mobile `lib/api.ts` — no changes
- Web `src/api/client.js` — no changes
- `GYMAPP_ARCHITECTURE_V2.md` — still the source of truth

# GymApp — Exercise Logs Migration Prompt for Cursor

## Context

We are reworking the exercise tracking flow. Previously exercises were logged inside a workout session (workout → workout_exercises → sets). We are simplifying this so users log exercises directly with no workout container.

**Old flow:**
```
Workout (session)
  └── workout_exercises (exercise within a workout)
        └── sets (reps + weight per set)
```

**New flow:**
```
exercise_logs (I logged Back Squat on Tuesday)
  └── sets (reps + weight per set)
```

The `workouts` and `workout_exercises` tables and routes are left in place — do not delete or modify them. Existing data stays intact. We are adding a new parallel path alongside them.

---

## Database Changes Already Made

These two changes have already been run in Supabase:

```sql
-- New table
create table exercise_logs (
  id text primary key,
  member_id text references members(id) on delete cascade,
  exercise_id text references exercise_library(id),
  logged_at timestamptz default now(),
  notes text,
  created_at timestamptz default now()
);

-- New column on sets
alter table sets 
  add column exercise_log_id text references exercise_logs(id) on delete cascade;
```

Do not run these again.

---

## What To Build

### 1. New API Routes — `api/src/routes/exerciseLogs.js`

Create this file with the following routes:

```
POST   /exercise-logs
       Body: { memberId, exerciseId, notes?, loggedAt? }
       → validate memberId and exerciseId exist
       → create exercise_log record
       → return created log

GET    /exercise-logs?memberId=x
       → return all exercise logs for a member
       → join with exercise_library to include exercise name, category, unit
       → sort newest first

GET    /exercise-logs/:id
       → return single exercise log
       → include exercise library data (name, category, unit, equipment)
       → include all sets for this log

DELETE /exercise-logs/:id
       → delete exercise log
       → cascade deletes sets via DB constraint

POST   /exercise-logs/:id/sets
       Body: { setNumber, reps?, weightKg?, durationSeconds?, distanceMeters?, completed? }
       → create a set linked to exercise_log_id (NOT workout_exercise_id)
       → return created set

GET    /members/:id/exercise-history/:exerciseId
       → return all logs for a specific exercise for a member
       → each entry includes: logId, loggedAt, sets, bestSet, totalVolume
       → sort oldest to newest (for charting progress over time)
       → if member plan is free, only return last 30 days (use planFeatures limit)
```

### 2. Mount the New Route in `api/src/index.js`

Add:
```js
import exerciseLogsRouter from './routes/exerciseLogs.js'
app.use('/exercise-logs', exerciseLogsRouter)
```

### 3. Add Mapper in `api/src/utils/mappers.js`

Add this mapper function:

```js
export function mapExerciseLog(row) {
  if (!row) return null
  return {
    id: row.id,
    memberId: row.member_id,
    exerciseId: row.exercise_id,
    loggedAt: row.logged_at,
    notes: row.notes,
    createdAt: row.created_at
  }
}
```

### 4. Update Sets Route

In `api/src/routes/sets.js`, the existing `POST /workout-exercises/:id/sets` creates sets with `workout_exercise_id`. This stays unchanged.

The new sets for exercise logs are created via `POST /exercise-logs/:id/sets` in the new route file above — sets get `exercise_log_id` populated instead of `workout_exercise_id`.

---

## Mobile Changes

### 1. Update `mobile/types/index.ts`

Add these new types:

```ts
export interface ExerciseLog {
  id: string
  memberId: string
  exerciseId: string
  loggedAt: string
  notes: string | null
  createdAt: string
  exercise?: Exercise        // joined from exercise_library
  sets?: Set[]               // included when fetching single log
}

export interface ExerciseHistory {
  logId: string
  loggedAt: string
  sets: Set[]
  bestSet: {
    reps: number | null
    weightKg: number | null
  }
  totalVolume: number
}
```

### 2. Update `mobile/lib/api.ts`

Add these new API functions:

```ts
// Create a new exercise log
export async function createExerciseLog(payload: {
  memberId: string
  exerciseId: string
  notes?: string
  loggedAt?: string
}): Promise<ExerciseLog>

// Get all exercise logs for a member
export async function getExerciseLogs(memberId: string): Promise<ExerciseLog[]>

// Get single exercise log with sets
export async function getExerciseLog(id: string): Promise<ExerciseLog>

// Delete an exercise log
export async function deleteExerciseLog(id: string): Promise<void>

// Add a set to an exercise log
export async function addSetToExerciseLog(
  exerciseLogId: string,
  payload: {
    setNumber: number
    reps?: number
    weightKg?: number
    durationSeconds?: number
    distanceMeters?: number
    completed?: boolean
  }
): Promise<Set>

// Get exercise history for progress chart
export async function getExerciseHistory(
  memberId: string,
  exerciseId: string
): Promise<ExerciseHistory[]>
```

### 3. Update Mobile Screens

**Replace the Workouts tab with an Exercises tab:**

`mobile/app/(tabs)/exercises.tsx`
- Fetch `GET /exercises` to show the full exercise library
- Group by category (Legs, Push, Pull, Core, Cardio)
- Tap an exercise → go to exercise detail screen

`mobile/app/exercise/[id].tsx` — Exercise Detail Screen
- Show exercise name, category, equipment, muscle groups
- Show a line chart of best weight over time (use `getExerciseHistory`)
- Show list of past logs below the chart, newest first
- Each log shows date + sets summary (e.g. "3 sets — best: 100kg x 5")
- **"Log this exercise" button** at the bottom → opens log modal

`mobile/app/exercise/log.tsx` — Log Exercise Screen
- User selects an exercise from the library (searchable list)
- Adds sets one by one: reps + weight (or time/distance based on exercise unit)
- Each set has a "+ Add Set" button
- "Save Log" button → calls `createExerciseLog` then `addSetToExerciseLog` for each set
- On success → navigate back to exercise detail

**Update tab layout** `mobile/app/(tabs)/_layout.tsx`:
- Replace "Workouts" tab with "Exercises" tab
- Keep Home and Leaderboard tabs

**Update Home/Dashboard** `mobile/app/(tabs)/index.tsx`:
- Remove workout-related stats and CTAs
- Add "Log an Exercise" CTA that navigates to exercise library
- Show recent exercise logs (last 3) with exercise name and date

---

## API Rules for New Routes

1. **Always use `exercise_log_id`** when creating sets via the new route — never `workout_exercise_id`
2. **Cascade deletes** are handled by the DB constraint — deleting an exercise_log automatically deletes its sets
3. **Progress history** sorts oldest to newest for charting — newest first for list display
4. **Free plan limit** — exercise history limited to last 30 days, check `plan_features` table
5. **All responses use camelCase** — apply `mapExerciseLog` and `mapSet` before returning

---

## What Does NOT Change

- `workouts` table — untouched
- `workout_exercises` table — untouched  
- `api/src/routes/workouts.js` — untouched
- `api/src/routes/workoutExercises.js` — untouched
- `workout_exercise_id` on sets — still exists, still works for old data
- All existing seed data — untouched

---

## After Building

Test these endpoints:

```bash
# Create an exercise log
curl -X POST https://horizen-production.up.railway.app/exercise-logs \
  -H "Content-Type: application/json" \
  -d '{"memberId": "m1", "exerciseId": "ex1", "notes": "Felt strong"}'

# Get logs for member
curl https://horizen-production.up.railway.app/exercise-logs?memberId=m1

# Get exercise history for progress chart
curl https://horizen-production.up.railway.app/members/m1/exercise-history/ex1
```

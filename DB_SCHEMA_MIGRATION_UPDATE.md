# DB schema migration (enums + UUIDs)

This document summarizes the alignment between the API, clients, and Postgres: **UUID primary keys** for members, sessions, sets, exercises (except semantic plan/feature ids), and **strict case-sensitive enum strings** for columns mapped to Postgres enums.

## Rules

- **IDs**: Use RFC 4122 UUID v4 strings for entity ids. Validate with a single-line regex before writes (see `api/src/utils/validation.js`).
- **Enums**: Values match Postgres exactly — e.g. `'Upper Body'` not `upper_body`, `'weight_reps'` not `weightReps`.
- **No legacy short ids** like `m1`, `ex1`, `i1` in API payloads or new seed data.

## Muscle groups (junction table)

Exercise muscle groups are **not** stored on `exercise_library`. They use the `muscle_groups` lookup table and `exercise_muscle_groups` junction. API responses expose `muscleGroups: { id, name, region }[]`. Writes use **`muscleGroupIds`** (UUIDs from `GET /muscle-groups`), not free-form name strings.

## Canonical enum lists (`ENUMS` in `api/src/utils/validation.js`)

| Key | Values |
|-----|--------|
| `roles` | `member`, `instructor`, `admin` |
| `plans` | `free`, `pro`, `elite` (plan ids may remain semantic strings where the schema defines text ids) |
| `units` | `weight_reps`, `time`, `distance` |
| `loggingTypes` | `weighted`, `bodyweight`, `weighted_or_bodyweight` |
| `categories` | `Upper Body`, `Lower Body`, `Full Body`, `Core`, `Cardio`, `Mobility` |
| `types` | `Push`, `Pull`, `Squat`, `Hinge`, `Lunge`, `Isolation`, `Core`, `Cardio`, `Olympic`, `Compound`, `Carry`, `Mobility`, `Plyometric` |
| `equipment` | `Barbell`, `Dumbbell`, `Bodyweight`, `Cable`, `Machine`, `Kettlebell` |
| `statuses` | `active`, `requested`, `rejected` |

**Default exercise category** when none is supplied on request: **`Upper Body`** (invalid values such as `General` will fail inserts).

## Client typings

- **Mobile**: `mobile/types/index.ts` exports unions matching the table above; `MuscleGroup` is `{ id, name, region }`.
- **Web**: `web/src/api/client.ts` exports matching exercise enums and `MuscleGroup`.

## Helpers

- `isValidEnum(value, enumArray)`
- `isValidUUID(value)`
- `isValidMuscleGroupIds(ids)` — optional array of UUIDs for `muscleGroupIds` payloads.

Bulk loading for exercises uses `getMuscleGroupsForExercises()` in `api/src/utils/exerciseHelpers.js` (no N+1 queries).

## Testing

Use real UUIDs from `GET /members` and `GET /exercises` in `curl` examples; confirm responses use UUID strings for member, session, exercise, and set ids.

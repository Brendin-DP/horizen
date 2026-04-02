# GymApp — Cursor Project Context

## What We're Building

A gym management app with two end-user features:
1. **Stars & Leaderboard** — instructors award stars to members, members compete on a leaderboard
2. **Exercise Tracker** — members log workouts (exercise, weight, reps) and track personal progress over time

The app serves three roles: **Admin**, **Instructor**, and **Member**.

---

## Architecture Philosophy

This is an **API-first, multi-client system**. One central API serves all clients. The API owns all business logic. Clients are dumb — they fetch data and send actions, nothing more.

```
[ Web App — React + Vite ]     [ Mobile App — Expo React Native ]
              ↓                              ↓
        [ REST API — Express + lowdb ]
              ↓
        [ db.json — local file DB ]
```

**Why lowdb for now:** We're using a local JSON file database to move fast and validate the architecture without setting up Supabase. The data models are designed to migrate to Supabase Postgres cleanly — table names, field names, and relationships are production-ready. When ready to migrate, we extract `db.json`, create matching Supabase tables, and swap the lowdb calls for Supabase client calls. The API contract (routes, request/response shapes) stays identical — clients don't change at all.

---

## Current Build Phase — Vertical Slice #1

We are NOT building everything at once. We are proving the full stack works with the thinnest possible feature:

**Instructor awards stars → Leaderboard updates → Both web and mobile see it**

This validates:
- The API layer works and is the single source of truth
- Web client can write data (award stars)
- Mobile client can read derived data (leaderboard)
- The pattern is proven before we scale

**In scope for this phase:**
- API: `POST /stars`, `GET /leaderboard`, `GET /members`
- Web: Instructor view (select member, award stars) + Leaderboard view
- Mobile: Leaderboard screen

**Out of scope for this phase:**
- Authentication (we'll hardcode a current user for now)
- Exercise tracker
- Admin screens
- Push notifications

---

## Folder Structure

```
gymapp/
├── api/                        # Express API — shared by all clients
│   ├── src/
│   │   ├── routes/
│   │   │   ├── members.js
│   │   │   ├── stars.js
│   │   │   └── leaderboard.js
│   │   ├── db.js               # lowdb setup + helpers
│   │   └── index.js            # Express app entry point
│   ├── db.json                 # Local JSON database
│   └── package.json
│
├── web/                        # React + Vite web client
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js       # All fetch calls — single file
│   │   ├── pages/
│   │   │   ├── Leaderboard.jsx
│   │   │   └── AwardStars.jsx
│   │   ├── components/
│   │   └── App.jsx
│   └── package.json
│
└── mobile/                     # Expo React Native client
    ├── app/
    │   ├── (tabs)/
    │   │   ├── leaderboard.tsx
    │   │   └── index.tsx
    │   └── _layout.tsx
    ├── components/
    ├── lib/
    │   └── api.ts              # All fetch calls — single file
    └── package.json
```

---

## Data Models

### members
```json
{
  "id": "string (uuid)",
  "name": "string",
  "email": "string",
  "role": "member | instructor | admin",
  "avatarUrl": "string | null",
  "createdAt": "ISO timestamp"
}
```

### starAwards
```json
{
  "id": "string (uuid)",
  "memberId": "string (ref: members.id)",
  "awardedBy": "string (ref: members.id)",
  "reason": "string | null",
  "createdAt": "ISO timestamp"
}
```

### exercises (for Phase 2)
```json
{
  "id": "string (uuid)",
  "name": "string",
  "category": "string",
  "createdAt": "ISO timestamp"
}
```

### exerciseLogs (for Phase 2)
```json
{
  "id": "string (uuid)",
  "memberId": "string (ref: members.id)",
  "exerciseId": "string (ref: exercises.id)",
  "sets": [{ "reps": "number", "weightKg": "number" }],
  "notes": "string | null",
  "loggedAt": "ISO timestamp"
}
```

---

## API Routes

### Phase 1 (build now)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/members` | List all members |
| GET | `/members/:id` | Get single member |
| POST | `/stars` | Award stars to a member |
| GET | `/members/:id/stars` | Get star history for a member |
| GET | `/leaderboard` | Ranked member list by star count |

### Phase 2 (exercise tracker)

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/exercises` | List exercise library |
| POST | `/exercises` | Add new exercise |
| POST | `/logs` | Log a workout session |
| GET | `/members/:id/logs` | All logs for a member |
| GET | `/members/:id/logs/:exerciseId` | Progress history for one exercise |

---

## API Rules

- **Leaderboard is always derived** — never stored. Compute it by counting `starAwards` grouped by `memberId`. Never maintain a separate star count field on the member — it will drift.
- **All IDs are UUIDs** — use the `uuid` package (`crypto.randomUUID()` in Node 18+)
- **Timestamps are ISO 8601** — always store and return as `new Date().toISOString()`
- **CORS is open** during development — both web (localhost:5173) and mobile (Expo) need to hit the API
- **No auth for Phase 1** — hardcode `currentUser` in the client. We'll add JWT later.
- **API runs on port 3001** — web on 5173, mobile via Expo Go

---

## db.json Seed Data

```json
{
  "members": [
    {
      "id": "00000010-0000-4000-8000-000000f42401",
      "name": "Sarah Jacobs",
      "email": "sarah@gym.com",
      "role": "member",
      "avatarUrl": null,
      "createdAt": "2025-01-01T00:00:00Z"
    },
    {
      "id": "00000010-0000-4000-8000-000000f42402",
      "name": "James Fortuin",
      "email": "james@gym.com",
      "role": "member",
      "avatarUrl": null,
      "createdAt": "2025-01-01T00:00:00Z"
    },
    {
      "id": "00000010-0000-4000-8000-000000f42403",
      "name": "Aisha Davids",
      "email": "aisha@gym.com",
      "role": "member",
      "avatarUrl": null,
      "createdAt": "2025-01-01T00:00:00Z"
    },
    {
      "id": "00000020-0000-4000-8000-000001e84801",
      "name": "Neal Oberholster",
      "email": "neal@gym.com",
      "role": "instructor",
      "avatarUrl": null,
      "createdAt": "2025-01-01T00:00:00Z"
    }
  ],
  "starAwards": [
    {
      "id": "00000050-0000-4000-8000-000004c4b401",
      "memberId": "00000010-0000-4000-8000-000000f42401",
      "awardedBy": "00000020-0000-4000-8000-000001e84801",
      "reason": "Best form this week",
      "createdAt": "2025-01-10T09:00:00Z"
    },
    {
      "id": "00000050-0000-4000-8000-000004c4b402",
      "memberId": "00000010-0000-4000-8000-000000f42401",
      "awardedBy": "00000020-0000-4000-8000-000001e84801",
      "reason": "Most improved",
      "createdAt": "2025-01-12T09:00:00Z"
    },
    {
      "id": "00000050-0000-4000-8000-000004c4b403",
      "memberId": "00000010-0000-4000-8000-000000f42402",
      "awardedBy": "00000020-0000-4000-8000-000001e84801",
      "reason": "100% attendance",
      "createdAt": "2025-01-11T09:00:00Z"
    }
  ],
  "exercises": [],
  "exerciseLogs": []
}
```

---

## Key Conventions

- **API client is always a single file** per client (`web/src/api/client.js`, `mobile/lib/api.ts`). All fetch calls live there. Never call `fetch` directly inside a component.
- **Base URL comes from an env var** — `VITE_API_URL` for web, stored in a config file for mobile. Never hardcode `localhost:3001` inside components.
- **Error handling on every API call** — wrap in try/catch, surface errors in UI.
- **TypeScript in mobile** — use proper types matching the data models above.
- **Keep components small** — pages fetch data, components render it.

---

## Migration Path to Supabase (future)

When ready:
1. Create Supabase tables matching the data models exactly
2. Seed with data from `db.json`
3. Replace lowdb calls in `api/src/db.js` with `@supabase/supabase-js` calls
4. Add Supabase Auth — replace hardcoded `currentUser` with real JWT tokens
5. Web and mobile clients change only their base URL and add an auth header

The API contract does not change. Clients don't change.

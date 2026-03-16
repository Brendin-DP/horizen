# Cursor Build Prompt — GymApp Phase 1 Scaffold

Paste this into Cursor's composer (Cmd+I) to scaffold the entire project.

---

## PROMPT

I'm building a gym management app called GymApp. Before you write any code, read the full context in `CURSOR_CONTEXT.md` in this project — it explains the architecture, data models, API routes, conventions, and migration plan. Everything you build must follow that document.

Please scaffold the complete Phase 1 project across three packages: `api/`, `web/`, and `mobile/`. Here's exactly what to build:

---

### 1. API (`api/`)

**Setup:**
- Node.js + Express
- `lowdb` for the JSON file database (use lowdb v3+ with ESM, or v1 with CommonJS — match whichever works with the Node version)
- `cors` middleware — allow all origins during development
- `uuid` for ID generation (use `crypto.randomUUID()` if Node 18+)
- Runs on port `3001`

**Files to create:**

`api/package.json` — include scripts: `"dev": "node --watch src/index.js"` and `"start": "node src/index.js"`

`api/db.json` — use the exact seed data from `CURSOR_CONTEXT.md`

`api/src/db.js` — lowdb setup. Export a `getDb()` function that reads/writes `db.json`. Include helper: `db.read()` before every read, `db.write()` after every write.

`api/src/index.js` — Express app. Import and mount routes. Add CORS. Start server on 3001. Log "API running on http://localhost:3001" on start.

`api/src/routes/members.js` — two routes:
- `GET /members` → return all members
- `GET /members/:id` → return single member or 404

`api/src/routes/stars.js` — two routes:
- `POST /stars` → body: `{ memberId, awardedBy, reason? }` → validate memberId exists → create starAward with UUID + timestamp → return created award
- `GET /members/:id/stars` → return all star awards for that member, sorted newest first

`api/src/routes/leaderboard.js` — one route:
- `GET /leaderboard` → compute leaderboard by counting starAwards grouped by memberId → join with members data for name/email → sort by starCount descending → return array of `{ rank, memberId, name, starCount }`
- IMPORTANT: leaderboard is always computed from starAwards, never stored

---

### 2. Web Client (`web/`)

**Setup:**
- React + Vite
- Tailwind CSS
- React Router v6
- Runs on port `5173`

**Files to create:**

`web/src/api/client.js` — all fetch calls in one place:
```js
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export async function getLeaderboard() { ... }
export async function getMembers() { ... }
export async function awardStars({ memberId, awardedBy, reason }) { ... }
```

`web/.env` — `VITE_API_URL=http://localhost:3001`

`web/src/App.jsx` — React Router setup with two routes:
- `/` → Leaderboard page
- `/award` → Award Stars page
- Simple nav bar at top with links to both

`web/src/pages/Leaderboard.jsx` — fetches `GET /leaderboard` on mount, displays ranked list. Show rank, name, star count (as ★ icons up to 5, then number). Add a "Refresh" button. Handle loading and error states.

`web/src/pages/AwardStars.jsx` — fetches members list, shows a form:
- Dropdown to select member (only show role: "member")
- Text input for reason (optional)
- Submit button → calls `POST /stars` with hardcoded `awardedBy: "i1"` (Neal, our instructor — no auth yet)
- On success: show a success message and reset form
- Handle loading and error states

Keep the UI clean and functional — this is an internal instructor tool, not the consumer-facing app.

---

### 3. Mobile Client (`mobile/`)

**Setup:**
- Expo with TypeScript (`npx create-expo-app mobile --template`)
- Expo Router (file-based routing)
- Runs via Expo Go

**Files to create:**

`mobile/lib/api.ts` — all fetch calls:
```ts
const BASE_URL = 'http://YOUR_LOCAL_IP:3001' // note: Expo needs your machine's LAN IP, not localhost

export interface LeaderboardEntry {
  rank: number
  memberId: string
  name: string
  starCount: number
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> { ... }
```

Add a comment in `api.ts` explaining that the IP address needs to match the developer's LAN IP (run `ipconfig` on Windows or `ifconfig` on Mac to find it) because Expo Go on a physical device can't reach `localhost`.

`mobile/app/(tabs)/leaderboard.tsx` — leaderboard screen:
- Fetches leaderboard on mount
- FlatList showing rank, name, star count
- Pull-to-refresh
- Loading state (ActivityIndicator)
- Error state with retry button
- Style it cleanly — dark background, bold rank numbers, star count prominent

`mobile/app/(tabs)/index.tsx` — simple home/dashboard screen for now:
- Show "Welcome to GymApp" 
- Show a card linking to the Leaderboard tab
- Hardcode current user as "Neal Oberholster" for now

`mobile/app/(tabs)/_layout.tsx` — tab layout with two tabs: Home and Leaderboard

---

### After scaffolding

Once created, give me:
1. The exact commands to install dependencies and start each package
2. A note about the Expo LAN IP requirement and how to find it
3. A quick sanity check — what to test first to confirm everything is wired up correctly

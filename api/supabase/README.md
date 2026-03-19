# Horizen Supabase migrations

Run these SQL files in the [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql) in order.

## Migration order

1. **000_initial_schema.sql** – Core tables (members, plans, features, plan_features, star_awards, exercise_library, workouts, workout_exercises, sets)
2. **001_fund_goals.sql** – Fund tracker config (raised amount, visibility)

## Environment variables (API)

Add to `api/.env`:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PORT=3001
JWT_SECRET=your-jwt-secret

# Fund tracker (optional)
FUND_TARGET=6000
DONATE_URL=https://...
```

## Seed admin user

From project root:

```bash
node api/scripts/seed-admin.js [email] [password] [name]
```

Default: `admin@gym.com` / `password123` / `Admin User`

# GymApp API — Vercel Deployment Fix

## The Problem

Vercel's Hobby plan allows a maximum of 12 serverless functions per deployment. By default Vercel treats every file it finds as a separate function, causing the deployment to fail when you have more than 12 route/config files.

## The Fix

We tell Vercel to treat the entire Express app as a single serverless function by routing all requests through `src/index.js`. Express handles all internal routing as normal. Nothing about the API logic changes.

---

## Instructions for Cursor

Make the following changes to the `api/` package.

### 1. Create `api/vercel.json`

Create this file at the root of the `api/` folder:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "src/index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "src/index.js"
    }
  ]
}
```

This tells Vercel: build only `src/index.js` as a single function, and send every incoming request to it regardless of path.

### 2. Update `api/src/index.js`

Vercel requires the Express app to be **exported** as a module, not just started with `app.listen()`. The index wraps `app.listen()` in a check and exports the app:

- `if (process.env.VERCEL !== '1')` — prevents the server trying to `listen()` inside Vercel's serverless environment
- `module.exports = app` — Vercel needs this to invoke Express as the handler

### 3. Add environment variables to Vercel

Your API uses `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `.env` locally. On Vercel these need to be added through the dashboard — they are never read from a `.env` file in production.

Go to: **Vercel Dashboard → Your Project → Settings → Environment Variables**

Add:
```
SUPABASE_URL                  = your Supabase project URL
SUPABASE_SERVICE_ROLE_KEY      = your Supabase service_role key (from Settings → API)
JWT_SECRET                     = a secret for signing tokens (e.g. a random string)
```

Set all for **Production**, **Preview**, and **Development** environments.

### 4. Confirm `.gitignore` has `api/.env`

The repo `.gitignore` already includes `api/.env` so secrets are never committed.

### 5. Update `api/package.json`

The `main` field points to `src/index.js` and `engines` specifies Node 18+. The API uses CommonJS (no `type: "module"`).

---

## After Making These Changes

Push to GitHub. Vercel will auto-redeploy. The deployment should succeed with a single function.

Test the live API with:

```bash
# Health check
curl https://your-api.vercel.app/

# Members
curl https://your-api.vercel.app/members

# Leaderboard
curl https://your-api.vercel.app/leaderboard

# Exercises
curl https://your-api.vercel.app/exercises
```

---

## Update Mobile API Base URL

Once deployed, update `mobile/lib/api.ts` to point at the live Vercel URL instead of your local LAN IP:

```ts
const BASE_URL = 'https://your-api.vercel.app'
```

For local development you can toggle this with an environment variable or a simple condition:

```ts
const BASE_URL = __DEV__
  ? 'http://192.168.x.x:3001'
  : 'https://your-api.vercel.app'
```

`__DEV__` is a global boolean Expo provides — `true` in development, `false` in production builds.

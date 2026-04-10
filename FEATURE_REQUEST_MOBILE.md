# GymApp — Mobile Feature Request Screen

## Context

We are building the feature request flow for the mobile app. A member taps "Request a Feature" on the Profile tab, fills in a title and description, submits, and sees a success screen. That's the entire flow.

---

## Database Reference

### feature_requests table
```
id            uuid      primary key default gen_random_uuid()
title         text      not null
description   text      not null
tag           feature_request_tag    default 'Feature Request'
status        feature_request_status default 'Requested'
requested_by  uuid      references members(id)
upvotes       integer   default 0
created_at    timestamptz default now()
updated_at    timestamptz default now()
```

### Enums
```
feature_request_tag:    Bug | Feature Request | Improvement
feature_request_status: Requested | Under Consideration | In Progress | Done
```

Users only submit title and description. Tag defaults to 'Feature Request' and status defaults to 'Requested' — both set by the API, never by the user.

---

## API Endpoint

### POST /feature-requests

Request body:
```json
{
  "title": "string",
  "description": "string",
  "memberId": "uuid"
}
```

Response:
```json
{
  "id": "uuid",
  "title": "string",
  "description": "string",
  "tag": "Feature Request",
  "status": "Requested",
  "upvotes": 0,
  "createdAt": "timestamp"
}
```

Validation:
- `title` required, not empty
- `description` required, not empty
- `memberId` required, must be a valid UUID

---

## Mobile API Client — `mobile/lib/api.ts`

Add this function:

```ts
export async function submitFeatureRequest(payload: {
  title: string
  description: string
  memberId: string
}): Promise<void> {
  const res = await fetch(`${BASE_URL}/feature-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error || 'Failed to submit request')
  }
}
```

---

## Mobile Types — `mobile/types/index.ts`

Add:

```ts
export type FeatureRequestTag = 'Bug' | 'Feature Request' | 'Improvement'
export type FeatureRequestStatus = 'Requested' | 'Under Consideration' | 'In Progress' | 'Done'

export interface FeatureRequest {
  id: string
  title: string
  description: string
  tag: FeatureRequestTag
  status: FeatureRequestStatus
  upvotes: number
  createdAt: string
  updatedAt: string
}
```

---

## Screen Flow

```
Profile Tab
  → Tap "Request a Feature"
       ↓
  Feature Request Screen
  (title + description + submit)
       ↓ on success
  Success Screen
  (confirmation message + two buttons)
       ↓
  Close → back to Profile
  Submit New → back to Feature Request Screen (cleared)
```

---

## Screen 1 — Feature Request Screen

### File
`mobile/app/feature-request.tsx`

### Navigation
Accessible from the Profile tab via a "Request a Feature" row/button. Use `router.push('/feature-request')` to navigate to it.

### Layout
- Back button top left
- Page title: "Request a Feature"
- Subtitle: "Have an idea or found a bug? Let us know."
- Form below:

**Title field**
- Label: "Title"
- TextInput, single line
- Placeholder: "Give your request a short title"
- Max 100 characters
- Show character count: "X/100" aligned right below the input
- Required

**Description field**
- Label: "Description"
- TextInput, multiline (4-5 lines tall)
- Placeholder: "Describe what you'd like to see and why it would be helpful"
- Max 500 characters
- Show character count: "X/500" aligned right below the input
- Required

**Submit button**
- Label: "Submit Request"
- Full width
- Disabled and visually muted when either field is empty
- Shows loading spinner while API call is in flight
- Uses the app's primary colour (same red/coral as the rest of the app)

### Behaviour
- Both fields must have content before submit is enabled
- On submit → call `submitFeatureRequest({ title, description, memberId: currentUser.id })`
- On success → navigate to Success Screen
- On error → show inline error message below the submit button, do not navigate away
- Keyboard should push the form up (use `KeyboardAvoidingView`)

---

## Screen 2 — Success Screen

### File
`mobile/app/feature-request-success.tsx`

### Layout
- No back button (replace header back with nothing or hide it)
- Centred content vertically and horizontally
- Checkmark icon or success illustration at top (use a simple checkmark in a circle — no external library needed, just a styled View)
- Heading: "Request Submitted!"
- Body text: "Thanks for your feedback. We review all requests and update our roadmap regularly."
- Two buttons stacked vertically:
  - Primary button: "Submit Another" → navigates back to Feature Request Screen with fields cleared
  - Secondary button (outline style): "Back to Profile" → navigates back to Profile tab

### Behaviour
- User cannot go back to the form via the hardware back button — replace navigation to prevent returning to the form with content still filled in
- "Submit Another" clears both fields and goes back to the form
- "Back to Profile" goes to the Profile tab root

---

## Profile Tab — Wire Up Entry Point

In the Profile screen, find the existing "Request a Feature" row or button and wire it up:

```tsx
import { router } from 'expo-router'

// On press
router.push('/feature-request')
```

If the "Request a Feature" entry point does not exist yet on the Profile screen, add it as a list row item in the same style as other profile options, placed in a logical section (e.g. under a "Feedback" or "Help" section heading).

---

## API Route — `api/src/routes/featureRequests.js`

Create this new route file:

```js
import express from 'express'
import supabase from '../db.js'
import { randomUUID } from 'crypto'

const router = express.Router()

router.post('/', async (req, res) => {
  const { title, description, memberId } = req.body

  if (!title?.trim()) {
    return res.status(400).json({ error: 'Title is required' })
  }
  if (!description?.trim()) {
    return res.status(400).json({ error: 'Description is required' })
  }
  if (!memberId) {
    return res.status(400).json({ error: 'memberId is required' })
  }

  // Verify member exists
  const { data: member } = await supabase
    .from('members')
    .select('id')
    .eq('id', memberId)
    .single()

  if (!member) {
    return res.status(404).json({ error: 'Member not found' })
  }

  const { data, error } = await supabase
    .from('feature_requests')
    .insert({
      id: randomUUID(),
      title: title.trim(),
      description: description.trim(),
      requested_by: memberId,
      tag: 'Feature Request',
      status: 'Requested'
    })
    .select()
    .single()

  if (error) {
    console.error('Feature request error:', error)
    return res.status(500).json({ error: 'Failed to submit request' })
  }

  return res.status(201).json({
    id: data.id,
    title: data.title,
    description: data.description,
    tag: data.tag,
    status: data.status,
    upvotes: data.upvotes,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  })
})

export default router
```

Mount in `api/src/index.js`:
```js
import featureRequestsRouter from './routes/featureRequests.js'
app.use('/feature-requests', featureRequestsRouter)
```

---

## Rules

1. Users never set tag or status — always defaulted by the API
2. `memberId` always comes from the authenticated user's session — never hardcoded
3. Character limits (100 title, 500 description) enforced in the UI — API trims whitespace
4. Success screen prevents navigating back to a partially filled form
5. The feature request screen matches the existing app visual style — same fonts, colours, button styles as the rest of the app

---

## After Building — Test This Flow

1. Open app → Profile tab → tap "Request a Feature"
2. Leave fields empty → confirm submit button is disabled
3. Fill in title only → confirm submit still disabled
4. Fill both fields → confirm submit enabled
5. Submit → confirm row appears in Supabase `feature_requests` table with `status = Requested`
6. Confirm success screen shows
7. Tap "Submit Another" → confirm form is cleared and ready
8. Tap "Back to Profile" → confirm lands on Profile tab

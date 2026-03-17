/**
 * API client for GymApp.
 *
 * PHYSICAL DEVICE (Expo Go on phone): Use your Mac's LAN IP so the phone can reach your API.
 * SIMULATOR (Expo → press i for iOS): Use 'localhost' — the simulator runs on your Mac.
 *
 * To find your Mac's IP: run `ifconfig` and look for inet under en0 (Wi‑Fi).
 */
const USE_SIMULATOR = true; // Set to true when using iOS Simulator (press i in Expo)
const API_HOST = USE_SIMULATOR ? 'localhost' : '10.21.216.254';
const BASE_URL = `http://${API_HOST}:3001`;

export interface Member {
  id: string;
  name: string;
  email: string;
  role: 'member' | 'instructor' | 'admin';
  plan?: 'free' | 'pro' | 'elite';
  planExpiresAt?: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  memberId: string;
  name: string;
  starCount: number;
}

export interface AuthResponse {
  member: Member;
  token: string;
}

function headersWithAuth(token: string | null): HeadersInit {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

export async function register({
  email,
  password,
  name,
}: {
  email: string;
  password: string;
  name: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Registration failed');
  }
  return res.json();
}

export async function login({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Login failed');
  }
  return res.json();
}

export async function getLeaderboard(token?: string | null): Promise<LeaderboardEntry[]> {
  const res = await fetch(`${BASE_URL}/leaderboard`, {
    headers: headersWithAuth(token ?? null),
  });
  if (!res.ok) throw new Error('Failed to fetch leaderboard');
  return res.json();
}

export async function getMembers(
  options?: { role?: string; token?: string | null }
): Promise<Member[]> {
  const q = options?.role ? `?role=${encodeURIComponent(options.role)}` : '';
  const res = await fetchApi(`/members${q}`, { token: options?.token });
  if (!res.ok) throw new Error('Failed to fetch members');
  return res.json();
}

export async function awardStar(
  memberId: string,
  reason?: string | null,
  token?: string | null
): Promise<{ id: string; memberId: string; awardedBy: string; reason: string | null; createdAt: string }> {
  const res = await fetchApi('/stars', {
    method: 'POST',
    body: JSON.stringify({ memberId, reason: reason || null }),
    token,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Failed to award star');
  }
  return res.json();
}

async function fetchApi(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<Response> {
  const { token, ...rest } = options;
  return fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(rest.headers as Record<string, string>),
    },
  });
}

export async function getExercises(category?: string): Promise<import('../types').Exercise[]> {
  const q = category ? `?category=${encodeURIComponent(category)}` : '';
  const res = await fetch(`${BASE_URL}/exercises${q}`);
  if (!res.ok) throw new Error('Failed to fetch exercises');
  return res.json();
}

export async function getExercise(id: string): Promise<import('../types').Exercise> {
  const res = await fetch(`${BASE_URL}/exercises/${id}`);
  if (!res.ok) throw new Error('Exercise not found');
  return res.json();
}

export async function getWorkouts(userId: string, token?: string | null): Promise<import('../types').Workout[]> {
  const res = await fetchApi(`/workouts?userId=${encodeURIComponent(userId)}`, { token });
  if (!res.ok) throw new Error('Failed to fetch workouts');
  return res.json();
}

export async function createWorkout(
  userId: string,
  name?: string | null,
  token?: string | null
): Promise<import('../types').Workout> {
  const res = await fetchApi('/workouts', {
    method: 'POST',
    body: JSON.stringify({ userId, name }),
    token,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Failed to create workout');
  }
  return res.json();
}

export async function getWorkout(
  id: string,
  token?: string | null
): Promise<import('../types').WorkoutWithDetails> {
  const res = await fetchApi(`/workouts/${id}`, { token });
  if (!res.ok) throw new Error('Workout not found');
  return res.json();
}

export async function updateWorkout(
  id: string,
  body: { name?: string; status?: string; completedAt?: string | null; notes?: string | null },
  token?: string | null
): Promise<import('../types').Workout> {
  const res = await fetchApi(`/workouts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    token,
  });
  if (!res.ok) throw new Error('Failed to update workout');
  return res.json();
}

export async function deleteWorkout(id: string, token?: string | null): Promise<void> {
  const res = await fetchApi(`/workouts/${id}`, { method: 'DELETE', token });
  if (!res.ok) throw new Error('Failed to delete workout');
}

export async function addWorkoutExercise(
  workoutId: string,
  exerciseId: string,
  order?: number,
  token?: string | null
): Promise<import('../types').WorkoutExercise> {
  const res = await fetchApi(`/workouts/${workoutId}/exercises`, {
    method: 'POST',
    body: JSON.stringify({ exerciseId, order }),
    token,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Failed to add exercise');
  }
  return res.json();
}

export async function removeWorkoutExercise(
  workoutId: string,
  workoutExerciseId: string,
  token?: string | null
): Promise<void> {
  const res = await fetchApi(`/workouts/${workoutId}/exercises/${workoutExerciseId}`, {
    method: 'DELETE',
    token,
  });
  if (!res.ok) throw new Error('Failed to remove exercise');
}

export async function addSet(
  workoutExerciseId: string,
  body: {
    setNumber?: number;
    reps?: number;
    weightKg?: number;
    durationSeconds?: number;
    distanceMeters?: number;
    completed?: boolean;
  },
  token?: string | null
): Promise<import('../types').Set> {
  const res = await fetchApi(`/workout-exercises/${workoutExerciseId}/sets`, {
    method: 'POST',
    body: JSON.stringify(body),
    token,
  });
  if (!res.ok) throw new Error('Failed to add set');
  return res.json();
}

export async function updateSet(
  id: string,
  body: Partial<import('../types').Set>,
  token?: string | null
): Promise<import('../types').Set> {
  const res = await fetchApi(`/sets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    token,
  });
  if (!res.ok) throw new Error('Failed to update set');
  return res.json();
}

export async function deleteSet(id: string, token?: string | null): Promise<void> {
  const res = await fetchApi(`/sets/${id}`, { method: 'DELETE', token });
  if (!res.ok) throw new Error('Failed to delete set');
}

export interface ProgressHistoryEntry {
  workoutId: string;
  workoutName: string | null;
  workoutDate: string;
  sets: Array<{
    id: string;
    setNumber: number;
    reps: number | null;
    weightKg: number | null;
    durationSeconds: number | null;
    distanceMeters: number | null;
    completed: boolean;
    createdAt: string;
  }>;
  bestSet: { reps: number; weightKg: number } | null;
  totalVolume: number;
}

export async function getMemberProgress(
  memberId: string,
  exerciseId: string,
  token?: string | null
): Promise<ProgressHistoryEntry[]> {
  const res = await fetchApi(
    `/members/${memberId}/progress/${exerciseId}`,
    { token }
  );
  if (!res.ok) throw new Error('Failed to fetch progress');
  return res.json();
}

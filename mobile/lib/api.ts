/**
 * API client for GymApp.
 *
 * The mobile app talks to the Express API only — it does NOT access Supabase directly.
 *
 * - __DEV__ (local): EXPO_PUBLIC_API_URL or fallback to localhost (Simulator). For physical
 *   device, set EXPO_PUBLIC_API_URL to your Mac's LAN IP in .env (e.g. http://192.168.1.5:3001).
 * - Production: Railway URL
 */
const API_URL_DEV =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) ||
  'http://localhost:3001';
const API_URL_PROD = 'https://horizen-production.up.railway.app';

const BASE_URL = __DEV__
  ? 'http://192.168.x.x:3001'
  : 'https://horizen-production.up.railway.app'

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
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch (e) {
    throw new Error(
      'Cannot reach API. On a physical device? Set EXPO_PUBLIC_API_URL to your Mac IP (e.g. http://192.168.1.5:3001) in .env'
    );
  }
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
    const msg = err.detail ? `${err.error || 'Login failed'}: ${err.detail}` : (err.error || 'Login failed');
    throw new Error(msg);
  }
  return res.json();
}

export async function updateProfile(
  updates: { name?: string; email?: string; avatarUrl?: string | null },
  token?: string | null
): Promise<Member> {
  const res = await fetchApi('/members/me', {
    method: 'PATCH',
    body: JSON.stringify(updates),
    token,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Failed to update profile');
  }
  return res.json();
}

export async function uploadAvatar(uri: string, token: string | null): Promise<Member> {
  const formData = new FormData();
  formData.append('avatar', {
    uri,
    name: 'avatar.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);

  const headers: HeadersInit = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // Do not set Content-Type; fetch sets multipart boundary

  const res = await fetch(`${BASE_URL}/members/me/avatar`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Failed to upload avatar');
  }
  return res.json();
}

export interface FundData {
  target: number;
  raised: number;
  donateUrl: string;
  visible: boolean;
}

export async function getFund(): Promise<FundData> {
  const res = await fetch(`${BASE_URL}/fund`);
  if (!res.ok) throw new Error('Failed to fetch fund');
  return res.json();
}

export async function updateFund(
  body: { raised?: number; visible?: boolean },
  token?: string | null
): Promise<{ raised: number; visible: boolean }> {
  const res = await fetchApi('/fund', {
    method: 'PATCH',
    body: JSON.stringify(body),
    token,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Failed to update fund');
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

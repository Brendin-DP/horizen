import type { FeatureRequestTag, FeatureRequestStatus } from '../types';

/**
 * API client for GymApp.
 *
 * - __DEV__: EXPO_PUBLIC_API_URL or http://localhost:3001 (works for Simulator)
 *   Physical device: set EXPO_PUBLIC_API_URL to your Mac's LAN IP in .env
 * - Production: Railway URL
 */
const API_URL_DEV =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) ||
  'http://localhost:3001';
const API_URL_PROD = 'https://horizen-production.up.railway.app';
const BASE_URL = typeof __DEV__ !== 'undefined' && __DEV__ ? API_URL_DEV : API_URL_PROD;

const REQUEST_TIMEOUT_MS = 10000;

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
  avatarUrl?: string | null;
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeout);
    const isAbort = e instanceof Error && e.name === 'AbortError';
    throw new Error(
      isAbort
        ? 'Connection timeout. Ensure the API is running at ' + BASE_URL
        : 'Cannot reach API. Check that the API is running.'
    );
  } finally {
    clearTimeout(timeout);
  }
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timeout);
    const isAbort = e instanceof Error && e.name === 'AbortError';
    throw new Error(
      isAbort
        ? 'Connection timeout. Ensure the API is running at ' + BASE_URL
        : 'Cannot reach API. On physical device? Set EXPO_PUBLIC_API_URL to your Mac IP (e.g. http://192.168.1.5:3001) in .env'
    );
  } finally {
    clearTimeout(timeout);
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

export async function changePassword(
  {
    currentPassword,
    newPassword,
  }: {
    currentPassword: string;
    newPassword: string;
  },
  token?: string | null
): Promise<void> {
  const res = await fetchApi('/members/me/password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
    token,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
    const msg = err.detail
      ? `${err.error || 'Failed to change password'}: ${err.detail}`
      : err.error || 'Failed to change password';
    throw new Error(msg);
  }
}

export async function submitFeatureRequest(
  payload: { title: string; description: string },
  token?: string | null
): Promise<void> {
  const res = await fetchApi('/feature-requests', {
    method: 'POST',
    body: JSON.stringify(payload),
    token,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || 'Failed to submit request');
  }
}

export interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  tag: FeatureRequestTag;
  status: FeatureRequestStatus;
  upvotes: number;
  hasVoted: boolean;
  createdAt: string;
}

export async function getRoadmap(memberId: string): Promise<RoadmapItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(
      `${BASE_URL}/feature-requests/roadmap?memberId=${encodeURIComponent(memberId)}`,
      { signal: controller.signal }
    );
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error || 'Failed to fetch roadmap');
    }
    return res.json();
  } catch (e) {
    const isAbort = e instanceof Error && e.name === 'AbortError';
    if (isAbort) {
      throw new Error(
        'Connection timeout. Ensure the API is running at ' + BASE_URL
      );
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

export async function voteOnRequest(
  featureRequestId: string,
  memberId: string
): Promise<{ hasVoted: boolean; upvotes: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/feature-requests/${featureRequestId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error || 'Failed to vote');
    }
    return res.json();
  } catch (e) {
    const isAbort = e instanceof Error && e.name === 'AbortError';
    if (isAbort) {
      throw new Error(
        'Connection timeout. Ensure the API is running at ' + BASE_URL
      );
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
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
  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(rest.headers as Record<string, string>),
    },
  });
  // #region agent log
  if (res.status === 401) {
    fetch('http://127.0.0.1:7613/ingest/647d3ca5-187f-4bcf-aae1-ccc3f04a480d', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '7fe38e' },
      body: JSON.stringify({
        sessionId: '7fe38e',
        location: 'api.ts:fetchApi:401',
        message: 'API 401 from fetchApi',
        data: {
          hypothesisId: 'H-client',
          path,
          baseUrl: BASE_URL.slice(0, 48),
          sentAuthHeader: !!token,
          tokenLen: token?.length ?? 0,
        },
        timestamp: Date.now(),
        hypothesisId: 'H-client',
      }),
    }).catch(() => {});
  }
  // #endregion
  return res;
}

export interface MuscleGroupsResponse {
  flat: import('../types').MuscleGroup[];
  grouped: Record<string, { id: string; name: string }[]>;
}

export async function getMuscleGroups(): Promise<MuscleGroupsResponse> {
  const res = await fetch(`${BASE_URL}/muscle-groups`);
  if (!res.ok) throw new Error('Failed to fetch muscle groups');
  return res.json();
}

export async function getExercises(
  category?: import('../types').ExerciseCategory
): Promise<import('../types').Exercise[]> {
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

export async function requestExercise(
  payload: import('../types').ExerciseRequestPayload,
  token: string
): Promise<import('../types').Exercise> {
  const res = await fetchApi('/exercises/request', {
    method: 'POST',
    body: JSON.stringify(payload),
    token,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
    const msg = err.detail ? `${err.error || 'Request failed'}: ${err.detail}` : (err.error || 'Failed to submit request');
    throw new Error(msg);
  }
  return res.json();
}

export async function getWorkouts(userId: string, token?: string | null): Promise<import('../types').Workout[]> {
  const res = await fetchApi(`/workouts?userId=${encodeURIComponent(userId)}`, { token });
  if (!res.ok) throw new Error('Failed to fetch workouts');
  return res.json();
}

export async function getDefaultWorkout(
  userId: string,
  token?: string | null
): Promise<import('../types').WorkoutWithDetails> {
  const res = await fetchApi(`/workouts/default?userId=${encodeURIComponent(userId)}`, { token });
  if (!res.ok) throw new Error('Failed to fetch default workout');
  return res.json();
}

export async function getWorkoutExercise(
  workoutExerciseId: string,
  token?: string | null
): Promise<import('../types').WorkoutExercise> {
  const res = await fetchApi(`/workout-exercises/${workoutExerciseId}`, { token });
  if (!res.ok) throw new Error('Workout exercise not found');
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
    weightKg?: number | null;
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
  sets: import('../types').Set[];
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

/** Sessions (standalone exercise logs, no workout container) */
export async function createSession(
  payload: {
    memberId: string;
    exerciseId: string;
    notes?: string;
    loggedAt?: string;
  },
  token?: string | null
): Promise<import('../types').Session> {
  const res = await fetchApi('/sessions', {
    method: 'POST',
    body: JSON.stringify(payload),
    token,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Failed to create session');
  }
  return res.json();
}

export async function getSessions(
  memberId: string,
  token?: string | null,
  options?: { exerciseId?: string }
): Promise<import('../types').Session[]> {
  const params = new URLSearchParams({ memberId });
  if (options?.exerciseId) params.set('exerciseId', options.exerciseId);
  const res = await fetchApi(`/sessions?${params.toString()}`, { token });
  if (!res.ok) throw new Error('Failed to fetch sessions');
  return res.json();
}

export async function getSession(id: string, token?: string | null): Promise<import('../types').Session> {
  const res = await fetchApi(`/sessions/${id}`, { token });
  if (!res.ok) throw new Error('Session not found');
  return res.json();
}

export async function updateSession(
  sessionId: string,
  body: { loggedAt: string },
  token?: string | null
): Promise<import('../types').Session> {
  const res = await fetchApi(`/sessions/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    token,
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || 'Failed to update session');
  }
  return res.json();
}

export async function deleteSession(id: string, token?: string | null): Promise<void> {
  const res = await fetchApi(`/sessions/${id}`, { method: 'DELETE', token });
  if (!res.ok) throw new Error('Failed to delete session');
}

/** Deletes every standalone session (and sets) for this member + exercise. */
export async function deleteAllSessionsForExercise(
  memberId: string,
  exerciseId: string,
  token?: string | null
): Promise<number> {
  const sessions = await getSessions(memberId, token, { exerciseId });
  for (const s of sessions) {
    await deleteSession(s.id, token);
  }
  return sessions.length;
}

export async function addSetToSession(
  sessionId: string,
  payload: {
    setNumber: number;
    reps?: number;
    weightKg?: number | null;
    durationSeconds?: number;
    distanceMeters?: number;
    completed?: boolean;
  },
  token?: string | null
): Promise<import('../types').Set> {
  const res = await fetchApi(`/sessions/${sessionId}/sets`, {
    method: 'POST',
    body: JSON.stringify(payload),
    token,
  });
  if (!res.ok) throw new Error('Failed to add set');
  return res.json();
}

export async function addSetsBatchToSession(
  sessionId: string,
  sets: Array<{
    setNumber: number;
    reps?: number;
    weightKg?: number | null;
    durationSeconds?: number;
    distanceMeters?: number;
    completed?: boolean;
  }>,
  token?: string | null
): Promise<import('../types').Set[]> {
  const res = await fetchApi(`/sessions/${sessionId}/sets/batch`, {
    method: 'POST',
    body: JSON.stringify({ sets }),
    token,
  });
  if (!res.ok) throw new Error('Failed to add sets');
  return res.json();
}

export async function getLoggedExercises(memberId: string): Promise<import('../types').LoggedExercise[]> {
  const res = await fetch(
    `${BASE_URL}/exercises/logged?memberId=${encodeURIComponent(memberId)}`
  );
  if (!res.ok) throw new Error('Failed to fetch logged exercises');
  return res.json();
}

export async function getExerciseMaxWeight(
  memberId: string,
  exerciseId: string,
  options?: { excludeLogId?: string },
  token?: string | null
): Promise<{ maxWeightKg: number | null }> {
  const params = new URLSearchParams();
  if (options?.excludeLogId) params.set('excludeLogId', options.excludeLogId);
  const q = params.toString() ? `?${params.toString()}` : '';
  const res = await fetchApi(
    `/members/${memberId}/exercise-history/${exerciseId}/max-weight${q}`,
    { token }
  );
  if (!res.ok) throw new Error('Failed to fetch max weight');
  return res.json();
}

export async function getExerciseMaxReps(
  memberId: string,
  exerciseId: string,
  options?: { excludeLogId?: string },
  token?: string | null
): Promise<{ maxReps: number | null }> {
  const params = new URLSearchParams();
  if (options?.excludeLogId) params.set('excludeLogId', options.excludeLogId);
  const q = params.toString() ? `?${params.toString()}` : '';
  const res = await fetchApi(
    `/members/${memberId}/exercise-history/${exerciseId}/max-reps${q}`,
    { token }
  );
  if (!res.ok) throw new Error('Failed to fetch max reps');
  return res.json();
}

export async function getExerciseHistory(
  memberId: string,
  exerciseId: string,
  token?: string | null
): Promise<import('../types').ExerciseHistory[]> {
  const res = await fetchApi(
    `/members/${memberId}/exercise-history/${exerciseId}`,
    { token }
  );
  if (!res.ok) throw new Error('Failed to fetch exercise history');
  return res.json();
}

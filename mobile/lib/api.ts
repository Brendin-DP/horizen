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

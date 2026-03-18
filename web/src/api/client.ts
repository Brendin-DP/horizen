const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
console.log('BASE_URL', BASE_URL)

function headersWithAuth(token: string | null): HeadersInit {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

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

export interface AuthResponse {
  member: Member;
  token: string;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
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

export interface LeaderboardEntry {
  rank: number;
  memberId: string;
  name: string;
  starCount: number;
}

export async function getMembers(
  token: string,
  options?: { role?: string; plan?: string }
): Promise<Member[]> {
  const params = new URLSearchParams();
  if (options?.role) params.set('role', options.role);
  if (options?.plan) params.set('plan', options.plan);
  const q = params.toString() ? `?${params}` : '';
  const res = await fetch(`${BASE_URL}/members${q}`, {
    headers: headersWithAuth(token),
  });
  if (!res.ok) throw new Error('Failed to fetch members');
  return res.json();
}

export async function getLeaderboard(token: string): Promise<LeaderboardEntry[]> {
  const res = await fetch(`${BASE_URL}/leaderboard`, {
    headers: headersWithAuth(token),
  });
  if (!res.ok) throw new Error('Failed to fetch leaderboard');
  return res.json();
}

export async function updateMemberPlan(
  memberId: string,
  plan: string,
  planExpiresAt: string | null,
  token: string
): Promise<Member> {
  return updateMember(memberId, { plan, planExpiresAt }, token);
}

export async function updateMember(
  memberId: string,
  updates: { plan?: string; planExpiresAt?: string | null; role?: 'member' | 'instructor' | 'admin' },
  token: string
): Promise<Member> {
  const res = await fetch(`${BASE_URL}/members/${memberId}`, {
    method: 'PATCH',
    headers: headersWithAuth(token),
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Failed to update member');
  }
  return res.json();
}

export async function createMember(
  data: { name: string; email: string; password: string; role: 'member' | 'instructor' | 'admin' },
  token: string
): Promise<Member> {
  const res = await fetch(`${BASE_URL}/admin/members`, {
    method: 'POST',
    headers: headersWithAuth(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Failed to create user');
  }
  return res.json();
}

export interface Plan {
  id: string;
  name: string;
  priceMonthly: number;
}

export interface Feature {
  id: string;
  name: string;
  description: string;
}

export interface PlanFeature {
  planId: string;
  featureId: string;
  enabled: boolean;
  limit: number | null;
}

export interface AdminConfig {
  plans: Plan[];
  features: Feature[];
  planFeatures: PlanFeature[];
}

export async function getAdminConfig(token: string): Promise<AdminConfig> {
  const res = await fetch(`${BASE_URL}/admin/config`, {
    headers: headersWithAuth(token),
  });
  if (!res.ok) throw new Error('Failed to fetch config');
  return res.json();
}

export async function updatePlanFeatures(
  planFeatures: PlanFeature[],
  token: string
): Promise<PlanFeature[]> {
  const res = await fetch(`${BASE_URL}/admin/plan-features`, {
    method: 'PUT',
    headers: headersWithAuth(token),
    body: JSON.stringify({ planFeatures }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Failed to update plan features');
  }
  return res.json();
}

export interface AdminMetrics {
  activeMembers: number;
  membersByPlan: { free: number; pro: number; elite: number };
  mrr: number;
  arr: number;
  starsThisMonth: number;
}

export async function getAdminMetrics(token: string): Promise<AdminMetrics> {
  const res = await fetch(`${BASE_URL}/admin/metrics`, {
    headers: headersWithAuth(token),
  });
  if (!res.ok) throw new Error('Failed to fetch metrics');
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
  token: string
): Promise<{ raised: number; visible: boolean }> {
  const res = await fetch(`${BASE_URL}/fund`, {
    method: 'PATCH',
    headers: headersWithAuth(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Failed to update fund');
  }
  return res.json();
}

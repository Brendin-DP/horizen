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

export interface LeaderboardEntry {
  rank: number;
  memberId: string;
  name: string;
  starCount: number;
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  const res = await fetch(`${BASE_URL}/leaderboard`);
  if (!res.ok) throw new Error('Failed to fetch leaderboard');
  return res.json();
}

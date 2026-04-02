// Data model types matching API

export type ExerciseUnit = 'weight_reps' | 'time' | 'distance';

export type LoggingType = 'weighted' | 'bodyweight' | 'weighted_or_bodyweight';

export interface Exercise {
  id: string;
  name: string;
  category: string;
  /** Movement pattern (e.g. pull / push). */
  type?: string | null;
  muscleGroups: string[];
  equipment: string | null;
  unit: ExerciseUnit;
  loggingType: LoggingType;
  status?: 'active' | 'requested' | 'rejected';
  requestedBy?: string | null;
  requestNotes?: string | null;
  createdAt: string;
}

/** Body for POST /exercises/request (memberId must match JWT member). */
export interface ExerciseRequestPayload {
  memberId: string;
  name: string;
  category?: string;
  type?: string;
  requestNotes?: string;
}

export interface Workout {
  id: string;
  userId: string;
  name: string | null;
  status: 'in_progress' | 'completed';
  startedAt: string;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface WorkoutExercise {
  id: string;
  workoutId: string;
  exerciseId: string;
  order: number;
  notes: string | null;
  createdAt: string;
  exercise?: Exercise;
  sets?: Set[];
}

export interface Session {
  id: string;
  memberId: string;
  exerciseId: string;
  loggedAt: string;
  notes: string | null;
  createdAt: string;
  exercise?: Exercise;
  sets?: Set[];
}

/** Unique exercise on the exercises tab: from GET /exercises/logged */
export interface LoggedExercise extends Exercise {
  sessionCount: number;
  lastLoggedAt: string | null;
  bestSet: Set | null;
}

export interface ExerciseHistory {
  logId: string;
  loggedAt: string;
  sets: Set[];
  bestSet: {
    reps: number | null;
    weightKg: number | null;
  };
  totalVolume: number;
}

export interface Set {
  id: string;
  workoutExerciseId?: string | null;
  sessionId?: string | null;
  setNumber: number;
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  completed: boolean;
  createdAt: string;
}

export interface WorkoutWithDetails extends Workout {
  workoutExercises: WorkoutExercise[];
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

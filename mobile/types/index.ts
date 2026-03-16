// Data model types matching API

export type ExerciseUnit = 'weight_reps' | 'time' | 'distance';

export interface Exercise {
  id: string;
  name: string;
  category: string;
  muscleGroups: string[];
  equipment: string;
  unit: ExerciseUnit;
  createdAt: string;
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

export interface Set {
  id: string;
  workoutExerciseId: string;
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

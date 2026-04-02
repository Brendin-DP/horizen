// Data model types matching API / Postgres enums (case-sensitive).

export type MemberRole = 'member' | 'instructor' | 'admin';
export type MemberPlan = 'free' | 'pro' | 'elite';

export type ExerciseUnit = 'weight_reps' | 'time' | 'distance';
export type ExerciseLoggingType = 'weighted' | 'bodyweight' | 'weighted_or_bodyweight';
/** @deprecated Use ExerciseLoggingType */
export type LoggingType = ExerciseLoggingType;

export type ExerciseCategory =
  | 'Upper Body'
  | 'Lower Body'
  | 'Full Body'
  | 'Core'
  | 'Cardio'
  | 'Mobility';

export type ExerciseType =
  | 'Push'
  | 'Pull'
  | 'Squat'
  | 'Hinge'
  | 'Lunge'
  | 'Isolation'
  | 'Core'
  | 'Cardio'
  | 'Olympic'
  | 'Compound'
  | 'Carry'
  | 'Mobility'
  | 'Plyometric';

export type ExerciseEquipment = 'Barbell' | 'Dumbbell' | 'Bodyweight' | 'Cable' | 'Machine' | 'Kettlebell';

export type ExerciseStatus = 'active' | 'requested' | 'rejected';

export type MuscleGroup =
  | 'Abs'
  | 'Adductors'
  | 'Ankles'
  | 'Arms'
  | 'Back'
  | 'Biceps'
  | 'Brachialis'
  | 'Calves'
  | 'Chest'
  | 'Core'
  | 'Forearms'
  | 'Front Delts'
  | 'Full Body'
  | 'Glutes'
  | 'Hamstrings'
  | 'Hip Flexors'
  | 'Inner Thighs'
  | 'IT Band'
  | 'Lats'
  | 'Legs'
  | 'Lower Abs'
  | 'Lower Back'
  | 'Lower Chest'
  | 'Obliques'
  | 'Outer Thighs'
  | 'Piriformis'
  | 'Quads'
  | 'Rear Delts'
  | 'Rhomboids'
  | 'Rotator Cuff'
  | 'Shoulders'
  | 'Side Delts'
  | 'Spine'
  | 'Thoracic Spine'
  | 'Traps'
  | 'Triceps'
  | 'Upper Back'
  | 'Upper Chest';

export interface Exercise {
  /** UUID */
  id: string;
  name: string;
  category: ExerciseCategory;
  type: ExerciseType | null;
  muscleGroups: MuscleGroup[];
  equipment: ExerciseEquipment | null;
  unit: ExerciseUnit;
  loggingType: ExerciseLoggingType;
  status?: ExerciseStatus;
  requestedBy?: string | null;
  requestNotes?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
}

/** Body for POST /exercises/request (memberId must match JWT member). */
export interface ExerciseRequestPayload {
  /** UUID */
  memberId: string;
  name: string;
  category?: ExerciseCategory;
  type?: ExerciseType;
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

/** Standalone session set or workout set — use sessionId XOR workoutExerciseId. */
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
  role: MemberRole;
  plan?: MemberPlan;
  planExpiresAt?: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface StarAward {
  id: string;
  memberId: string;
  awardedBy: string;
  reason: string | null;
  createdAt: string;
}

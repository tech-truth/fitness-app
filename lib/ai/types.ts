export type TrainingGoal = "fat_loss" | "muscle_gain" | "strength" | "recomposition" | "general_fitness";

export type WorkoutDraftInput = {
  goal: TrainingGoal;
  experienceLevel: "beginner" | "intermediate" | "advanced";
  trainingDaysPerWeek: number;
  injuries?: string[];
  equipment?: string[];
  notes?: string;
};

export type WorkoutExerciseDraft = {
  name: string;
  sets: number;
  reps: string;
  restSeconds: number;
  notes?: string;
  substitutions?: string[];
};

export type WorkoutDayDraft = {
  title: string;
  focus: string;
  exercises: WorkoutExerciseDraft[];
};

export type WorkoutDraft = {
  title: string;
  goal: TrainingGoal;
  durationWeeks: number;
  difficulty: string;
  days: WorkoutDayDraft[];
  trainerReviewNotes: string[];
};

export type DietDraftInput = {
  calorieTarget: number;
  proteinTargetGrams: number;
  mealCount: number;
  dietaryPreference: string;
  regionalPreference?: string;
  allergies?: string[];
  notes?: string;
};

export type DietMealDraft = {
  title: string;
  foods: Array<{ name: string; quantity: string }>;
  notes?: string;
  alternatives?: string[];
};

export type DietDraft = {
  title: string;
  calorieTarget: number;
  proteinTargetGrams: number;
  meals: DietMealDraft[];
  trainerReviewNotes: string[];
};

export type ProgressSummaryInput = {
  clientName: string;
  goal: TrainingGoal;
  weeks: Array<{
    weekStartDate: string;
    weightKg?: number;
    waistCm?: number;
    adherencePercent?: number;
    notes?: string;
  }>;
};

export type ProgressSummary = {
  summary: string;
  trend: "improving" | "stalled" | "regressing" | "insufficient_data";
  suggestedAdjustments: string[];
  risks: string[];
  trainerReviewNotes: string[];
};

export interface AiProvider {
  generateWorkoutDraft(input: WorkoutDraftInput): Promise<WorkoutDraft>;
  generateDietDraft(input: DietDraftInput): Promise<DietDraft>;
  summarizeWeeklyProgress(input: ProgressSummaryInput): Promise<ProgressSummary>;
}

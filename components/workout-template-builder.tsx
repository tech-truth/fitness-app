"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/env";

type ExerciseDraft = {
  name: string;
  sets: string;
  reps: string;
  restSeconds: string;
  notes: string;
  substitutions: string;
};

type WorkoutDayDraft = {
  title: string;
  focus: string;
  exercises: ExerciseDraft[];
};

type TemplateDraft = {
  name: string;
  goal: string;
  durationWeeks: string;
  difficulty: string;
  days: WorkoutDayDraft[];
};

type WorkoutTemplateBuilderProps = {
  templateId?: string;
};

type WorkoutTemplateEditRow = {
  id: string;
  name: string | null;
  goal: string | null;
  duration_weeks: number | null;
  difficulty: string | null;
  workout_days: Array<{
    id: string;
    day_order: number;
    title: string | null;
    focus: string | null;
    workout_exercises: Array<{
      exercise_order: number;
      name: string | null;
      sets: number | null;
      reps: string | null;
      rest_seconds: number | null;
      notes: string | null;
      substitutions: string[] | null;
    }> | null;
  }> | null;
};

const emptyExercise: ExerciseDraft = {
  name: "",
  sets: "",
  reps: "",
  restSeconds: "",
  notes: "",
  substitutions: "",
};

const initialTemplate: TemplateDraft = {
  name: "",
  goal: "fat_loss",
  durationWeeks: "8",
  difficulty: "beginner",
  days: [
    {
      title: "Day 1",
      focus: "Full body",
      exercises: [{ ...emptyExercise }],
    },
  ],
};

export function WorkoutTemplateBuilder({ templateId }: WorkoutTemplateBuilderProps) {
  const hasConfig = hasSupabaseBrowserConfig();
  const supabase = useMemo(() => (hasConfig ? createSupabaseBrowserClient() : null), [hasConfig]);
  const submitLockRef = useRef(false);
  const [template, setTemplate] = useState<TemplateDraft>(initialTemplate);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(Boolean(templateId));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const isEditing = Boolean(templateId);

  useEffect(() => {
    let isMounted = true;

    async function loadTemplate() {
      if (!templateId) {
        return;
      }

      if (!supabase) {
        setError("Supabase is not configured.");
        setIsLoadingTemplate(false);
        return;
      }

      const { data, error: loadError } = await supabase
        .from("workout_templates")
        .select(
          `
          id,
          name,
          goal,
          duration_weeks,
          difficulty,
          workout_days (
            id,
            day_order,
            title,
            focus,
            workout_exercises (
              exercise_order,
              name,
              sets,
              reps,
              rest_seconds,
              notes,
              substitutions
            )
          )
        `,
        )
        .eq("id", templateId)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      if (loadError || !data) {
        setError(loadError?.message ?? "Workout template not found.");
        setIsLoadingTemplate(false);
        return;
      }

      setTemplate(mapWorkoutTemplateRow(data as unknown as WorkoutTemplateEditRow));
      setIsLoadingTemplate(false);
    }

    loadTemplate();

    return () => {
      isMounted = false;
    };
  }, [supabase, templateId]);

  async function saveTemplate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitLockRef.current || isSaving) {
      return;
    }

    submitLockRef.current = true;
    setError(null);
    setStatus(null);

    if (!supabase) {
      submitLockRef.current = false;
      setError("Supabase is not configured.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      submitLockRef.current = false;
      setError("Sign in as a trainer before creating templates.");
      return;
    }

    const { data: trainer, error: trainerError } = await supabase
      .from("trainers")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (trainerError || !trainer) {
      submitLockRef.current = false;
      setError(trainerError?.message ?? "Complete trainer onboarding before creating templates.");
      return;
    }

    const cleanDays = template.days
      .map((day) => ({
        ...day,
        exercises: day.exercises.filter((exercise) => exercise.name.trim()),
      }))
      .filter((day) => day.title.trim() && day.exercises.length);

    const validationError = validateWorkoutTemplate(template, cleanDays);

    if (validationError) {
      submitLockRef.current = false;
      setError(validationError);
      return;
    }

    setIsSaving(true);

    const templatePayload = {
      name: template.name,
      goal: template.goal,
      duration_weeks: integerOrNull(template.durationWeeks),
      difficulty: template.difficulty,
    };

    const { data: workoutTemplate, error: templateError } = isEditing
      ? await supabase
          .from("workout_templates")
          .update({ ...templatePayload, updated_at: new Date().toISOString() })
          .eq("id", templateId)
          .select("id")
          .single()
      : await supabase
          .from("workout_templates")
          .insert({
            trainer_id: trainer.id,
            ...templatePayload,
          })
          .select("id")
          .single();

    if (templateError) {
      submitLockRef.current = false;
      setIsSaving(false);
      setError(templateError.message);
      return;
    }

    if (isEditing) {
      const { data: existingDays, error: existingDaysError } = await supabase
        .from("workout_days")
        .select("id")
        .eq("workout_template_id", workoutTemplate.id);

      if (existingDaysError) {
        submitLockRef.current = false;
        setIsSaving(false);
        setError(existingDaysError.message);
        return;
      }

      const existingDayIds = (existingDays ?? []).map((day) => day.id);

      if (existingDayIds.length) {
        const { error: exerciseDeleteError } = await supabase
          .from("workout_exercises")
          .delete()
          .in("workout_day_id", existingDayIds);

        if (exerciseDeleteError) {
          submitLockRef.current = false;
          setIsSaving(false);
          setError(exerciseDeleteError.message);
          return;
        }
      }

      const { error: dayDeleteError } = await supabase
        .from("workout_days")
        .delete()
        .eq("workout_template_id", workoutTemplate.id);

      if (dayDeleteError) {
        submitLockRef.current = false;
        setIsSaving(false);
        setError(dayDeleteError.message);
        return;
      }
    }

    for (const [dayIndex, day] of cleanDays.entries()) {
      const { data: workoutDay, error: dayError } = await supabase
        .from("workout_days")
        .insert({
          workout_template_id: workoutTemplate.id,
          day_order: dayIndex + 1,
          title: day.title,
          focus: day.focus || null,
        })
        .select("id")
        .single();

      if (dayError) {
        submitLockRef.current = false;
        setIsSaving(false);
        setError(dayError.message);
        return;
      }

      const exercises = day.exercises.map((exercise, exerciseIndex) => ({
        workout_day_id: workoutDay.id,
        exercise_order: exerciseIndex + 1,
        name: exercise.name,
        sets: integerOrNull(exercise.sets),
        reps: exercise.reps || null,
        rest_seconds: integerOrNull(exercise.restSeconds),
        notes: exercise.notes || null,
        substitutions: splitList(exercise.substitutions),
      }));

      const { error: exerciseError } = await supabase.from("workout_exercises").insert(exercises);

      if (exerciseError) {
        submitLockRef.current = false;
        setIsSaving(false);
        setError(exerciseError.message);
        return;
      }
    }

    submitLockRef.current = false;
    setIsSaving(false);
    setStatus(isEditing ? "Workout template updated." : "Workout template saved.");
    if (!isEditing) {
      setTemplate(initialTemplate);
    }
  }

  function updateTemplate(field: keyof Omit<TemplateDraft, "days">, value: string) {
    setTemplate((current) => ({ ...current, [field]: value }));
  }

  function updateDay(dayIndex: number, field: keyof Omit<WorkoutDayDraft, "exercises">, value: string) {
    setTemplate((current) => ({
      ...current,
      days: current.days.map((day, index) => (index === dayIndex ? { ...day, [field]: value } : day)),
    }));
  }

  function updateExercise(dayIndex: number, exerciseIndex: number, field: keyof ExerciseDraft, value: string) {
    setTemplate((current) => ({
      ...current,
      days: current.days.map((day, currentDayIndex) =>
        currentDayIndex === dayIndex
          ? {
              ...day,
              exercises: day.exercises.map((exercise, currentExerciseIndex) =>
                currentExerciseIndex === exerciseIndex ? { ...exercise, [field]: value } : exercise,
              ),
            }
          : day,
      ),
    }));
  }

  function addDay() {
    setTemplate((current) => ({
      ...current,
      days: [
        ...current.days,
        {
          title: `Day ${current.days.length + 1}`,
          focus: "",
          exercises: [{ ...emptyExercise }],
        },
      ],
    }));
  }

  function addExercise(dayIndex: number) {
    setTemplate((current) => ({
      ...current,
      days: current.days.map((day, index) =>
        index === dayIndex ? { ...day, exercises: [...day.exercises, { ...emptyExercise }] } : day,
      ),
    }));
  }

  function removeDay(dayIndex: number) {
    setTemplate((current) => ({
      ...current,
      days: current.days.filter((_, index) => index !== dayIndex),
    }));
  }

  function removeExercise(dayIndex: number, exerciseIndex: number) {
    setTemplate((current) => ({
      ...current,
      days: current.days.map((day, index) =>
        index === dayIndex
          ? { ...day, exercises: day.exercises.filter((_, currentExerciseIndex) => currentExerciseIndex !== exerciseIndex) }
          : day,
      ),
    }));
  }

  return (
    <main className="min-h-screen bg-stone-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-5xl px-5 py-4">
          <Link href={isEditing ? "/templates/workouts" : "/dashboard"} className="text-sm font-medium text-emerald-700">
            {isEditing ? "Back to workouts" : "Back to dashboard"}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-950">
            {isEditing ? "Edit workout template" : "New workout template"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            {isEditing ? "Update this reusable workout structure." : "Create a reusable plan structure you can assign and customize later."}
          </p>
        </div>
      </header>

      <form onSubmit={saveTemplate} className="mx-auto max-w-5xl space-y-6 px-5 py-6">
        {error ? <p className="rounded-md bg-rose-50 p-3 text-sm leading-6 text-rose-800">{error}</p> : null}
        {status ? <p className="rounded-md bg-emerald-50 p-3 text-sm leading-6 text-emerald-800">{status}</p> : null}
        {!hasConfig ? (
          <p className="rounded-md bg-amber-50 p-3 text-sm leading-6 text-amber-900">Supabase is not configured.</p>
        ) : null}
        {isLoadingTemplate ? (
          <p className="rounded-md border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">Loading template</p>
        ) : null}

        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-zinc-950">Template details</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Template name" value={template.name} onChange={(value) => updateTemplate("name", value)} />
            <SelectField
              label="Goal"
              value={template.goal}
              onChange={(value) => updateTemplate("goal", value)}
              options={[
                ["fat_loss", "Fat loss"],
                ["muscle_gain", "Muscle gain"],
                ["strength", "Strength"],
                ["recomposition", "Recomposition"],
                ["general_fitness", "General fitness"],
              ]}
            />
            <Field label="Duration weeks" type="number" value={template.durationWeeks} onChange={(value) => updateTemplate("durationWeeks", value)} />
            <SelectField
              label="Difficulty"
              value={template.difficulty}
              onChange={(value) => updateTemplate("difficulty", value)}
              options={[
                ["beginner", "Beginner"],
                ["intermediate", "Intermediate"],
                ["advanced", "Advanced"],
              ]}
            />
          </div>
        </section>

        {template.days.map((day, dayIndex) => (
          <section key={dayIndex} className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-zinc-950">Workout day {dayIndex + 1}</h2>
              <button
                type="button"
                onClick={() => removeDay(dayIndex)}
                disabled={template.days.length === 1}
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Remove day
              </button>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Day title" value={day.title} onChange={(value) => updateDay(dayIndex, "title", value)} />
              <Field label="Focus" value={day.focus} onChange={(value) => updateDay(dayIndex, "focus", value)} />
            </div>

            <div className="mt-5 space-y-4">
              {day.exercises.map((exercise, exerciseIndex) => (
                <div key={exerciseIndex} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-zinc-950">Exercise {exerciseIndex + 1}</p>
                    <button
                      type="button"
                      onClick={() => removeExercise(dayIndex, exerciseIndex)}
                      disabled={day.exercises.length === 1}
                      className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <Field label="Name" value={exercise.name} onChange={(value) => updateExercise(dayIndex, exerciseIndex, "name", value)} />
                    <Field
                      label="Sets"
                      type="number"
                      value={exercise.sets}
                      onChange={(value) => updateExercise(dayIndex, exerciseIndex, "sets", value)}
                    />
                    <Field label="Reps" value={exercise.reps} onChange={(value) => updateExercise(dayIndex, exerciseIndex, "reps", value)} />
                    <Field
                      label="Rest seconds"
                      type="number"
                      value={exercise.restSeconds}
                      onChange={(value) => updateExercise(dayIndex, exerciseIndex, "restSeconds", value)}
                    />
                    <Field
                      label="Substitutions"
                      value={exercise.substitutions}
                      onChange={(value) => updateExercise(dayIndex, exerciseIndex, "substitutions", value)}
                    />
                  </div>
                  <label className="mt-4 block">
                    <span className="text-sm font-medium text-zinc-700">Notes</span>
                    <textarea
                      value={exercise.notes}
                      onChange={(event) => updateExercise(dayIndex, exerciseIndex, "notes", event.target.value)}
                      className="mt-2 min-h-20 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900"
                    />
                  </label>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => addExercise(dayIndex)}
              className="mt-4 rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Add exercise
            </button>
          </section>
        ))}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={addDay}
            className="rounded-md border border-zinc-300 bg-white px-4 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Add day
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-md bg-zinc-950 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving" : isEditing ? "Update template" : "Save template"}
          </button>
        </div>
      </form>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number";
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-900"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-900"
      >
        {options.map(([optionValue, label]) => (
          <option key={optionValue} value={optionValue}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

function mapWorkoutTemplateRow(row: WorkoutTemplateEditRow): TemplateDraft {
  const days = (row.workout_days ?? [])
    .toSorted((a, b) => a.day_order - b.day_order)
    .map((day) => ({
      title: day.title ?? `Day ${day.day_order}`,
      focus: day.focus ?? "",
      exercises: (day.workout_exercises ?? [])
        .toSorted((a, b) => a.exercise_order - b.exercise_order)
        .map((exercise) => ({
          name: exercise.name ?? "",
          sets: exercise.sets?.toString() ?? "",
          reps: exercise.reps ?? "",
          restSeconds: exercise.rest_seconds?.toString() ?? "",
          notes: exercise.notes ?? "",
          substitutions: exercise.substitutions?.join(", ") ?? "",
        })),
    }));

  return {
    name: row.name ?? "",
    goal: row.goal ?? "fat_loss",
    durationWeeks: row.duration_weeks?.toString() ?? "8",
    difficulty: row.difficulty ?? "beginner",
    days: days.length ? days : initialTemplate.days,
  };
}

function integerOrNull(value: string) {
  return value.trim() ? Math.round(Number(value)) : null;
}

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function validateWorkoutTemplate(template: TemplateDraft, cleanDays: WorkoutDayDraft[]) {
  if (!template.name.trim()) {
    return "Template name is required.";
  }

  if (!cleanDays.length) {
    return "At least one workout day with one exercise is required.";
  }

  const durationWeeks = Number(template.durationWeeks);

  if (!Number.isFinite(durationWeeks) || durationWeeks < 1 || durationWeeks > 104) {
    return "Duration must be between 1 and 104 weeks.";
  }

  for (const day of cleanDays) {
    for (const exercise of day.exercises) {
      const sets = Number(exercise.sets);

      if (!Number.isFinite(sets) || sets < 1 || sets > 20) {
        return `Sets for ${exercise.name} must be between 1 and 20.`;
      }

      if (!exercise.reps.trim()) {
        return `Reps are required for ${exercise.name}.`;
      }

      if (exercise.restSeconds.trim()) {
        const restSeconds = Number(exercise.restSeconds);

        if (!Number.isFinite(restSeconds) || restSeconds < 0 || restSeconds > 600) {
          return `Rest seconds for ${exercise.name} must be between 0 and 600.`;
        }
      }
    }
  }

  return null;
}

"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/env";

type MemberHomeState = {
  memberName: string;
  trainerName: string;
  trainerClientId: string | null;
  latestCheckin: string;
  assignedPlan: AssignedPlanView | null;
  isLoading: boolean;
  error: string | null;
};

const initialState: MemberHomeState = {
  memberName: "Member",
  trainerName: "Not connected",
  trainerClientId: null,
  latestCheckin: "No check-ins yet",
  assignedPlan: null,
  isLoading: true,
  error: null,
};

type RelationshipRow = {
  id: string;
  trainers:
    | {
        profiles:
          | {
              full_name: string | null;
            }
          | Array<{
              full_name: string | null;
            }>
          | null;
      }
    | Array<{
        profiles:
          | {
              full_name: string | null;
            }
          | Array<{
              full_name: string | null;
            }>
          | null;
      }>
    | null;
};

type AssignedPlanView = {
  workout: {
    name: string;
    meta: string;
    days: Array<{
      title: string;
      focus: string;
      exercises: Array<{
        name: string;
        prescription: string;
      }>;
    }>;
  } | null;
  diet: {
    name: string;
    meta: string;
    generalInstructions: string;
    meals: Array<{
      title: string;
      notes: string;
      foods: Array<{
        name: string;
        quantity: string;
      }>;
    }>;
  } | null;
};

type AssignedPlanRow = {
  workout_templates:
    | {
        name: string | null;
        goal: string | null;
        difficulty: string | null;
        duration_weeks: number | null;
        workout_days: Array<{
          day_order: number;
          title: string | null;
          focus: string | null;
          workout_exercises: Array<{
            exercise_order: number;
            name: string | null;
            sets: number | null;
            reps: string | null;
            rest_seconds: number | null;
          }> | null;
        }> | null;
      }
    | Array<{
        name: string | null;
        goal: string | null;
        difficulty: string | null;
        duration_weeks: number | null;
        workout_days: Array<{
          day_order: number;
          title: string | null;
          focus: string | null;
          workout_exercises: Array<{
            exercise_order: number;
            name: string | null;
            sets: number | null;
            reps: string | null;
            rest_seconds: number | null;
          }> | null;
        }> | null;
      }>
    | null;
  diet_templates:
    | {
        name: string | null;
        calorie_target: number | null;
        protein_target_grams: number | null;
        meal_count: number | null;
        dietary_preference: string | null;
        general_instructions: string | null;
        meals: Array<{
          meal_order: number;
          title: string | null;
          notes: string | null;
          meal_foods: Array<{
            food_order: number;
            name: string | null;
            quantity: string | null;
          }> | null;
        }> | null;
      }
    | Array<{
        name: string | null;
        calorie_target: number | null;
        protein_target_grams: number | null;
        meal_count: number | null;
        dietary_preference: string | null;
        general_instructions: string | null;
        meals: Array<{
          meal_order: number;
          title: string | null;
          notes: string | null;
          meal_foods: Array<{
            food_order: number;
            name: string | null;
            quantity: string | null;
          }> | null;
        }> | null;
      }>
    | null;
};

export function MemberHome() {
  const hasConfig = hasSupabaseBrowserConfig();
  const supabase = useMemo(() => (hasConfig ? createSupabaseBrowserClient() : null), [hasConfig]);
  const [state, setState] = useState<MemberHomeState>(initialState);

  useEffect(() => {
    let isMounted = true;

    async function loadMemberHome() {
      if (!supabase) {
        setState({ ...initialState, isLoading: false, error: "Supabase is not configured." });
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setState({ ...initialState, isLoading: false, error: "Sign in as a member to view your workspace." });
        return;
      }

      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      const { data: member } = await supabase.from("members").select("id").eq("profile_id", user.id).maybeSingle();

      if (!member) {
        setState({ ...initialState, memberName: profile?.full_name ?? "Member", isLoading: false, error: "Complete member onboarding first." });
        return;
      }

      const { data: relationship, error: relationshipError } = await supabase
        .from("trainer_clients")
        .select("id, trainers(profiles(full_name))")
        .eq("member_id", member.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (relationshipError) {
        setState({ ...initialState, isLoading: false, error: relationshipError.message });
        return;
      }

      const normalizedRelationship = relationship as unknown as RelationshipRow | null;
      const trainer = normalizeTrainer(normalizedRelationship?.trainers ?? null);
      const trainerProfile = normalizeProfile(trainer?.profiles ?? null);
      const latestCheckin = normalizedRelationship
        ? await loadLatestCheckinLabel(supabase, normalizedRelationship.id)
        : "Join a trainer to submit check-ins";
      const assignedPlan = normalizedRelationship ? await loadAssignedPlan(supabase, normalizedRelationship.id) : null;

      if (!isMounted) {
        return;
      }

      setState({
        memberName: profile?.full_name ?? "Member",
        trainerName: trainerProfile?.full_name ?? "Not connected",
        trainerClientId: normalizedRelationship?.id ?? null,
        latestCheckin,
        assignedPlan,
        isLoading: false,
        error: null,
      });
    }

    loadMemberHome();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  return (
    <main className="min-h-screen bg-stone-50 px-5 py-6">
      <section className="mx-auto max-w-4xl rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-emerald-700">Member workspace</p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-950">Today&apos;s coaching plan</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
          Track your weekly progress and keep your trainer updated from one lightweight workspace.
        </p>

        {state.error ? (
          <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
            {state.error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            ["Member", state.memberName],
            ["Trainer", state.trainerName],
            ["Latest check-in", state.isLoading ? "Loading" : state.latestCheckin],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <p className="text-xs font-medium uppercase text-zinc-500">{label}</p>
              <p className="mt-2 text-sm font-medium text-zinc-950">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/member/check-in"
            className="rounded-md bg-zinc-950 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Weekly check-in
          </Link>
          {state.trainerClientId ? (
            <Link
              href={`/clients/${state.trainerClientId}`}
              className="rounded-md border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              View trainer review
            </Link>
          ) : null}
        </div>
      </section>

      <section className="mx-auto mt-6 grid max-w-4xl gap-6 lg:grid-cols-2">
        <PlanCard title="Workout plan" emptyText="No workout plan assigned yet.">
          {state.assignedPlan?.workout ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-950">{state.assignedPlan.workout.name}</h2>
                <p className="mt-1 text-sm text-zinc-500">{state.assignedPlan.workout.meta}</p>
              </div>
              {state.assignedPlan.workout.days.map((day) => (
                <div key={day.title} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                  <p className="font-medium text-zinc-950">{day.title}</p>
                  <p className="mt-1 text-sm text-zinc-500">{day.focus}</p>
                  <div className="mt-3 space-y-2">
                    {day.exercises.map((exercise) => (
                      <div key={exercise.name} className="rounded-md bg-white p-3 text-sm">
                        <p className="font-medium text-zinc-900">{exercise.name}</p>
                        <p className="mt-1 text-zinc-600">{exercise.prescription}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </PlanCard>

        <PlanCard title="Diet plan" emptyText="No diet plan assigned yet.">
          {state.assignedPlan?.diet ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-950">{state.assignedPlan.diet.name}</h2>
                <p className="mt-1 text-sm text-zinc-500">{state.assignedPlan.diet.meta}</p>
              </div>
              {state.assignedPlan.diet.generalInstructions ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs font-medium uppercase text-emerald-800">Daily instructions</p>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-emerald-950">
                    {state.assignedPlan.diet.generalInstructions}
                  </p>
                </div>
              ) : null}
              {state.assignedPlan.diet.meals.map((meal) => (
                <div key={meal.title} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                  <p className="font-medium text-zinc-950">{meal.title}</p>
                  {meal.notes ? <p className="mt-1 text-sm text-zinc-500">{meal.notes}</p> : null}
                  <div className="mt-3 space-y-2">
                    {meal.foods.map((food) => (
                      <div key={`${meal.title}-${food.name}`} className="flex justify-between gap-3 rounded-md bg-white p-3 text-sm">
                        <p className="font-medium text-zinc-900">{food.name}</p>
                        <p className="text-zinc-600">{food.quantity}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </PlanCard>
      </section>
    </main>
  );
}

async function loadLatestCheckinLabel(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  trainerClientId: string,
) {
  const { data } = await supabase
    .from("progress_checkins")
    .select("week_start_date")
    .eq("trainer_client_id", trainerClientId)
    .order("week_start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.week_start_date ? formatDate(data.week_start_date) : "No check-ins yet";
}

async function loadAssignedPlan(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  trainerClientId: string,
): Promise<AssignedPlanView | null> {
  const { data } = await supabase
    .from("assigned_plans")
    .select(
      `
      workout_templates (
        name,
        goal,
        difficulty,
        duration_weeks,
        workout_days (
          day_order,
          title,
          focus,
          workout_exercises (
            exercise_order,
            name,
            sets,
            reps,
            rest_seconds
          )
        )
      ),
      diet_templates (
        name,
        calorie_target,
        protein_target_grams,
        meal_count,
        dietary_preference,
        general_instructions,
        meals (
          meal_order,
          title,
          notes,
          meal_foods (
            food_order,
            name,
            quantity
          )
        )
      )
    `,
    )
    .eq("trainer_client_id", trainerClientId)
    .eq("active", true)
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return null;
  }

  const row = data as unknown as AssignedPlanRow;
  const workout = normalizeSingle(row.workout_templates);
  const diet = normalizeSingle(row.diet_templates);

  return {
    workout: workout
      ? {
          name: workout.name ?? "Workout plan",
          meta: [
            workout.goal ? workout.goal.replaceAll("_", " ") : null,
            workout.difficulty,
            workout.duration_weeks ? `${workout.duration_weeks} weeks` : null,
          ]
            .filter(Boolean)
            .join(" · "),
          days: (workout.workout_days ?? [])
            .toSorted((a, b) => a.day_order - b.day_order)
            .map((day) => ({
              title: day.title ?? `Day ${day.day_order}`,
              focus: day.focus ?? "Workout",
              exercises: (day.workout_exercises ?? [])
                .toSorted((a, b) => a.exercise_order - b.exercise_order)
                .map((exercise) => ({
                  name: exercise.name ?? "Exercise",
                  prescription: formatExercisePrescription(exercise.sets, exercise.reps, exercise.rest_seconds),
                })),
            })),
        }
      : null,
    diet: diet
      ? {
          name: diet.name ?? "Diet plan",
          meta: [
            diet.calorie_target ? `${diet.calorie_target} kcal` : null,
            diet.protein_target_grams ? `${diet.protein_target_grams} g protein` : null,
            diet.meal_count ? `${diet.meal_count} meals` : null,
            diet.dietary_preference ? diet.dietary_preference.replaceAll("_", " ") : null,
          ]
            .filter(Boolean)
            .join(" · "),
          generalInstructions: diet.general_instructions ?? "",
          meals: (diet.meals ?? [])
            .toSorted((a, b) => a.meal_order - b.meal_order)
            .map((meal) => ({
              title: meal.title ?? `Meal ${meal.meal_order}`,
              notes: meal.notes ?? "",
              foods: (meal.meal_foods ?? [])
                .toSorted((a, b) => a.food_order - b.food_order)
                .map((food) => ({
                  name: food.name ?? "Food",
                  quantity: food.quantity ?? "",
                })),
            })),
        }
      : null,
  };
}

function PlanCard({
  title,
  emptyText,
  children,
}: {
  title: string;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      {children ? (
        children
      ) : (
        <>
          <h2 className="text-lg font-semibold text-zinc-950">{title}</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-600">{emptyText}</p>
        </>
      )}
    </section>
  );
}

function normalizeSingle<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function formatExercisePrescription(sets: number | null, reps: string | null, restSeconds: number | null) {
  const parts = [sets ? `${sets} sets` : null, reps ? `${reps} reps` : null, restSeconds ? `${restSeconds}s rest` : null].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Follow trainer notes";
}

function normalizeTrainer(trainer: RelationshipRow["trainers"]) {
  return Array.isArray(trainer) ? trainer[0] ?? null : trainer;
}

function normalizeProfile(profile: NonNullable<ReturnType<typeof normalizeTrainer>>["profiles"] | null) {
  return Array.isArray(profile) ? profile[0] ?? null : profile;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

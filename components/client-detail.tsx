"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/env";

type ClientDetailState = {
  client: {
    name: string;
    goal: string;
    status: string;
    age: string;
    gender: string;
    height: string;
    currentWeight: string;
    dietaryPreference: string;
    injuries: string;
  } | null;
  latestCheckin: {
    weekStartDate: string;
    weight: string;
    adherence: string;
    notes: string;
    measurements: Array<{ label: string; value: string }>;
    photoCount: number;
    photos: Array<{
      id: string;
      label: string;
      signedUrl: string;
    }>;
  } | null;
  assignedPlan: {
    workoutTemplateId: string | null;
    dietTemplateId: string | null;
    workoutTemplate: string;
    dietTemplate: string;
    assignedAt: string;
  } | null;
  workoutTemplates: WorkoutTemplateOption[];
  dietTemplates: DietTemplateOption[];
  selectedWorkoutTemplateId: string;
  selectedDietTemplateId: string;
  canAssignPlans: boolean;
  aiSuggestions: Array<{
    id: string;
    type: string;
    status: string;
    createdAt: string;
    output: AiSummaryOutput | null;
  }>;
  isLoading: boolean;
  error: string | null;
  assignmentError: string | null;
  assignmentStatus: string | null;
  isAssigningPlan: boolean;
  aiError: string | null;
  isGeneratingSummary: boolean;
};

const initialState: ClientDetailState = {
  client: null,
  latestCheckin: null,
  assignedPlan: null,
  workoutTemplates: [],
  dietTemplates: [],
  selectedWorkoutTemplateId: "",
  selectedDietTemplateId: "",
  canAssignPlans: false,
  aiSuggestions: [],
  isLoading: true,
  error: null,
  assignmentError: null,
  assignmentStatus: null,
  isAssigningPlan: false,
  aiError: null,
  isGeneratingSummary: false,
};

type AiSummaryOutput = {
  summary?: string;
  trend?: string;
  suggestedAdjustments?: string[];
  risks?: string[];
  trainerReviewNotes?: string[];
};

type TrainerClientRow = {
  id: string;
  status: string;
  members:
    | {
        age: number | null;
        gender: string | null;
        height_cm: number | null;
        current_weight_kg: number | null;
        goal: string | null;
        injuries: string[] | null;
        dietary_preference: string | null;
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
        age: number | null;
        gender: string | null;
        height_cm: number | null;
        current_weight_kg: number | null;
        goal: string | null;
        injuries: string[] | null;
        dietary_preference: string | null;
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

type CheckinRow = {
  id: string;
  week_start_date: string;
  weight_kg: number | null;
  adherence_percent: number | null;
  notes: string | null;
  progress_measurements:
    | {
        chest_cm: number | null;
        waist_cm: number | null;
        hip_cm: number | null;
        glutes_cm: number | null;
        arm_cm: number | null;
        thigh_cm: number | null;
        calf_cm: number | null;
      }
    | Array<{
        chest_cm: number | null;
        waist_cm: number | null;
        hip_cm: number | null;
        glutes_cm: number | null;
        arm_cm: number | null;
        thigh_cm: number | null;
        calf_cm: number | null;
      }>
    | null;
  progress_photos: Array<{ id: string; storage_path: string; photo_label: string | null }> | null;
};

type AssignedPlanRow = {
  assigned_at: string;
  workout_template_id: string | null;
  diet_template_id: string | null;
  workout_templates:
    | {
        name: string | null;
      }
    | Array<{
        name: string | null;
      }>
    | null;
  diet_templates:
    | {
        name: string | null;
      }
    | Array<{
        name: string | null;
      }>
    | null;
};

type WorkoutTemplateOption = {
  id: string;
  name: string;
  goal: string | null;
  difficulty: string | null;
  duration_weeks: number | null;
  workout_days: Array<{ id: string }> | null;
};

type DietTemplateOption = {
  id: string;
  name: string;
  calorie_target: number | null;
  protein_target_grams: number | null;
  meal_count: number | null;
  dietary_preference: string | null;
};

type AiSuggestionRow = {
  id: string;
  suggestion_type: string;
  status: string;
  created_at: string;
  output?: AiSummaryOutput | null;
};

export function ClientDetail({ trainerClientId }: { trainerClientId: string }) {
  const hasConfig = hasSupabaseBrowserConfig();
  const supabase = useMemo(() => (hasConfig ? createSupabaseBrowserClient() : null), [hasConfig]);
  const [state, setState] = useState<ClientDetailState>(initialState);

  useEffect(() => {
    let isMounted = true;

    async function loadClient() {
      if (!supabase) {
        setState({ ...initialState, isLoading: false, error: "Supabase is not configured." });
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setState({ ...initialState, isLoading: false, error: "Sign in as a trainer to view client details." });
        return;
      }

      const { data: relationship, error: relationshipError } = await supabase
        .from("trainer_clients")
        .select(
          `
          id,
          status,
          members (
            age,
            gender,
            height_cm,
            current_weight_kg,
            goal,
            injuries,
            dietary_preference,
            profiles (
              full_name
            )
          )
        `,
        )
        .eq("id", trainerClientId)
        .maybeSingle();

      if (relationshipError) {
        setState({ ...initialState, isLoading: false, error: relationshipError.message });
        return;
      }

      if (!relationship) {
        setState({ ...initialState, isLoading: false, error: "Client relationship not found." });
        return;
      }

      const { data: trainer } = await supabase.from("trainers").select("id").eq("profile_id", user.id).maybeSingle();
      const [{ data: checkins, error: checkinsError }, { data: assignedPlans, error: assignedPlansError }, { data: aiRows }] =
        await Promise.all([
          supabase
            .from("progress_checkins")
            .select(
              `
              id,
              week_start_date,
              weight_kg,
              adherence_percent,
              notes,
              progress_measurements (
                chest_cm,
                waist_cm,
                hip_cm,
                glutes_cm,
                arm_cm,
                thigh_cm,
                calf_cm
              ),
              progress_photos (
                id,
                storage_path,
                photo_label
              )
            `,
            )
            .eq("trainer_client_id", trainerClientId)
            .order("week_start_date", { ascending: false })
            .limit(1),
          supabase
            .from("assigned_plans")
            .select(
              `
              workout_template_id,
              diet_template_id,
              assigned_at,
              workout_templates (
                name
              ),
              diet_templates (
                name
              )
            `,
            )
            .eq("trainer_client_id", trainerClientId)
            .eq("active", true)
            .order("assigned_at", { ascending: false })
            .limit(1),
          supabase
            .from("ai_suggestions")
            .select("id, suggestion_type, status, created_at, output")
            .eq("trainer_client_id", trainerClientId)
            .order("created_at", { ascending: false })
            .limit(5),
        ]);
      const { data: workoutTemplates, error: workoutTemplatesError } = trainer
        ? await supabase
            .from("workout_templates")
            .select("id, name, goal, difficulty, duration_weeks, workout_days(id)")
            .order("created_at", { ascending: false })
        : { data: [], error: null };
      const { data: dietTemplates, error: dietTemplatesError } = trainer
        ? await supabase
            .from("diet_templates")
            .select("id, name, calorie_target, protein_target_grams, meal_count, dietary_preference")
            .order("created_at", { ascending: false })
        : { data: [], error: null };

      if (checkinsError) {
        setState({ ...initialState, isLoading: false, error: checkinsError.message });
        return;
      }

      if (assignedPlansError) {
        setState({ ...initialState, isLoading: false, error: assignedPlansError.message });
        return;
      }

      if (workoutTemplatesError) {
        setState({ ...initialState, isLoading: false, error: workoutTemplatesError.message });
        return;
      }

      if (dietTemplatesError) {
        setState({ ...initialState, isLoading: false, error: dietTemplatesError.message });
        return;
      }

      const row = relationship as unknown as TrainerClientRow;
      const member = normalizeMember(row.members);
      const latestCheckin = ((checkins ?? []) as unknown as CheckinRow[])[0] ?? null;
      const assignedPlan = ((assignedPlans ?? []) as unknown as AssignedPlanRow[])[0] ?? null;
      const formattedCheckin = latestCheckin ? await formatCheckin(supabase, latestCheckin) : null;
      const templateOptions = (workoutTemplates ?? []) as unknown as WorkoutTemplateOption[];
      const dietOptions = (dietTemplates ?? []) as unknown as DietTemplateOption[];

      if (!isMounted) {
        return;
      }

      setState({
        client: member
          ? {
              name: normalizeProfile(member.profiles)?.full_name ?? "Unnamed member",
              goal: member.goal ?? "Not set",
              status: formatStatus(row.status),
              age: formatValue(member.age),
              gender: member.gender ?? "Not set",
              height: member.height_cm ? `${member.height_cm} cm` : "Not set",
              currentWeight: member.current_weight_kg ? `${member.current_weight_kg} kg` : "Not set",
              dietaryPreference: member.dietary_preference ?? "Not set",
              injuries: member.injuries?.length ? member.injuries.join(", ") : "None recorded",
            }
          : null,
        latestCheckin: formattedCheckin,
        assignedPlan: assignedPlan
          ? {
              workoutTemplateId: assignedPlan.workout_template_id,
              dietTemplateId: assignedPlan.diet_template_id,
              workoutTemplate: normalizeTemplateName(assignedPlan.workout_templates) ?? "No workout assigned",
              dietTemplate: normalizeTemplateName(assignedPlan.diet_templates) ?? "No diet assigned",
              assignedAt: formatDate(assignedPlan.assigned_at),
            }
          : null,
        workoutTemplates: templateOptions,
        dietTemplates: dietOptions,
        selectedWorkoutTemplateId: assignedPlan?.workout_template_id ?? templateOptions[0]?.id ?? "",
        selectedDietTemplateId: assignedPlan?.diet_template_id ?? dietOptions[0]?.id ?? "",
        canAssignPlans: Boolean(trainer),
        aiSuggestions: ((aiRows ?? []) as AiSuggestionRow[]).map((item) => ({
          id: item.id,
          type: item.suggestion_type,
          status: item.status,
          createdAt: formatDate(item.created_at),
          output: item.output ?? null,
        })),
        isLoading: false,
        error: null,
        assignmentError: null,
        assignmentStatus: null,
        isAssigningPlan: false,
        aiError: null,
        isGeneratingSummary: false,
      });
    }

    loadClient();

    return () => {
      isMounted = false;
    };
  }, [supabase, trainerClientId]);

  async function assignPlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase || state.isAssigningPlan) {
      return;
    }

    if (!state.selectedWorkoutTemplateId && !state.selectedDietTemplateId) {
      setState((current) => ({
        ...current,
        assignmentError: "Select a workout or diet template before assigning a plan.",
        assignmentStatus: null,
      }));
      return;
    }

    const workoutTemplate = state.workoutTemplates.find((item) => item.id === state.selectedWorkoutTemplateId);
    const dietTemplate = state.dietTemplates.find((item) => item.id === state.selectedDietTemplateId);

    setState((current) => ({
      ...current,
      assignmentError: null,
      assignmentStatus: null,
      isAssigningPlan: true,
    }));

    const { error: deactivateError } = await supabase
      .from("assigned_plans")
      .update({ active: false })
      .eq("trainer_client_id", trainerClientId)
      .eq("active", true);

    if (deactivateError) {
      setState((current) => ({
        ...current,
        assignmentError: deactivateError.message,
        assignmentStatus: null,
        isAssigningPlan: false,
      }));
      return;
    }

    const { data: assignment, error: assignmentError } = await supabase
      .from("assigned_plans")
      .insert({
        trainer_client_id: trainerClientId,
        workout_template_id: state.selectedWorkoutTemplateId || null,
        diet_template_id: state.selectedDietTemplateId || null,
        active: true,
      })
      .select("assigned_at")
      .single();

    if (assignmentError) {
      setState((current) => ({
        ...current,
        assignmentError: assignmentError.message,
        assignmentStatus: null,
        isAssigningPlan: false,
      }));
      return;
    }

    setState((current) => ({
      ...current,
      assignedPlan: {
        workoutTemplateId: state.selectedWorkoutTemplateId || null,
        dietTemplateId: state.selectedDietTemplateId || null,
        workoutTemplate: workoutTemplate?.name ?? "No workout assigned",
        dietTemplate: dietTemplate?.name ?? "No diet assigned",
        assignedAt: formatDate(assignment.assigned_at),
      },
      assignmentError: null,
      assignmentStatus: "Plan assigned.",
      isAssigningPlan: false,
    }));
  }

  async function generateWeeklySummary() {
    if (!supabase) {
      setState((current) => ({ ...current, aiError: "Supabase is not configured." }));
      return;
    }

    setState((current) => ({ ...current, aiError: null, isGeneratingSummary: true }));

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      setState((current) => ({
        ...current,
        aiError: sessionError?.message ?? "Sign in before generating an AI summary.",
        isGeneratingSummary: false,
      }));
      return;
    }

    const response = await fetch("/api/ai/weekly-summary", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ trainerClientId }),
    });

    const payload = (await response.json()) as {
      error?: string;
      suggestion?: AiSuggestionRow;
    };

    if (!response.ok || !payload.suggestion) {
      setState((current) => ({
        ...current,
        aiError: payload.error ?? "Unable to generate AI summary.",
        isGeneratingSummary: false,
      }));
      return;
    }

    setState((current) => ({
      ...current,
      aiSuggestions: [
        {
          id: payload.suggestion!.id,
          type: payload.suggestion!.suggestion_type,
          status: payload.suggestion!.status,
          createdAt: formatDate(payload.suggestion!.created_at),
          output: payload.suggestion!.output ?? null,
        },
        ...current.aiSuggestions,
      ],
      aiError: null,
      isGeneratingSummary: false,
    }));
  }

  if (state.isLoading) {
    return <ClientShell title="Loading client" />;
  }

  if (state.error || !state.client) {
    return (
      <ClientShell title="Client detail">
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          {state.error ?? "Client could not be loaded."}
        </section>
      </ClientShell>
    );
  }

  return (
    <ClientShell title={state.client.name}>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-6">
          <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-emerald-700">{state.client.status}</p>
                <h1 className="mt-2 text-2xl font-semibold text-zinc-950">{state.client.name}</h1>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{state.client.goal}</p>
              </div>
              <button className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50">
                Edit profile
              </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[
                ["Age", state.client.age],
                ["Gender", state.client.gender],
                ["Height", state.client.height],
                ["Current weight", state.client.currentWeight],
                ["Diet", state.client.dietaryPreference],
                ["Injuries", state.client.injuries],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-xs font-medium uppercase text-zinc-500">{label}</p>
                  <p className="mt-2 text-sm font-medium text-zinc-950">{value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-950">Latest progress check-in</h2>
            {state.latestCheckin ? (
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ["Week", state.latestCheckin.weekStartDate],
                    ["Weight", state.latestCheckin.weight],
                    ["Adherence", state.latestCheckin.adherence],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                      <p className="text-xs font-medium uppercase text-zinc-500">{label}</p>
                      <p className="mt-2 text-sm font-medium text-zinc-950">{value}</p>
                    </div>
                  ))}
                </div>
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm leading-6 text-zinc-700">
                  {state.latestCheckin.notes}
                </p>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {state.latestCheckin.measurements.map((measurement) => (
                    <div key={measurement.label} className="rounded-lg border border-zinc-200 bg-white p-3">
                      <p className="text-xs font-medium uppercase text-zinc-500">{measurement.label}</p>
                      <p className="mt-2 text-sm font-medium text-zinc-950">{measurement.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">
                No weekly check-in submitted yet.
              </p>
            )}
          </section>
        </section>

        <aside className="space-y-6">
          <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-950">Assigned plans</h2>
            {state.assignedPlan ? (
              <div className="mt-4 space-y-3 text-sm text-zinc-700">
                <p>Workout: {state.assignedPlan.workoutTemplate}</p>
                <p>Diet: {state.assignedPlan.dietTemplate}</p>
                <p>Assigned: {state.assignedPlan.assignedAt}</p>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-zinc-600">No active workout or diet plan assigned yet.</p>
            )}

            {state.canAssignPlans ? (
              <form onSubmit={assignPlan} className="mt-5 space-y-3 border-t border-zinc-200 pt-4">
                <label htmlFor="workout-template" className="block text-sm font-medium text-zinc-800">
                  Workout template
                </label>
                <select
                  id="workout-template"
                  value={state.selectedWorkoutTemplateId}
                  onChange={(event) =>
                    setState((current) => ({
                      ...current,
                      selectedWorkoutTemplateId: event.target.value,
                      assignmentError: null,
                      assignmentStatus: null,
                    }))
                  }
                  disabled={!state.workoutTemplates.length || state.isAssigningPlan}
                  className="h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-emerald-600 disabled:cursor-not-allowed disabled:bg-zinc-100"
                >
                  <option value="">No workout</option>
                  {state.workoutTemplates.length ? (
                    state.workoutTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))
                  ) : null}
                </select>
                {state.selectedWorkoutTemplateId ? (
                  <p className="text-xs leading-5 text-zinc-500">
                    {formatTemplateMeta(
                      state.workoutTemplates.find((template) => template.id === state.selectedWorkoutTemplateId),
                    )}
                  </p>
                ) : null}
                <label htmlFor="diet-template" className="block text-sm font-medium text-zinc-800">
                  Diet template
                </label>
                <select
                  id="diet-template"
                  value={state.selectedDietTemplateId}
                  onChange={(event) =>
                    setState((current) => ({
                      ...current,
                      selectedDietTemplateId: event.target.value,
                      assignmentError: null,
                      assignmentStatus: null,
                    }))
                  }
                  disabled={!state.dietTemplates.length || state.isAssigningPlan}
                  className="h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-emerald-600 disabled:cursor-not-allowed disabled:bg-zinc-100"
                >
                  <option value="">No diet</option>
                  {state.dietTemplates.length
                    ? state.dietTemplates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))
                    : null}
                </select>
                {state.selectedDietTemplateId ? (
                  <p className="text-xs leading-5 text-zinc-500">
                    {formatDietTemplateMeta(
                      state.dietTemplates.find((template) => template.id === state.selectedDietTemplateId),
                    )}
                  </p>
                ) : null}
                {state.assignmentError ? (
                  <p className="rounded-md bg-rose-50 p-3 text-sm leading-6 text-rose-800">{state.assignmentError}</p>
                ) : null}
                {state.assignmentStatus ? (
                  <p className="rounded-md bg-emerald-50 p-3 text-sm leading-6 text-emerald-800">{state.assignmentStatus}</p>
                ) : null}
                <button
                  type="submit"
                  disabled={(!state.workoutTemplates.length && !state.dietTemplates.length) || state.isAssigningPlan}
                  className="w-full rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {state.isAssigningPlan ? "Assigning" : "Assign plan"}
                </button>
                <div className="flex flex-wrap gap-3 text-sm font-medium text-emerald-700">
                  {!state.workoutTemplates.length ? <Link href="/templates/workouts/new">Create workout template</Link> : null}
                  {!state.dietTemplates.length ? <Link href="/templates/diets/new">Create diet template</Link> : null}
                </div>
              </form>
            ) : null}
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-950">Progress photos</h2>
            {state.latestCheckin?.photos.length ? (
              <div className="mt-4 grid gap-3">
                {state.latestCheckin.photos.map((photo) => (
                  <a
                    key={photo.id}
                    href={photo.signedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.signedUrl} alt={photo.label} className="h-40 w-full object-cover" />
                    <p className="p-3 text-sm font-medium text-zinc-700">{photo.label}</p>
                  </a>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-zinc-600">No photos yet.</p>
            )}
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-zinc-950">AI review</h2>
              <button
                type="button"
                onClick={generateWeeklySummary}
                disabled={state.isGeneratingSummary}
                className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {state.isGeneratingSummary ? "Generating" : "Generate"}
              </button>
            </div>
            {state.aiError ? (
              <p className="mt-4 rounded-md bg-rose-50 p-3 text-sm leading-6 text-rose-800">{state.aiError}</p>
            ) : null}
            {state.aiSuggestions.length ? (
              <div className="mt-4 space-y-3">
                {state.aiSuggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm leading-6 text-zinc-700"
                  >
                    <p className="font-medium text-zinc-950">{suggestion.type}</p>
                    <p className="mt-1">{suggestion.status} · {suggestion.createdAt}</p>
                    {suggestion.output?.summary ? (
                      <p className="mt-3 rounded-md bg-white p-3 text-zinc-700">{suggestion.output.summary}</p>
                    ) : null}
                    {suggestion.output?.trend ? (
                      <p className="mt-3 text-xs font-medium uppercase text-zinc-500">Trend: {suggestion.output.trend}</p>
                    ) : null}
                    {suggestion.output?.suggestedAdjustments?.length ? (
                      <div className="mt-3">
                        <p className="text-xs font-medium uppercase text-zinc-500">Suggested adjustments</p>
                        <ul className="mt-2 list-inside list-disc space-y-1">
                          {suggestion.output.suggestedAdjustments.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-zinc-600">No AI summaries yet. Weekly review generation comes next.</p>
            )}
          </section>
        </aside>
      </div>
    </ClientShell>
  );
}

function ClientShell({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-stone-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div>
            <Link href="/dashboard" className="text-sm font-medium text-emerald-700">
              Back to dashboard
            </Link>
            <h1 className="mt-1 text-2xl font-semibold text-zinc-950">{title}</h1>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-6">{children}</div>
    </main>
  );
}

function normalizeMember(member: TrainerClientRow["members"]) {
  return Array.isArray(member) ? member[0] ?? null : member;
}

function normalizeProfile(profile: NonNullable<ReturnType<typeof normalizeMember>>["profiles"]) {
  return Array.isArray(profile) ? profile[0] ?? null : profile;
}

function normalizeTemplateName(template: AssignedPlanRow["workout_templates"] | AssignedPlanRow["diet_templates"]) {
  const normalized = Array.isArray(template) ? template[0] ?? null : template;
  return normalized?.name ?? null;
}

function formatTemplateMeta(template?: WorkoutTemplateOption) {
  if (!template) {
    return "";
  }

  const parts = [
    template.goal ? template.goal.replaceAll("_", " ") : null,
    template.difficulty,
    template.duration_weeks ? `${template.duration_weeks} weeks` : null,
    `${template.workout_days?.length ?? 0} days`,
  ].filter(Boolean);

  return parts.join(" · ");
}

function formatDietTemplateMeta(template?: DietTemplateOption) {
  if (!template) {
    return "";
  }

  const parts = [
    template.calorie_target ? `${template.calorie_target} kcal` : null,
    template.protein_target_grams ? `${template.protein_target_grams} g protein` : null,
    template.meal_count ? `${template.meal_count} meals` : null,
    template.dietary_preference ? template.dietary_preference.replaceAll("_", " ") : null,
  ].filter(Boolean);

  return parts.join(" · ");
}

async function formatCheckin(supabase: ReturnType<typeof createSupabaseBrowserClient>, checkin: CheckinRow) {
  const measurements = Array.isArray(checkin.progress_measurements)
    ? checkin.progress_measurements[0] ?? null
    : checkin.progress_measurements;
  const photos = await createSignedPhotoUrls(supabase, checkin.progress_photos ?? []);

  return {
    weekStartDate: formatDate(checkin.week_start_date),
    weight: checkin.weight_kg ? `${checkin.weight_kg} kg` : "Not recorded",
    adherence: checkin.adherence_percent != null ? `${checkin.adherence_percent}%` : "Not recorded",
    notes: checkin.notes ?? "No notes recorded.",
    measurements: [
      ["Chest", measurements?.chest_cm],
      ["Waist", measurements?.waist_cm],
      ["Hip", measurements?.hip_cm],
      ["Glutes", measurements?.glutes_cm],
      ["Arm", measurements?.arm_cm],
      ["Thigh", measurements?.thigh_cm],
      ["Calf", measurements?.calf_cm],
    ].map(([label, value]) => ({
      label: String(label),
      value: value ? `${value} cm` : "Not recorded",
    })),
    photoCount: checkin.progress_photos?.length ?? 0,
    photos,
  };
}

async function createSignedPhotoUrls(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  photos: Array<{ id: string; storage_path: string; photo_label: string | null }>,
) {
  const signedPhotos = await Promise.all(
    photos.map(async (photo) => {
      const { data } = await supabase.storage.from("progress-photos").createSignedUrl(photo.storage_path, 60 * 10);

      return {
        id: photo.id,
        label: photo.photo_label ?? "Progress photo",
        signedUrl: data?.signedUrl ?? "",
      };
    }),
  );

  return signedPhotos.filter((photo) => photo.signedUrl);
}

function formatStatus(status: string) {
  return status.slice(0, 1).toUpperCase() + status.slice(1);
}

function formatValue(value: number | null) {
  return value == null ? "Not set" : String(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

import { NextResponse } from "next/server";
import { aiService } from "@/lib/ai/service";
import type { ProgressSummaryInput, TrainingGoal } from "@/lib/ai/types";
import { createSupabaseUserServerClient } from "@/lib/supabase/server";

type RequestBody = {
  trainerClientId?: string;
};

type TrainerClientRow = {
  id: string;
  members:
    | {
        goal: string | null;
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
        goal: string | null;
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
  week_start_date: string;
  weight_kg: number | null;
  adherence_percent: number | null;
  notes: string | null;
  progress_measurements:
    | {
        waist_cm: number | null;
      }
    | Array<{
        waist_cm: number | null;
      }>
    | null;
};

export async function POST(request: Request) {
  try {
    const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

    if (!accessToken) {
      return NextResponse.json({ error: "Missing bearer token." }, { status: 401 });
    }

    const body = (await request.json()) as RequestBody;

    if (!body.trainerClientId) {
      return NextResponse.json({ error: "trainerClientId is required." }, { status: 400 });
    }

    const supabase = createSupabaseUserServerClient(accessToken);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Invalid user session." }, { status: 401 });
    }

    const { data: relationship, error: relationshipError } = await supabase
      .from("trainer_clients")
      .select(
        `
        id,
        members (
          goal,
          profiles (
            full_name
          )
        )
      `,
      )
      .eq("id", body.trainerClientId)
      .maybeSingle();

    if (relationshipError) {
      return NextResponse.json({ error: relationshipError.message }, { status: 400 });
    }

    if (!relationship) {
      return NextResponse.json({ error: "Client relationship not found." }, { status: 404 });
    }

    const { data: checkins, error: checkinsError } = await supabase
      .from("progress_checkins")
      .select(
        `
        week_start_date,
        weight_kg,
        adherence_percent,
        notes,
        progress_measurements (
          waist_cm
        )
      `,
      )
      .eq("trainer_client_id", body.trainerClientId)
      .order("week_start_date", { ascending: false })
      .limit(8);

    if (checkinsError) {
      return NextResponse.json({ error: checkinsError.message }, { status: 400 });
    }

    const normalizedRelationship = relationship as unknown as TrainerClientRow;
    const member = normalizeMember(normalizedRelationship.members);
    const clientName = normalizeProfile(member?.profiles)?.full_name ?? "Client";
    const clientGoal = toTrainingGoal(member?.goal);
    const normalizedCheckins = ((checkins ?? []) as unknown as CheckinRow[]).reverse();
    const input: ProgressSummaryInput = {
      clientName,
      goal: clientGoal,
      weeks: normalizedCheckins.map((checkin) => {
        const measurements = normalizeMeasurements(checkin.progress_measurements);

        return {
          weekStartDate: checkin.week_start_date,
          weightKg: checkin.weight_kg ?? undefined,
          waistCm: measurements?.waist_cm ?? undefined,
          adherencePercent: checkin.adherence_percent ?? undefined,
          notes: checkin.notes ?? undefined,
        };
      }),
    };

    const output = await aiService.summarizeWeeklyProgress(input);
    const { data: suggestion, error: suggestionError } = await supabase
      .from("ai_suggestions")
      .insert({
        trainer_client_id: body.trainerClientId,
        suggestion_type: "weekly_progress_summary",
        provider: process.env.AI_PROVIDER ?? "nvidia-nim",
        model: process.env.NVIDIA_NIM_MODEL ?? null,
        input_snapshot: input,
        output,
        status: "draft",
      })
      .select("id, suggestion_type, status, created_at, output")
      .single();

    if (suggestionError) {
      return NextResponse.json({ error: suggestionError.message }, { status: 400 });
    }

    return NextResponse.json({ suggestion });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate weekly summary." },
      { status: 500 },
    );
  }
}

function normalizeMember(member: TrainerClientRow["members"]) {
  return Array.isArray(member) ? member[0] ?? null : member;
}

function normalizeProfile(profile: NonNullable<ReturnType<typeof normalizeMember>>["profiles"] | undefined) {
  return Array.isArray(profile) ? profile[0] ?? null : profile ?? null;
}

function normalizeMeasurements(measurements: CheckinRow["progress_measurements"]) {
  return Array.isArray(measurements) ? measurements[0] ?? null : measurements;
}

function toTrainingGoal(goal?: string | null): TrainingGoal {
  const normalized = goal?.toLowerCase().replaceAll(" ", "_");

  if (
    normalized === "fat_loss" ||
    normalized === "muscle_gain" ||
    normalized === "strength" ||
    normalized === "recomposition" ||
    normalized === "general_fitness"
  ) {
    return normalized;
  }

  return "general_fitness";
}

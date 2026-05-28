"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { InviteLinkCard } from "./invite-link-card";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/env";

type DashboardClient = {
  id: string;
  name: string;
  goal: string;
  weight: string;
  adherence: string;
  status: string;
};

type DashboardState = {
  trainerName: string;
  activeClients: number;
  pendingReviews: number;
  missedCheckIns: number;
  newUploads: number;
  clients: DashboardClient[];
  alerts: string[];
  isLoading: boolean;
  error: string | null;
};

const initialState: DashboardState = {
  trainerName: "Trainer",
  activeClients: 0,
  pendingReviews: 0,
  missedCheckIns: 0,
  newUploads: 0,
  clients: [],
  alerts: [],
  isLoading: true,
  error: null,
};

type TrainerClientRow = {
  id: string;
  status: string;
  members:
    | {
        current_weight_kg: number | null;
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
        current_weight_kg: number | null;
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

type MemberRelation = {
  current_weight_kg: number | null;
  goal: string | null;
  profiles:
    | {
        full_name: string | null;
      }
    | Array<{
        full_name: string | null;
      }>
    | null;
};

type TrainerRelation = {
  id: string;
  profiles:
    | {
        full_name: string | null;
      }
    | Array<{
        full_name: string | null;
      }>
    | null;
};

type TrainerProfileRelation = {
  full_name: string | null;
};

type MemberProfileRelation = {
  full_name: string | null;
};

type NormalizedMember = {
  current_weight_kg: number | null;
  goal: string | null;
  profile: MemberProfileRelation | null;
};

type ProgressCheckinRow = {
  trainer_client_id: string;
  week_start_date: string;
  adherence_percent: number | null;
  created_at: string;
  progress_photos: Array<{ id: string }> | null;
};

export function TrainerDashboard() {
  const hasConfig = hasSupabaseBrowserConfig();
  const supabase = useMemo(() => (hasConfig ? createSupabaseBrowserClient() : null), [hasConfig]);
  const [state, setState] = useState<DashboardState>(initialState);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      if (!supabase) {
        setState({ ...initialState, isLoading: false, error: "Supabase is not configured." });
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setState({
          ...initialState,
          isLoading: false,
          error: "Sign in as a trainer to view your dashboard.",
        });
        return;
      }

      const { data: trainer, error: trainerError } = await supabase
        .from("trainers")
        .select("id, profiles(full_name)")
        .eq("profile_id", user.id)
        .maybeSingle();

      if (trainerError) {
        setState({ ...initialState, isLoading: false, error: trainerError.message });
        return;
      }

      if (!trainer) {
        setState({
          ...initialState,
          isLoading: false,
          error: "Complete trainer onboarding before using the dashboard.",
        });
        return;
      }

      const { data: relationshipRows, error: relationshipError } = await supabase
        .from("trainer_clients")
        .select(
          `
          id,
          status,
          members (
            current_weight_kg,
            goal,
            profiles (
              full_name
            )
          )
        `,
        )
        .eq("trainer_id", trainer.id)
        .order("created_at", { ascending: false });

      if (relationshipError) {
        setState({ ...initialState, isLoading: false, error: relationshipError.message });
        return;
      }

      const trainerClientIds = (relationshipRows ?? []).map((row) => row.id);
      const { data: checkins, error: checkinsError } = trainerClientIds.length
        ? await supabase
            .from("progress_checkins")
            .select("trainer_client_id, week_start_date, adherence_percent, created_at, progress_photos(id)")
            .in("trainer_client_id", trainerClientIds)
            .order("week_start_date", { ascending: false })
        : { data: [], error: null };

      if (checkinsError) {
        setState({ ...initialState, isLoading: false, error: checkinsError.message });
        return;
      }

      const latestCheckins = latestCheckinByClient((checkins ?? []) as unknown as ProgressCheckinRow[]);
      const clients = ((relationshipRows ?? []) as unknown as TrainerClientRow[]).map((row) => {
        const latestCheckin = latestCheckins.get(row.id);
        const member = normalizeMemberRelation(row.members);

        return {
          id: row.id,
          name: member?.profile?.full_name ?? "Unnamed member",
          goal: member?.goal ?? "Not set",
          weight: member?.current_weight_kg ? `${member.current_weight_kg} kg` : "Not set",
          adherence: latestCheckin?.adherence_percent != null ? `${latestCheckin.adherence_percent}%` : "No check-in",
          status: formatClientStatus(row.status, latestCheckin),
        };
      });

      const missedCheckIns = countMissedCheckins(clients, latestCheckins);
      const newUploads = ((checkins ?? []) as unknown as ProgressCheckinRow[]).reduce(
        (count, checkin) => count + (checkin.progress_photos?.length ?? 0),
        0,
      );
      const alerts = buildAlerts(clients, latestCheckins);
      const normalizedTrainer = trainer as unknown as TrainerRelation;
      const trainerProfile = normalizeTrainerProfile(normalizedTrainer.profiles);

      if (!isMounted) {
        return;
      }

      setState({
        trainerName: trainerProfile?.full_name ?? "Trainer",
        activeClients: clients.filter((client) => client.status !== "Archived").length,
        pendingReviews: clients.filter((client) => client.adherence !== "No check-in").length,
        missedCheckIns,
        newUploads,
        clients,
        alerts,
        isLoading: false,
        error: null,
      });
    }

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  async function signOut() {
    await supabase?.auth.signOut();
    window.location.href = "/sign-in";
  }

  const overview = [
    {
      label: "Active clients",
      value: String(state.activeClients),
      detail: state.isLoading ? "Loading" : "Current roster",
      tone: "bg-emerald-50 text-emerald-800",
    },
    {
      label: "Pending reviews",
      value: String(state.pendingReviews),
      detail: "With check-ins",
      tone: "bg-amber-50 text-amber-800",
    },
    {
      label: "Missed check-ins",
      value: String(state.missedCheckIns),
      detail: "Needs follow-up",
      tone: "bg-rose-50 text-rose-800",
    },
    {
      label: "New uploads",
      value: String(state.newUploads),
      detail: "Progress photos",
      tone: "bg-sky-50 text-sky-800",
    },
  ];

  return (
    <main className="min-h-screen bg-stone-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <div>
            <p className="text-sm font-medium text-emerald-700">FitnessOS</p>
            <h1 className="text-2xl font-semibold tracking-normal text-zinc-950">Trainer operations</h1>
            <p className="mt-1 text-sm text-zinc-500">{state.trainerName}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="h-10 rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50">
              Invite client
            </button>
            <Link
              href="/templates/workouts"
              className="flex h-10 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Workouts
            </Link>
            <Link
              href="/templates/diets"
              className="flex h-10 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              Diets
            </Link>
            <Link
              href="/templates/workouts/new"
              className="flex h-10 items-center rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
            >
              New workout
            </Link>
            <Link
              href="/templates/diets/new"
              className="flex h-10 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
            >
              New diet
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="h-10 rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-6">
          {state.error ? (
            <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              <p>{state.error}</p>
              <Link href="/onboarding" className="mt-3 inline-block font-medium underline underline-offset-4">
                Go to onboarding
              </Link>
            </section>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {overview.map((item) => (
              <article key={item.label} className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-medium text-zinc-500">{item.label}</p>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <p className="text-3xl font-semibold text-zinc-950">{item.value}</p>
                  <span className={item.tone + " rounded-md px-2 py-1 text-xs font-medium"}>{item.detail}</span>
                </div>
              </article>
            ))}
          </div>

          <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <h2 className="text-base font-semibold text-zinc-950">Client list</h2>
              <span className="text-sm text-zinc-500">{state.clients.length} total</span>
            </div>
            {state.isLoading ? (
              <div className="p-6 text-sm text-zinc-600">Loading clients</div>
            ) : state.clients.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                  <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Client</th>
                      <th className="px-4 py-3 font-semibold">Goal</th>
                      <th className="px-4 py-3 font-semibold">Latest weight</th>
                      <th className="px-4 py-3 font-semibold">Adherence</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {state.clients.map((client) => (
                      <tr key={client.id} className="hover:bg-zinc-50">
                        <td className="px-4 py-4 font-medium text-zinc-950">
                          <Link href={`/clients/${client.id}`} className="underline-offset-4 hover:underline">
                            {client.name}
                          </Link>
                        </td>
                        <td className="px-4 py-4 text-zinc-600">
                          <Link href={`/clients/${client.id}`}>{client.goal}</Link>
                        </td>
                        <td className="px-4 py-4 text-zinc-600">
                          <Link href={`/clients/${client.id}`}>{client.weight}</Link>
                        </td>
                        <td className="px-4 py-4 text-zinc-600">
                          <Link href={`/clients/${client.id}`}>{client.adherence}</Link>
                        </td>
                        <td className="px-4 py-4 text-zinc-600">
                          <Link href={`/clients/${client.id}`}>{client.status}</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6">
                <h3 className="text-base font-semibold text-zinc-950">No clients yet</h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600">
                  Share your invite link with a client. When they join and complete member onboarding, they will appear
                  here.
                </p>
              </div>
            )}
          </section>
        </section>

        <aside className="space-y-6">
          <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-zinc-950">AI review queue</h2>
              <span className="rounded-md bg-violet-50 px-2 py-1 text-xs font-medium text-violet-800">NVIDIA NIM</span>
            </div>
            <div className="mt-4 space-y-3">
              {state.alerts.length ? (
                state.alerts.map((alert) => (
                  <div
                    key={alert}
                    className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm leading-6 text-zinc-700"
                  >
                    {alert}
                  </div>
                ))
              ) : (
                <p className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm leading-6 text-zinc-600">
                  No AI alerts yet. Weekly reviews will appear here after member check-ins.
                </p>
              )}
            </div>
          </section>

          <InviteLinkCard />

          <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-semibold text-zinc-950">Template library</h2>
            <div className="mt-4 grid gap-3 text-sm">
              <Link
                href="/templates/workouts"
                className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-medium text-zinc-800 hover:bg-zinc-100"
              >
                Manage workout templates
              </Link>
              <Link
                href="/templates/diets"
                className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-medium text-zinc-800 hover:bg-zinc-100"
              >
                Manage diet templates
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

function latestCheckinByClient(checkins: ProgressCheckinRow[]) {
  const latest = new Map<string, ProgressCheckinRow>();

  for (const checkin of checkins) {
    const current = latest.get(checkin.trainer_client_id);

    if (!current || checkin.week_start_date > current.week_start_date) {
      latest.set(checkin.trainer_client_id, checkin);
    }
  }

  return latest;
}

function normalizeMemberRelation(member: TrainerClientRow["members"]): NormalizedMember | null {
  const normalizedMember = Array.isArray(member) ? member[0] : member;

  if (!normalizedMember) {
    return null;
  }

  return {
    current_weight_kg: normalizedMember.current_weight_kg,
    goal: normalizedMember.goal,
    profile: normalizeMemberProfile(normalizedMember.profiles),
  };
}

function normalizeMemberProfile(
  profile: MemberRelation["profiles"],
): MemberProfileRelation | null {
  return Array.isArray(profile) ? profile[0] ?? null : profile;
}

function normalizeTrainerProfile(
  profile: TrainerRelation["profiles"],
): TrainerProfileRelation | null {
  return Array.isArray(profile) ? profile[0] ?? null : profile;
}

function formatClientStatus(status: string, latestCheckin?: ProgressCheckinRow) {
  if (status === "archived") {
    return "Archived";
  }

  if (!latestCheckin) {
    return "No check-in yet";
  }

  const daysSinceCheckin = daysBetween(new Date(latestCheckin.week_start_date), new Date());

  if (daysSinceCheckin > 10) {
    return "Missed check-in";
  }

  return "Checked in";
}

function countMissedCheckins(clients: DashboardClient[], latestCheckins: Map<string, ProgressCheckinRow>) {
  return clients.filter((client) => {
    const latest = latestCheckins.get(client.id);

    if (!latest) {
      return true;
    }

    return daysBetween(new Date(latest.week_start_date), new Date()) > 10;
  }).length;
}

function buildAlerts(clients: DashboardClient[], latestCheckins: Map<string, ProgressCheckinRow>) {
  return clients
    .map((client) => {
      const latest = latestCheckins.get(client.id);

      if (!latest) {
        return `${client.name} has not submitted a weekly check-in yet.`;
      }

      if (latest.adherence_percent != null && latest.adherence_percent < 70) {
        return `${client.name} adherence is below 70%. Review plan difficulty and accountability.`;
      }

      if (daysBetween(new Date(latest.week_start_date), new Date()) > 10) {
        return `${client.name} may have missed the latest weekly review.`;
      }

      return null;
    })
    .filter((alert): alert is string => Boolean(alert))
    .slice(0, 4);
}

function daysBetween(start: Date, end: Date) {
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000);
}

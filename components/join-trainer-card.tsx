"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/env";

type TrainerInvite = {
  trainer_name: string;
  specialization: string | null;
};

export function JoinTrainerCard({ inviteCode }: { inviteCode: string }) {
  const hasConfig = hasSupabaseBrowserConfig();
  const supabase = useMemo(() => (hasConfig ? createSupabaseBrowserClient() : null), [hasConfig]);
  const [trainer, setTrainer] = useState<TrainerInvite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadTrainer() {
      if (!supabase) {
        setError("Supabase is not configured.");
        setIsLoading(false);
        return;
      }

      const { data, error: inviteError } = await supabase.rpc("get_trainer_by_invite", {
        invite_code_input: inviteCode,
      });

      if (!isMounted) {
        return;
      }

      if (inviteError) {
        setError(inviteError.message);
        setIsLoading(false);
        return;
      }

      setTrainer(Array.isArray(data) ? data[0] ?? null : null);
      setIsLoading(false);
    }

    loadTrainer();

    return () => {
      isMounted = false;
    };
  }, [inviteCode, supabase]);

  return (
    <section className="w-full max-w-xl rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-emerald-700">Trainer invite</p>
      <h1 className="mt-2 text-2xl font-semibold text-zinc-950">Join your trainer on FitnessOS</h1>

      <div className="mt-5 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        {isLoading ? (
          <p className="text-sm text-zinc-600">Checking invite</p>
        ) : error ? (
          <p className="text-sm text-rose-700">{error}</p>
        ) : trainer ? (
          <div>
            <p className="text-sm text-zinc-500">You were invited by</p>
            <p className="mt-1 text-lg font-semibold text-zinc-950">{trainer.trainer_name}</p>
            <p className="mt-1 text-sm text-zinc-600">{trainer.specialization ?? "Personal trainer"}</p>
          </div>
        ) : (
          <p className="text-sm text-rose-700">This invite link is invalid.</p>
        )}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link
          href={`/sign-up?invite=${inviteCode}`}
          className="rounded-md bg-zinc-950 px-4 py-3 text-center text-sm font-medium text-white hover:bg-zinc-800"
        >
          Create account
        </Link>
        <Link
          href={`/onboarding?invite=${inviteCode}&role=member`}
          className="rounded-md border border-zinc-300 bg-white px-4 py-3 text-center text-sm font-medium text-zinc-800 hover:bg-zinc-50"
        >
          I already signed in
        </Link>
      </div>
    </section>
  );
}

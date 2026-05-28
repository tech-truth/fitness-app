"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/env";

type InviteState = {
  inviteCode: string | null;
  error: string | null;
  isLoading: boolean;
};

export function InviteLinkCard() {
  const hasConfig = hasSupabaseBrowserConfig();
  const supabase = useMemo(() => (hasConfig ? createSupabaseBrowserClient() : null), [hasConfig]);
  const [state, setState] = useState<InviteState>({ inviteCode: null, error: null, isLoading: true });

  useEffect(() => {
    let isMounted = true;

    async function loadInviteCode() {
      if (!supabase) {
        setState({ inviteCode: null, error: "Supabase is not configured.", isLoading: false });
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setState({ inviteCode: null, error: "Sign in as a trainer to view your invite link.", isLoading: false });
        return;
      }

      const { data, error } = await supabase
        .from("trainers")
        .select("invite_code")
        .eq("profile_id", user.id)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      if (error) {
        setState({ inviteCode: null, error: error.message, isLoading: false });
        return;
      }

      setState({ inviteCode: data?.invite_code ?? null, error: null, isLoading: false });
    }

    loadInviteCode();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  const inviteUrl =
    typeof window !== "undefined" && state.inviteCode ? `${window.location.origin}/join/${state.inviteCode}` : "";

  async function copyInviteLink() {
    if (!inviteUrl) {
      return;
    }

    await navigator.clipboard.writeText(inviteUrl);
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-zinc-950">Client invite</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-600">Share this link with a client so they can join your roster.</p>

      <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
        {state.isLoading ? "Loading invite link" : state.error ? state.error : inviteUrl || "Complete trainer onboarding first."}
      </div>

      <button
        type="button"
        onClick={copyInviteLink}
        disabled={!inviteUrl}
        className="mt-3 h-10 w-full rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Copy invite link
      </button>
    </section>
  );
}

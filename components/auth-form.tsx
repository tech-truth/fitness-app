"use client";

import { useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/env";

type AuthMode = "sign-in" | "sign-up";

export function AuthForm({ mode, inviteCode }: { mode: AuthMode; inviteCode?: string }) {
  const hasConfig = hasSupabaseBrowserConfig();
  const supabase = useMemo(() => (hasConfig ? createSupabaseBrowserClient() : null), [hasConfig]);
  const submitLockRef = useRef(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSignUp = mode === "sign-up";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitLockRef.current || isSubmitting) {
      return;
    }

    submitLockRef.current = true;
    setError(null);
    setStatus(null);

    if (!supabase) {
      submitLockRef.current = false;
      setError("Supabase environment variables are missing. Add them to .env.local before using auth.");
      return;
    }

    setIsSubmitting(true);
    const result = isSignUp
      ? await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/onboarding${inviteCode ? `?invite=${inviteCode}&role=member` : ""}`,
          },
        })
      : await supabase.auth.signInWithPassword({ email, password });

    if (result.error) {
      submitLockRef.current = false;
      setIsSubmitting(false);
      setError(result.error.message);
      return;
    }

    if (isSignUp) {
      submitLockRef.current = false;
      setIsSubmitting(false);
      setStatus("Account created. Check your email if confirmation is enabled, then complete onboarding.");

      if (result.data.session) {
        window.location.href = inviteCode ? `/onboarding?invite=${inviteCode}&role=member` : "/onboarding";
      }

      return;
    }

    const userId = result.data.user?.id;

    if (!userId) {
      submitLockRef.current = false;
      setIsSubmitting(false);
      setError("Unable to read signed-in user.");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    setIsSubmitting(false);

    if (profileError) {
      submitLockRef.current = false;
      setError(profileError.message);
      return;
    }

    if (!profile) {
      window.location.href = "/onboarding";
      return;
    }

    submitLockRef.current = false;
    window.location.href = profile.role === "member" ? "/member" : "/dashboard";
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!hasConfig ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
          Supabase is not configured yet. Add the public URL and anon key to .env.local.
        </div>
      ) : null}

      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Email</span>
        <input
          required
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-900"
          placeholder="coach@example.com"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Password</span>
        <input
          required
          type="password"
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-zinc-900"
          placeholder="Minimum 8 characters"
        />
      </label>

      {error ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
      {status ? <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{status}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="h-11 w-full rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Please wait" : isSignUp ? "Create account" : "Sign in"}
      </button>
    </form>
  );
}

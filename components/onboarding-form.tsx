"use client";

import { useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/env";
import type { MemberProfileFormState, ProfileFormState, TrainerProfileFormState, UserRole } from "@/lib/auth/types";

const initialProfile: ProfileFormState = {
  role: "trainer",
  fullName: "",
};

const initialTrainer: TrainerProfileFormState = {
  specialization: "",
  experienceYears: "",
  certifications: "",
};

const initialMember: MemberProfileFormState = {
  age: "",
  gender: "",
  heightCm: "",
  currentWeightKg: "",
  goal: "",
  injuries: "",
  dietaryPreference: "",
};

export function OnboardingForm({
  inviteCode,
  initialRole,
}: {
  inviteCode?: string;
  initialRole?: UserRole;
}) {
  const hasConfig = hasSupabaseBrowserConfig();
  const supabase = useMemo(() => (hasConfig ? createSupabaseBrowserClient() : null), [hasConfig]);
  const submitLockRef = useRef(false);
  const [profile, setProfile] = useState({ ...initialProfile, role: initialRole ?? initialProfile.role });
  const [trainer, setTrainer] = useState(initialTrainer);
  const [member, setMember] = useState(initialMember);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateProfile(field: keyof ProfileFormState, value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  function updateRole(role: UserRole) {
    setProfile((current) => ({ ...current, role }));
  }

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
      setError("Supabase environment variables are missing. Add them to .env.local before onboarding.");
      return;
    }

    const validationError = validateOnboardingForm(profile, trainer, member);

    if (validationError) {
      submitLockRef.current = false;
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      submitLockRef.current = false;
      setIsSubmitting(false);
      setError(userError?.message ?? "Sign in before completing onboarding.");
      return;
    }

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: user.id,
      role: profile.role,
      full_name: profile.fullName,
    });

    if (profileError) {
      submitLockRef.current = false;
      setIsSubmitting(false);
      setError(profileError.message);
      return;
    }

    const detailResult =
      profile.role === "trainer"
        ? await supabase
            .from("trainers")
            .upsert({
              profile_id: user.id,
              specialization: trainer.specialization || null,
              experience_years: trainer.experienceYears ? Number(trainer.experienceYears) : null,
              certifications: splitList(trainer.certifications),
            })
            .select("id")
            .single()
        : await supabase
            .from("members")
            .upsert({
              profile_id: user.id,
              age: member.age ? Number(member.age) : null,
              gender: member.gender || null,
              height_cm: member.heightCm ? Number(member.heightCm) : null,
              current_weight_kg: member.currentWeightKg ? Number(member.currentWeightKg) : null,
              goal: member.goal || null,
              injuries: splitList(member.injuries),
              dietary_preference: member.dietaryPreference || null,
            })
            .select("id")
            .single();

    if (detailResult.error) {
      submitLockRef.current = false;
      setIsSubmitting(false);
      setError(detailResult.error.message);
      return;
    }

    if (profile.role === "member" && inviteCode) {
      const { error: joinError } = await supabase.rpc("join_trainer_by_invite", {
        invite_code_input: inviteCode,
      });

      if (joinError) {
        submitLockRef.current = false;
        setIsSubmitting(false);
        setError(joinError.message);
        return;
      }
    }

    submitLockRef.current = false;
    setIsSubmitting(false);
    setStatus("Profile saved. Redirecting to dashboard.");
    window.location.href = profile.role === "trainer" ? "/dashboard" : "/member";
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {!hasConfig ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">
          Supabase is not configured yet. The form UI is ready; saving requires .env.local keys.
        </div>
      ) : null}

      <fieldset>
        <legend className="text-sm font-medium text-zinc-700">Role</legend>
        {inviteCode ? (
          <p className="mt-1 text-sm leading-6 text-zinc-600">This invite will connect you as a member after profile setup.</p>
        ) : null}
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(["trainer", "member"] as const).map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => updateRole(role)}
              className={
                "h-11 rounded-md border px-3 text-sm font-medium capitalize " +
                (profile.role === role
                  ? "border-zinc-950 bg-zinc-950 text-white"
                  : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50")
              }
            >
              {role}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Full name</span>
        <input
          required
          value={profile.fullName}
          onChange={(event) => updateProfile("fullName", event.target.value)}
          className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-900"
          placeholder="Your name"
        />
      </label>

      {profile.role === "trainer" ? (
        <TrainerFields trainer={trainer} setTrainer={setTrainer} />
      ) : (
        <MemberFields member={member} setMember={setMember} />
      )}

      {error ? <p className="rounded-md bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
      {status ? <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{status}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="h-11 w-full rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Saving" : "Complete profile"}
      </button>
    </form>
  );
}

function TrainerFields({
  trainer,
  setTrainer,
}: {
  trainer: TrainerProfileFormState;
  setTrainer: React.Dispatch<React.SetStateAction<TrainerProfileFormState>>;
}) {
  return (
    <div className="grid gap-4">
      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Specialization</span>
        <input
          value={trainer.specialization}
          onChange={(event) => setTrainer((current) => ({ ...current, specialization: event.target.value }))}
          className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-900"
          placeholder="Fat loss, strength, transformations"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Experience years</span>
        <input
          type="number"
          min="0"
          value={trainer.experienceYears}
          onChange={(event) => setTrainer((current) => ({ ...current, experienceYears: event.target.value }))}
          className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-900"
          placeholder="3"
        />
      </label>
      <label className="block">
        <span className="text-sm font-medium text-zinc-700">Certifications</span>
        <input
          value={trainer.certifications}
          onChange={(event) => setTrainer((current) => ({ ...current, certifications: event.target.value }))}
          className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-900"
          placeholder="ACE, ISSA, INFS"
        />
      </label>
    </div>
  );
}

function MemberFields({
  member,
  setMember,
}: {
  member: MemberProfileFormState;
  setMember: React.Dispatch<React.SetStateAction<MemberProfileFormState>>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {[
        ["age", "Age"],
        ["gender", "Gender"],
        ["heightCm", "Height cm"],
        ["currentWeightKg", "Current weight kg"],
        ["goal", "Goal"],
        ["dietaryPreference", "Dietary preference"],
      ].map(([field, label]) => (
        <label key={field} className="block">
          <span className="text-sm font-medium text-zinc-700">{label}</span>
          <input
            value={member[field as keyof MemberProfileFormState]}
            onChange={(event) => setMember((current) => ({ ...current, [field]: event.target.value }))}
            className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-900"
          />
        </label>
      ))}
      <label className="block sm:col-span-2">
        <span className="text-sm font-medium text-zinc-700">Injuries</span>
        <input
          value={member.injuries}
          onChange={(event) => setMember((current) => ({ ...current, injuries: event.target.value }))}
          className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-900"
          placeholder="Knee pain, shoulder impingement"
        />
      </label>
    </div>
  );
}

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function validateOnboardingForm(
  profile: ProfileFormState,
  trainer: TrainerProfileFormState,
  member: MemberProfileFormState,
) {
  if (!profile.fullName.trim()) {
    return "Full name is required.";
  }

  if (profile.role === "trainer") {
    if (trainer.experienceYears.trim()) {
      const experienceYears = Number(trainer.experienceYears);

      if (!Number.isFinite(experienceYears) || experienceYears < 0 || experienceYears > 80) {
        return "Experience years must be between 0 and 80.";
      }
    }

    return null;
  }

  if (member.age.trim()) {
    const age = Number(member.age);

    if (!Number.isFinite(age) || age < 10 || age > 100) {
      return "Age must be between 10 and 100.";
    }
  }

  if (member.heightCm.trim()) {
    const heightCm = Number(member.heightCm);

    if (!Number.isFinite(heightCm) || heightCm < 80 || heightCm > 250) {
      return "Height must be between 80 and 250 cm.";
    }
  }

  if (member.currentWeightKg.trim()) {
    const currentWeightKg = Number(member.currentWeightKg);

    if (!Number.isFinite(currentWeightKg) || currentWeightKg < 20 || currentWeightKg > 300) {
      return "Current weight must be between 20 and 300 kg.";
    }
  }

  return null;
}

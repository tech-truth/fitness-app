"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/env";

type CheckInFormState = {
  trainerClientId: string | null;
  weekStartDate: string;
  weightKg: string;
  adherencePercent: string;
  notes: string;
  chestCm: string;
  waistCm: string;
  hipCm: string;
  glutesCm: string;
  armCm: string;
  thighCm: string;
  calfCm: string;
};

type ProgressPhotoLabel = "front" | "side" | "back";

type ProgressPhotoState = Record<ProgressPhotoLabel, File | null>;

const initialForm: CheckInFormState = {
  trainerClientId: null,
  weekStartDate: getCurrentWeekStartDate(),
  weightKg: "",
  adherencePercent: "",
  notes: "",
  chestCm: "",
  waistCm: "",
  hipCm: "",
  glutesCm: "",
  armCm: "",
  thighCm: "",
  calfCm: "",
};

export function MemberCheckInForm() {
  const hasConfig = hasSupabaseBrowserConfig();
  const supabase = useMemo(() => (hasConfig ? createSupabaseBrowserClient() : null), [hasConfig]);
  const submitLockRef = useRef(false);
  const [form, setForm] = useState(initialForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [photos, setPhotos] = useState<ProgressPhotoState>({
    front: null,
    side: null,
    back: null,
  });

  useEffect(() => {
    async function loadRelationship() {
      if (!supabase) {
        setError("Supabase is not configured.");
        setIsLoading(false);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Sign in as a member before submitting a check-in.");
        setIsLoading(false);
        return;
      }

      const { data: member } = await supabase.from("members").select("id").eq("profile_id", user.id).maybeSingle();

      if (!member) {
        setError("Complete member onboarding before submitting a check-in.");
        setIsLoading(false);
        return;
      }

      const { data: relationship, error: relationshipError } = await supabase
        .from("trainer_clients")
        .select("id")
        .eq("member_id", member.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (relationshipError) {
        setError(relationshipError.message);
        setIsLoading(false);
        return;
      }

      if (!relationship) {
        setError("Join a trainer before submitting check-ins.");
        setIsLoading(false);
        return;
      }

      setForm((current) => ({ ...current, trainerClientId: relationship.id }));
      setIsLoading(false);
    }

    loadRelationship();
  }, [supabase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitLockRef.current || isSubmitting) {
      return;
    }

    submitLockRef.current = true;
    setError(null);
    setStatus(null);

    if (!supabase || !form.trainerClientId) {
      submitLockRef.current = false;
      setError("Unable to find an active trainer relationship.");
      return;
    }

    const validationError = validateCheckInForm(form, photos);

    if (validationError) {
      submitLockRef.current = false;
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    const { data: checkin, error: checkinError } = await supabase
      .from("progress_checkins")
      .upsert(
        {
          trainer_client_id: form.trainerClientId,
          week_start_date: form.weekStartDate,
          weight_kg: numberOrNull(form.weightKg),
          adherence_percent: integerOrNull(form.adherencePercent),
          notes: form.notes || null,
        },
        { onConflict: "trainer_client_id,week_start_date" },
      )
      .select("id")
      .single();

    if (checkinError) {
      submitLockRef.current = false;
      setIsSubmitting(false);
      setError(checkinError.message);
      return;
    }

    const { error: measurementError } = await supabase.from("progress_measurements").upsert(
      {
        progress_checkin_id: checkin.id,
        chest_cm: numberOrNull(form.chestCm),
        waist_cm: numberOrNull(form.waistCm),
        hip_cm: numberOrNull(form.hipCm),
        glutes_cm: numberOrNull(form.glutesCm),
        arm_cm: numberOrNull(form.armCm),
        thigh_cm: numberOrNull(form.thighCm),
        calf_cm: numberOrNull(form.calfCm),
      },
      { onConflict: "progress_checkin_id" },
    );

    if (measurementError) {
      submitLockRef.current = false;
      setIsSubmitting(false);
      setError(measurementError.message);
      return;
    }

    const selectedPhotos = getSelectedPhotos(photos);

    if (selectedPhotos.length) {
      const photoError = await uploadProgressPhotos({
        supabase,
        trainerClientId: form.trainerClientId,
        checkinId: checkin.id,
        photos: selectedPhotos,
      });

      if (photoError) {
        submitLockRef.current = false;
        setIsSubmitting(false);
        setError(photoError);
        return;
      }
    }

    submitLockRef.current = false;
    setIsSubmitting(false);
    setStatus(selectedPhotos.length ? "Weekly check-in and photos saved." : "Weekly check-in saved.");
  }

  function updateField(field: keyof CheckInFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updatePhoto(label: ProgressPhotoLabel, file: File | null) {
    setPhotos((current) => ({ ...current, [label]: file }));
  }

  return (
    <main className="min-h-screen bg-stone-50 px-5 py-6">
      <section className="mx-auto max-w-3xl rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <Link href="/member" className="text-sm font-medium text-emerald-700">
          Back to member home
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-950">Weekly check-in</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Submit your weekly progress so your trainer can review trends and adjust your plan.
        </p>

        {error ? <p className="mt-5 rounded-md bg-rose-50 p-3 text-sm leading-6 text-rose-800">{error}</p> : null}
        {status ? <p className="mt-5 rounded-md bg-emerald-50 p-3 text-sm leading-6 text-emerald-800">{status}</p> : null}

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Week start" type="date" value={form.weekStartDate} onChange={(value) => updateField("weekStartDate", value)} />
            <Field label="Weight kg" type="number" min="20" max="300" value={form.weightKg} onChange={(value) => updateField("weightKg", value)} />
            <Field
              label="Adherence %"
              type="number"
              min="0"
              max="100"
              value={form.adherencePercent}
              onChange={(value) => updateField("adherencePercent", value)}
            />
          </div>

          <label className="block">
            <span className="text-sm font-medium text-zinc-700">Notes</span>
            <textarea
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              className="mt-2 min-h-28 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900"
              placeholder="Energy, hunger, training performance, sleep, blockers"
            />
          </label>

          <section>
            <h2 className="text-base font-semibold text-zinc-950">Measurements cm</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Chest", "chestCm"],
                ["Waist", "waistCm"],
                ["Hip", "hipCm"],
                ["Glutes", "glutesCm"],
                ["Arm", "armCm"],
                ["Thigh", "thighCm"],
                ["Calf", "calfCm"],
              ].map(([label, field]) => (
                <Field
                  key={field}
                  label={label}
                  type="number"
                  min="1"
                  max="300"
                  value={form[field as keyof CheckInFormState] ?? ""}
                  onChange={(value) => updateField(field as keyof CheckInFormState, value)}
                />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-base font-semibold text-zinc-950">Progress photos</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">Upload the same three angles each week for clean transformation comparisons.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {(["front", "side", "back"] as const).map((label) => (
                <PhotoField key={label} label={label} file={photos[label]} onChange={(file) => updatePhoto(label, file)} />
              ))}
            </div>
          </section>

          <button
            type="submit"
            disabled={isLoading || isSubmitting || !form.trainerClientId}
            className="h-11 w-full rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Saving" : "Save check-in"}
          </button>
        </form>
      </section>
    </main>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  type: "text" | "number" | "date";
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <input
        type={type}
        step={type === "number" ? "0.1" : undefined}
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-900"
      />
    </label>
  );
}

function PhotoField({
  label,
  file,
  onChange,
}: {
  label: ProgressPhotoLabel;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <label className="block rounded-lg border border-zinc-200 bg-zinc-50 p-3">
      <span className="text-sm font-medium capitalize text-zinc-700">{label}</span>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
        className="mt-3 block w-full text-sm text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-800"
      />
      <span className="mt-2 block min-h-5 text-xs text-zinc-500">{file ? file.name : "No photo selected"}</span>
    </label>
  );
}

function numberOrNull(value: string) {
  return value.trim() ? Number(value) : null;
}

function integerOrNull(value: string) {
  return value.trim() ? Math.round(Number(value)) : null;
}

async function uploadProgressPhotos({
  supabase,
  trainerClientId,
  checkinId,
  photos,
}: {
  supabase: ReturnType<typeof createSupabaseBrowserClient>;
  trainerClientId: string;
  checkinId: string;
  photos: Array<{ label: ProgressPhotoLabel; file: File }>;
}) {
  for (const photo of photos) {
    const extension = getFileExtension(photo.file.name);
    const path = `${trainerClientId}/${checkinId}/${photo.label}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("progress-photos").upload(path, photo.file, {
      upsert: true,
      contentType: photo.file.type,
    });

    if (uploadError) {
      return uploadError.message;
    }

    const { error: insertError } = await supabase.from("progress_photos").upsert(
      {
        progress_checkin_id: checkinId,
        storage_path: path,
        photo_label: photo.label,
      },
      { onConflict: "progress_checkin_id,photo_label" },
    );

    if (insertError) {
      return insertError.message;
    }
  }

  return null;
}

function validateCheckInForm(form: CheckInFormState, photos: ProgressPhotoState) {
  if (!form.weekStartDate) {
    return "Week start date is required.";
  }

  if (!form.weightKg.trim()) {
    return "Weight is required.";
  }

  const weight = Number(form.weightKg);

  if (!Number.isFinite(weight) || weight < 20 || weight > 300) {
    return "Weight must be between 20 and 300 kg.";
  }

  if (!form.adherencePercent.trim()) {
    return "Adherence percentage is required.";
  }

  const adherence = Number(form.adherencePercent);

  if (!Number.isFinite(adherence) || adherence < 0 || adherence > 100) {
    return "Adherence must be between 0 and 100.";
  }

  for (const [label, value] of [
    ["Chest", form.chestCm],
    ["Waist", form.waistCm],
    ["Hip", form.hipCm],
    ["Glutes", form.glutesCm],
    ["Arm", form.armCm],
    ["Thigh", form.thighCm],
    ["Calf", form.calfCm],
  ]) {
    if (!value.trim()) {
      continue;
    }

    const measurement = Number(value);

    if (!Number.isFinite(measurement) || measurement < 1 || measurement > 300) {
      return `${label} measurement must be between 1 and 300 cm.`;
    }
  }

  for (const [label, file] of Object.entries(photos) as Array<[ProgressPhotoLabel, File | null]>) {
    if (!file) {
      continue;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return `${label} photo must be JPG, PNG, or WebP.`;
    }

    if (file.size > 10 * 1024 * 1024) {
      return `${label} photo must be 10 MB or smaller.`;
    }
  }

  return null;
}

function getSelectedPhotos(photos: ProgressPhotoState) {
  return (Object.entries(photos) as Array<[ProgressPhotoLabel, File | null]>)
    .filter((entry): entry is [ProgressPhotoLabel, File] => Boolean(entry[1]))
    .map(([label, file]) => ({ label, file }));
}

function getFileExtension(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (extension === "png" || extension === "webp" || extension === "jpg" || extension === "jpeg") {
    return extension;
  }

  return "jpg";
}

function getCurrentWeekStartDate() {
  const date = new Date();
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  return monday.toISOString().slice(0, 10);
}

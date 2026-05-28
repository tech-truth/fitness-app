"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/env";

type DietTemplateCard = {
  id: string;
  name: string;
  preference: string;
  calories: string;
  protein: string;
  mealsCount: number;
  foodsCount: number;
  hasInstructions: boolean;
  createdAt: string;
};

type DietTemplateRow = {
  id: string;
  name: string | null;
  calorie_target: number | null;
  protein_target_grams: number | null;
  meal_count: number | null;
  dietary_preference: string | null;
  general_instructions: string | null;
  created_at: string;
  meals: Array<{
    id: string;
    meal_foods: Array<{ id: string }> | null;
  }> | null;
};

type TemplateListState = {
  templates: DietTemplateCard[];
  isLoading: boolean;
  error: string | null;
};

const initialState: TemplateListState = {
  templates: [],
  isLoading: true,
  error: null,
};

export function DietTemplateList() {
  const hasConfig = hasSupabaseBrowserConfig();
  const supabase = useMemo(() => (hasConfig ? createSupabaseBrowserClient() : null), [hasConfig]);
  const [state, setState] = useState<TemplateListState>(initialState);

  useEffect(() => {
    let isMounted = true;

    async function loadTemplates() {
      if (!supabase) {
        setState({ ...initialState, isLoading: false, error: "Supabase is not configured." });
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setState({ ...initialState, isLoading: false, error: "Sign in as a trainer to view templates." });
        return;
      }

      const { data: trainer, error: trainerError } = await supabase
        .from("trainers")
        .select("id")
        .eq("profile_id", user.id)
        .maybeSingle();

      if (trainerError || !trainer) {
        setState({
          ...initialState,
          isLoading: false,
          error: trainerError?.message ?? "Complete trainer onboarding before viewing templates.",
        });
        return;
      }

      const { data, error } = await supabase
        .from("diet_templates")
        .select(
          `
          id,
          name,
          calorie_target,
          protein_target_grams,
          meal_count,
          dietary_preference,
          general_instructions,
          created_at,
          meals (
            id,
            meal_foods (
              id
            )
          )
        `,
        )
        .eq("trainer_id", trainer.id)
        .order("created_at", { ascending: false });

      if (error) {
        setState({ ...initialState, isLoading: false, error: error.message });
        return;
      }

      if (!isMounted) {
        return;
      }

      setState({
        templates: ((data ?? []) as unknown as DietTemplateRow[]).map(formatDietTemplate),
        isLoading: false,
        error: null,
      });
    }

    loadTemplates();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  return (
    <TemplateShell
      title="Diet templates"
      description="Reusable meal plans, food quantities, and daily instructions."
      createHref="/templates/diets/new"
      createLabel="New diet"
    >
      {state.error ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          {state.error}
        </section>
      ) : null}

      {state.isLoading ? (
        <section className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-600 shadow-sm">
          Loading diet templates
        </section>
      ) : state.templates.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {state.templates.map((template) => (
            <article key={template.id} className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-zinc-950">{template.name}</h2>
                  <p className="mt-2 text-sm text-zinc-500">{template.preference}</p>
                </div>
                {template.hasInstructions ? (
                  <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800">
                    Instructions
                  </span>
                ) : null}
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <Metric label="Calories" value={template.calories} />
                <Metric label="Protein" value={template.protein} />
                <Metric label="Meals" value={String(template.mealsCount)} />
                <Metric label="Foods" value={String(template.foodsCount)} />
              </div>

              <p className="mt-4 text-xs text-zinc-500">Created {template.createdAt}</p>
              <Link
                href={`/templates/diets/${template.id}`}
                className="mt-4 inline-flex rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              >
                Edit
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <EmptyTemplates
          title="No diet templates yet"
          description="Create your first reusable diet template with meals, quantities, and common instructions."
          href="/templates/diets/new"
          label="Create diet template"
        />
      )}
    </TemplateShell>
  );
}

function TemplateShell({
  title,
  description,
  createHref,
  createLabel,
  children,
}: {
  title: string;
  description: string;
  createHref: string;
  createLabel: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-stone-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div>
            <Link href="/dashboard" className="text-sm font-medium text-emerald-700">
              Back to dashboard
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-zinc-950">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
          </div>
          <Link
            href={createHref}
            className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            {createLabel}
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-6">{children}</div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
      <p className="text-xs font-medium uppercase text-zinc-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-zinc-950">{value}</p>
    </div>
  );
}

function EmptyTemplates({
  title,
  description,
  href,
  label,
}: {
  title: string;
  description: string;
  href: string;
  label: string;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-zinc-950">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">{description}</p>
      <Link
        href={href}
        className="mt-5 inline-flex rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
      >
        {label}
      </Link>
    </section>
  );
}

function formatDietTemplate(template: DietTemplateRow): DietTemplateCard {
  const meals = template.meals ?? [];
  const foodsCount = meals.reduce((total, meal) => total + (meal.meal_foods?.length ?? 0), 0);

  return {
    id: template.id,
    name: template.name ?? "Untitled diet",
    preference: formatLabel(template.dietary_preference ?? "Not set"),
    calories: template.calorie_target ? `${template.calorie_target} kcal` : "Not set",
    protein: template.protein_target_grams ? `${template.protein_target_grams} g` : "Not set",
    mealsCount: meals.length || template.meal_count || 0,
    foodsCount,
    hasInstructions: Boolean(template.general_instructions?.trim()),
    createdAt: formatDate(template.created_at),
  };
}

function formatLabel(value: string) {
  return value.replaceAll("_", " ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

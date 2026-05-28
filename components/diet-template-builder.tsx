"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { hasSupabaseBrowserConfig } from "@/lib/supabase/env";

type FoodDraft = {
  name: string;
  quantity: string;
};

type MealDraft = {
  title: string;
  notes: string;
  alternatives: string;
  foods: FoodDraft[];
};

type DietDraft = {
  name: string;
  calorieTarget: string;
  proteinTargetGrams: string;
  mealCount: string;
  dietaryPreference: string;
  generalInstructions: string;
  meals: MealDraft[];
};

type DietTemplateBuilderProps = {
  templateId?: string;
};

type DietTemplateEditRow = {
  id: string;
  name: string | null;
  calorie_target: number | null;
  protein_target_grams: number | null;
  meal_count: number | null;
  dietary_preference: string | null;
  general_instructions: string | null;
  meals: Array<{
    id: string;
    meal_order: number;
    title: string | null;
    notes: string | null;
    alternatives: string[] | null;
    meal_foods: Array<{
      food_order: number;
      name: string | null;
      quantity: string | null;
    }> | null;
  }> | null;
};

const emptyFood: FoodDraft = {
  name: "",
  quantity: "",
};

const initialDiet: DietDraft = {
  name: "",
  calorieTarget: "1800",
  proteinTargetGrams: "120",
  mealCount: "4",
  dietaryPreference: "balanced",
  generalInstructions: "Drink 4L of water per day.",
  meals: [
    {
      title: "Breakfast",
      notes: "",
      alternatives: "",
      foods: [{ ...emptyFood }],
    },
  ],
};

export function DietTemplateBuilder({ templateId }: DietTemplateBuilderProps) {
  const hasConfig = hasSupabaseBrowserConfig();
  const supabase = useMemo(() => (hasConfig ? createSupabaseBrowserClient() : null), [hasConfig]);
  const submitLockRef = useRef(false);
  const [diet, setDiet] = useState<DietDraft>(initialDiet);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(Boolean(templateId));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const isEditing = Boolean(templateId);

  useEffect(() => {
    let isMounted = true;

    async function loadTemplate() {
      if (!templateId) {
        return;
      }

      if (!supabase) {
        setError("Supabase is not configured.");
        setIsLoadingTemplate(false);
        return;
      }

      const { data, error: loadError } = await supabase
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
          meals (
            id,
            meal_order,
            title,
            notes,
            alternatives,
            meal_foods (
              food_order,
              name,
              quantity
            )
          )
        `,
        )
        .eq("id", templateId)
        .maybeSingle();

      if (!isMounted) {
        return;
      }

      if (loadError || !data) {
        setError(loadError?.message ?? "Diet template not found.");
        setIsLoadingTemplate(false);
        return;
      }

      setDiet(mapDietTemplateRow(data as unknown as DietTemplateEditRow));
      setIsLoadingTemplate(false);
    }

    loadTemplate();

    return () => {
      isMounted = false;
    };
  }, [supabase, templateId]);

  async function saveDiet(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitLockRef.current || isSaving) {
      return;
    }

    submitLockRef.current = true;
    setError(null);
    setStatus(null);

    if (!supabase) {
      submitLockRef.current = false;
      setError("Supabase is not configured.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      submitLockRef.current = false;
      setError("Sign in as a trainer before creating templates.");
      return;
    }

    const { data: trainer, error: trainerError } = await supabase
      .from("trainers")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();

    if (trainerError || !trainer) {
      submitLockRef.current = false;
      setError(trainerError?.message ?? "Complete trainer onboarding before creating templates.");
      return;
    }

    const cleanMeals = diet.meals
      .map((meal) => ({
        ...meal,
        foods: meal.foods.filter((food) => food.name.trim() && food.quantity.trim()),
      }))
      .filter((meal) => meal.title.trim() && meal.foods.length);

    const validationError = validateDietTemplate(diet, cleanMeals);

    if (validationError) {
      submitLockRef.current = false;
      setError(validationError);
      return;
    }

    setIsSaving(true);

    const dietPayload = {
      name: diet.name.trim(),
      calorie_target: integerOrNull(diet.calorieTarget),
      protein_target_grams: integerOrNull(diet.proteinTargetGrams),
      meal_count: integerOrNull(diet.mealCount),
      dietary_preference: diet.dietaryPreference.trim() || null,
      general_instructions: diet.generalInstructions.trim() || null,
    };

    const { data: dietTemplate, error: dietError } = isEditing
      ? await supabase
          .from("diet_templates")
          .update({ ...dietPayload, updated_at: new Date().toISOString() })
          .eq("id", templateId)
          .select("id")
          .single()
      : await supabase
          .from("diet_templates")
          .insert({
            trainer_id: trainer.id,
            ...dietPayload,
          })
          .select("id")
          .single();

    if (dietError) {
      submitLockRef.current = false;
      setIsSaving(false);
      setError(dietError.message);
      return;
    }

    if (isEditing) {
      const { data: existingMeals, error: existingMealsError } = await supabase
        .from("meals")
        .select("id")
        .eq("diet_template_id", dietTemplate.id);

      if (existingMealsError) {
        submitLockRef.current = false;
        setIsSaving(false);
        setError(existingMealsError.message);
        return;
      }

      const existingMealIds = (existingMeals ?? []).map((meal) => meal.id);

      if (existingMealIds.length) {
        const { error: foodDeleteError } = await supabase.from("meal_foods").delete().in("meal_id", existingMealIds);

        if (foodDeleteError) {
          submitLockRef.current = false;
          setIsSaving(false);
          setError(foodDeleteError.message);
          return;
        }
      }

      const { error: mealDeleteError } = await supabase.from("meals").delete().eq("diet_template_id", dietTemplate.id);

      if (mealDeleteError) {
        submitLockRef.current = false;
        setIsSaving(false);
        setError(mealDeleteError.message);
        return;
      }
    }

    for (const [mealIndex, meal] of cleanMeals.entries()) {
      const { data: savedMeal, error: mealError } = await supabase
        .from("meals")
        .insert({
          diet_template_id: dietTemplate.id,
          meal_order: mealIndex + 1,
          title: meal.title.trim(),
          notes: meal.notes.trim() || null,
          alternatives: splitList(meal.alternatives),
        })
        .select("id")
        .single();

      if (mealError) {
        submitLockRef.current = false;
        setIsSaving(false);
        setError(mealError.message);
        return;
      }

      const foods = meal.foods.map((food, foodIndex) => ({
        meal_id: savedMeal.id,
        food_order: foodIndex + 1,
        name: food.name.trim(),
        quantity: food.quantity.trim(),
      }));

      const { error: foodError } = await supabase.from("meal_foods").insert(foods);

      if (foodError) {
        submitLockRef.current = false;
        setIsSaving(false);
        setError(foodError.message);
        return;
      }
    }

    submitLockRef.current = false;
    setIsSaving(false);
    setStatus(isEditing ? "Diet template updated." : "Diet template saved.");
    if (!isEditing) {
      setDiet(initialDiet);
    }
  }

  function updateDiet(field: keyof Omit<DietDraft, "meals">, value: string) {
    setDiet((current) => ({ ...current, [field]: value }));
  }

  function updateMeal(mealIndex: number, field: keyof Omit<MealDraft, "foods">, value: string) {
    setDiet((current) => ({
      ...current,
      meals: current.meals.map((meal, index) => (index === mealIndex ? { ...meal, [field]: value } : meal)),
    }));
  }

  function updateFood(mealIndex: number, foodIndex: number, field: keyof FoodDraft, value: string) {
    setDiet((current) => ({
      ...current,
      meals: current.meals.map((meal, currentMealIndex) =>
        currentMealIndex === mealIndex
          ? {
              ...meal,
              foods: meal.foods.map((food, currentFoodIndex) =>
                currentFoodIndex === foodIndex ? { ...food, [field]: value } : food,
              ),
            }
          : meal,
      ),
    }));
  }

  function addMeal() {
    setDiet((current) => ({
      ...current,
      meals: [
        ...current.meals,
        {
          title: `Meal ${current.meals.length + 1}`,
          notes: "",
          alternatives: "",
          foods: [{ ...emptyFood }],
        },
      ],
    }));
  }

  function addFood(mealIndex: number) {
    setDiet((current) => ({
      ...current,
      meals: current.meals.map((meal, index) =>
        index === mealIndex ? { ...meal, foods: [...meal.foods, { ...emptyFood }] } : meal,
      ),
    }));
  }

  function removeMeal(mealIndex: number) {
    setDiet((current) => ({
      ...current,
      meals: current.meals.filter((_, index) => index !== mealIndex),
    }));
  }

  function removeFood(mealIndex: number, foodIndex: number) {
    setDiet((current) => ({
      ...current,
      meals: current.meals.map((meal, index) =>
        index === mealIndex ? { ...meal, foods: meal.foods.filter((_, currentFoodIndex) => currentFoodIndex !== foodIndex) } : meal,
      ),
    }));
  }

  return (
    <main className="min-h-screen bg-stone-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto max-w-5xl px-5 py-4">
          <Link href={isEditing ? "/templates/diets" : "/dashboard"} className="text-sm font-medium text-emerald-700">
            {isEditing ? "Back to diets" : "Back to dashboard"}
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-950">
            {isEditing ? "Edit diet template" : "New diet template"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            {isEditing ? "Update this reusable meal plan." : "Create reusable meal plans you can assign to clients later."}
          </p>
        </div>
      </header>

      <form onSubmit={saveDiet} className="mx-auto grid max-w-5xl gap-6 px-5 py-6">
        {error ? <div className="rounded-md bg-rose-50 p-3 text-sm leading-6 text-rose-800">{error}</div> : null}
        {status ? <div className="rounded-md bg-emerald-50 p-3 text-sm leading-6 text-emerald-800">{status}</div> : null}
        {isLoadingTemplate ? (
          <p className="rounded-md border border-zinc-200 bg-white p-4 text-sm text-zinc-600 shadow-sm">Loading template</p>
        ) : null}

        <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-zinc-950">Template basics</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Template name" value={diet.name} onChange={(value) => updateDiet("name", value)} placeholder="South Indian fat loss" required />
            <Field label="Calories" type="number" min="800" max="6000" value={diet.calorieTarget} onChange={(value) => updateDiet("calorieTarget", value)} />
            <Field label="Protein grams" type="number" min="20" max="400" value={diet.proteinTargetGrams} onChange={(value) => updateDiet("proteinTargetGrams", value)} />
            <Field label="Meal count" type="number" min="1" max="10" value={diet.mealCount} onChange={(value) => updateDiet("mealCount", value)} />
            <label className="grid gap-2 text-sm font-medium text-zinc-800">
              Dietary preference
              <select
                value={diet.dietaryPreference}
                onChange={(event) => updateDiet("dietaryPreference", event.target.value)}
                className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-emerald-600"
              >
                <option value="balanced">Balanced</option>
                <option value="vegetarian">Vegetarian</option>
                <option value="vegan">Vegan</option>
                <option value="eggetarian">Eggetarian</option>
                <option value="non_vegetarian">Non vegetarian</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-800 sm:col-span-2">
              General instructions
              <textarea
                value={diet.generalInstructions}
                onChange={(event) => updateDiet("generalInstructions", event.target.value)}
                rows={4}
                placeholder="Drink 4L of water per day. Avoid sugar drinks. Keep dinner before 8 PM."
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-emerald-600"
              />
            </label>
          </div>
        </section>

        {diet.meals.map((meal, mealIndex) => (
          <section key={mealIndex} className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-zinc-950">Meal {mealIndex + 1}</h2>
              {diet.meals.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeMeal(mealIndex)}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Remove meal
                </button>
              ) : null}
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Meal title" value={meal.title} onChange={(value) => updateMeal(mealIndex, "title", value)} required />
              <Field label="Alternatives" value={meal.alternatives} onChange={(value) => updateMeal(mealIndex, "alternatives", value)} placeholder="Idli, dosa, oats" />
              <label className="grid gap-2 text-sm font-medium text-zinc-800 sm:col-span-2">
                Notes
                <textarea
                  value={meal.notes}
                  onChange={(event) => updateMeal(mealIndex, "notes", event.target.value)}
                  rows={3}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-emerald-600"
                />
              </label>
            </div>

            <div className="mt-5 space-y-3">
              {meal.foods.map((food, foodIndex) => (
                <div key={foodIndex} className="grid gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 sm:grid-cols-[1fr_180px_auto]">
                  <Field label="Food" value={food.name} onChange={(value) => updateFood(mealIndex, foodIndex, "name", value)} placeholder="Rice" required />
                  <Field label="Quantity" value={food.quantity} onChange={(value) => updateFood(mealIndex, foodIndex, "quantity", value)} placeholder="150 g" required />
                  <button
                    type="button"
                    onClick={() => removeFood(mealIndex, foodIndex)}
                    disabled={meal.foods.length === 1}
                    className="self-end rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addFood(mealIndex)}
                className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
              >
                Add food
              </button>
            </div>
          </section>
        ))}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={addMeal}
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Add meal
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-md bg-zinc-950 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving" : isEditing ? "Update diet template" : "Save diet template"}
          </button>
        </div>
      </form>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  min?: string;
  max?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-zinc-800">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        min={min}
        max={max}
        className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-emerald-600"
      />
    </label>
  );
}

function validateDietTemplate(diet: DietDraft, cleanMeals: MealDraft[]) {
  if (!diet.name.trim()) {
    return "Template name is required.";
  }

  const calories = integerOrNull(diet.calorieTarget);
  if (calories == null || calories < 800 || calories > 6000) {
    return "Calories must be between 800 and 6000.";
  }

  const protein = integerOrNull(diet.proteinTargetGrams);
  if (protein == null || protein < 20 || protein > 400) {
    return "Protein must be between 20 and 400 grams.";
  }

  const mealCount = integerOrNull(diet.mealCount);
  if (mealCount == null || mealCount < 1 || mealCount > 10) {
    return "Meal count must be between 1 and 10.";
  }

  if (!cleanMeals.length) {
    return "Add at least one meal with one food item.";
  }

  for (const [mealIndex, meal] of cleanMeals.entries()) {
    if (!meal.title.trim()) {
      return `Meal ${mealIndex + 1} needs a title.`;
    }

    if (!meal.foods.length) {
      return `${meal.title} needs at least one food item.`;
    }

    for (const food of meal.foods) {
      if (!food.name.trim() || !food.quantity.trim()) {
        return `${meal.title} has a food item missing name or quantity.`;
      }
    }
  }

  return null;
}

function mapDietTemplateRow(row: DietTemplateEditRow): DietDraft {
  const meals = (row.meals ?? [])
    .toSorted((a, b) => a.meal_order - b.meal_order)
    .map((meal) => ({
      title: meal.title ?? `Meal ${meal.meal_order}`,
      notes: meal.notes ?? "",
      alternatives: meal.alternatives?.join(", ") ?? "",
      foods: (meal.meal_foods ?? [])
        .toSorted((a, b) => a.food_order - b.food_order)
        .map((food) => ({
          name: food.name ?? "",
          quantity: food.quantity ?? "",
        })),
    }));

  return {
    name: row.name ?? "",
    calorieTarget: row.calorie_target?.toString() ?? "1800",
    proteinTargetGrams: row.protein_target_grams?.toString() ?? "120",
    mealCount: row.meal_count?.toString() ?? "4",
    dietaryPreference: row.dietary_preference ?? "balanced",
    generalInstructions: row.general_instructions ?? "",
    meals: meals.length ? meals : initialDiet.meals,
  };
}

function integerOrNull(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function splitList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

import type {
  AiProvider,
  DietDraft,
  DietDraftInput,
  ProgressSummary,
  ProgressSummaryInput,
  WorkoutDraft,
  WorkoutDraftInput,
} from "../types";

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

type NvidiaNimOptions = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

const SYSTEM_PROMPT = "You are an assistant for professional personal trainers. Produce practical draft plans only. The trainer is always the final decision maker. Return valid JSON only.";

export class NvidiaNimProvider implements AiProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(options?: Partial<NvidiaNimOptions>) {
    this.apiKey = options?.apiKey ?? process.env.NVIDIA_NIM_API_KEY ?? "";
    this.baseUrl = options?.baseUrl ?? process.env.NVIDIA_NIM_BASE_URL ?? "https://integrate.api.nvidia.com/v1";
    this.model = options?.model ?? process.env.NVIDIA_NIM_MODEL ?? "meta/llama-3.1-70b-instruct";

    if (!this.apiKey) {
      throw new Error("NVIDIA_NIM_API_KEY is required to use the NVIDIA NIM provider.");
    }
  }

  async generateWorkoutDraft(input: WorkoutDraftInput): Promise<WorkoutDraft> {
    return this.completeJson<WorkoutDraft>([
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content:
          "Create a workout template draft for this client context. JSON shape: " +
          "{\"title\": string, \"goal\": \"fat_loss\"|\"muscle_gain\"|\"strength\"|\"recomposition\"|\"general_fitness\", \"durationWeeks\": number, \"difficulty\": string, \"days\": [{\"title\": string, \"focus\": string, \"exercises\": [{\"name\": string, \"sets\": number, \"reps\": string, \"restSeconds\": number, \"notes\": string, \"substitutions\": string[]}]}], \"trainerReviewNotes\": string[]}. Context: " +
          JSON.stringify(input),
      },
    ]);
  }

  async generateDietDraft(input: DietDraftInput): Promise<DietDraft> {
    return this.completeJson<DietDraft>([
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content:
          "Create a meal-based diet template draft. JSON shape: " +
          "{\"title\": string, \"calorieTarget\": number, \"proteinTargetGrams\": number, \"meals\": [{\"title\": string, \"foods\": [{\"name\": string, \"quantity\": string}], \"notes\": string, \"alternatives\": string[]}], \"trainerReviewNotes\": string[]}. Context: " +
          JSON.stringify(input),
      },
    ]);
  }

  async summarizeWeeklyProgress(input: ProgressSummaryInput): Promise<ProgressSummary> {
    return this.completeJson<ProgressSummary>([
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content:
          "Summarize weekly progress for trainer review. JSON shape: " +
          "{\"summary\": string, \"trend\": \"improving\"|\"stalled\"|\"regressing\"|\"insufficient_data\", \"suggestedAdjustments\": string[], \"risks\": string[], \"trainerReviewNotes\": string[]}. Context: " +
          JSON.stringify(input),
      },
    ]);
  }

  private async completeJson<T>(messages: ChatMessage[]): Promise<T> {
    const response = await fetch(this.baseUrl.replace(/\/$/, "") + "/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error("NVIDIA NIM request failed: " + response.status + " " + errorText);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("NVIDIA NIM response did not include message content.");
    }

    return JSON.parse(content) as T;
  }
}

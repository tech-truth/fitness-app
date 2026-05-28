import { NvidiaNimProvider } from "./providers/nvidia-nim";
import type { AiProvider } from "./types";

export function createAiProvider(): AiProvider {
  const provider = process.env.AI_PROVIDER ?? "nvidia-nim";

  if (provider === "nvidia-nim") {
    return new NvidiaNimProvider();
  }

  throw new Error("Unsupported AI_PROVIDER: " + provider);
}

export const aiService = {
  generateWorkoutDraft: (...args: Parameters<AiProvider["generateWorkoutDraft"]>) =>
    createAiProvider().generateWorkoutDraft(...args),
  generateDietDraft: (...args: Parameters<AiProvider["generateDietDraft"]>) =>
    createAiProvider().generateDietDraft(...args),
  summarizeWeeklyProgress: (...args: Parameters<AiProvider["summarizeWeeklyProgress"]>) =>
    createAiProvider().summarizeWeeklyProgress(...args),
};

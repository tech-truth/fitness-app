# FitnessOS MVP Architecture

## Stack

- Next.js App Router with TypeScript for the trainer portal and member web experience.
- Supabase Auth for identity.
- Supabase Postgres for relational product data.
- Supabase Storage for weekly progress photos.
- NVIDIA NIM API as the first AI provider.
- Vercel-ready deployment.

## Product Boundary

The MVP is a trainer operations platform, not a social fitness app. The first product surface is the trainer dashboard: clients, pending reviews, missed check-ins, new uploads, and AI review queue.

## AI Boundary

Product code must call the internal AI service rather than provider SDKs directly. This keeps the app portable across NVIDIA NIM, OpenAI, AWS Bedrock, or a self-hosted model.

Current interface:

- generateWorkoutDraft
- generateDietDraft
- summarizeWeeklyProgress

Current implementation:

- NvidiaNimProvider

Environment variables:

- AI_PROVIDER=nvidia-nim
- NVIDIA_NIM_API_KEY
- NVIDIA_NIM_BASE_URL=https://integrate.api.nvidia.com/v1
- NVIDIA_NIM_MODEL

## Data Ownership

Supabase row-level security should enforce trainer/member access rules. The initial migration enables RLS but leaves final policies for the auth implementation pass.

## Member Experience

The MVP should use mobile-first web screens. React Native/Expo can be added after the core coaching workflow is validated.

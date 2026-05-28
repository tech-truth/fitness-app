# FitnessOS

AI-assisted client management for freelance personal trainers and online fitness coaches.

## MVP Stack

- Next.js + TypeScript
- Supabase Auth
- Supabase Postgres
- Supabase Storage
- NVIDIA NIM API for the first AI provider
- Vercel-ready deployment

## Getting Started

Install dependencies:

~~~bash
npm install
~~~

Create .env.local:

~~~bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
# or, for newer Supabase projects:
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
AI_PROVIDER=nvidia-nim
NVIDIA_NIM_API_KEY=
NVIDIA_NIM_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_NIM_MODEL=meta/llama-3.1-70b-instruct
~~~

Run the development server:

~~~bash
npm run dev
~~~

Open http://localhost:3000.

## Architecture Notes

See docs/architecture.md.

## MVP Roadmap

See docs/mvp-roadmap.md.

## Current Routes

- `/` public product entry
- `/sign-up` email/password account creation
- `/sign-in` email/password sign in
- `/onboarding` trainer/member profile setup
- `/dashboard` trainer dashboard shell
- `/member` member mobile web shell
- `/join/[inviteCode]` trainer invite landing page

## Database Migrations

- `supabase/migrations/0001_initial_schema.sql`
- `supabase/migrations/0002_rls_policies.sql`
- `supabase/migrations/0003_invite_flow.sql`

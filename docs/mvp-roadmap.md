# MVP Roadmap

## Phase 1: Foundation

- Next.js scaffold
- Supabase project setup
- Initial schema migration
- AI provider abstraction
- NVIDIA NIM provider

## Phase 2: Auth and Profiles

- Trainer signup
- Trainer profile setup
- Member profile setup
- Role-based routing
- Supabase RLS ownership policies

Status: in progress. The app has email auth screens, role onboarding, trainer/member profile writes, and draft RLS policies. Live verification requires Supabase project keys.

## Phase 3: Client Management

- Invite link flow
- Client list
- Client detail view
- Client status tracking

Status: in progress. Trainer invite link UI, invite lookup, member join RPC, real trainer dashboard client loading, and client detail route are in place.

## Phase 4: Templates

- Workout template builder
- Workout day editor
- Exercise editor
- Diet template builder
- Meal and food editor

Status: started. Workout template builder can create templates, days, and exercises.

## Phase 5: Member Check-ins

- Assigned workout view
- Assigned diet view
- Weekly measurement upload
- Progress photo upload

Status: started. Member home, weekly measurement check-in form, and progress photo upload are in place.

## Phase 6: Trainer Review

- Weekly review queue
- Progress timeline
- Measurement trend view
- AI weekly summary

Status: started. Client detail pages can generate and persist AI weekly summaries through NVIDIA NIM.

## Phase 7: AI Drafting

- AI workout draft generation
- AI diet draft generation
- AI adjustment suggestions
- Persist AI suggestions for trainer review

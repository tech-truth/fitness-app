create extension if not exists "pgcrypto";

create type user_role as enum ('trainer', 'member');
create type client_status as enum ('invited', 'active', 'paused', 'archived');
create type ai_suggestion_status as enum ('draft', 'accepted', 'rejected', 'edited');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null,
  full_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table trainers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references profiles(id) on delete cascade,
  specialization text,
  experience_years int,
  certifications text[],
  invite_code text not null unique default encode(gen_random_bytes(8), 'hex'),
  created_at timestamptz not null default now()
);

create table members (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references profiles(id) on delete cascade,
  age int,
  gender text,
  height_cm numeric(5, 2),
  current_weight_kg numeric(5, 2),
  goal text,
  injuries text[],
  dietary_preference text,
  created_at timestamptz not null default now()
);

create table trainer_clients (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references trainers(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  status client_status not null default 'invited',
  started_at timestamptz,
  created_at timestamptz not null default now(),
  unique (trainer_id, member_id)
);

create table workout_templates (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references trainers(id) on delete cascade,
  name text not null,
  goal text not null,
  duration_weeks int,
  difficulty text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table workout_days (
  id uuid primary key default gen_random_uuid(),
  workout_template_id uuid not null references workout_templates(id) on delete cascade,
  day_order int not null,
  title text not null,
  focus text,
  unique (workout_template_id, day_order)
);

create table workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_day_id uuid not null references workout_days(id) on delete cascade,
  exercise_order int not null,
  name text not null,
  sets int,
  reps text,
  rest_seconds int,
  notes text,
  substitutions text[],
  unique (workout_day_id, exercise_order)
);

create table diet_templates (
  id uuid primary key default gen_random_uuid(),
  trainer_id uuid not null references trainers(id) on delete cascade,
  name text not null,
  calorie_target int,
  protein_target_grams int,
  meal_count int,
  dietary_preference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table meals (
  id uuid primary key default gen_random_uuid(),
  diet_template_id uuid not null references diet_templates(id) on delete cascade,
  meal_order int not null,
  title text not null,
  notes text,
  alternatives text[],
  unique (diet_template_id, meal_order)
);

create table meal_foods (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references meals(id) on delete cascade,
  food_order int not null,
  name text not null,
  quantity text not null,
  unique (meal_id, food_order)
);

create table assigned_plans (
  id uuid primary key default gen_random_uuid(),
  trainer_client_id uuid not null references trainer_clients(id) on delete cascade,
  workout_template_id uuid references workout_templates(id) on delete set null,
  diet_template_id uuid references diet_templates(id) on delete set null,
  assigned_at timestamptz not null default now(),
  active boolean not null default true
);

create table progress_checkins (
  id uuid primary key default gen_random_uuid(),
  trainer_client_id uuid not null references trainer_clients(id) on delete cascade,
  week_start_date date not null,
  weight_kg numeric(5, 2),
  adherence_percent int check (adherence_percent between 0 and 100),
  notes text,
  created_at timestamptz not null default now(),
  unique (trainer_client_id, week_start_date)
);

create table progress_measurements (
  id uuid primary key default gen_random_uuid(),
  progress_checkin_id uuid not null unique references progress_checkins(id) on delete cascade,
  chest_cm numeric(5, 2),
  waist_cm numeric(5, 2),
  hip_cm numeric(5, 2),
  glutes_cm numeric(5, 2),
  arm_cm numeric(5, 2),
  thigh_cm numeric(5, 2),
  calf_cm numeric(5, 2)
);

create table progress_photos (
  id uuid primary key default gen_random_uuid(),
  progress_checkin_id uuid not null references progress_checkins(id) on delete cascade,
  storage_path text not null,
  photo_label text,
  created_at timestamptz not null default now()
);

create table ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  trainer_client_id uuid references trainer_clients(id) on delete cascade,
  suggestion_type text not null,
  provider text not null,
  model text,
  input_snapshot jsonb not null,
  output jsonb not null,
  status ai_suggestion_status not null default 'draft',
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table trainers enable row level security;
alter table members enable row level security;
alter table trainer_clients enable row level security;
alter table workout_templates enable row level security;
alter table workout_days enable row level security;
alter table workout_exercises enable row level security;
alter table diet_templates enable row level security;
alter table meals enable row level security;
alter table meal_foods enable row level security;
alter table assigned_plans enable row level security;
alter table progress_checkins enable row level security;
alter table progress_measurements enable row level security;
alter table progress_photos enable row level security;
alter table ai_suggestions enable row level security;

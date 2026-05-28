create or replace function public.current_trainer_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from trainers where profile_id = auth.uid()
$$;

create or replace function public.current_member_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from members where profile_id = auth.uid()
$$;

create or replace function public.can_access_trainer_client(trainer_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from trainer_clients tc
    where tc.id = trainer_client_id
      and (
        tc.trainer_id = public.current_trainer_id()
        or tc.member_id = public.current_member_id()
      )
  )
$$;

create policy "profiles can read own profile"
on profiles for select
using (id = auth.uid());

create policy "profiles can create own profile"
on profiles for insert
with check (id = auth.uid());

create policy "profiles can update own profile"
on profiles for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "trainers can manage own trainer row"
on trainers for all
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy "members can manage own member row"
on members for all
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy "trainers and members can read their relationship"
on trainer_clients for select
using (
  trainer_id = public.current_trainer_id()
  or member_id = public.current_member_id()
);

create policy "trainers can create client relationships"
on trainer_clients for insert
with check (trainer_id = public.current_trainer_id());

create policy "trainers can update client relationships"
on trainer_clients for update
using (trainer_id = public.current_trainer_id())
with check (trainer_id = public.current_trainer_id());

create policy "trainers can manage own workout templates"
on workout_templates for all
using (trainer_id = public.current_trainer_id())
with check (trainer_id = public.current_trainer_id());

create policy "trainers can manage workout days through templates"
on workout_days for all
using (
  exists (
    select 1 from workout_templates wt
    where wt.id = workout_template_id
      and wt.trainer_id = public.current_trainer_id()
  )
)
with check (
  exists (
    select 1 from workout_templates wt
    where wt.id = workout_template_id
      and wt.trainer_id = public.current_trainer_id()
  )
);

create policy "trainers can manage exercises through workout days"
on workout_exercises for all
using (
  exists (
    select 1
    from workout_days wd
    join workout_templates wt on wt.id = wd.workout_template_id
    where wd.id = workout_day_id
      and wt.trainer_id = public.current_trainer_id()
  )
)
with check (
  exists (
    select 1
    from workout_days wd
    join workout_templates wt on wt.id = wd.workout_template_id
    where wd.id = workout_day_id
      and wt.trainer_id = public.current_trainer_id()
  )
);

create policy "trainers can manage own diet templates"
on diet_templates for all
using (trainer_id = public.current_trainer_id())
with check (trainer_id = public.current_trainer_id());

create policy "trainers can manage meals through diet templates"
on meals for all
using (
  exists (
    select 1 from diet_templates dt
    where dt.id = diet_template_id
      and dt.trainer_id = public.current_trainer_id()
  )
)
with check (
  exists (
    select 1 from diet_templates dt
    where dt.id = diet_template_id
      and dt.trainer_id = public.current_trainer_id()
  )
);

create policy "trainers can manage foods through meals"
on meal_foods for all
using (
  exists (
    select 1
    from meals m
    join diet_templates dt on dt.id = m.diet_template_id
    where m.id = meal_id
      and dt.trainer_id = public.current_trainer_id()
  )
)
with check (
  exists (
    select 1
    from meals m
    join diet_templates dt on dt.id = m.diet_template_id
    where m.id = meal_id
      and dt.trainer_id = public.current_trainer_id()
  )
);

create policy "trainers can manage assigned plans"
on assigned_plans for all
using (
  exists (
    select 1 from trainer_clients tc
    where tc.id = trainer_client_id
      and tc.trainer_id = public.current_trainer_id()
  )
)
with check (
  exists (
    select 1 from trainer_clients tc
    where tc.id = trainer_client_id
      and tc.trainer_id = public.current_trainer_id()
  )
);

create policy "members can read assigned plans"
on assigned_plans for select
using (
  exists (
    select 1 from trainer_clients tc
    where tc.id = trainer_client_id
      and tc.member_id = public.current_member_id()
  )
);

create policy "trainer client parties can read checkins"
on progress_checkins for select
using (public.can_access_trainer_client(trainer_client_id));

create policy "members can create own checkins"
on progress_checkins for insert
with check (
  exists (
    select 1 from trainer_clients tc
    where tc.id = trainer_client_id
      and tc.member_id = public.current_member_id()
  )
);

create policy "members can update own checkins"
on progress_checkins for update
using (
  exists (
    select 1 from trainer_clients tc
    where tc.id = trainer_client_id
      and tc.member_id = public.current_member_id()
  )
)
with check (
  exists (
    select 1 from trainer_clients tc
    where tc.id = trainer_client_id
      and tc.member_id = public.current_member_id()
  )
);

create policy "trainer client parties can read measurements"
on progress_measurements for select
using (
  exists (
    select 1 from progress_checkins pc
    where pc.id = progress_checkin_id
      and public.can_access_trainer_client(pc.trainer_client_id)
  )
);

create policy "members can manage measurements through own checkins"
on progress_measurements for all
using (
  exists (
    select 1
    from progress_checkins pc
    join trainer_clients tc on tc.id = pc.trainer_client_id
    where pc.id = progress_checkin_id
      and tc.member_id = public.current_member_id()
  )
)
with check (
  exists (
    select 1
    from progress_checkins pc
    join trainer_clients tc on tc.id = pc.trainer_client_id
    where pc.id = progress_checkin_id
      and tc.member_id = public.current_member_id()
  )
);

create policy "trainer client parties can read progress photos"
on progress_photos for select
using (
  exists (
    select 1 from progress_checkins pc
    where pc.id = progress_checkin_id
      and public.can_access_trainer_client(pc.trainer_client_id)
  )
);

create policy "members can manage photos through own checkins"
on progress_photos for all
using (
  exists (
    select 1
    from progress_checkins pc
    join trainer_clients tc on tc.id = pc.trainer_client_id
    where pc.id = progress_checkin_id
      and tc.member_id = public.current_member_id()
  )
)
with check (
  exists (
    select 1
    from progress_checkins pc
    join trainer_clients tc on tc.id = pc.trainer_client_id
    where pc.id = progress_checkin_id
      and tc.member_id = public.current_member_id()
  )
);

create policy "trainers can manage ai suggestions"
on ai_suggestions for all
using (
  trainer_client_id is null
  or exists (
    select 1 from trainer_clients tc
    where tc.id = trainer_client_id
      and tc.trainer_id = public.current_trainer_id()
  )
)
with check (
  trainer_client_id is null
  or exists (
    select 1 from trainer_clients tc
    where tc.id = trainer_client_id
      and tc.trainer_id = public.current_trainer_id()
  )
);

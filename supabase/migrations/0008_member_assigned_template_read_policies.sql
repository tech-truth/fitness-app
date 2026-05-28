create policy "members can read assigned workout templates"
on workout_templates for select
using (
  exists (
    select 1
    from assigned_plans ap
    join trainer_clients tc on tc.id = ap.trainer_client_id
    where ap.workout_template_id = workout_templates.id
      and ap.active = true
      and tc.member_id = public.current_member_id()
  )
);

create policy "members can read assigned workout days"
on workout_days for select
using (
  exists (
    select 1
    from workout_templates wt
    join assigned_plans ap on ap.workout_template_id = wt.id
    join trainer_clients tc on tc.id = ap.trainer_client_id
    where wt.id = workout_days.workout_template_id
      and ap.active = true
      and tc.member_id = public.current_member_id()
  )
);

create policy "members can read assigned workout exercises"
on workout_exercises for select
using (
  exists (
    select 1
    from workout_days wd
    join workout_templates wt on wt.id = wd.workout_template_id
    join assigned_plans ap on ap.workout_template_id = wt.id
    join trainer_clients tc on tc.id = ap.trainer_client_id
    where wd.id = workout_exercises.workout_day_id
      and ap.active = true
      and tc.member_id = public.current_member_id()
  )
);

create policy "members can read assigned diet templates"
on diet_templates for select
using (
  exists (
    select 1
    from assigned_plans ap
    join trainer_clients tc on tc.id = ap.trainer_client_id
    where ap.diet_template_id = diet_templates.id
      and ap.active = true
      and tc.member_id = public.current_member_id()
  )
);

create policy "members can read assigned meals"
on meals for select
using (
  exists (
    select 1
    from diet_templates dt
    join assigned_plans ap on ap.diet_template_id = dt.id
    join trainer_clients tc on tc.id = ap.trainer_client_id
    where dt.id = meals.diet_template_id
      and ap.active = true
      and tc.member_id = public.current_member_id()
  )
);

create policy "members can read assigned meal foods"
on meal_foods for select
using (
  exists (
    select 1
    from meals m
    join diet_templates dt on dt.id = m.diet_template_id
    join assigned_plans ap on ap.diet_template_id = dt.id
    join trainer_clients tc on tc.id = ap.trainer_client_id
    where m.id = meal_foods.meal_id
      and ap.active = true
      and tc.member_id = public.current_member_id()
  )
);

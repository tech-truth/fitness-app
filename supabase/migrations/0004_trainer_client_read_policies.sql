create policy "trainers can read profiles for their clients"
on profiles for select
using (
  exists (
    select 1
    from members m
    join trainer_clients tc on tc.member_id = m.id
    where m.profile_id = profiles.id
      and tc.trainer_id = public.current_trainer_id()
  )
);

create policy "members can read profiles for their trainers"
on profiles for select
using (
  exists (
    select 1
    from trainers t
    join trainer_clients tc on tc.trainer_id = t.id
    where t.profile_id = profiles.id
      and tc.member_id = public.current_member_id()
  )
);

create policy "trainers can read member rows for their clients"
on members for select
using (
  exists (
    select 1
    from trainer_clients tc
    where tc.member_id = members.id
      and tc.trainer_id = public.current_trainer_id()
  )
);

create policy "members can read trainer rows for their trainers"
on trainers for select
using (
  exists (
    select 1
    from trainer_clients tc
    where tc.trainer_id = trainers.id
      and tc.member_id = public.current_member_id()
  )
);

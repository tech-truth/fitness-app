create or replace function public.join_trainer_by_invite(invite_code_input text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_trainer_id uuid;
  target_member_id uuid;
  relationship_id uuid;
begin
  select id
  into target_trainer_id
  from trainers
  where invite_code = invite_code_input;

  if target_trainer_id is null then
    raise exception 'Invalid trainer invite code';
  end if;

  select id
  into target_member_id
  from members
  where profile_id = auth.uid();

  if target_member_id is null then
    raise exception 'Complete member onboarding before joining a trainer';
  end if;

  insert into trainer_clients (trainer_id, member_id, status, started_at)
  values (target_trainer_id, target_member_id, 'active', now())
  on conflict (trainer_id, member_id)
  do update set status = 'active', started_at = coalesce(trainer_clients.started_at, now())
  returning id into relationship_id;

  return relationship_id;
end;
$$;

grant execute on function public.join_trainer_by_invite(text) to authenticated;

create or replace function public.get_trainer_by_invite(invite_code_input text)
returns table (
  trainer_id uuid,
  trainer_name text,
  specialization text
)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, p.full_name, t.specialization
  from trainers t
  join profiles p on p.id = t.profile_id
  where t.invite_code = invite_code_input
$$;

grant execute on function public.get_trainer_by_invite(text) to anon, authenticated;

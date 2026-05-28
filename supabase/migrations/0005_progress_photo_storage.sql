insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'progress-photos',
  'progress-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "members can upload own progress photos"
on storage.objects for insert
with check (
  bucket_id = 'progress-photos'
  and exists (
    select 1
    from progress_checkins pc
    join trainer_clients tc on tc.id = pc.trainer_client_id
    where pc.id::text = split_part(name, '/', 2)
      and tc.id::text = split_part(name, '/', 1)
      and tc.member_id = public.current_member_id()
  )
);

create policy "members can update own progress photos"
on storage.objects for update
using (
  bucket_id = 'progress-photos'
  and exists (
    select 1
    from progress_checkins pc
    join trainer_clients tc on tc.id = pc.trainer_client_id
    where pc.id::text = split_part(name, '/', 2)
      and tc.id::text = split_part(name, '/', 1)
      and tc.member_id = public.current_member_id()
  )
)
with check (
  bucket_id = 'progress-photos'
  and exists (
    select 1
    from progress_checkins pc
    join trainer_clients tc on tc.id = pc.trainer_client_id
    where pc.id::text = split_part(name, '/', 2)
      and tc.id::text = split_part(name, '/', 1)
      and tc.member_id = public.current_member_id()
  )
);

create policy "client parties can read progress photo objects"
on storage.objects for select
using (
  bucket_id = 'progress-photos'
  and exists (
    select 1
    from progress_checkins pc
    join trainer_clients tc on tc.id = pc.trainer_client_id
    where pc.id::text = split_part(name, '/', 2)
      and tc.id::text = split_part(name, '/', 1)
      and (
        tc.member_id = public.current_member_id()
        or tc.trainer_id = public.current_trainer_id()
      )
  )
);

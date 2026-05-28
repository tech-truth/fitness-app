delete from progress_photos a
using progress_photos b
where a.id < b.id
  and a.progress_checkin_id = b.progress_checkin_id
  and coalesce(a.photo_label, '') = coalesce(b.photo_label, '');

create unique index if not exists progress_photos_checkin_label_unique
on progress_photos (progress_checkin_id, photo_label);

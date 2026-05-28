update assigned_plans newer
set active = false
from assigned_plans older
where newer.trainer_client_id = older.trainer_client_id
  and newer.active = true
  and older.active = true
  and newer.assigned_at < older.assigned_at;

create unique index if not exists assigned_plans_one_active_per_client
on assigned_plans (trainer_client_id)
where active = true;

-- Respiratory Gate Hospital Platform — Phase 1 schema.
-- Design: docs/database-schema.md. Operational and financial data only: no patient-level data.
--
-- NULL means "not yet provided"; 0 means zero. Calculations are not stored.
-- RLS is enabled on every table and denies by default. audit_log is written only by triggers.

-- ─────────────────────────────────────────────────────────────────────────────
-- Types
-- ─────────────────────────────────────────────────────────────────────────────
create type public.app_role as enum ('admin', 'manager', 'viewer', 'referring_physician', 'patient');
comment on type public.app_role is
  'referring_physician and patient are reserved for future portals and are granted nothing.';

create type public.input_source_type as enum ('hospital_data', 'verified_public', 'rg_assumption');
create type public.savings_level as enum ('low', 'mid', 'high');
create type public.scenario_status as enum ('draft', 'approved', 'archived');

-- ─────────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────────
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  organization_id uuid not null references public.organizations (id),
  full_name text not null check (length(trim(full_name)) > 0),
  role public.app_role not null default 'viewer',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_organization_idx on public.profiles (organization_id);

create table public.hospital_inputs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  key text not null,
  category text not null check (category in (
    'icu_activity', 'unit_costs', 'annual_spend', 'usage', 'equipment', 'billing',
    'other_revenue', 'operating_cost', 'model_assumptions')),
  label text not null,
  unit text not null,
  numeric_value numeric check (numeric_value is null or numeric_value >= 0),
  text_value text check (text_value is null or length(text_value) <= 200),
  data_owner text,
  note text,
  source_type public.input_source_type not null,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (organization_id, key),
  constraint hospital_inputs_percent_fraction check (unit <> '%' or numeric_value is null or numeric_value <= 1)
);
comment on column public.hospital_inputs.numeric_value is 'NULL = not yet provided. Percentages are fractions (0.8 = 80%).';
comment on column public.hospital_inputs.text_value is 'Optional qualifier (e.g. oxygen consumption unit). Never patient information.';

create table public.scenario_assumptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  scenario_name text not null check (length(trim(scenario_name)) between 1 and 120),
  occupancy_rate numeric(6, 5) not null check (occupancy_rate > 0 and occupancy_rate <= 1),
  package_price numeric(12, 2) not null check (package_price > 0),
  savings_level public.savings_level not null default 'mid',
  low_savings_pct numeric(6, 5) not null default 0.05 check (low_savings_pct between 0 and 1),
  mid_savings_pct numeric(6, 5) not null default 0.10 check (mid_savings_pct between 0 and 1),
  high_savings_pct numeric(6, 5) not null default 0.15 check (high_savings_pct between 0 and 1),
  is_default boolean not null default false,
  status public.scenario_status not null default 'draft',
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  approved_snapshot jsonb,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, scenario_name)
);
create unique index scenario_assumptions_one_default on public.scenario_assumptions (organization_id) where is_default;

create table public.audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id),
  entity_type text not null check (entity_type in ('hospital_input', 'scenario_assumption', 'profile', 'organization')),
  entity_id uuid not null,
  field_name text not null,
  old_value text,
  new_value text,
  -- No foreign key: the history must survive removal of the user account.
  changed_by uuid,
  -- Name captured at write time for the same reason.
  actor_name text,
  changed_at timestamptz not null default now(),
  action text not null default 'update' check (action in ('insert', 'update', 'delete'))
);
create index audit_log_org_time_idx on public.audit_log (organization_id, changed_at desc);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id, changed_at desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- Role helpers (private schema: not exposed through the Data API)
-- ─────────────────────────────────────────────────────────────────────────────
create schema if not exists private;
grant usage on schema private to authenticated;

create function private.current_org_id() returns uuid
language sql stable security definer set search_path = ''
as $$
  select organization_id from public.profiles where user_id = auth.uid() and active
$$;

create function private.has_role(variadic roles public.app_role[]) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and active and role = any (roles)
  )
$$;

create function private.actor_name() returns text
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select full_name from public.profiles where user_id = auth.uid()),
    (select email::text from auth.users where id = auth.uid()),
    'System'
  )
$$;

revoke all on function private.current_org_id(), private.has_role(public.app_role[]), private.actor_name() from public, anon;
grant execute on function private.current_org_id(), private.has_role(public.app_role[]) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Privileges: anon gets nothing; authenticated gets only what policies refine.
-- ─────────────────────────────────────────────────────────────────────────────
revoke all on public.organizations, public.profiles, public.hospital_inputs,
  public.scenario_assumptions, public.audit_log from anon, authenticated;

grant select on public.organizations, public.profiles, public.hospital_inputs,
  public.scenario_assumptions, public.audit_log to authenticated;
grant update (name) on public.organizations to authenticated;
grant insert (user_id, organization_id, full_name, role, active) on public.profiles to authenticated;
grant update (full_name, role, active) on public.profiles to authenticated;
-- Inputs: only values are editable from the app; keys and metadata come from migrations.
grant update (numeric_value, text_value) on public.hospital_inputs to authenticated;
grant insert (organization_id, scenario_name, occupancy_rate, package_price, savings_level,
  low_savings_pct, mid_savings_pct, high_savings_pct) on public.scenario_assumptions to authenticated;
grant update (scenario_name, occupancy_rate, package_price, savings_level, low_savings_pct,
  mid_savings_pct, high_savings_pct, status, approved_snapshot) on public.scenario_assumptions to authenticated;
grant delete on public.scenario_assumptions to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Row-level security. Staff = admin, manager, viewer. Reserved roles match nothing.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.hospital_inputs enable row level security;
alter table public.scenario_assumptions enable row level security;
alter table public.audit_log enable row level security;

create policy organizations_select on public.organizations for select to authenticated
  using (id = (select private.current_org_id()) and (select private.has_role('admin', 'manager', 'viewer')));
create policy organizations_update on public.organizations for update to authenticated
  using (id = (select private.current_org_id()) and (select private.has_role('admin')))
  with check (id = (select private.current_org_id()));

-- Everyone may read their own profile (to learn their role or that they are deactivated).
create policy profiles_select on public.profiles for select to authenticated
  using (
    user_id = (select auth.uid())
    or (organization_id = (select private.current_org_id()) and (select private.has_role('admin', 'manager', 'viewer')))
  );
create policy profiles_insert on public.profiles for insert to authenticated
  with check (organization_id = (select private.current_org_id()) and (select private.has_role('admin')));
create policy profiles_update on public.profiles for update to authenticated
  using (organization_id = (select private.current_org_id()) and (select private.has_role('admin')))
  with check (organization_id = (select private.current_org_id()));

create policy hospital_inputs_select on public.hospital_inputs for select to authenticated
  using (organization_id = (select private.current_org_id()) and (select private.has_role('admin', 'manager', 'viewer')));
-- Managers edit hospital data; only Admins edit Respiratory Gate assumptions.
create policy hospital_inputs_update on public.hospital_inputs for update to authenticated
  using (
    organization_id = (select private.current_org_id())
    and (
      (select private.has_role('admin'))
      or ((select private.has_role('manager')) and source_type in ('hospital_data', 'verified_public'))
    )
  )
  with check (organization_id = (select private.current_org_id()));

create policy scenarios_select on public.scenario_assumptions for select to authenticated
  using (organization_id = (select private.current_org_id()) and (select private.has_role('admin', 'manager', 'viewer')));
create policy scenarios_insert on public.scenario_assumptions for insert to authenticated
  with check (
    organization_id = (select private.current_org_id())
    and (select private.has_role('admin', 'manager'))
    and status = 'draft'
    and not is_default
  );
-- Managers edit their drafts; Admins edit, approve and archive any scenario.
create policy scenarios_update on public.scenario_assumptions for update to authenticated
  using (
    organization_id = (select private.current_org_id())
    and (
      (select private.has_role('admin'))
      or ((select private.has_role('manager')) and status = 'draft' and not is_default)
    )
  )
  with check (
    organization_id = (select private.current_org_id())
    and ((select private.has_role('admin')) or (status = 'draft' and not is_default))
  );
create policy scenarios_delete on public.scenario_assumptions for delete to authenticated
  using (organization_id = (select private.current_org_id()) and (select private.has_role('admin')) and not is_default);

create policy audit_log_select on public.audit_log for select to authenticated
  using (organization_id = (select private.current_org_id()) and (select private.has_role('admin', 'manager')));

-- ─────────────────────────────────────────────────────────────────────────────
-- Triggers: stamping, approval rules, last-admin guard, audit
-- ─────────────────────────────────────────────────────────────────────────────
create function private.stamp_hospital_input() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.numeric_value is distinct from old.numeric_value or new.text_value is distinct from old.text_value then
    new.updated_by := auth.uid();
    new.updated_at := now();
  end if;
  return new;
end
$$;
create trigger hospital_inputs_stamp before update on public.hospital_inputs
  for each row execute function private.stamp_hospital_input();

create function private.audit_hospital_input() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.numeric_value is distinct from old.numeric_value then
    insert into public.audit_log (organization_id, entity_type, entity_id, field_name, old_value, new_value,
                                  changed_by, actor_name, action)
    values (new.organization_id, 'hospital_input', new.id, new.key, old.numeric_value::text,
            new.numeric_value::text, auth.uid(), private.actor_name(), 'update');
  end if;
  if new.text_value is distinct from old.text_value then
    insert into public.audit_log (organization_id, entity_type, entity_id, field_name, old_value, new_value,
                                  changed_by, actor_name, action)
    values (new.organization_id, 'hospital_input', new.id, new.key || '.text', old.text_value,
            new.text_value, auth.uid(), private.actor_name(), 'update');
  end if;
  return null;
end
$$;
create trigger hospital_inputs_audit after update on public.hospital_inputs
  for each row execute function private.audit_hospital_input();

-- Approval bookkeeping. Changing an approved scenario's numbers returns it to draft,
-- so approved figures can never drift silently.
create function private.scenario_rules() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.status := 'draft';
    new.approved_by := null;
    new.approved_at := null;
    new.approved_snapshot := null;
    return new;
  end if;

  if old.status = 'approved' and new.status = 'approved'
     and (new.occupancy_rate, new.package_price, new.savings_level, new.low_savings_pct, new.mid_savings_pct,
          new.high_savings_pct)
         is distinct from
         (old.occupancy_rate, old.package_price, old.savings_level, old.low_savings_pct, old.mid_savings_pct,
          old.high_savings_pct) then
    new.status := 'draft';
  end if;

  if new.status = 'approved' and old.status is distinct from 'approved' then
    new.approved_by := auth.uid();
    new.approved_at := now();
  elsif new.status <> 'approved' then
    new.approved_by := null;
    new.approved_at := null;
    new.approved_snapshot := null;
  end if;

  new.updated_at := now();
  return new;
end
$$;
create trigger scenario_assumptions_rules before insert or update on public.scenario_assumptions
  for each row execute function private.scenario_rules();

create function private.audit_scenario() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  old_row jsonb;
  new_row jsonb;
  field text;
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (organization_id, entity_type, entity_id, field_name, old_value, new_value,
                                  changed_by, actor_name, action)
    values (new.organization_id, 'scenario_assumption', new.id, 'scenario_name', null, new.scenario_name,
            auth.uid(), private.actor_name(), 'insert');
    return null;
  elsif tg_op = 'DELETE' then
    insert into public.audit_log (organization_id, entity_type, entity_id, field_name, old_value, new_value,
                                  changed_by, actor_name, action)
    values (old.organization_id, 'scenario_assumption', old.id, 'scenario_name', old.scenario_name, null,
            auth.uid(), private.actor_name(), 'delete');
    return null;
  end if;

  old_row := to_jsonb(old);
  new_row := to_jsonb(new);
  for field in
    select k from jsonb_object_keys(new_row) as k
    where k not in ('id', 'organization_id', 'created_by', 'created_at', 'updated_at', 'approved_by',
                    'approved_at', 'approved_snapshot')
      and (old_row -> k) is distinct from (new_row -> k)
  loop
    insert into public.audit_log (organization_id, entity_type, entity_id, field_name, old_value, new_value,
                                  changed_by, actor_name, action)
    values (new.organization_id, 'scenario_assumption', new.id, field, old_row ->> field, new_row ->> field,
            auth.uid(), private.actor_name(), 'update');
  end loop;
  return null;
end
$$;
create trigger scenario_assumptions_audit after insert or update or delete on public.scenario_assumptions
  for each row execute function private.audit_scenario();

-- At least one active Admin must remain, so nobody can lock the organisation out.
create function private.keep_one_admin() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.role = 'admin' and old.active and (new.role <> 'admin' or not new.active) then
    if not exists (
      select 1 from public.profiles
      where organization_id = old.organization_id and role = 'admin' and active and id <> old.id
    ) then
      raise exception 'At least one active Admin is required.' using errcode = 'P0001';
    end if;
  end if;
  new.updated_at := now();
  return new;
end
$$;
create trigger profiles_keep_one_admin before update on public.profiles
  for each row execute function private.keep_one_admin();

create function private.audit_profile() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (organization_id, entity_type, entity_id, field_name, old_value, new_value,
                                  changed_by, actor_name, action)
    values (new.organization_id, 'profile', new.id, 'role', null, new.role::text, auth.uid(),
            private.actor_name(), 'insert');
    return null;
  end if;
  if new.role is distinct from old.role then
    insert into public.audit_log (organization_id, entity_type, entity_id, field_name, old_value, new_value,
                                  changed_by, actor_name, action)
    values (new.organization_id, 'profile', new.id, 'role', old.role::text, new.role::text, auth.uid(),
            private.actor_name(), 'update');
  end if;
  if new.active is distinct from old.active then
    insert into public.audit_log (organization_id, entity_type, entity_id, field_name, old_value, new_value,
                                  changed_by, actor_name, action)
    values (new.organization_id, 'profile', new.id, 'active', old.active::text, new.active::text, auth.uid(),
            private.actor_name(), 'update');
  end if;
  if new.full_name is distinct from old.full_name then
    insert into public.audit_log (organization_id, entity_type, entity_id, field_name, old_value, new_value,
                                  changed_by, actor_name, action)
    values (new.organization_id, 'profile', new.id, 'full_name', old.full_name, new.full_name, auth.uid(),
            private.actor_name(), 'update');
  end if;
  return null;
end
$$;
create trigger profiles_audit after insert or update on public.profiles
  for each row execute function private.audit_profile();

create function private.audit_organization() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.name is distinct from old.name then
    insert into public.audit_log (organization_id, entity_type, entity_id, field_name, old_value, new_value,
                                  changed_by, actor_name, action)
    values (new.id, 'organization', new.id, 'name', old.name, new.name, auth.uid(), private.actor_name(), 'update');
  end if;
  return null;
end
$$;
create trigger organizations_audit after update on public.organizations
  for each row execute function private.audit_organization();

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: switch the organisation's default scenario atomically (Admin only).
-- ─────────────────────────────────────────────────────────────────────────────
create function public.set_default_scenario(scenario_id uuid) returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  if not private.has_role('admin') then
    raise exception 'Only an Admin can change the default scenario.' using errcode = '42501';
  end if;
  update public.scenario_assumptions set is_default = false
    where organization_id = private.current_org_id() and is_default and id <> scenario_id;
  update public.scenario_assumptions set is_default = true
    where id = scenario_id and organization_id = private.current_org_id();
  if not found then
    raise exception 'Scenario not found.' using errcode = 'P0002';
  end if;
end
$$;
revoke all on function public.set_default_scenario(uuid) from public, anon;
grant execute on function public.set_default_scenario(uuid) to authenticated;
-- Admins may change is_default (policies stop Managers); set_default_scenario() does it atomically.
grant update (is_default) on public.scenario_assumptions to authenticated;

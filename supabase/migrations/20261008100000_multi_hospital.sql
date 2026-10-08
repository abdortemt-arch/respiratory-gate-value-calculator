-- Multi-hospital platform.
-- Design: docs/database-schema.md §8–§12.
--
-- organizations      the platform operator (Respiratory Gate)
-- hospitals          client hospitals, each configured independently
-- configuration      departments, services, department assignments, equipment, cost items
-- versions           effective-dated prices and costs; never edited, only voided with a reason
-- operating periods  one per hospital and month: activity, statistics, cost quantities, savings
-- workbook model     the original Elite workbook inputs and scenarios, now per hospital
--
-- RLS is hospital-level: organisation Admins see every hospital; other users see
-- only hospitals they are members of (manager = edit, viewer = read).

-- ─────────────────────────────────────────────────────────────────────────────
-- Types
-- ─────────────────────────────────────────────────────────────────────────────
create type public.billing_unit as enum (
  'per_procedure', 'per_patient', 'per_session', 'per_day', 'per_ventilator_day', 'per_hour',
  'per_case', 'monthly_package', 'fixed_contract', 'percentage', 'custom');
create type public.period_status as enum ('draft', 'in_review', 'finalized', 'locked');

-- ─────────────────────────────────────────────────────────────────────────────
-- Hospitals and access
-- ─────────────────────────────────────────────────────────────────────────────
create table public.hospitals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  name text not null check (length(trim(name)) between 2 and 160),
  code text not null check (code ~ '^[A-Z0-9][A-Z0-9_-]{0,19}$'),
  hospital_type text check (hospital_type in ('general', 'teaching', 'specialty', 'private', 'public', 'military', 'other')),
  total_beds integer check (total_beds is null or total_beds >= 0),
  location text check (location is null or length(location) <= 200),
  notes text check (notes is null or length(notes) <= 2000),
  currency text not null default 'EGP' check (currency ~ '^[A-Z]{3}$'),
  active boolean not null default true,
  workbook_model_enabled boolean not null default false,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  unique (organization_id, id)
);
create unique index hospitals_org_name_idx on public.hospitals (organization_id, lower(name));

create table public.hospital_members (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals (id),
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null check (role in ('manager', 'viewer')),
  active boolean not null default true,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hospital_id, user_id)
);
create index hospital_members_user_idx on public.hospital_members (user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Hospital configuration
-- ─────────────────────────────────────────────────────────────────────────────
create table public.hospital_departments (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals (id),
  name text not null check (length(trim(name)) between 1 and 120),
  category text not null default 'other' check (category in (
    'adult_icu', 'picu', 'nicu', 'ccu', 'burn_icu', 'emergency', 'step_down', 'ward', 'operating_room', 'other')),
  beds integer check (beds is null or beds >= 0),
  rt_coverage boolean not null default true,
  notes text check (notes is null or length(notes) <= 1000),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hospital_id, id)
);
create unique index hospital_departments_name_idx on public.hospital_departments (hospital_id, lower(name));

-- The organisation's library of respiratory therapy services (shared identity
-- across hospitals so NIV in Hospital A can be compared with NIV in Hospital B).
create table public.services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  name text not null check (length(trim(name)) between 1 and 120),
  code text check (code is null or code ~ '^[A-Z0-9][A-Z0-9_-]{0,19}$'),
  category text not null default 'other' check (category in (
    'ventilation', 'oxygen_therapy', 'airway', 'aerosol', 'diagnostics', 'therapy', 'transport', 'sleep', 'other')),
  description text check (description is null or length(description) <= 1000),
  active boolean not null default true,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
create unique index services_name_idx on public.services (organization_id, lower(name));

-- A service as provided by one hospital. Prices belong here, never to the library.
create table public.hospital_services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  hospital_id uuid not null,
  service_id uuid not null,
  active boolean not null default true,
  notes text check (notes is null or length(notes) <= 1000),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, hospital_id) references public.hospitals (organization_id, id),
  foreign key (organization_id, service_id) references public.services (organization_id, id),
  unique (hospital_id, service_id),
  unique (hospital_id, id)
);

-- Where a hospital provides a service (the same service can be in several departments).
create table public.hospital_service_departments (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null,
  hospital_service_id uuid not null,
  department_id uuid not null,
  active boolean not null default true,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (hospital_id, hospital_service_id) references public.hospital_services (hospital_id, id),
  foreign key (hospital_id, department_id) references public.hospital_departments (hospital_id, id),
  unique (hospital_service_id, department_id)
);

-- Effective-dated prices. Rows are never edited: a change is a new version; a
-- wrong entry is voided with a reason. Versions take effect on the 1st of a month.
create table public.service_price_versions (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null,
  hospital_service_id uuid not null,
  amount numeric(14, 2) not null check (amount >= 0),
  currency text not null default 'EGP' check (currency ~ '^[A-Z]{3}$'),
  billing_unit public.billing_unit not null,
  effective_from date not null check (extract(day from effective_from) = 1),
  notes text check (notes is null or length(notes) <= 1000),
  change_reason text check (change_reason is null or length(change_reason) <= 500),
  voided boolean not null default false,
  void_reason text check (void_reason is null or length(void_reason) <= 500),
  voided_by uuid references auth.users (id) on delete set null,
  voided_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (hospital_id, hospital_service_id) references public.hospital_services (hospital_id, id),
  check (billing_unit <> 'percentage' or amount <= 100),
  check (not voided or length(trim(coalesce(void_reason, ''))) >= 3)
);
create unique index service_price_versions_month_idx
  on public.service_price_versions (hospital_service_id, effective_from) where not voided;

create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals (id),
  department_id uuid,
  name text not null check (length(trim(name)) between 1 and 160),
  category text not null default 'other' check (category in (
    'ventilator', 'niv_device', 'hfnc_device', 'transport_ventilator', 'humidifier', 'monitor',
    'blood_gas_analyzer', 'pft_equipment', 'other')),
  quantity integer not null default 1 check (quantity >= 0),
  ownership text not null default 'owned' check (ownership in ('owned', 'rented', 'leased', 'consigned')),
  acquired_on date,
  notes text check (notes is null or length(notes) <= 1000),
  active boolean not null default true,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (hospital_id, department_id) references public.hospital_departments (hospital_id, id),
  unique (hospital_id, id)
);

-- Cost items: consumables, staffing (per FTE), equipment, maintenance, contracts...
create table public.cost_items (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals (id),
  name text not null check (length(trim(name)) between 1 and 160),
  category text not null check (category in (
    'staffing', 'consumable', 'equipment', 'maintenance', 'contract', 'service_cost', 'package_cost', 'other_recurring')),
  basis text not null check (basis in ('per_unit', 'monthly', 'per_service_unit')),
  unit_label text not null default 'unit' check (length(trim(unit_label)) between 1 and 40),
  hospital_service_id uuid,
  department_id uuid,
  equipment_id uuid,
  is_rt_staff boolean not null default false,
  active boolean not null default true,
  ended_from date check (ended_from is null or extract(day from ended_from) = 1),
  notes text check (notes is null or length(notes) <= 1000),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (hospital_id, hospital_service_id) references public.hospital_services (hospital_id, id),
  foreign key (hospital_id, department_id) references public.hospital_departments (hospital_id, id),
  foreign key (hospital_id, equipment_id) references public.equipment (hospital_id, id),
  check (basis <> 'per_service_unit' or hospital_service_id is not null),
  check (not is_rt_staff or category = 'staffing'),
  unique (hospital_id, id)
);
create unique index cost_items_name_idx on public.cost_items (hospital_id, lower(name));

-- Effective-dated costs: unit cost, monthly amount, or monthly cost per FTE.
create table public.cost_versions (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null,
  cost_item_id uuid not null,
  amount numeric(14, 2) not null check (amount >= 0),
  effective_from date not null check (extract(day from effective_from) = 1),
  notes text check (notes is null or length(notes) <= 1000),
  change_reason text check (change_reason is null or length(change_reason) <= 500),
  voided boolean not null default false,
  void_reason text check (void_reason is null or length(void_reason) <= 500),
  voided_by uuid references auth.users (id) on delete set null,
  voided_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (hospital_id, cost_item_id) references public.cost_items (hospital_id, id),
  check (not voided or length(trim(coalesce(void_reason, ''))) >= 3)
);
create unique index cost_versions_month_idx on public.cost_versions (cost_item_id, effective_from) where not voided;

-- ─────────────────────────────────────────────────────────────────────────────
-- Monthly operating periods (what happened)
-- ─────────────────────────────────────────────────────────────────────────────
create table public.operating_periods (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals (id),
  period_month date not null check (extract(day from period_month) = 1),
  status public.period_status not null default 'draft',
  notes text check (notes is null or length(notes) <= 2000),
  finalized_snapshot jsonb,
  finalized_at timestamptz,
  finalized_by uuid references auth.users (id) on delete set null,
  locked_at timestamptz,
  locked_by uuid references auth.users (id) on delete set null,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hospital_id, period_month),
  unique (hospital_id, id)
);

create table public.service_activity (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null,
  period_id uuid not null,
  hospital_service_id uuid not null,
  department_id uuid,
  quantity numeric(14, 2) check (quantity is null or quantity >= 0),
  notes text check (notes is null or length(notes) <= 500),
  change_reason text check (change_reason is null or length(change_reason) <= 500),
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  foreign key (hospital_id, period_id) references public.operating_periods (hospital_id, id),
  foreign key (hospital_id, hospital_service_id) references public.hospital_services (hospital_id, id),
  foreign key (hospital_id, department_id) references public.hospital_departments (hospital_id, id),
  unique nulls not distinct (period_id, hospital_service_id, department_id)
);

create table public.period_stats (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null,
  period_id uuid not null,
  department_id uuid,
  patients integer check (patients is null or patients >= 0),
  admissions integer check (admissions is null or admissions >= 0),
  occupied_bed_days numeric(12, 2) check (occupied_bed_days is null or occupied_bed_days >= 0),
  ventilator_days numeric(12, 2) check (ventilator_days is null or ventilator_days >= 0),
  change_reason text check (change_reason is null or length(change_reason) <= 500),
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  foreign key (hospital_id, period_id) references public.operating_periods (hospital_id, id),
  foreign key (hospital_id, department_id) references public.hospital_departments (hospital_id, id),
  unique nulls not distinct (period_id, department_id)
);

create table public.period_cost_entries (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null,
  period_id uuid not null,
  cost_item_id uuid not null,
  quantity numeric(14, 3) check (quantity is null or quantity >= 0),
  notes text check (notes is null or length(notes) <= 500),
  change_reason text check (change_reason is null or length(change_reason) <= 500),
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  foreign key (hospital_id, period_id) references public.operating_periods (hospital_id, id),
  foreign key (hospital_id, cost_item_id) references public.cost_items (hospital_id, id),
  unique (period_id, cost_item_id)
);

-- Documented (realised) cost avoidance for the month.
create table public.period_savings (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null,
  period_id uuid not null,
  category text not null check (category in (
    'ventilator_resources', 'niv_hfnc_utilization', 'oxygen_stewardship', 'consumable_standardization',
    'equipment_utilization', 'staffing_outsourcing', 'other')),
  description text not null check (length(trim(description)) between 2 and 300),
  amount numeric(14, 2) not null check (amount >= 0),
  change_reason text check (change_reason is null or length(change_reason) <= 500),
  updated_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (hospital_id, period_id) references public.operating_periods (hospital_id, id)
);

create index on public.hospital_departments (hospital_id);
create index on public.hospital_services (hospital_id);
create index on public.service_price_versions (hospital_id);
create index on public.cost_items (hospital_id);
create index on public.cost_versions (hospital_id);
create index on public.equipment (hospital_id);
create index on public.service_activity (hospital_id, period_id);
create index on public.period_stats (hospital_id, period_id);
create index on public.period_cost_entries (hospital_id, period_id);
create index on public.period_savings (hospital_id, period_id);

-- Template for the Elite / Workbook Value Model inputs (filled by the next migration).
create table public.workbook_input_templates (
  key text primary key,
  category text not null,
  label text not null,
  unit text not null,
  default_value numeric,
  data_owner text,
  note text,
  source_type public.input_source_type not null,
  sort_order integer not null
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Existing workbook tables become hospital-scoped; audit log gains context
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.hospital_inputs add column hospital_id uuid references public.hospitals (id);
alter table public.scenario_assumptions add column hospital_id uuid references public.hospitals (id);

alter table public.audit_log
  add column hospital_id uuid references public.hospitals (id) on delete set null,
  add column period_id uuid,
  add column entity_label text,
  add column reason text;
alter table public.audit_log drop constraint audit_log_entity_type_check;
alter table public.audit_log add constraint audit_log_entity_type_check check (entity_type in (
  'hospital_input', 'scenario_assumption', 'profile', 'organization', 'hospital', 'hospital_member', 'department',
  'service', 'hospital_service', 'service_department', 'price_version', 'equipment', 'cost_item', 'cost_version',
  'period', 'service_activity', 'period_stats', 'cost_entry', 'period_savings'));
alter table public.audit_log drop constraint audit_log_action_check;
alter table public.audit_log add constraint audit_log_action_check check (action in ('insert', 'update', 'delete', 'correction', 'status'));
create index audit_log_hospital_idx on public.audit_log (hospital_id, changed_at desc);

-- The operator organisation is Respiratory Gate; Elite Hospital becomes its first hospital.
update public.organizations set name = 'Respiratory Gate Egypt'
  where id = '00000000-0000-4000-8000-000000000001' and name = 'Elite Hospital';

insert into public.hospitals (id, organization_id, name, code, notes, workbook_model_enabled)
select '00000000-0000-4000-8000-000000000101', id, 'Elite Hospital', 'ELITE',
       'Original Elite RT Value Calculator workbook model.', true
from public.organizations where id = '00000000-0000-4000-8000-000000000001'
on conflict do nothing;

-- Any other organisation holding workbook data gets a hospital of its own.
do $$
declare
  org record;
  new_id uuid;
begin
  for org in
    select distinct o.id, o.name from public.organizations o
    join public.hospital_inputs i on i.organization_id = o.id
    where o.id <> '00000000-0000-4000-8000-000000000001'
  loop
    insert into public.hospitals (organization_id, name, code, workbook_model_enabled)
    values (org.id, org.name, 'H' || upper(substr(md5(org.id::text), 1, 6)), true)
    returning id into new_id;
    update public.hospital_inputs set hospital_id = new_id where organization_id = org.id;
    update public.scenario_assumptions set hospital_id = new_id where organization_id = org.id;
  end loop;
end
$$;

update public.hospital_inputs set hospital_id = '00000000-0000-4000-8000-000000000101'
  where organization_id = '00000000-0000-4000-8000-000000000001' and hospital_id is null;
update public.scenario_assumptions set hospital_id = '00000000-0000-4000-8000-000000000101'
  where organization_id = '00000000-0000-4000-8000-000000000001' and hospital_id is null;

-- Existing staff keep access to the hospital whose data they worked on.
insert into public.hospital_members (hospital_id, user_id, role)
select h.id, p.user_id, case p.role when 'viewer' then 'viewer'::public.app_role else 'manager'::public.app_role end
from public.profiles p
join public.hospitals h on h.organization_id = p.organization_id
where p.role in ('manager', 'viewer')
on conflict (hospital_id, user_id) do nothing;

alter table public.hospital_inputs alter column hospital_id set not null;
alter table public.scenario_assumptions alter column hospital_id set not null;
alter table public.hospital_inputs add constraint hospital_inputs_hospital_org_fkey
  foreign key (organization_id, hospital_id) references public.hospitals (organization_id, id);
alter table public.scenario_assumptions add constraint scenario_assumptions_hospital_org_fkey
  foreign key (organization_id, hospital_id) references public.hospitals (organization_id, id);
alter table public.hospital_inputs drop constraint hospital_inputs_organization_id_key_key;
alter table public.hospital_inputs add constraint hospital_inputs_hospital_key_key unique (hospital_id, key);
alter table public.scenario_assumptions drop constraint scenario_assumptions_organization_id_scenario_name_key;
alter table public.scenario_assumptions add constraint scenario_assumptions_hospital_name_key unique (hospital_id, scenario_name);
drop index public.scenario_assumptions_one_default;
create unique index scenario_assumptions_one_default on public.scenario_assumptions (hospital_id) where is_default;
-- Organisation admins and staff saw the old org-wide audit; now each row may carry a hospital.
update public.audit_log a set hospital_id = i.hospital_id from public.hospital_inputs i
  where a.entity_type = 'hospital_input' and a.entity_id = i.id and a.hospital_id is null;
update public.audit_log a set hospital_id = s.hospital_id from public.scenario_assumptions s
  where a.entity_type = 'scenario_assumption' and a.entity_id = s.id and a.hospital_id is null;

-- ─────────────────────────────────────────────────────────────────────────────
-- Access helpers (private schema; not exposed through the Data API)
-- ─────────────────────────────────────────────────────────────────────────────
create function private.is_org_admin(org uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and active and role = 'admin' and organization_id = org
  )
$$;

-- 'admin' for organisation Admins, the membership role for members, null otherwise.
create function private.hospital_role(h uuid) returns text
language sql stable security definer set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.hospitals x
      join public.profiles p on p.organization_id = x.organization_id
      where x.id = h and p.user_id = auth.uid() and p.active and p.role = 'admin'
    ) then 'admin'
    else (
      -- The organisation role caps the membership: a Viewer stays read-only everywhere.
      select case when p.role = 'viewer' then 'viewer' else m.role::text end from public.hospital_members m
      join public.hospitals x on x.id = m.hospital_id
      join public.profiles p on p.user_id = m.user_id and p.organization_id = x.organization_id and p.active
      where m.hospital_id = h and m.user_id = auth.uid() and m.active
        and p.role in ('admin', 'manager', 'viewer')
    )
  end
$$;

create function private.can_read_hospital(h uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select private.hospital_role(h) is not null $$;

-- Managers write only while the hospital is active; Admins always.
create function private.can_write_hospital(h uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select case private.hospital_role(h)
    when 'admin' then true
    when 'manager' then coalesce((select active from public.hospitals where id = h), false)
    else false
  end
$$;

create function private.is_hospital_admin(h uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select private.hospital_role(h) = 'admin' $$;

revoke all on function private.is_org_admin(uuid), private.hospital_role(uuid), private.can_read_hospital(uuid),
  private.can_write_hospital(uuid), private.is_hospital_admin(uuid) from public, anon;
grant execute on function private.is_org_admin(uuid), private.hospital_role(uuid), private.can_read_hospital(uuid),
  private.can_write_hospital(uuid), private.is_hospital_admin(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Privileges. No DELETE on configuration or versions: deactivate or void instead.
-- ─────────────────────────────────────────────────────────────────────────────
revoke all on public.hospitals, public.hospital_members, public.hospital_departments, public.services,
  public.hospital_services, public.hospital_service_departments, public.service_price_versions, public.equipment,
  public.cost_items, public.cost_versions, public.operating_periods, public.service_activity, public.period_stats,
  public.period_cost_entries, public.period_savings, public.workbook_input_templates from anon, authenticated;

grant select on public.hospitals, public.hospital_members, public.hospital_departments, public.services,
  public.hospital_services, public.hospital_service_departments, public.service_price_versions, public.equipment,
  public.cost_items, public.cost_versions, public.operating_periods, public.service_activity, public.period_stats,
  public.period_cost_entries, public.period_savings, public.workbook_input_templates to authenticated;

grant insert, update on public.hospitals, public.hospital_members, public.hospital_departments, public.services,
  public.hospital_services, public.hospital_service_departments, public.equipment, public.cost_items,
  public.service_activity, public.period_stats, public.period_cost_entries, public.period_savings to authenticated;
grant delete on public.hospital_members, public.service_activity, public.period_stats, public.period_cost_entries,
  public.period_savings to authenticated;
-- Versions: insert; update only to void.
grant insert on public.service_price_versions, public.cost_versions to authenticated;
grant update (voided, void_reason) on public.service_price_versions, public.cost_versions to authenticated;
-- Periods: create and annotate; status changes go through set_period_status().
grant insert (hospital_id, period_month, notes) on public.operating_periods to authenticated;
grant update (notes) on public.operating_periods to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Row-level security
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.hospitals enable row level security;
alter table public.hospital_members enable row level security;
alter table public.hospital_departments enable row level security;
alter table public.services enable row level security;
alter table public.hospital_services enable row level security;
alter table public.hospital_service_departments enable row level security;
alter table public.service_price_versions enable row level security;
alter table public.equipment enable row level security;
alter table public.cost_items enable row level security;
alter table public.cost_versions enable row level security;
alter table public.operating_periods enable row level security;
alter table public.service_activity enable row level security;
alter table public.period_stats enable row level security;
alter table public.period_cost_entries enable row level security;
alter table public.period_savings enable row level security;
alter table public.workbook_input_templates enable row level security;

-- is_org_admin(organization_id) reads the row itself, so a just-inserted hospital is
-- visible to its creator (can_read_hospital looks the hospital up and cannot see it yet).
create policy hospitals_select on public.hospitals for select to authenticated
  using ((select private.is_org_admin(organization_id)) or (select private.can_read_hospital(id)));
create policy hospitals_insert on public.hospitals for insert to authenticated
  with check (organization_id = (select private.current_org_id()) and (select private.is_org_admin(organization_id)));
create policy hospitals_update on public.hospitals for update to authenticated
  using ((select private.is_hospital_admin(id)))
  with check (organization_id = (select private.current_org_id()));

create policy hospital_members_select on public.hospital_members for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_hospital_admin(hospital_id)));
create policy hospital_members_write on public.hospital_members for all to authenticated
  using ((select private.is_hospital_admin(hospital_id)))
  with check ((select private.is_hospital_admin(hospital_id)));

create policy services_select on public.services for select to authenticated
  using (organization_id = (select private.current_org_id()) and (select private.has_role('admin', 'manager', 'viewer')));
create policy services_insert on public.services for insert to authenticated
  with check (organization_id = (select private.current_org_id()) and (select private.has_role('admin', 'manager')));
create policy services_update on public.services for update to authenticated
  using (organization_id = (select private.current_org_id()) and (select private.has_role('admin')))
  with check (organization_id = (select private.current_org_id()));

create policy templates_select on public.workbook_input_templates for select to authenticated using (true);

-- Hospital-scoped tables share one pattern: read with access, write with manager/admin access.
do $$
declare
  t text;
begin
  foreach t in array array['hospital_departments', 'hospital_services', 'hospital_service_departments', 'equipment',
                           'cost_items', 'service_price_versions', 'cost_versions', 'operating_periods',
                           'service_activity', 'period_stats', 'period_cost_entries', 'period_savings']
  loop
    execute format('create policy %I on public.%I for select to authenticated using ((select private.can_read_hospital(hospital_id)))',
                   t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select private.can_write_hospital(hospital_id)))',
                   t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select private.can_write_hospital(hospital_id))) with check ((select private.can_write_hospital(hospital_id)))',
                   t || '_update', t);
  end loop;
  foreach t in array array['service_activity', 'period_stats', 'period_cost_entries', 'period_savings']
  loop
    execute format('create policy %I on public.%I for delete to authenticated using ((select private.can_write_hospital(hospital_id)))',
                   t || '_delete', t);
  end loop;
end
$$;

-- Workbook model tables: from organisation scope to hospital scope.
drop policy hospital_inputs_select on public.hospital_inputs;
drop policy hospital_inputs_update on public.hospital_inputs;
create policy hospital_inputs_select on public.hospital_inputs for select to authenticated
  using ((select private.can_read_hospital(hospital_id)));
create policy hospital_inputs_update on public.hospital_inputs for update to authenticated
  using (
    (select private.is_hospital_admin(hospital_id))
    or ((select private.can_write_hospital(hospital_id)) and source_type in ('hospital_data', 'verified_public'))
  )
  with check ((select private.can_write_hospital(hospital_id)));

drop policy scenarios_select on public.scenario_assumptions;
drop policy scenarios_insert on public.scenario_assumptions;
drop policy scenarios_update on public.scenario_assumptions;
drop policy scenarios_delete on public.scenario_assumptions;
create policy scenarios_select on public.scenario_assumptions for select to authenticated
  using ((select private.can_read_hospital(hospital_id)));
create policy scenarios_insert on public.scenario_assumptions for insert to authenticated
  with check ((select private.can_write_hospital(hospital_id)) and status = 'draft' and not is_default);
create policy scenarios_update on public.scenario_assumptions for update to authenticated
  using (
    (select private.is_hospital_admin(hospital_id))
    or ((select private.can_write_hospital(hospital_id)) and status = 'draft' and not is_default)
  )
  with check ((select private.is_hospital_admin(hospital_id)) or (status = 'draft' and not is_default));
create policy scenarios_delete on public.scenario_assumptions for delete to authenticated
  using ((select private.is_hospital_admin(hospital_id)) and not is_default);
grant insert (hospital_id) on public.scenario_assumptions to authenticated;

-- Audit: organisation Admins see everything; hospital managers see their hospitals.
drop policy audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log for select to authenticated
  using (
    (organization_id = (select private.current_org_id()) and (select private.has_role('admin')))
    or (hospital_id is not null and (select private.hospital_role(hospital_id)) = 'manager')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Triggers: stamping, integrity rules, period locking, version immutability
-- ─────────────────────────────────────────────────────────────────────────────
create function private.touch() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    -- created_by always reflects the caller (service-role scripts leave it null).
    if to_jsonb(new) ? 'created_by' then new := jsonb_populate_record(new, jsonb_build_object('created_by', auth.uid())); end if;
  end if;
  if to_jsonb(new) ? 'updated_by' then new := jsonb_populate_record(new, jsonb_build_object('updated_by', auth.uid())); end if;
  return new;
end
$$;

do $$
declare
  t text;
begin
  foreach t in array array['hospitals', 'hospital_members', 'hospital_departments', 'services', 'hospital_services',
                           'hospital_service_departments', 'equipment', 'cost_items', 'operating_periods',
                           'service_activity', 'period_stats', 'period_cost_entries', 'period_savings']
  loop
    execute format('create trigger %I before insert or update on public.%I for each row execute function private.touch()',
                   t || '_touch', t);
  end loop;
end
$$;

-- Hospital codes are stored in upper case; inactive hospitals stay readable.
create function private.normalize_hospital() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.code := upper(trim(new.code));
  if tg_op = 'UPDATE' and new.organization_id <> old.organization_id then
    raise exception 'A hospital cannot move to another organisation.' using errcode = 'P0001';
  end if;
  return new;
end
$$;
create trigger hospitals_normalize before insert or update on public.hospitals
  for each row execute function private.normalize_hospital();

-- Members must belong to the hospital's organisation.
create function private.check_member() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p join public.hospitals h on h.organization_id = p.organization_id
    where p.user_id = new.user_id and h.id = new.hospital_id
  ) then
    raise exception 'The user does not belong to this organisation.' using errcode = 'P0001';
  end if;
  return new;
end
$$;
create trigger hospital_members_check before insert or update on public.hospital_members
  for each row execute function private.check_member();

-- True when a version starting at `from_month` (until `next_from`) affects a finalized or locked period.
create function private.affects_closed_periods(h uuid, from_month date, next_from date) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.operating_periods p
    where p.hospital_id = h and p.status in ('finalized', 'locked')
      and p.period_month >= from_month and (next_from is null or p.period_month < next_from)
  )
$$;

-- Versions are immutable. Adding or voiding one that changes a finalized or
-- locked month is a historical correction: Admin only, with a reason.
create function private.guard_version() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  owner_col text := case tg_table_name when 'service_price_versions' then 'hospital_service_id' else 'cost_item_id' end;
  owner_id uuid := (to_jsonb(new) ->> owner_col)::uuid;
  next_from date;
  allowed text[] := array['voided', 'void_reason', 'voided_by', 'voided_at', 'change_reason'];
begin
  execute format(
    'select min(effective_from) from public.%I where %I = $1 and not voided and effective_from > $2 and id <> $3',
    tg_table_name, owner_col)
    into next_from using owner_id, new.effective_from, new.id;

  if tg_op = 'INSERT' then
    new.voided := false;
    new.void_reason := null;
    new.created_by := auth.uid();
    if private.affects_closed_periods(new.hospital_id, new.effective_from, next_from) then
      if not private.is_hospital_admin(new.hospital_id) then
        raise exception 'This change affects a finalized or locked period. Only an Admin can make this correction.'
          using errcode = '42501';
      end if;
      if length(trim(coalesce(new.change_reason, ''))) < 3 then
        raise exception 'A reason is required for a change that affects a finalized or locked period.' using errcode = 'P0001';
      end if;
    end if;
    return new;
  end if;

  -- UPDATE: only voiding is allowed.
  if (to_jsonb(new) - allowed) is distinct from (to_jsonb(old) - allowed) then
    raise exception 'Price and cost versions cannot be edited. Add a new version, or void this one with a reason.'
      using errcode = 'P0001';
  end if;
  if old.voided and not new.voided then
    raise exception 'A voided version cannot be restored. Add a new version instead.' using errcode = 'P0001';
  end if;
  if new.voided and not old.voided then
    new.voided_by := auth.uid();
    new.voided_at := now();
    new.change_reason := new.void_reason;
    if private.affects_closed_periods(new.hospital_id, new.effective_from, next_from)
       and not private.is_hospital_admin(new.hospital_id) then
      raise exception 'This version is used by a finalized or locked period. Only an Admin can void it.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end
$$;
create trigger service_price_versions_guard before insert or update on public.service_price_versions
  for each row execute function private.guard_version();
create trigger cost_versions_guard before insert or update on public.cost_versions
  for each row execute function private.guard_version();

-- Period data: editable while Draft / In review; Finalized and Locked periods
-- accept only Admin corrections that carry a reason, and nothing can be deleted.
create function private.guard_period_data() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  st public.period_status;
  row_hospital uuid := case when tg_op = 'DELETE' then old.hospital_id else new.hospital_id end;
  row_period uuid := case when tg_op = 'DELETE' then old.period_id else new.period_id end;
begin
  select status into st from public.operating_periods where id = row_period and hospital_id = row_hospital;
  if tg_op = 'UPDATE' and new.change_reason is not distinct from old.change_reason then
    new.change_reason := null; -- a reason applies to one change only
  end if;
  if st in ('finalized', 'locked') then
    if tg_op = 'DELETE' then
      raise exception 'This period is %. Entries cannot be deleted.', st using errcode = 'P0001';
    end if;
    if not private.is_hospital_admin(row_hospital) then
      raise exception 'This period is %. Only an Admin can make a correction.', st using errcode = '42501';
    end if;
    if length(trim(coalesce(new.change_reason, ''))) < 3 then
      raise exception 'A reason is required to correct a % period.', st using errcode = 'P0001';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end
$$;
do $$
declare
  t text;
begin
  foreach t in array array['service_activity', 'period_stats', 'period_cost_entries', 'period_savings']
  loop
    execute format('create trigger %I before insert or update or delete on public.%I for each row execute function private.guard_period_data()',
                   t || '_guard', t);
  end loop;
end
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Audit (self-describing: hospital, period, readable label, reason)
-- ─────────────────────────────────────────────────────────────────────────────
create function private.audit_label(tbl text, r jsonb) returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  svc text;
  dept text;
begin
  if r ? 'hospital_service_id' then
    select s.name into svc from public.hospital_services hs join public.services s on s.id = hs.service_id
    where hs.id = (r ->> 'hospital_service_id')::uuid;
  end if;
  if r ? 'department_id' and r ->> 'department_id' is not null then
    select name into dept from public.hospital_departments where id = (r ->> 'department_id')::uuid;
  end if;
  return case tbl
    when 'hospitals' then r ->> 'name'
    when 'hospital_departments' then r ->> 'name'
    when 'services' then r ->> 'name'
    when 'equipment' then r ->> 'name'
    when 'cost_items' then r ->> 'name'
    when 'hospital_services' then (select name from public.services where id = (r ->> 'service_id')::uuid)
    when 'hospital_service_departments' then concat_ws(' — ', svc, dept)
    when 'service_price_versions' then concat_ws(' ', svc, 'price from', to_char((r ->> 'effective_from')::date, 'Mon YYYY'))
    when 'cost_versions' then concat_ws(' ', (select name from public.cost_items where id = (r ->> 'cost_item_id')::uuid),
                                        'cost from', to_char((r ->> 'effective_from')::date, 'Mon YYYY'))
    when 'operating_periods' then to_char((r ->> 'period_month')::date, 'FMMonth YYYY')
    when 'service_activity' then concat_ws(' — ', svc, dept)
    when 'period_stats' then concat_ws(' — ', 'Statistics', coalesce(dept, 'hospital'))
    when 'period_cost_entries' then (select name from public.cost_items where id = (r ->> 'cost_item_id')::uuid)
    when 'period_savings' then r ->> 'description'
    when 'hospital_members' then (select full_name from public.profiles where user_id = (r ->> 'user_id')::uuid)
    else null
  end;
end
$$;

-- Audit values as text; numbers without trailing zeros (65, not 65.00).
create function private.audit_text(v jsonb) returns text
language sql immutable set search_path = ''
as $$
  select case jsonb_typeof(v)
    when 'number' then trim_scale((v #>> '{}')::numeric)::text
    when 'null' then null
    else v #>> '{}'
  end
$$;

create function private.audit_change() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  entity text := tg_argv[0];
  old_row jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else '{}'::jsonb end;
  new_row jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else '{}'::jsonb end;
  r jsonb := case when tg_op = 'DELETE' then old_row else new_row end;
  hid uuid := coalesce((r ->> 'hospital_id')::uuid,
                       case when tg_table_name = 'hospitals' and tg_op <> 'DELETE' then (r ->> 'id')::uuid end);
  org uuid;
  pid uuid := coalesce((r ->> 'period_id')::uuid, case when tg_table_name = 'operating_periods' then (r ->> 'id')::uuid end);
  label text := private.audit_label(tg_table_name, r);
  reason text := coalesce(nullif(new_row ->> 'change_reason', ''), nullif(current_setting('app.change_reason', true), ''));
  act text;
  field text;
  skip text[] := array['id', 'hospital_id', 'organization_id', 'created_at', 'created_by', 'updated_at', 'updated_by',
                       'voided_by', 'voided_at', 'change_reason', 'finalized_snapshot', 'finalized_at', 'finalized_by',
                       'locked_at', 'locked_by', 'period_id'];
begin
  org := coalesce((r ->> 'organization_id')::uuid, (select organization_id from public.hospitals where id = (r ->> 'hospital_id')::uuid));
  if tg_op = 'DELETE' and tg_table_name <> 'hospitals' and not exists (select 1 from public.hospitals where id = hid) then
    hid := null; -- the hospital itself is being removed (maintenance only)
  end if;
  if org is null then
    return null;
  end if;
  act := case when reason is not null and tg_op <> 'DELETE' then 'correction' else lower(tg_op) end;

  if tg_op in ('INSERT', 'DELETE') then
    insert into public.audit_log (organization_id, hospital_id, period_id, entity_type, entity_id, entity_label,
                                  field_name, old_value, new_value, changed_by, actor_name, action, reason)
    values (org, hid, pid, entity, (r ->> 'id')::uuid, label,
            case tg_op when 'INSERT' then 'created' else 'deleted' end,
            case when tg_op = 'DELETE' then (r - skip)::text end,
            case when tg_op = 'INSERT' then (r - skip)::text end,
            auth.uid(), private.actor_name(), act, reason);
    return null;
  end if;

  for field in
    select k from jsonb_object_keys(new_row) k
    where not (k = any (skip)) and (old_row -> k) is distinct from (new_row -> k)
  loop
    insert into public.audit_log (organization_id, hospital_id, period_id, entity_type, entity_id, entity_label,
                                  field_name, old_value, new_value, changed_by, actor_name, action, reason)
    values (org, hid, pid, entity, (r ->> 'id')::uuid, label, field, private.audit_text(old_row -> field), private.audit_text(new_row -> field),
            auth.uid(), private.actor_name(),
            case when field = 'status' and entity = 'period' then 'status' else act end,
            case when field = 'voided' then coalesce(new_row ->> 'void_reason', reason) else reason end);
  end loop;
  return null;
end
$$;

do $$
declare
  pair text[];
begin
  foreach pair slice 1 in array array[
    array['hospitals', 'hospital'], array['hospital_members', 'hospital_member'],
    array['hospital_departments', 'department'], array['services', 'service'],
    array['hospital_services', 'hospital_service'], array['hospital_service_departments', 'service_department'],
    array['service_price_versions', 'price_version'], array['equipment', 'equipment'],
    array['cost_items', 'cost_item'], array['cost_versions', 'cost_version'],
    array['operating_periods', 'period'], array['service_activity', 'service_activity'],
    array['period_stats', 'period_stats'], array['period_cost_entries', 'cost_entry'],
    array['period_savings', 'period_savings']]
  loop
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function private.audit_change(%L)',
                   pair[1] || '_audit', pair[1], pair[2]);
  end loop;
end
$$;

-- Workbook audit triggers now record the hospital.
create or replace function private.audit_hospital_input() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.numeric_value is distinct from old.numeric_value then
    insert into public.audit_log (organization_id, hospital_id, entity_type, entity_id, entity_label, field_name,
                                  old_value, new_value, changed_by, actor_name, action)
    values (new.organization_id, new.hospital_id, 'hospital_input', new.id, new.label, new.key, old.numeric_value::text,
            new.numeric_value::text, auth.uid(), private.actor_name(), 'update');
  end if;
  if new.text_value is distinct from old.text_value then
    insert into public.audit_log (organization_id, hospital_id, entity_type, entity_id, entity_label, field_name,
                                  old_value, new_value, changed_by, actor_name, action)
    values (new.organization_id, new.hospital_id, 'hospital_input', new.id, new.label, new.key || '.text',
            old.text_value, new.text_value, auth.uid(), private.actor_name(), 'update');
  end if;
  return null;
end
$$;

create or replace function private.audit_scenario() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  old_row jsonb;
  new_row jsonb;
  field text;
begin
  if tg_op = 'INSERT' then
    insert into public.audit_log (organization_id, hospital_id, entity_type, entity_id, entity_label, field_name,
                                  old_value, new_value, changed_by, actor_name, action)
    values (new.organization_id, new.hospital_id, 'scenario_assumption', new.id, new.scenario_name, 'scenario_name',
            null, new.scenario_name, auth.uid(), private.actor_name(), 'insert');
    return null;
  elsif tg_op = 'DELETE' then
    insert into public.audit_log (organization_id, hospital_id, entity_type, entity_id, entity_label, field_name,
                                  old_value, new_value, changed_by, actor_name, action)
    values (old.organization_id, old.hospital_id, 'scenario_assumption', old.id, old.scenario_name, 'scenario_name',
            old.scenario_name, null, auth.uid(), private.actor_name(), 'delete');
    return null;
  end if;
  old_row := to_jsonb(old);
  new_row := to_jsonb(new);
  for field in
    select k from jsonb_object_keys(new_row) as k
    where k not in ('id', 'organization_id', 'hospital_id', 'created_by', 'created_at', 'updated_at', 'approved_by',
                    'approved_at', 'approved_snapshot')
      and (old_row -> k) is distinct from (new_row -> k)
  loop
    insert into public.audit_log (organization_id, hospital_id, entity_type, entity_id, entity_label, field_name,
                                  old_value, new_value, changed_by, actor_name, action)
    values (new.organization_id, new.hospital_id, 'scenario_assumption', new.id, new.scenario_name, field,
            old_row ->> field, new_row ->> field, auth.uid(), private.actor_name(), 'update');
  end loop;
  return null;
end
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPCs
-- ─────────────────────────────────────────────────────────────────────────────

-- Period workflow:
--   Draft ⇄ In review ⇄ Finalized       (managers and Admins; reopening a Finalized period is Admin-only)
--   Finalized → Locked                   (Admin)
--   Locked → Finalized / In review / Draft (Admin, with a reason)
-- Finalizing stores the calculated results as a snapshot for later verification.
create function public.set_period_status(p_period uuid, p_status public.period_status, p_reason text default null,
                                         p_snapshot jsonb default null) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  per public.operating_periods;
  role text;
  closed boolean;
begin
  select * into per from public.operating_periods where id = p_period for update;
  if not found then
    raise exception 'Period not found.' using errcode = 'P0002';
  end if;
  role := private.hospital_role(per.hospital_id);
  if role is null or role = 'viewer' or not private.can_write_hospital(per.hospital_id) then
    raise exception 'Your role cannot change this period.' using errcode = '42501';
  end if;
  if per.status = p_status then
    return;
  end if;
  closed := per.status in ('finalized', 'locked');
  if (closed or p_status = 'locked') and role <> 'admin' then
    raise exception 'Only an Admin can lock, unlock or reopen a period.' using errcode = '42501';
  end if;
  if closed and p_status in ('draft', 'in_review') or per.status = 'locked' then
    if length(trim(coalesce(p_reason, ''))) < 3 then
      raise exception 'A reason is required to unlock or reopen a period.' using errcode = 'P0001';
    end if;
  end if;

  perform set_config('app.change_reason', coalesce(p_reason, ''), true);
  update public.operating_periods set
    status = p_status,
    finalized_snapshot = case
      when p_status in ('finalized', 'locked') and not closed then p_snapshot
      when p_status in ('draft', 'in_review') then null
      else finalized_snapshot end,
    finalized_at = case
      when p_status in ('finalized', 'locked') and not closed then now()
      when p_status in ('draft', 'in_review') then null
      else finalized_at end,
    finalized_by = case
      when p_status in ('finalized', 'locked') and not closed then auth.uid()
      when p_status in ('draft', 'in_review') then null
      else finalized_by end,
    locked_at = case when p_status = 'locked' then now() else null end,
    locked_by = case when p_status = 'locked' then auth.uid() else null end
  where id = p_period;
  perform set_config('app.change_reason', '', true);
end
$$;
revoke all on function public.set_period_status(uuid, public.period_status, text, jsonb) from public, anon;
grant execute on function public.set_period_status(uuid, public.period_status, text, jsonb) to authenticated;

-- Attach the Elite / Workbook Value Model to a hospital (Admin): copies the input template.
create function public.enable_workbook_model(p_hospital uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  h public.hospitals;
begin
  select * into h from public.hospitals where id = p_hospital;
  if not found or not private.is_hospital_admin(p_hospital) then
    raise exception 'Only an Admin can enable the workbook model.' using errcode = '42501';
  end if;
  insert into public.hospital_inputs (organization_id, hospital_id, key, category, label, unit, numeric_value,
                                     data_owner, note, source_type)
  select h.organization_id, h.id, t.key, t.category, t.label, t.unit, t.default_value, t.data_owner, t.note, t.source_type
  from public.workbook_input_templates t
  on conflict (hospital_id, key) do nothing;
  insert into public.scenario_assumptions (organization_id, hospital_id, scenario_name, occupancy_rate, package_price,
                                           savings_level, low_savings_pct, mid_savings_pct, high_savings_pct, is_default)
  select h.organization_id, h.id, 'Workbook default', 0.8, 1000, 'mid', 0.05, 0.10, 0.15, true
  where not exists (select 1 from public.scenario_assumptions where hospital_id = h.id and is_default);
  update public.hospitals set workbook_model_enabled = true where id = h.id;
end
$$;
revoke all on function public.enable_workbook_model(uuid) from public, anon;
grant execute on function public.enable_workbook_model(uuid) to authenticated;

-- Default scenario switch, now per hospital.
create or replace function public.set_default_scenario(scenario_id uuid) returns void
language plpgsql security invoker set search_path = ''
as $$
declare
  h uuid;
begin
  select hospital_id into h from public.scenario_assumptions where id = scenario_id;
  if h is null then
    raise exception 'Scenario not found.' using errcode = 'P0002';
  end if;
  if not private.is_hospital_admin(h) then
    raise exception 'Only an Admin can change the default scenario.' using errcode = '42501';
  end if;
  update public.scenario_assumptions set is_default = false where hospital_id = h and is_default and id <> scenario_id;
  update public.scenario_assumptions set is_default = true where id = scenario_id;
end
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Default service library (editable; each hospital chooses what it provides)
-- ─────────────────────────────────────────────────────────────────────────────
create function private.seed_service_library(org uuid) returns void
language sql security definer set search_path = ''
as $$
  insert into public.services (organization_id, name, code, category, description)
  values
    (org, 'Invasive Mechanical Ventilation', 'IMV', 'ventilation', 'Invasive mechanical ventilation via endotracheal tube or tracheostomy'),
    (org, 'NIV', 'NIV', 'ventilation', 'Non-invasive ventilation (BiPAP / NIPPV)'),
    (org, 'CPAP', 'CPAP', 'ventilation', 'Continuous positive airway pressure'),
    (org, 'HFNC', 'HFNC', 'oxygen_therapy', 'High-flow nasal cannula'),
    (org, 'Oxygen Therapy', 'O2', 'oxygen_therapy', 'Conventional oxygen therapy'),
    (org, 'Aerosol Therapy', 'AERO', 'aerosol', 'Nebulised and inhaled medication delivery'),
    (org, 'Airway Management', 'AIRWAY', 'airway', 'Airway clearance, artificial airway care, extubation support'),
    (org, 'ABG', 'ABG', 'diagnostics', 'Arterial blood gas sampling and analysis'),
    (org, 'Suction', 'SUCTION', 'airway', 'Airway suctioning (open and closed)'),
    (org, 'Transport Ventilation', 'TRANSPORT', 'transport', 'Ventilation during intra- and inter-hospital transport'),
    (org, 'PFT', 'PFT', 'diagnostics', 'Pulmonary function testing'),
    (org, 'Sleep Study', 'SLEEP', 'sleep', 'Polysomnography / sleep studies'),
    (org, 'CPT', 'CPT', 'therapy', 'Chest physiotherapy'),
    (org, 'Mobilization', 'MOBIL', 'therapy', 'Early mobilization of ventilated and critical patients'),
    (org, 'Weaning', 'WEAN', 'ventilation', 'Ventilator weaning protocols and spontaneous breathing trials')
  on conflict do nothing
$$;

select private.seed_service_library(id) from public.organizations;

create function private.seed_library_for_new_org() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.seed_service_library(new.id);
  return null;
end
$$;
create trigger organizations_seed_library after insert on public.organizations
  for each row execute function private.seed_library_for_new_org();

-- Price timeline with derived end month (read-only view; RLS of the base table applies).
create view public.service_price_timeline with (security_invoker = true) as
select v.*,
       (lead(v.effective_from) over (partition by v.hospital_service_id order by v.effective_from) - 1) as effective_to
from public.service_price_versions v
where not v.voided;
grant select on public.service_price_timeline to authenticated;

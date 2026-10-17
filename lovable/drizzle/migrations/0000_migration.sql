create type public.app_role as enum ('admin','director','chief_accountant','accountant','cashier','warehouse','operator','auditor');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid());

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  idno text,
  address text,
  iban text,
  bank text,
  director text,
  chief_accountant text,
  vat_payer boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, update on public.companies to authenticated;
grant all on public.companies to service_role;
alter table public.companies enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, company_id)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.company_role(_company uuid)
returns public.app_role language sql stable security definer set search_path = public as $$
  select role from public.user_roles where user_id = auth.uid() and company_id = _company limit 1
$$;

create or replace function public.has_perm(_company uuid, _perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select case _perm
      when 'read' then r.role in ('admin','director','chief_accountant','accountant','operator','auditor')
      when 'write' then r.role in ('admin','chief_accountant','accountant','operator')
      when 'company' then r.role in ('admin')
      when 'journal.read' then r.role in ('admin','chief_accountant','accountant','auditor')
      when 'journal.post' then r.role in ('admin','chief_accountant','accountant')
      when 'catalog' then r.role in ('admin','chief_accountant','accountant','operator')
      else false end
    from public.user_roles r where r.user_id = auth.uid() and r.company_id = _company limit 1
  ), false)
$$;

create policy "members read company" on public.companies for select to authenticated using (public.company_role(id) is not null);
create policy "admin updates company" on public.companies for update to authenticated using (public.has_perm(id,'company'));

create table public.catalog_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  kind text not null,
  code text not null,
  name text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (company_id, kind, code)
);
grant select, insert, update, delete on public.catalog_entries to authenticated;
grant all on public.catalog_entries to service_role;
alter table public.catalog_entries enable row level security;
create policy "catalog read" on public.catalog_entries for select to authenticated using (public.company_role(company_id) is not null);
create policy "catalog insert" on public.catalog_entries for insert to authenticated with check (public.has_perm(company_id,'catalog'));
create policy "catalog update" on public.catalog_entries for update to authenticated using (public.has_perm(company_id,'catalog'));
create policy "catalog delete" on public.catalog_entries for delete to authenticated using (public.has_perm(company_id,'catalog'));

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  kind text not null check (kind in ('sale','expense')),
  number text not null,
  date date not null default current_date,
  partner_id uuid references public.catalog_entries(id) on delete set null,
  partner_name text not null,
  category text not null default '',
  description text not null default '',
  total bigint not null check (total > 0 and total <= 100000000),
  paid bigint not null default 0 check (paid >= 0),
  status text not null default 'draft' check (status in ('draft','confirmed')),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  check (paid <= total)
);
grant select, insert, update, delete on public.documents to authenticated;
grant all on public.documents to service_role;
alter table public.documents enable row level security;
create policy "doc read" on public.documents for select to authenticated using (public.has_perm(company_id,'read'));
create policy "doc insert" on public.documents for insert to authenticated with check (public.has_perm(company_id,'write') and status = 'draft' and paid = 0);
create policy "doc update draft" on public.documents for update to authenticated using (public.has_perm(company_id,'write') and status = 'draft') with check (status = 'draft' and paid = 0);
create policy "doc delete draft" on public.documents for delete to authenticated using (public.has_perm(company_id,'write') and status = 'draft');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  amount bigint not null check (amount > 0),
  date date not null,
  created_by uuid not null,
  created_at timestamptz not null default now()
);
grant select on public.payments to authenticated;
grant all on public.payments to service_role;
alter table public.payments enable row level security;
create policy "pay read" on public.payments for select to authenticated using (public.has_perm(company_id,'read'));

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  operation text not null check (operation in ('sale','receipt','expense','payment')),
  debit text not null,
  credit text not null,
  amount bigint not null check (amount > 0),
  date date not null,
  state text not null default 'proposed' check (state in ('proposed','posted')),
  posted_by uuid,
  created_at timestamptz not null default now()
);
grant select on public.journal_entries to authenticated;
grant all on public.journal_entries to service_role;
alter table public.journal_entries enable row level security;
create policy "journal read" on public.journal_entries for select to authenticated using (public.has_perm(company_id,'journal.read'));

-- Business operations
create or replace function public.confirm_document(_doc uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d public.documents;
begin
  select * into d from public.documents where id = _doc for update;
  if d.id is null then raise exception 'Documentul nu există.'; end if;
  if not public.has_perm(d.company_id,'write') then raise exception 'Nu ai drept de modificare.'; end if;
  if d.status <> 'draft' then raise exception 'Documentul este deja confirmat.'; end if;
  update public.documents set status = 'confirmed' where id = _doc;
  insert into public.journal_entries(company_id, document_id, operation, debit, credit, amount, date)
  values (d.company_id, d.id, case when d.kind='sale' then 'sale' else 'expense' end,
          case when d.kind='sale' then '221' else '713' end,
          case when d.kind='sale' then '611' else '521' end, d.total, d.date);
end $$;

create or replace function public.add_payment(_doc uuid, _amount bigint, _date date)
returns void language plpgsql security definer set search_path = public as $$
declare d public.documents;
begin
  select * into d from public.documents where id = _doc for update;
  if d.id is null then raise exception 'Documentul nu există.'; end if;
  if not public.has_perm(d.company_id,'write') then raise exception 'Nu ai drept de modificare.'; end if;
  if d.status <> 'confirmed' then raise exception 'Confirmă documentul înainte de plată.'; end if;
  if _amount is null or _amount <= 0 then raise exception 'Suma trebuie să fie pozitivă.'; end if;
  if d.paid + _amount > d.total then raise exception 'Plata depășește restul de achitat.'; end if;
  update public.documents set paid = paid + _amount where id = _doc;
  insert into public.payments(company_id, document_id, amount, date, created_by) values (d.company_id, d.id, _amount, _date, auth.uid());
  insert into public.journal_entries(company_id, document_id, operation, debit, credit, amount, date)
  values (d.company_id, d.id, case when d.kind='sale' then 'receipt' else 'payment' end,
          case when d.kind='sale' then '242' else '521' end,
          case when d.kind='sale' then '221' else '242' end, _amount, _date);
end $$;

create or replace function public.post_entry(_entry uuid)
returns void language plpgsql security definer set search_path = public as $$
declare e public.journal_entries;
begin
  select * into e from public.journal_entries where id = _entry for update;
  if e.id is null then raise exception 'Articolul nu există.'; end if;
  if not public.has_perm(e.company_id,'journal.post') then raise exception 'Nu ai drept de postare.'; end if;
  if e.state <> 'proposed' then raise exception 'Articolul este deja postat.'; end if;
  update public.journal_entries set state='posted', posted_by=auth.uid() where id=_entry;
end $$;

revoke execute on function public.confirm_document(uuid), public.add_payment(uuid,bigint,date), public.post_entry(uuid) from public, anon;
grant execute on function public.confirm_document(uuid), public.add_payment(uuid,bigint,date), public.post_entry(uuid) to authenticated;

-- New user: profile + own company + admin role
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare c uuid; n text;
begin
  n := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1));
  insert into public.profiles(id, display_name) values (new.id, n);
  insert into public.companies(name) values (coalesce(nullif(new.raw_user_meta_data->>'company_name',''), 'Întreprinderea mea')) returning id into c;
  insert into public.user_roles(user_id, company_id, role) values (new.id, c, 'admin');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
-- Run manually in the Supabase SQL editor. This file is NOT run by the app or build.
-- A fresh project is recommended. All amounts are PHP; dates are local calendar dates.
begin;
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  currency text not null default 'PHP' check (currency = 'PHP'),
  created_at timestamptz not null default now()
);
create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  opening_balance numeric(11,2) not null default 0,
  created_at timestamptz not null default now(),
  unique (id, user_id), unique (user_id, name)
);
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  kind text not null check (kind in ('income','expense')),
  color text not null default '#527565' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (id, user_id), unique (id, user_id, kind), unique (user_id, name, kind)
);
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_id uuid not null,
  category_id uuid not null,
  kind text not null check (kind in ('income','expense')),
  amount numeric(11,2) not null check (amount > 0),
  note text not null default '' check (char_length(note) <= 200),
  occurred_on date not null default current_date,
  created_at timestamptz not null default now(),
  foreign key (wallet_id,user_id) references public.wallets(id,user_id),
  foreign key (category_id,user_id,kind) references public.categories(id,user_id,kind)
);
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null,
  month date not null check (extract(day from month) = 1),
  amount numeric(11,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  foreign key (category_id,user_id) references public.categories(id,user_id),
  unique(user_id,category_id,month)
);
create table public.recurring (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wallet_id uuid not null,
  category_id uuid not null,
  kind text not null check (kind in ('income','expense')),
  amount numeric(11,2) not null check (amount > 0),
  note text not null default '' check (char_length(note) <= 200),
  frequency text not null check (frequency in ('daily','weekly','monthly','yearly')),
  next_due date not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (wallet_id,user_id) references public.wallets(id,user_id),
  foreign key (category_id,user_id,kind) references public.categories(id,user_id,kind)
);
create index transactions_user_date on public.transactions(user_id,occurred_on desc,created_at desc);
create index transactions_category on public.transactions(category_id,user_id);
create index budgets_user_month on public.budgets(user_id,month);
create index recurring_user_due on public.recurring(user_id,next_due) where active;

-- RLS applies equally to reads and writes; no user may link another user's rows.
alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.recurring enable row level security;
create policy own_profile on public.profiles for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own_wallets on public.wallets for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own_categories on public.categories for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own_transactions on public.transactions for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own_budgets on public.budgets for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own_recurring on public.recurring for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.profiles,public.wallets,public.categories,public.transactions,public.budgets,public.recurring from anon;
grant select,insert,update,delete on public.profiles,public.wallets,public.categories,public.transactions,public.budgets,public.recurring to authenticated;

-- Internal initializer: never callable through the client API.
create function public.initialize_saldo_user(p_user uuid,p_name text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(user_id,display_name) values(p_user,coalesce(p_name,'')) on conflict(user_id) do nothing;
  insert into public.wallets(user_id,name) values(p_user,'Cash'),(p_user,'GCash'),(p_user,'Bank') on conflict(user_id,name) do nothing;
  insert into public.categories(user_id,name,kind,color) values
    (p_user,'Food & groceries','expense','#173f38'),
    (p_user,'Transport','expense','#527565'),
    (p_user,'Shopping','expense','#8c9f85'),
    (p_user,'Bills & utilities','expense','#b0be9c'),
    (p_user,'Health','expense','#789e9c'),
    (p_user,'Entertainment','expense','#b6ab84'),
    (p_user,'Other','expense','#c4ccbb'),
    (p_user,'Salary','income','#397341'),
    (p_user,'Freelance','income','#668a50'),
    (p_user,'Other income','income','#8baf6c')
  on conflict(user_id,name,kind) do nothing;
end;
$$;
revoke all on function public.initialize_saldo_user(uuid,text) from public,anon,authenticated;
create function public.handle_new_saldo_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.initialize_saldo_user(new.id,new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;
revoke all on function public.handle_new_saldo_user() from public,anon,authenticated;
create trigger on_auth_user_created_saldo after insert on auth.users for each row execute function public.handle_new_saldo_user();
-- Also initialize accounts created before this migration was applied.
do $$
declare u record;
begin
  for u in select id,raw_user_meta_data from auth.users loop
    perform public.initialize_saldo_user(u.id,u.raw_user_meta_data->>'full_name');
  end loop;
end;
$$;
commit;

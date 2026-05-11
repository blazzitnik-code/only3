-- Run this in your Supabase SQL editor

-- Profiles (extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  weekly_theme text,
  weekly_theme_set_at text, -- YYYY-MM-DD (monday of the week)
  push_subscription jsonb,
  notification_time text not null default '08:00',
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "Users can manage own profile"
  on public.profiles for all using (auth.uid() = id);

-- Daily entries
create table public.daily_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  date text not null, -- YYYY-MM-DD
  mood smallint check (mood >= 0 and mood <= 4),
  completed_at timestamptz,
  created_at timestamptz default now(),
  unique(user_id, date)
);

alter table public.daily_entries enable row level security;
create policy "Users can manage own entries"
  on public.daily_entries for all using (auth.uid() = user_id);

-- Tasks
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid references public.daily_entries on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  position smallint not null check (position in (1, 2, 3)),
  text text not null default '',
  done boolean not null default false,
  created_at timestamptz default now(),
  unique(entry_id, position)
);

alter table public.tasks enable row level security;
create policy "Users can manage own tasks"
  on public.tasks for all using (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

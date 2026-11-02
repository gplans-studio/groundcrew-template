-- Example table showing the default security posture of every Groundcrew
-- project: row level security is always on, and each policy is explicit.

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.notes enable row level security;

create policy "Users can read their own notes"
  on public.notes for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own notes"
  on public.notes for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own notes"
  on public.notes for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own notes"
  on public.notes for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create index notes_user_id_idx on public.notes (user_id);

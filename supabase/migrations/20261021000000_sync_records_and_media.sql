-- Applied to the "encore" Supabase project. Kept here for reference / re-creating the project.

create table public.records (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('memory', 'event', 'ticket', 'media')),
  id text not null,
  data jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, kind, id)
);

comment on table public.records is 'Encore sync: client records as JSON; deleted rows are tombstones.';

create index records_user_updated_idx on public.records (user_id, updated_at);

create function public.records_touch() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger records_touch
before insert or update on public.records
for each row execute function public.records_touch();

alter table public.records enable row level security;

create policy "records: select own" on public.records
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "records: insert own" on public.records
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "records: update own" on public.records
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "records: delete own" on public.records
  for delete to authenticated using ((select auth.uid()) = user_id);

insert into storage.buckets (id, name, public)
values ('media', 'media', false);

create policy "media: read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "media: upload own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "media: update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "media: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = (select auth.uid())::text);

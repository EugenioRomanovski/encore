-- One Supabase project ("hub") for all apps: one account, one profile, one friend list.
-- Layout (see docs/BACKEND.md):
--   public   — shared core: profiles, friendships, social RPC functions, `avatars` bucket
--   private  — internal helpers (not exposed through the API)
--   encore   — Encore: records, shares, share_concert()   (bucket `media`, legacy name)
--   winenote — Wine Note: recommendations, my_recommendations()   (bucket `winenote-rec-photos`)
-- Applied to the hub project uvuifuyozscfcowuxdtr (formerly "encore").
-- Data (Wine Note recommendations, photos, avatar) was copied separately, not in this file.

-- ---------- app schemas, exposed through the Data API ----------
create schema if not exists encore;
create schema if not exists winenote;
grant usage on schema encore, winenote to anon, authenticated, service_role;
-- same as Dashboard → Project Settings → Data API → Exposed schemas
alter role authenticator set pgrst.db_schemas = 'public, graphql_public, encore, winenote';

-- ---------- private helpers ----------
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- Answers only about the caller's own friendships (usable in RLS policies).
create function private.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) in (a, b) and exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and least(f.requester, f.addressee) = least(a, b)
      and greatest(f.requester, f.addressee) = greatest(a, b)
  );
$$;
revoke execute on function private.are_friends(uuid, uuid) from public, anon;
grant execute on function private.are_friends(uuid, uuid) to authenticated, service_role;

-- ---------- shared core: profiles ----------
-- A user may have a profile (name, avatar) before choosing a username (Wine Note allows that).
alter table public.profiles alter column username drop not null;
alter table public.profiles drop constraint profiles_display_name_len;
alter table public.profiles add constraint profiles_display_name_len check (char_length(display_name) <= 100);
comment on table public.profiles is 'Shared by all apps: one profile per account (username, name, avatar in the public `avatars` bucket).';

-- ---------- shared core: friendships ----------
-- Wine Note addresses a friendship by id.
alter table public.friendships add column id uuid not null default gen_random_uuid();
alter table public.friendships add constraint friendships_id_key unique (id);
comment on table public.friendships is 'Shared by all apps: one row per pair, pending → accepted.';

-- Exact username lookup (no prefix scan).
create function public.find_user(target_username text)
returns table (user_id uuid, username text, display_name text, avatar_url text)
language sql stable security definer set search_path = '' as $$
  select p.user_id, p.username, p.display_name, p.avatar_url from public.profiles p
  where auth.uid() is not null and p.username = lower(trim(target_username)) and p.user_id <> auth.uid();
$$;

-- Caller's friends and requests, with the other person's profile.
create function public.my_friends()
returns table (friendship_id uuid, status text, incoming boolean, user_id uuid, username text, display_name text, avatar_url text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select f.id, f.status, f.addressee = auth.uid(), p.user_id, p.username, p.display_name, p.avatar_url, f.created_at
  from public.friendships f
  join public.profiles p on p.user_id = case when f.requester = auth.uid() then f.addressee else f.requester end
  where auth.uid() in (f.requester, f.addressee)
  order by f.created_at desc;
$$;

-- Accept or decline an incoming request by its id.
create function public.respond_friend_request(request_id uuid, accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if accept then
    update public.friendships set status = 'accepted', updated_at = now()
      where id = request_id and addressee = auth.uid() and status = 'pending';
  else
    delete from public.friendships
      where id = request_id and addressee = auth.uid() and status = 'pending';
  end if;
end;
$$;

revoke execute on function public.find_user(text), public.my_friends(), public.respond_friend_request(uuid, boolean) from public, anon;
grant execute on function public.find_user(text), public.my_friends(), public.respond_friend_request(uuid, boolean) to authenticated;

-- ---------- Encore → schema encore ----------
alter table public.records set schema encore;
alter table public.shares set schema encore;
alter function public.records_touch() set schema encore;
revoke all on encore.records, encore.shares from anon;

create function encore.share_concert(p_to uuid[], p_kind text, p_source text, p_payload jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  n integer;
begin
  if me is null then raise exception 'not authenticated'; end if;
  insert into encore.shares (from_user, to_user, kind, source_id, payload)
  select me, t, p_kind, p_source, p_payload
  from unnest(p_to) as t
  where t <> me and private.are_friends(me, t)
  on conflict (from_user, to_user, kind, source_id)
  do update set payload = excluded.payload, updated_at = now();
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function encore.share_concert(uuid[], text, text, jsonb) from public, anon;
grant execute on function encore.share_concert(uuid[], text, text, jsonb) to authenticated;

-- Compatibility for Encore clients that still use public.* (installed PWAs). Remove later
-- (see "Cleanup" in docs/BACKEND.md).
create view public.records with (security_invoker = true) as select * from encore.records;
alter view public.records alter column user_id set default auth.uid();
create view public.shares with (security_invoker = true) as select * from encore.shares;
revoke all on public.records, public.shares from anon, authenticated;
grant select, insert, update, delete on public.records to authenticated;
grant select, delete on public.shares to authenticated;
grant update (status, updated_at) on public.shares to authenticated;

create or replace function public.share_concert(p_to uuid[], p_kind text, p_source text, p_payload jsonb) returns integer
language sql security invoker set search_path = '' as $$
  select encore.share_concert(p_to, p_kind, p_source, p_payload);
$$;

-- ---------- Wine Note → schema winenote ----------
create table winenote.recommendations (
  id uuid primary key default gen_random_uuid(),
  sender uuid not null default auth.uid() references auth.users (id) on delete cascade,
  recipient uuid not null references auth.users (id) on delete cascade,
  wine jsonb not null check (jsonb_typeof(wine) = 'object' and pg_column_size(wine) < 8192),
  message text check (char_length(message) <= 500),
  -- '<sender id>/<recommendation id>.jpg' in the `winenote-rec-photos` bucket
  photo_path text,
  created_at timestamptz not null default now(),
  constraint recommendations_photo_in_sender_folder check (photo_path is null or photo_path like sender::text || '/%')
);
comment on table winenote.recommendations is 'Wine Note: a wine (copy of the note) recommended to a friend.';
create index recommendations_recipient_idx on winenote.recommendations (recipient, created_at desc);
create index recommendations_sender_idx on winenote.recommendations (sender);
alter table winenote.recommendations enable row level security;
create policy "recommendations: sender and recipient read" on winenote.recommendations
  for select to authenticated using ((select auth.uid()) in (sender, recipient));
create policy "recommendations: send to a friend" on winenote.recommendations
  for insert to authenticated with check (sender = (select auth.uid()) and private.are_friends(sender, recipient));
create policy "recommendations: sender and recipient delete" on winenote.recommendations
  for delete to authenticated using ((select auth.uid()) in (sender, recipient));
revoke all on winenote.recommendations from anon, authenticated;
grant select, insert, delete on winenote.recommendations to authenticated;

-- Received recommendations with the sender's profile.
create function winenote.my_recommendations()
returns table (id uuid, wine jsonb, message text, photo_path text, created_at timestamptz,
               sender_id uuid, sender_username text, sender_name text, sender_avatar_url text)
language sql stable security definer set search_path = '' as $$
  select r.id, r.wine, r.message, r.photo_path, r.created_at, p.user_id, p.username, p.display_name, p.avatar_url
  from winenote.recommendations r
  left join public.profiles p on p.user_id = r.sender
  where r.recipient = auth.uid()
  order by r.created_at desc;
$$;
revoke execute on function winenote.my_recommendations() from public, anon;
grant execute on function winenote.my_recommendations() to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('winenote-rec-photos', 'winenote-rec-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']);

create policy "winenote-rec-photos: upload own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'winenote-rec-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "winenote-rec-photos: sender and recipient read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'winenote-rec-photos' and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1 from winenote.recommendations r
        where r.photo_path = storage.objects.name and r.recipient = (select auth.uid())
      )
    )
  );
create policy "winenote-rec-photos: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'winenote-rec-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

notify pgrst, 'reload config';
notify pgrst, 'reload schema';

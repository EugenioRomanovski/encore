-- Applied to the "encore" Supabase project. Kept here for reference / re-creating the project.

-- ---------- profiles: public username + display name ----------
create table public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  username text not null,
  display_name text not null default '',
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_][a-z0-9_.]{1,22}[a-z0-9_]$'),
  constraint profiles_display_name_len check (char_length(display_name) <= 60)
);
create unique index profiles_username_key on public.profiles (username);
create index profiles_username_prefix_idx on public.profiles (username text_pattern_ops);

alter table public.profiles enable row level security;
-- usernames are discoverable by any signed-in user (that's how friends are found)
create policy "profiles: read" on public.profiles for select to authenticated using (true);
create policy "profiles: insert own" on public.profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "profiles: update own" on public.profiles for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.profiles from anon;

-- ---------- friendships ----------
create table public.friendships (
  requester uuid not null references auth.users (id) on delete cascade,
  addressee uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);
-- one relationship per pair, whichever side asked
create unique index friendships_pair_key on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index friendships_addressee_idx on public.friendships (addressee);

alter table public.friendships enable row level security;
create policy "friendships: read own" on public.friendships for select to authenticated
  using ((select auth.uid()) in (requester, addressee));
-- decline / cancel / unfriend
create policy "friendships: delete own" on public.friendships for delete to authenticated
  using ((select auth.uid()) in (requester, addressee));
-- inserts and accepting go through the functions below
revoke insert, update on public.friendships from authenticated;
revoke all on public.friendships from anon;

create function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and least(f.requester, f.addressee) = least(a, b)
      and greatest(f.requester, f.addressee) = greatest(a, b)
  );
$$;

-- returns: 'requested' | 'accepted' (they had already asked you) | 'pending' | 'friends' | 'self' | 'not_found'
create function public.send_friend_request(p_username text) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  them uuid;
  f public.friendships;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select user_id into them from public.profiles where username = lower(trim(p_username));
  if them is null then return 'not_found'; end if;
  if them = me then return 'self'; end if;
  select * into f from public.friendships
    where least(requester, addressee) = least(me, them) and greatest(requester, addressee) = greatest(me, them);
  if found then
    if f.status = 'accepted' then return 'friends'; end if;
    if f.requester = them then
      update public.friendships set status = 'accepted', updated_at = now() where requester = them and addressee = me;
      return 'accepted';
    end if;
    return 'pending';
  end if;
  insert into public.friendships (requester, addressee) values (me, them);
  return 'requested';
end;
$$;

create function public.accept_friend_request(p_requester uuid) returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  update public.friendships set status = 'accepted', updated_at = now()
    where requester = p_requester and addressee = auth.uid() and status = 'pending';
  return found;
end;
$$;

-- ---------- shares: "a friend tagged you in a concert" ----------
create table public.shares (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('memory', 'event')),
  source_id text not null,
  payload jsonb not null,
  status text not null default 'new' check (status in ('new', 'added', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (from_user, to_user, kind, source_id)
);
create index shares_to_user_idx on public.shares (to_user, status);

alter table public.shares enable row level security;
create policy "shares: read own" on public.shares for select to authenticated
  using ((select auth.uid()) in (from_user, to_user));
create policy "shares: recipient updates status" on public.shares for update to authenticated
  using ((select auth.uid()) = to_user) with check ((select auth.uid()) = to_user);
create policy "shares: delete own" on public.shares for delete to authenticated
  using ((select auth.uid()) in (from_user, to_user));
revoke insert, update on public.shares from authenticated;
grant update (status, updated_at) on public.shares to authenticated;
revoke all on public.shares from anon;

-- Send (or refresh) a concert card to friends; non-friends are skipped. Returns how many were sent.
create function public.share_concert(p_to uuid[], p_kind text, p_source text, p_payload jsonb) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  n integer;
begin
  if me is null then raise exception 'not authenticated'; end if;
  insert into public.shares (from_user, to_user, kind, source_id, payload)
  select me, t, p_kind, p_source, p_payload
  from unnest(p_to) as t
  where t <> me and public.are_friends(me, t)
  on conflict (from_user, to_user, kind, source_id)
  do update set payload = excluded.payload, updated_at = now();
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.are_friends(uuid, uuid) from public, anon, authenticated; -- internal only
revoke execute on function public.send_friend_request(text) from public, anon;
revoke execute on function public.accept_friend_request(uuid) from public, anon;
revoke execute on function public.share_concert(uuid[], text, text, jsonb) from public, anon;
grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.accept_friend_request(uuid) to authenticated;
grant execute on function public.share_concert(uuid[], text, text, jsonb) to authenticated;

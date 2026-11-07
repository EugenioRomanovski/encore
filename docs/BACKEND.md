# Общий бэкенд приложений (Supabase)

Один проект Supabase на все приложения автора: **один аккаунт, один профиль, один список друзей**.
Сейчас в нём Encore и Wine Note; новые приложения добавляются по шаблону ниже.

- Проект: `uvuifuyozscfcowuxdtr` (в панели пока называется «encore», имя можно поменять:
  Project Settings → General). URL: `https://uvuifuyozscfcowuxdtr.supabase.co`,
  публичный ключ: `sb_publishable_gD0M11LHLg4PJWxA8rKatQ_zn69qbw_` (доступ ограничен RLS).
- История схемы: `supabase/migrations/` в этом репозитории (имя файла = версия из `list_migrations`).
  Старые проекты: Wine Note жил в `zhgtrtqrhcsvcbidnuoe` (его миграции — в репозитории wine_note,
  `supabase/old-winenote-project/`).

## Устройство

| Схема | Что лежит | Кто пользуется |
|---|---|---|
| `public` — общее ядро | `profiles` (юзернейм, имя, аватар), `friendships` (одна строка на пару, `pending` → `accepted`), функции `send_friend_request`, `accept_friend_request`, `respond_friend_request`, `find_user`, `my_friends` | все приложения |
| `private` | `are_friends(a, b)` для RLS (отвечает только про дружбу самого спрашивающего). Через API не видна | политики доступа |
| `encore` | `records` (синхронизация: строка на запись, JSON), `shares` (карточки концертов друзьям), `share_concert()` | Encore |
| `winenote` | `recommendations` (вино, рекомендованное другу), `my_recommendations()` | Wine Note |

Бакеты Storage:
- `avatars` — общий, публичный: `<user id>/avatar-<время>.jpg`, ссылка в `profiles.avatar_url`.
- `media` — Encore (историческое имя без префикса): фото, видео, PDF, `<user id>/<media id>`.
- `winenote-rec-photos` — Wine Note: фото рекомендаций, `<sender id>/<recommendation id>.jpg`.

Схемы приложений открыты для Data API настройкой роли `authenticator`
(`pgrst.db_schemas = 'public, graphql_public, encore, winenote'`). В панели это же место —
Project Settings → Data API → Exposed schemas; **держите оба списка одинаковыми**.

В клиенте общее берётся напрямую, своё — через схему приложения:

```ts
supabase.from('profiles')                  // общее
supabase.rpc('my_friends')                 // общее
supabase.schema('encore').from('records')  // только Encore
supabase.schema('winenote').rpc('my_recommendations')
```

### Правила

1. Аккаунт, профиль и друзья — только в `public`. Таблицы приложения — только в его схеме.
2. Таблица приложения ссылается на пользователя через `auth.users (id) on delete cascade`,
   RLS включён всегда, доступ «своё» — `(select auth.uid()) = user_id`.
3. «Только другу» — через `private.are_friends(...)` в политике.
4. Функции, которые трогают двух пользователей, — `security definer set search_path = ''`, фильтр по
   `auth.uid()`, `revoke execute … from public, anon`, `grant … to authenticated`.
5. Бакет приложения называется `<app>-<что>`; путь начинается с id владельца (`<user id>/…`).
6. Чужие профили в `public.profiles` сейчас видны всем вошедшим (Encore ищет друзей по началу
   юзернейма). Секретов в профиле не хранить.
7. `profiles.username` может быть пустым: аккаунт, созданный в одном приложении, получает
   юзернейм позже. Формат: `^[a-z0-9_][a-z0-9_.]{1,22}[a-z0-9_]$`; приложение может требовать более
   строгий (Wine Note: `^[a-z0-9_]{3,20}$`).

## Как добавить приложение `myapp`

1. Миграция:
   ```sql
   create schema myapp;
   grant usage on schema myapp to anon, authenticated, service_role;
   alter role authenticator set pgrst.db_schemas = 'public, graphql_public, encore, winenote, myapp';
   create table myapp.items (
     id uuid primary key default gen_random_uuid(),
     user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
     data jsonb not null,
     updated_at timestamptz not null default now()
   );
   alter table myapp.items enable row level security;
   create policy "items: own" on myapp.items for all to authenticated
     using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
   revoke all on myapp.items from anon, authenticated;
   grant select, insert, update, delete on myapp.items to authenticated;
   notify pgrst, 'reload config';
   notify pgrst, 'reload schema';
   ```
   и добавить `myapp` в Exposed schemas в панели.
2. В приложении — тот же URL и публичный ключ, свой `storageKey` для сессии,
   `supabase.schema('myapp')` для своих таблиц.
3. Вход: `signInWithOtp({ email, options: { emailRedirectTo: <адрес приложения> } })`; адрес добавить
   в Authentication → URL Configuration → Redirect URLs. Ссылку из письма
   (`?token_hash=…&type=email`) обработать через `verifyOtp({ token_hash, type })`.
4. Дописать приложение в таблицу выше.

## Настройки в панели (один раз, вручную)

Authentication:
- **URL Configuration** → Redirect URLs: `https://encore-one-rho.vercel.app/**`,
  `https://wine-note-one.vercel.app/**`, `http://localhost:5173/**`. Без этого ссылка из письма для
  Wine Note откроет Site URL (Encore); вход кодом работает в любом случае.
- **Email Templates** → Magic Link и Confirm signup — один текст на все приложения:
  ```html
  <h2>Вход</h2>
  <p>Ваш код: <b style="font-size:20px">{{ .Token }}</b></p>
  <p>Или нажмите: <a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">войти</a></p>
  ```
  `{{ .ConfirmationURL }}` не использовать: токены после `#` ломают HashRouter в Wine Note.

## Слияние Wine Note (07.11.2026)

- Пользователи сопоставлены по email (id из Encore остались, id из Wine Note заменены).
- Профили: имя совпадало; аватар взят более новый (правило «побеждает последнее изменение»).
- Дружба уже была в обоих проектах — одна строка. Рекомендации (3) и их фото перенесены с новыми id.
- Файлы перенесены одноразовыми edge-функциями `import-winenote-files` (здесь) и
  `export-for-merge` (старый проект); сейчас они отключены (отвечают 410), их можно удалить в панели.
- Encore-клиенты старой версии (установленные PWA) продолжают работать: в `public` оставлены
  представления `records`, `shares` и обёртка `share_concert()`.

## Уборка (через пару недель, когда старые версии обновятся)

Требует подтверждения (удаление):
```sql
drop function public.share_concert(uuid[], text, text, jsonb);
drop view public.records;
drop view public.shares;
drop function public.are_friends(uuid, uuid);
```
Старый проект Wine Note (`zhgtrtqrhcsvcbidnuoe`) после проверки — поставить на паузу или удалить.

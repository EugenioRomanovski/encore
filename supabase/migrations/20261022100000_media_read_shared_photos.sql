-- Applied to the "encore" Supabase project. Kept here for reference / re-creating the project.

-- A friend may read exactly the photos/videos (and their previews, "<id>.thumb") that the owner
-- listed in a memory card shared with them: shares.payload.photos is a JSON array of media ids.
create policy "media: read photos shared with me" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'media'
    and exists (
      select 1 from public.shares s
      where s.to_user = (select auth.uid())
        and s.kind = 'memory'
        and s.from_user::text = (storage.foldername(name))[1]
        and (s.payload -> 'photos') ? split_part(storage.filename(name), '.', 1)
    )
  );

-- Private notes now live in submission_admin_notes (admin-only). The old
-- column sat on the artist-readable submissions row, so remove it.

insert into public.submission_admin_notes (submission_id, notes)
select id, admin_notes from public.submissions where admin_notes is not null
on conflict (submission_id) do nothing;

drop policy "Artists create their own pending submissions" on public.submissions;

create policy "Artists create their own pending submissions"
  on public.submissions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and notified_at is null
    and artist_message is null
    and artist_notified_status is null
    and artist_notified_at is null
    and starts_with(audio_path, (select auth.uid())::text || '/' || id::text || '/')
    and starts_with(poster_path, (select auth.uid())::text || '/' || id::text || '/')
  );

alter table public.submissions drop column admin_notes;

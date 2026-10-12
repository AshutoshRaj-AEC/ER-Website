-- Record when a release's files were deleted to free up storage.
alter table public.submissions
  add column files_removed_at timestamptz,
  add column files_removed_bytes bigint check (files_removed_bytes >= 0);

-- Admins may delete a submission's audio/poster, but only once the release
-- has been sent to the distributor.
create policy "Admins delete files of distributed submissions"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'submissions'
    and (select public.is_admin())
    and exists (
      select 1 from public.submissions s
      where s.status = 'sent_to_distributor'
        and storage.objects.name in (s.audio_path, s.poster_path)
    )
  );

-- Storage totals per bucket for the admin storage meter. Returns only
-- counts and sizes, never file names, so private Song Vault files stay private.
create or replace function public.admin_storage_usage()
returns table (bucket_id text, files bigint, bytes bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can view storage usage' using errcode = '42501';
  end if;

  return query
    select o.bucket_id, count(*)::bigint, coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint
    from storage.objects o
    group by o.bucket_id;
end;
$$;

-- Bytes stored for each submission's audio + poster.
create or replace function public.admin_submission_file_sizes()
returns table (submission_id uuid, bytes bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can view file sizes' using errcode = '42501';
  end if;

  return query
    select s.id, coalesce(sum((o.metadata->>'size')::bigint), 0)::bigint
    from public.submissions s
    join storage.objects o
      on o.bucket_id = 'submissions' and o.name in (s.audio_path, s.poster_path)
    group by s.id;
end;
$$;

revoke execute on function public.admin_storage_usage() from public, anon;
revoke execute on function public.admin_submission_file_sizes() from public, anon;
grant execute on function public.admin_storage_usage() to authenticated;
grant execute on function public.admin_submission_file_sizes() to authenticated;

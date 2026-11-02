-- Store each authenticated user's own profile photo in a dedicated bucket.
-- Public read is intentional so the dashboard can display profile images without
-- requiring a signed URL; uploads/updates/deletes remain restricted to the owner.

insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
values (
    'profile-photos',
    'profile-photos',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users upload their own profile photos" on storage.objects;
create policy "Users upload their own profile photos"
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users update their own profile photos" on storage.objects;
create policy "Users update their own profile photos"
on storage.objects
for update
to authenticated
using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users delete their own profile photos" on storage.objects;
create policy "Users delete their own profile photos"
on storage.objects
for delete
to authenticated
using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos-membres', 'photos-membres', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "envoi public photos membres" on storage.objects
for insert to anon, authenticated
with check (bucket_id = 'photos-membres' and name ~ '^[a-f0-9-]+[.](jpg|jpeg|png|webp)$');

create policy "lecture photos membres autorisee" on storage.objects
for select to authenticated
using (bucket_id = 'photos-membres' and public.peut_gerer_membres());

create policy "suppression photos membres autorisee" on storage.objects
for delete to authenticated
using (bucket_id = 'photos-membres' and public.peut_gerer_membres());

-- Mode test : consultation et suppression anonymes des membres et de leurs photos.
grant select, delete on public.membres_organisation to anon;
create policy "test lecture membres" on public.membres_organisation for select to anon using (true);
create policy "test suppression membres" on public.membres_organisation for delete to anon using (true);
create policy "test lecture photos membres" on storage.objects for select to anon using (bucket_id = 'photos-membres');
create policy "test suppression photos membres" on storage.objects for delete to anon using (bucket_id = 'photos-membres');

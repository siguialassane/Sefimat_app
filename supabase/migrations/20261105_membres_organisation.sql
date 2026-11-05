-- Les inscriptions sont publiques ; les coordonnées restent réservées aux comptes autorisés.
create table if not exists public.membres_organisation (
    id uuid primary key default gen_random_uuid(),
    nom text not null check (char_length(trim(nom)) between 1 and 100),
    prenom text not null check (char_length(trim(prenom)) between 1 and 150),
    telephone text not null check (char_length(trim(telephone)) between 1 and 30),
    email text not null check (char_length(trim(email)) between 3 and 254),
    commission text not null check (char_length(trim(commission)) between 1 and 150),
    photo_url text not null check (photo_url like 'https://%'),
    created_at timestamptz not null default now()
);

create table if not exists public.membres_administrateurs (
    user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.membres_administrateurs enable row level security;
revoke all on public.membres_administrateurs from anon, authenticated;

create or replace function public.peut_gerer_membres()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$ select exists (select 1 from public.membres_administrateurs where user_id = auth.uid()) $$;
revoke all on function public.peut_gerer_membres() from public, anon;
grant execute on function public.peut_gerer_membres() to authenticated;

alter table public.membres_organisation enable row level security;
revoke all on public.membres_organisation from anon, authenticated;
grant insert (nom, prenom, telephone, email, commission, photo_url) on public.membres_organisation to anon, authenticated;
grant select, delete on public.membres_organisation to authenticated;
create policy "inscription publique membres" on public.membres_organisation for insert to anon, authenticated with check (true);
create policy "lecture membres autorisee" on public.membres_organisation for select to authenticated using (public.peut_gerer_membres());
create policy "suppression membres autorisee" on public.membres_organisation for delete to authenticated using (public.peut_gerer_membres());

-- Conserve les notes et les identifiants des classes pendant la réaffectation.
begin;
lock table public.classes, public.notes_examens, public.config_seuils_niveaux in share row exclusive mode;

alter table public.classes alter column nom drop expression if exists;

create or replace function public.definir_nom_classe()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
    if new.nom is null or btrim(new.nom) = '' then
        new.nom := case new.niveau
            when 'niveau_1' then 'Niveau 1-'
            when 'niveau_2' then 'Niveau 2-'
            when 'niveau_3' then 'Niveau 3-'
            when 'niveau_superieur' then 'Niveau Supérieur-'
        end || chr(64 + new.numero);
    end if;
    return new;
end $$;
drop trigger if exists classes_nom_defaut on public.classes;
create trigger classes_nom_defaut before insert on public.classes
for each row execute function public.definir_nom_classe();

insert into public.config_seuils_niveaux (niveau, note_max)
values ('niveau_1', 7), ('niveau_2', 12)
on conflict (niveau) do update set note_max = excluded.note_max, updated_at = now();

do $$
declare
    ancienne record;
    evaluation record;
    numero_suivant integer;
    niveau_cible text;
    classe_cible uuid;
    capacite_cible integer;
begin
    if exists (select 1 from public.notes_examens where note_entree is null and niveau_attribue = 'niveau_3') then
        raise exception 'Une note Niveau 3 ne possède pas de note d’entrée ; réaffectation automatique interrompue.';
    end if;

    for ancienne in select id from public.classes where niveau = 'niveau_3' order by numero loop
        select coalesce(max(numero), 0) + 1 into numero_suivant from public.classes where niveau = 'niveau_superieur';
        update public.classes set niveau = 'niveau_superieur', numero = numero_suivant,
            nom = 'Niveau Supérieur-' || chr(64 + numero_suivant)
        where id = ancienne.id;
    end loop;

    for evaluation in select id, note_entree, classe_id from public.notes_examens where note_entree is not null order by created_at, id loop
        niveau_cible := case when evaluation.note_entree <= 7 then 'niveau_1'
                             when evaluation.note_entree <= 12 then 'niveau_2'
                             else 'niveau_superieur' end;

        select id into classe_cible from public.classes where id = evaluation.classe_id and niveau = niveau_cible;
        if classe_cible is null then
            select c.id into classe_cible from public.classes c
            where c.niveau = niveau_cible
              and (select count(*) from public.notes_examens n where n.classe_id = c.id) < c.capacite
            order by c.numero limit 1;
        end if;

        if classe_cible is null then
            select coalesce(max(numero), 0) + 1 into numero_suivant from public.classes where niveau = niveau_cible;
            select capacite into capacite_cible from public.config_capacite_classes where niveau = niveau_cible;
            insert into public.classes (niveau, numero, capacite)
            values (niveau_cible, numero_suivant, coalesce(capacite_cible, 10))
            returning id into classe_cible;
        end if;

        update public.notes_examens set niveau_attribue = niveau_cible, classe_id = classe_cible where id = evaluation.id;
        classe_cible := null;
    end loop;
end $$;
commit;

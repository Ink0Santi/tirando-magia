-- =========================================================
-- TIRANDO MAGIA — ACTUALIZACIÓN DE LA BASE DE DATOS
-- Ejecutar una vez en Supabase → SQL Editor → New query → Run.
-- Se puede ejecutar varias veces sin romper nada.
-- =========================================================


-- ---------------------------------------------------------
-- 1. Columnas nuevas del perfil (rol de profesor y clases)
-- ---------------------------------------------------------

alter table public.profiles
    add column if not exists role                text not null default 'musico',
    add column if not exists class_price         integer,
    add column if not exists class_mode          text,
    add column if not exists teaching_levels     text,
    add column if not exists teaching_experience text,
    add column if not exists profile_photo       text;

do $$
begin
    alter table public.profiles
        add constraint profiles_role_check check (role in ('musico', 'profesor'));
exception
    when duplicate_object then null;
end $$;

do $$
begin
    alter table public.profiles
        add constraint profiles_class_price_check check (class_price is null or class_price >= 0);
exception
    when duplicate_object then null;
end $$;

create index if not exists profiles_role_idx on public.profiles (role);


-- ---------------------------------------------------------
-- 2. Arreglar instrumentos guardados por el registro viejo
--    ("guitarra" → "Guitarra", "bateria" → "Batería", etc.)
-- ---------------------------------------------------------

update public.profiles set instrument = case lower(instrument)
    when 'guitarra' then 'Guitarra'
    when 'bajo'     then 'Bajo'
    when 'bateria'  then 'Batería'
    when 'voz'      then 'Voz'
    when 'piano'    then 'Piano'
    when 'teclado'  then 'Teclado'
    when 'violin'   then 'Violín'
    when 'saxofon'  then 'Saxofón'
    when 'otro'     then 'Otro'
    else instrument
end
where instrument is not null;


-- ---------------------------------------------------------
-- 3. Índices para que mensajes y chats carguen rápido
-- ---------------------------------------------------------

create index if not exists messages_conversation_created_idx
    on public.messages (conversation_id, created_at desc);

create index if not exists conversations_user_one_idx on public.conversations (user_one);
create index if not exists conversations_user_two_idx on public.conversations (user_two);


-- ---------------------------------------------------------
-- 4. Fotos de perfil (Storage)
--    Cada usuario solo puede subir/borrar archivos dentro
--    de su propia carpeta: avatars/<su id>/...
-- ---------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Avatares públicos"        on storage.objects;
drop policy if exists "Subir avatar propio"      on storage.objects;
drop policy if exists "Actualizar avatar propio" on storage.objects;
drop policy if exists "Borrar avatar propio"     on storage.objects;

create policy "Avatares públicos"
    on storage.objects for select
    using (bucket_id = 'avatars');

create policy "Subir avatar propio"
    on storage.objects for insert to authenticated
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Actualizar avatar propio"
    on storage.objects for update to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Borrar avatar propio"
    on storage.objects for delete to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);


-- ---------------------------------------------------------
-- 5. Tiempo real para el chat (si ya estaba activado, no hace nada)
-- ---------------------------------------------------------

do $$
begin
    alter publication supabase_realtime add table public.messages;
exception
    when duplicate_object then null;
end $$;

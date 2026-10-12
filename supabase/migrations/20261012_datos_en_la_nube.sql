-- LifeBucket · los datos de cada persona en la nube (semana, momentos, objetivos, sueño).
-- Se corre una vez en Supabase: SQL Editor → pegar todo → Run.

-- Una fila por persona con todo su estado (el mismo que la app guarda en el navegador).
create table if not exists public.datos (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  estado jsonb not null,
  version integer not null default 5,  -- versión del formato (la del store de la app)
  actualizado timestamptz not null default now()
);

-- Seguridad: cada persona solo ve y modifica lo suyo.
alter table public.datos enable row level security;

drop policy if exists "cada uno lee sus datos" on public.datos;
create policy "cada uno lee sus datos" on public.datos
  for select to authenticated using (usuario_id = (select auth.uid()));

drop policy if exists "cada uno crea sus datos" on public.datos;
create policy "cada uno crea sus datos" on public.datos
  for insert to authenticated with check (usuario_id = (select auth.uid()));

drop policy if exists "cada uno actualiza sus datos" on public.datos;
create policy "cada uno actualiza sus datos" on public.datos
  for update to authenticated using (usuario_id = (select auth.uid())) with check (usuario_id = (select auth.uid()));

-- LifeBucket · registro de usuarios e ingresos.
-- Se corre una vez en Supabase: SQL Editor → pegar todo → Run.

-- Una fila por persona que se crea una cuenta (Google o email).
create table if not exists public.usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  nombre text,
  foto text,
  proveedor text,                      -- 'google' o 'email' (con qué se registró)
  creado_en timestamptz not null default now(),
  ultimo_ingreso timestamptz,
  cantidad_ingresos integer not null default 0
);

-- Una fila por cada vez que alguien entra: el log.
create table if not exists public.ingresos (
  id bigint generated always as identity primary key,
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  fecha timestamptz not null default now(),
  proveedor text,                      -- con qué entró esta vez
  navegador text
);
create index if not exists ingresos_usuario_fecha on public.ingresos (usuario_id, fecha desc);

-- Seguridad: cada usuario solo puede leer lo suyo. Nadie escribe directo: solo las funciones de abajo.
alter table public.usuarios enable row level security;
alter table public.ingresos enable row level security;

drop policy if exists "cada uno ve su usuario" on public.usuarios;
create policy "cada uno ve su usuario" on public.usuarios for select to authenticated using (id = (select auth.uid()));

drop policy if exists "cada uno ve sus ingresos" on public.ingresos;
create policy "cada uno ve sus ingresos" on public.ingresos for select to authenticated using (usuario_id = (select auth.uid()));

-- Al crearse una cuenta, se agrega a `usuarios`.
create or replace function public.nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.usuarios (id, email, nombre, foto, proveedor, creado_en)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    coalesce(new.raw_app_meta_data ->> 'provider', 'email'),
    new.created_at
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists al_crear_usuario on auth.users;
create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function public.nuevo_usuario();

-- La app la llama cada vez que alguien entra.
create or replace function public.registrar_ingreso(proveedor text default null, navegador text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return;
  end if;

  -- Por si la cuenta es anterior a esta tabla.
  insert into public.usuarios (id, email, nombre, foto, proveedor, creado_en)
  select u.id, u.email,
         coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
         u.raw_user_meta_data ->> 'avatar_url',
         coalesce(u.raw_app_meta_data ->> 'provider', 'email'),
         u.created_at
  from auth.users u
  where u.id = uid
  on conflict (id) do nothing;

  update public.usuarios
  set ultimo_ingreso = now(), cantidad_ingresos = cantidad_ingresos + 1
  where id = uid;

  insert into public.ingresos (usuario_id, proveedor, navegador)
  values (uid, left(registrar_ingreso.proveedor, 20), left(registrar_ingreso.navegador, 300));
end;
$$;

revoke execute on function public.registrar_ingreso(text, text) from public, anon;
grant execute on function public.registrar_ingreso(text, text) to authenticated;
revoke execute on function public.nuevo_usuario() from public, anon, authenticated;

-- Para mirar el log cómodo desde el panel (Table Editor o SQL): quién entró y cuándo.
create or replace view public.ingresos_detalle
with (security_invoker = true) as
select i.fecha, u.email, u.nombre, i.proveedor, i.navegador, u.creado_en as cuenta_creada
from public.ingresos i
join public.usuarios u on u.id = i.usuario_id
order by i.fecha desc;

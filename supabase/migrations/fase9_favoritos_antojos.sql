-- ================= AVISO "YA TE APROBARON" =================
-- Quien espera aprobación también puede activar avisos (para enterarse cuando lo aprueben)
create or replace function public.guardar_suscripcion(p_endpoint text, p_p256dh text, p_auth text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.es_activo()
     and not exists (select 1 from public.perfiles where id = (select auth.uid()) and not aprobado) then
    raise exception 'Usuario no autorizado' using errcode = '42501';
  end if;
  delete from public.push_suscripciones where endpoint = p_endpoint;
  insert into public.push_suscripciones (usuario_id, endpoint, p256dh, auth)
  values ((select auth.uid()), p_endpoint, p_p256dh, p_auth);
end;
$$;

create or replace function private.aviso_aprobado()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_tienda text; v_enc text;
begin
  select nombre_tienda, nombre_encargada into v_tienda, v_enc from public.ajustes where id = 1;
  perform private.notificar(jsonb_build_object(
    'accion', 'usuario', 'usuario_id', new.id, 'tag', 'aprobado',
    'titulo', '✅ ¡Ya te aprobaron!',
    'cuerpo', 'Hola ' || split_part(new.nombre, ' ', 1) || ', ' || v_enc || ' aprobó tu cuenta. Ya puedes comprar en ' || v_tienda || '.',
    'url', '/'));
  return null;
end;
$$;
revoke all on function private.aviso_aprobado() from public, anon, authenticated;

create trigger perfiles_aviso_aprobado
after update of aprobado on public.perfiles
for each row when (old.aprobado = false and new.aprobado = true)
execute function private.aviso_aprobado();

-- ================= FAVORITOS =================
create table public.favoritos (
  usuario_id uuid not null default auth.uid() references public.perfiles(id) on delete cascade,
  producto_id bigint not null references public.productos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (usuario_id, producto_id)
);
create index favoritos_producto_idx on public.favoritos (producto_id);
alter table public.favoritos enable row level security;
revoke all on public.favoritos from anon, authenticated;
grant select, insert, delete on public.favoritos to authenticated;
create policy favoritos_select on public.favoritos for select to authenticated
  using (usuario_id = (select auth.uid()));
create policy favoritos_insert on public.favoritos for insert to authenticated
  with check (usuario_id = (select auth.uid()) and (select private.es_activo()));
create policy favoritos_delete on public.favoritos for delete to authenticated
  using (usuario_id = (select auth.uid()));

-- ================= BUZÓN DE ANTOJOS =================
create table public.antojos (
  id bigint generated always as identity primary key,
  texto text not null check (char_length(texto) between 2 and 60),
  usuario_id uuid references public.perfiles(id) on delete set null,
  estado text not null default 'abierto' check (estado in ('abierto', 'traido', 'descartado')),
  created_at timestamptz not null default now(),
  resuelto_at timestamptz,
  resuelto_por uuid references public.perfiles(id) on delete set null
);
create index antojos_estado_idx on public.antojos (estado, created_at desc);
create index antojos_usuario_idx on public.antojos (usuario_id);
create index antojos_resuelto_por_idx on public.antojos (resuelto_por);

create table public.antojo_votos (
  antojo_id bigint not null references public.antojos(id) on delete cascade,
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (antojo_id, usuario_id)
);
create index antojo_votos_usuario_idx on public.antojo_votos (usuario_id);

alter table public.antojos enable row level security;
alter table public.antojo_votos enable row level security;
revoke all on public.antojos, public.antojo_votos from anon, authenticated;
grant select on public.antojos, public.antojo_votos to authenticated;
create policy antojos_select on public.antojos for select to authenticated using ((select private.es_activo()));
create policy antojo_votos_select on public.antojo_votos for select to authenticated using ((select private.es_activo()));

-- Pedir un producto. Si ya alguien pidió lo mismo, suma un voto en vez de repetirlo.
create or replace function public.proponer_antojo(p_texto text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_txt text := regexp_replace(trim(coalesce(p_texto, '')), '\s+', ' ', 'g');
  v_id bigint;
  v_nombre text;
begin
  if v_uid is null or not private.es_activo() then
    raise exception 'Usuario no autorizado' using errcode = '42501';
  end if;
  if char_length(v_txt) < 2 or char_length(v_txt) > 60 then
    raise exception 'Escribe qué producto quieres (de 2 a 60 letras).';
  end if;

  select id into v_id from public.antojos where estado = 'abierto' and lower(texto) = lower(v_txt) limit 1;
  if found then
    insert into public.antojo_votos (antojo_id, usuario_id) values (v_id, v_uid) on conflict do nothing;
    return v_id;
  end if;

  if (select count(*) from public.antojos where usuario_id = v_uid and created_at > now() - interval '1 day') >= 5 then
    raise exception 'Ya pediste 5 cosas hoy. Vota por las que ya están en la lista.';
  end if;

  insert into public.antojos (texto, usuario_id) values (v_txt, v_uid) returning id into v_id;
  insert into public.antojo_votos (antojo_id, usuario_id) values (v_id, v_uid);

  select split_part(nombre, ' ', 1) into v_nombre from public.perfiles where id = v_uid;
  perform private.notificar(jsonb_build_object(
    'accion', 'admins', 'permiso', 'productos', 'tag', 'antojos',
    'titulo', '💡 Nuevo antojo',
    'cuerpo', v_nombre || ' pidió: ' || v_txt,
    'url', '/?vista=menu'));
  return v_id;
end;
$$;

-- Votar o quitar el voto. Devuelve true si quedó votado.
create or replace function public.votar_antojo(p_id bigint)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not private.es_activo() then
    raise exception 'Usuario no autorizado' using errcode = '42501';
  end if;
  if not exists (select 1 from public.antojos where id = p_id and estado = 'abierto') then
    raise exception 'Ese pedido ya no está abierto.';
  end if;
  delete from public.antojo_votos where antojo_id = p_id and usuario_id = v_uid;
  if found then return false; end if;
  insert into public.antojo_votos (antojo_id, usuario_id) values (p_id, v_uid);
  return true;
end;
$$;

-- Administración: "ya lo traje" (avisa a quienes lo pidieron) o descartar
create or replace function public.resolver_antojo(p_id bigint, p_estado text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_txt text;
  v_quien uuid;
  v_enc text;
begin
  if v_uid is null or not private.tiene_permiso('productos') then
    raise exception 'No autorizado' using errcode = '42501';
  end if;
  if p_estado not in ('traido', 'descartado', 'abierto') then raise exception 'Estado inválido'; end if;

  update public.antojos
     set estado = p_estado,
         resuelto_at = case when p_estado = 'abierto' then null else now() end,
         resuelto_por = case when p_estado = 'abierto' then null else v_uid end
   where id = p_id
  returning texto into v_txt;
  if not found then raise exception 'No encontrado'; end if;

  if p_estado = 'traido' then
    select nombre_encargada into v_enc from public.ajustes where id = 1;
    for v_quien in select usuario_id from public.antojo_votos where antojo_id = p_id and usuario_id <> v_uid loop
      perform private.notificar(jsonb_build_object(
        'accion', 'usuario', 'usuario_id', v_quien, 'tag', 'antojo-' || p_id,
        'titulo', '🎉 ¡Llegó lo que pediste!',
        'cuerpo', v_enc || ' ya trajo: ' || v_txt || '. Búscalo en la tienda.',
        'url', '/?vista=menu'));
    end loop;
  end if;
end;
$$;

revoke all on function public.proponer_antojo(text), public.votar_antojo(bigint), public.resolver_antojo(bigint, text)
  from public, anon, authenticated;
grant execute on function public.proponer_antojo(text), public.votar_antojo(bigint), public.resolver_antojo(bigint, text)
  to authenticated;

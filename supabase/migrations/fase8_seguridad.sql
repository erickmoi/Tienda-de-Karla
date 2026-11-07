-- ================= 1. BLOQUEO POR INTENTOS FALLIDOS =================
create table private.intentos_login (
  usuario text primary key,
  fallos integer not null default 0,
  bloqueado_hasta timestamptz,
  actualizado timestamptz not null default now()
);

-- Segundos que faltan para poder intentar (0 = puede intentar)
create or replace function public.login_estado(p_usuario text)
returns integer language sql security definer set search_path = '' stable as $$
  select coalesce((
    select greatest(0, ceil(extract(epoch from (bloqueado_hasta - now()))))::integer
      from private.intentos_login where usuario = lower(trim(p_usuario))), 0);
$$;

-- Registra un intento fallido. 5 seguidos en 15 min => bloqueo de 15 min.
create or replace function public.login_fallo(p_usuario text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_u text := lower(trim(p_usuario));
  v_fila private.intentos_login;
  v_nombre text;
begin
  select nombre into v_nombre from public.perfiles where usuario = v_u;
  if not found then return jsonb_build_object('restantes', null, 'bloqueado_seg', 0); end if;

  insert into private.intentos_login as i (usuario, fallos, actualizado) values (v_u, 1, now())
  on conflict (usuario) do update set
    fallos = case when i.actualizado < now() - interval '15 minutes'
                    or (i.bloqueado_hasta is not null and i.bloqueado_hasta <= now())
                  then 1 else i.fallos + 1 end,
    bloqueado_hasta = case when i.bloqueado_hasta > now() then i.bloqueado_hasta end,
    actualizado = now()
  returning * into v_fila;

  if v_fila.bloqueado_hasta is null and v_fila.fallos >= 5 then
    update private.intentos_login set bloqueado_hasta = now() + interval '15 minutes', fallos = 0
     where usuario = v_u returning * into v_fila;
    perform private.notificar(jsonb_build_object(
      'accion', 'admins', 'permiso', 'usuarios', 'tag', 'seguridad',
      'titulo', '🔒 Cuenta bloqueada 15 min',
      'cuerpo', 'Hubo 5 intentos fallidos de PIN en la cuenta de ' || split_part(v_nombre, ' ', 1) || ' (@' || v_u || ').',
      'url', '/?vista=admin'));
  end if;

  return jsonb_build_object(
    'restantes', case when v_fila.bloqueado_hasta is null then 5 - v_fila.fallos end,
    'bloqueado_seg', coalesce(greatest(0, ceil(extract(epoch from (v_fila.bloqueado_hasta - now()))))::integer, 0));
end;
$$;

-- Entrada correcta: limpia el contador del propio usuario
create or replace function public.login_ok()
returns void language sql security definer set search_path = '' as $$
  delete from private.intentos_login
   where usuario = (select usuario from public.perfiles where id = (select auth.uid()));
$$;

revoke all on function public.login_estado(text), public.login_fallo(text), public.login_ok() from public, anon, authenticated;
grant execute on function public.login_estado(text), public.login_fallo(text) to anon, authenticated;
grant execute on function public.login_ok() to authenticated;

-- ================= 7. AVISO DE CAMBIOS EN CUENTAS DE BANCO =================
create or replace function private.aviso_cuentas()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_quien text;
  v_txt text;
  v_sa uuid;
begin
  select split_part(nombre, ' ', 1) into v_quien from public.perfiles where id = v_uid;
  if tg_op = 'INSERT' then
    v_txt := 'agregó la cuenta ' || new.banco || ' ' || new.numero || ' (' || new.titular || ')';
  elsif tg_op = 'DELETE' then
    v_txt := 'borró la cuenta ' || old.banco || ' ' || old.numero;
  elsif (old.banco, old.numero, old.titular) is distinct from (new.banco, new.numero, new.titular) then
    v_txt := 'cambió la cuenta ' || old.banco || ' ' || old.numero || ' → ' || new.banco || ' ' || new.numero || ' (' || new.titular || ')';
  elsif old.qr_path is distinct from new.qr_path then
    v_txt := case when new.qr_path is null then 'quitó el QR de ' else 'cambió el QR de ' end || new.banco;
  elsif old.activo is distinct from new.activo then
    v_txt := case when new.activo then 'mostró' else 'ocultó' end || ' la cuenta ' || new.banco;
  end if;
  if v_txt is null then return null; end if; -- p. ej. solo cambió el orden

  if v_uid is not null then
    insert into public.bitacora (usuario_id, accion, detalle)
    values (v_uid, 'cuenta_banco', jsonb_build_object('cambio', v_txt));
  end if;

  for v_sa in select id from public.perfiles where rol = 'superadmin' and activo and id is distinct from v_uid loop
    perform private.notificar(jsonb_build_object(
      'accion', 'usuario', 'usuario_id', v_sa, 'tag', 'cuentas',
      'titulo', '🏦 Cambio en cuentas de pago',
      'cuerpo', coalesce(v_quien, 'Alguien') || ' ' || v_txt || '.',
      'url', '/?vista=admin'));
  end loop;
  return null;
end;
$$;
revoke all on function private.aviso_cuentas() from public, anon, authenticated;

create trigger metodos_pago_aviso
after insert or update or delete on public.metodos_pago
for each row execute function private.aviso_cuentas();

-- ================= RECORDATORIO DE QUINCENA (15 y 30, 4 pm) =================
alter table public.ajustes add column recordatorio_quincena boolean not null default true;

create or replace function private.recordatorio_tick()
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_aj record;
  v_ahora timestamp := now() at time zone 'America/El_Salvador';
  v_dia integer := extract(day from v_ahora);
  v_ultimo integer := extract(day from (date_trunc('month', v_ahora) + interval '1 month - 1 day'));
begin
  select recordatorio_activo, recordatorio_dia, recordatorio_hora, recordatorio_quincena into v_aj from public.ajustes where id = 1;

  -- Semanal (día y hora elegidos en Ajustes)
  if v_aj.recordatorio_activo
     and extract(dow from v_ahora) = v_aj.recordatorio_dia
     and extract(hour from v_ahora) = v_aj.recordatorio_hora then
    perform private.notificar('{"accion":"recordatorios"}'::jsonb);
  end if;

  -- Quincena: el 15 y el 30 (en febrero, el último día) a las 4:00 pm
  if v_aj.recordatorio_quincena
     and extract(hour from v_ahora) = 16
     and (v_dia = 15 or v_dia = least(30, v_ultimo)) then
    perform private.notificar('{"accion":"recordatorios","motivo":"quincena"}'::jsonb);
  end if;
end;
$$;

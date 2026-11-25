-- Migración 002: libros de diario (líneas sin registrar) y nº de documento en asientos.
alter table asientos add column if not exists documento text;

drop function if exists crear_asiento(uuid, date, text, text, jsonb);
create or replace function crear_asiento(p_empresa uuid, p_fecha date, p_concepto text, p_origen text, p_apuntes jsonb, p_documento text default null)
returns uuid language plpgsql security invoker as $$
declare
  v_id uuid; v_num int; v_ej int := extract(year from p_fecha);
  v_debe numeric; v_haber numeric;
begin
  select coalesce(sum((a->>'debe')::numeric),0), coalesce(sum((a->>'haber')::numeric),0)
    into v_debe, v_haber from jsonb_array_elements(p_apuntes) a;
  if round(v_debe,2) <> round(v_haber,2) or v_debe = 0 then
    raise exception 'El asiento no cuadra: debe % / haber %', v_debe, v_haber;
  end if;
  select coalesce(max(numero),0)+1 into v_num from asientos where empresa_id = p_empresa and ejercicio = v_ej;
  insert into asientos (empresa_id, ejercicio, numero, fecha, concepto, origen, documento)
    values (p_empresa, v_ej, v_num, p_fecha, p_concepto, coalesce(p_origen,'manual'), p_documento) returning id into v_id;
  insert into apuntes (asiento_id, empresa_id, cuenta, concepto, debe, haber)
    select v_id, p_empresa, a->>'cuenta', a->>'concepto', coalesce((a->>'debe')::numeric,0), coalesce((a->>'haber')::numeric,0)
    from jsonb_array_elements(p_apuntes) a;
  return v_id;
end $$;
grant execute on function crear_asiento(uuid, date, text, text, jsonb, text) to authenticated;

create table if not exists diario_lineas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  libro text not null default 'GENERAL',
  fecha date,
  documento text,
  descripcion text,
  cuenta text,
  debe numeric(14,2) not null default 0 check (debe >= 0),
  haber numeric(14,2) not null default 0 check (haber >= 0),
  orden bigint not null default (extract(epoch from clock_timestamp()) * 1000)::bigint
);
create index if not exists diario_lineas_emp on diario_lineas (empresa_id, libro);
alter table diario_lineas enable row level security;
drop policy if exists dl_all on diario_lineas;
create policy dl_all on diario_lineas for all using (exists (select 1 from empresas e where e.id = empresa_id and e.owner = auth.uid()))
  with check (exists (select 1 from empresas e where e.id = empresa_id and e.owner = auth.uid()));
grant select, insert, update, delete on diario_lineas to authenticated;

-- Modificar un asiento ya registrado: cambia cabecera y sustituye sus apuntes, exigiendo que cuadre.
create or replace function modificar_asiento(p_asiento uuid, p_fecha date, p_concepto text, p_documento text, p_apuntes jsonb)
returns void language plpgsql security invoker as $$
declare
  v_emp uuid; v_debe numeric; v_haber numeric;
begin
  select empresa_id into v_emp from asientos where id = p_asiento;
  if v_emp is null then raise exception 'Asiento no encontrado'; end if;
  select coalesce(sum((a->>'debe')::numeric),0), coalesce(sum((a->>'haber')::numeric),0)
    into v_debe, v_haber from jsonb_array_elements(p_apuntes) a;
  if round(v_debe,2) <> round(v_haber,2) or v_debe = 0 then
    raise exception 'El asiento no cuadra: debe % / haber %', v_debe, v_haber;
  end if;
  update asientos set fecha = p_fecha, ejercicio = extract(year from p_fecha), concepto = p_concepto, documento = p_documento where id = p_asiento;
  delete from apuntes where asiento_id = p_asiento;
  insert into apuntes (asiento_id, empresa_id, cuenta, concepto, debe, haber)
    select p_asiento, v_emp, a->>'cuenta', a->>'concepto', coalesce((a->>'debe')::numeric,0), coalesce((a->>'haber')::numeric,0)
    from jsonb_array_elements(p_apuntes) a;
end $$;
grant execute on function modificar_asiento(uuid, date, text, text, jsonb) to authenticated;

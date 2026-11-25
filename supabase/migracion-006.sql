-- Migración 006: los asientos solo admiten cuentas de movimiento de 9 dígitos (los títulos del PGC no admiten movimientos).
create or replace function crear_asiento(p_empresa uuid, p_fecha date, p_concepto text, p_origen text, p_apuntes jsonb, p_documento text default null)
returns uuid language plpgsql security invoker as $$
declare
  v_id uuid; v_num int; v_ej int := extract(year from p_fecha);
  v_debe numeric; v_haber numeric;
begin
  if exists (select 1 from jsonb_array_elements(p_apuntes) a where coalesce(a->>'cuenta','') !~ '^[0-9]{9}$') then
    raise exception 'Todas las cuentas de un asiento deben ser cuentas de movimiento de 9 dígitos';
  end if;
  select coalesce(sum((a->>'debe')::numeric),0), coalesce(sum((a->>'haber')::numeric),0)
    into v_debe, v_haber from jsonb_array_elements(p_apuntes) a;
  if round(v_debe,2) <> round(v_haber,2) or v_debe = 0 then
    raise exception 'El asiento no cuadra: debe % / haber %', v_debe, v_haber;
  end if;
  select coalesce(max(numero),0)+1 into v_num from asientos where empresa_id = p_empresa and ejercicio = v_ej;
  insert into asientos (empresa_id, ejercicio, numero, fecha, concepto, origen, documento)
    values (p_empresa, v_ej, v_num, p_fecha, p_concepto, coalesce(p_origen,'manual'), p_documento) returning id into v_id;
  insert into apuntes (asiento_id, empresa_id, cuenta, concepto, debe, haber, tercero_id)
    select v_id, p_empresa, a->>'cuenta', a->>'concepto', coalesce((a->>'debe')::numeric,0), coalesce((a->>'haber')::numeric,0), nullif(a->>'tercero_id','')::uuid
    from jsonb_array_elements(p_apuntes) a;
  return v_id;
end $$;

create or replace function modificar_asiento(p_asiento uuid, p_fecha date, p_concepto text, p_documento text, p_apuntes jsonb)
returns void language plpgsql security invoker as $$
declare
  v_emp uuid; v_debe numeric; v_haber numeric;
begin
  select empresa_id into v_emp from asientos where id = p_asiento;
  if v_emp is null then raise exception 'Asiento no encontrado'; end if;
  if exists (select 1 from jsonb_array_elements(p_apuntes) a where coalesce(a->>'cuenta','') !~ '^[0-9]{9}$') then
    raise exception 'Todas las cuentas de un asiento deben ser cuentas de movimiento de 9 dígitos';
  end if;
  select coalesce(sum((a->>'debe')::numeric),0), coalesce(sum((a->>'haber')::numeric),0)
    into v_debe, v_haber from jsonb_array_elements(p_apuntes) a;
  if round(v_debe,2) <> round(v_haber,2) or v_debe = 0 then
    raise exception 'El asiento no cuadra: debe % / haber %', v_debe, v_haber;
  end if;
  update asientos set fecha = p_fecha, ejercicio = extract(year from p_fecha), concepto = p_concepto, documento = p_documento where id = p_asiento;
  delete from apuntes where asiento_id = p_asiento;
  insert into apuntes (asiento_id, empresa_id, cuenta, concepto, debe, haber, tercero_id)
    select p_asiento, v_emp, a->>'cuenta', a->>'concepto', coalesce((a->>'debe')::numeric,0), coalesce((a->>'haber')::numeric,0), nullif(a->>'tercero_id','')::uuid
    from jsonb_array_elements(p_apuntes) a;
end $$;

-- Migración 003: clientes y proveedores (terceros) y facturas de venta/compra con IVA.
create table if not exists terceros (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  tipo text not null check (tipo in ('C','P')),
  codigo text not null,
  nombre text not null,
  cif text,
  grupo_iva text not null default 'NAC',
  telefono text,
  email text,
  cuenta text,
  unique (empresa_id, codigo)
);

create table if not exists facturas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  tipo text not null check (tipo in ('V','C')),
  numero text not null,
  tercero_id uuid references terceros(id) on delete restrict,
  num_externo text,
  fecha_emision date,
  fecha_registro date,
  fecha_iva date,
  fecha_vencimiento date,
  estado text not null default 'abierto',
  asiento_id uuid references asientos(id) on delete set null,
  notas text,
  unique (empresa_id, tipo, numero)
);

create table if not exists factura_lineas (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references facturas(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  orden int not null default 0,
  descripcion text,
  cuenta text,
  cantidad numeric(14,3) not null default 1,
  precio numeric(14,4) not null default 0,
  iva numeric(5,2) not null default 21
);
create index if not exists factura_lineas_f on factura_lineas (factura_id);
create index if not exists facturas_emp on facturas (empresa_id, tipo);

alter table apuntes add column if not exists tercero_id uuid references terceros(id) on delete set null;
alter table diario_lineas add column if not exists tercero_id uuid references terceros(id) on delete set null;

alter table terceros enable row level security;
alter table facturas enable row level security;
alter table factura_lineas enable row level security;
drop policy if exists ter_all on terceros;
drop policy if exists fac_all on facturas;
drop policy if exists fli_all on factura_lineas;
create policy ter_all on terceros for all using (exists (select 1 from empresas e where e.id = empresa_id and e.owner = auth.uid()))
  with check (exists (select 1 from empresas e where e.id = empresa_id and e.owner = auth.uid()));
create policy fac_all on facturas for all using (exists (select 1 from empresas e where e.id = empresa_id and e.owner = auth.uid()))
  with check (exists (select 1 from empresas e where e.id = empresa_id and e.owner = auth.uid()));
create policy fli_all on factura_lineas for all using (exists (select 1 from empresas e where e.id = empresa_id and e.owner = auth.uid()))
  with check (exists (select 1 from empresas e where e.id = empresa_id and e.owner = auth.uid()));
grant select, insert, update, delete on terceros, facturas, factura_lineas to authenticated;

-- Lotes de diario (como la lista "Diarios generales" de D365): cada lote agrupa sus líneas.
create table if not exists diario_libros (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  numero text not null,
  nombre text not null default 'GENERAL',
  descripcion text,
  creado timestamptz default now(),
  unique (empresa_id, numero)
);
alter table diario_libros enable row level security;
drop policy if exists dli_all on diario_libros;
create policy dli_all on diario_libros for all using (exists (select 1 from empresas e where e.id = empresa_id and e.owner = auth.uid()))
  with check (exists (select 1 from empresas e where e.id = empresa_id and e.owner = auth.uid()));
grant select, insert, update, delete on diario_libros to authenticated;

-- Las funciones de asiento ahora conservan el tercero de cada apunte.
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

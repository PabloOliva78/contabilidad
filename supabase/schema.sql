-- Esquema del programa de contabilidad (proyecto Supabase PROPIO, separado de gestion-empresas).
-- Ejecutar entero en Supabase > SQL Editor.

create table empresas (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id),
  nombre text not null,
  cif text,
  creada timestamptz default now()
);

create table cuentas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  codigo text not null,
  nombre text not null,
  unique (empresa_id, codigo)
);

create table asientos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  ejercicio int not null,
  numero int not null,
  fecha date not null,
  concepto text not null,
  origen text not null default 'manual',
  creado timestamptz default now(),
  unique (empresa_id, ejercicio, numero)
);

create table apuntes (
  id uuid primary key default gen_random_uuid(),
  asiento_id uuid not null references asientos(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  cuenta text not null,
  concepto text,
  debe numeric(14,2) not null default 0 check (debe >= 0),
  haber numeric(14,2) not null default 0 check (haber >= 0),
  check (not (debe > 0 and haber > 0))
);
create index on apuntes (empresa_id, cuenta);
create index on apuntes (asiento_id);

-- RLS: cada usuario solo ve sus empresas y lo que cuelga de ellas
alter table empresas enable row level security;
alter table cuentas  enable row level security;
alter table asientos enable row level security;
alter table apuntes  enable row level security;

create policy emp_all on empresas for all using (owner = auth.uid()) with check (owner = auth.uid());
create policy cue_all on cuentas  for all using (exists (select 1 from empresas e where e.id = empresa_id and e.owner = auth.uid()))
  with check (exists (select 1 from empresas e where e.id = empresa_id and e.owner = auth.uid()));
create policy asi_all on asientos for all using (exists (select 1 from empresas e where e.id = empresa_id and e.owner = auth.uid()))
  with check (exists (select 1 from empresas e where e.id = empresa_id and e.owner = auth.uid()));
create policy apu_all on apuntes  for all using (exists (select 1 from empresas e where e.id = empresa_id and e.owner = auth.uid()))
  with check (exists (select 1 from empresas e where e.id = empresa_id and e.owner = auth.uid()));

-- Crear asiento de forma atómica: exige que cuadre (debe = haber) y numera correlativamente.
create or replace function crear_asiento(p_empresa uuid, p_fecha date, p_concepto text, p_origen text, p_apuntes jsonb)
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
  insert into asientos (empresa_id, ejercicio, numero, fecha, concepto, origen)
    values (p_empresa, v_ej, v_num, p_fecha, p_concepto, coalesce(p_origen,'manual')) returning id into v_id;
  insert into apuntes (asiento_id, empresa_id, cuenta, concepto, debe, haber)
    select v_id, p_empresa, a->>'cuenta', a->>'concepto', coalesce((a->>'debe')::numeric,0), coalesce((a->>'haber')::numeric,0)
    from jsonb_array_elements(p_apuntes) a;
  return v_id;
end $$;

-- Migración 005: retenciones en facturas de proveedor (modelos 111/115/123) y casillas manuales de modelos.
alter table facturas add column if not exists retencion_tipo text check (retencion_tipo in ('111','115','123'));
alter table facturas add column if not exists retencion_pct numeric(5,2) not null default 0;

create table if not exists modelos_manual (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  modelo text not null,
  ejercicio int not null,
  periodo text not null,
  datos jsonb not null default '{}',
  unique (empresa_id, modelo, ejercicio, periodo)
);
alter table modelos_manual enable row level security;
drop policy if exists mm_all on modelos_manual;
create policy mm_all on modelos_manual for all using (exists (select 1 from empresas e where e.id = empresa_id and e.owner = auth.uid()))
  with check (exists (select 1 from empresas e where e.id = empresa_id and e.owner = auth.uid()));
grant select, insert, update, delete on modelos_manual to authenticated;

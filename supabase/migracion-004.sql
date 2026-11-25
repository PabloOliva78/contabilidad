-- Migración 004: cobros y pagos (liquidación de facturas).
create table if not exists liquidaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  factura_id uuid not null references facturas(id) on delete cascade,
  asiento_id uuid references asientos(id) on delete cascade,
  fecha date not null,
  importe numeric(14,2) not null check (importe > 0)
);
create index if not exists liquidaciones_f on liquidaciones (factura_id);
alter table liquidaciones enable row level security;
drop policy if exists liq_all on liquidaciones;
create policy liq_all on liquidaciones for all using (exists (select 1 from empresas e where e.id = empresa_id and e.owner = auth.uid()))
  with check (exists (select 1 from empresas e where e.id = empresa_id and e.owner = auth.uid()));
grant select, insert, update, delete on liquidaciones to authenticated;

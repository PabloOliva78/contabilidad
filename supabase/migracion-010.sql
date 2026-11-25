-- Migración 010: inventario (artículos, almacenes, movimientos) y pedidos de compra y de venta.
create table if not exists almacenes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  codigo text not null, nombre text not null, direccion text,
  unique (empresa_id, codigo)
);
create table if not exists articulos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  codigo text not null, nombre text not null,
  tipo text not null default 'Artículo',
  unidad text default 'ud', grupo text,
  cod_iva_c text, cod_iva_v text, cuenta_compra text, cuenta_venta text,
  precio_compra numeric(14,4) not null default 0, precio_venta numeric(14,4) not null default 0,
  stock_min numeric(14,3) not null default 0, activo boolean not null default true,
  ficha jsonb not null default '{}'::jsonb,
  unique (empresa_id, codigo)
);
create table if not exists pedidos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  tipo text not null check (tipo in ('C','V')),
  numero text not null,
  tercero_id uuid references terceros(id) on delete restrict,
  fecha date, fecha_entrega date,
  almacen_id uuid references almacenes(id) on delete set null,
  estado text not null default 'abierto',
  dto_pct numeric(5,2) not null default 0,
  ficha jsonb not null default '{}'::jsonb,
  creado timestamptz default now(),
  unique (empresa_id, tipo, numero)
);
create table if not exists pedido_lineas (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  orden int not null default 0,
  articulo_id uuid references articulos(id) on delete restrict,
  descripcion text,
  almacen_id uuid references almacenes(id) on delete set null,
  cantidad numeric(14,3) not null default 0, unidad text,
  precio numeric(14,4) not null default 0, dto_pct numeric(5,2) not null default 0,
  cod_iva text, cod_rec text,
  cant_recibida numeric(14,3) not null default 0, cant_facturada numeric(14,3) not null default 0
);
create table if not exists mov_inventario (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  fecha date not null,
  articulo_id uuid not null references articulos(id) on delete cascade,
  almacen_id uuid references almacenes(id) on delete restrict,
  tipo text not null,
  cantidad numeric(14,3) not null,
  coste numeric(14,4) not null default 0,
  pedido_id uuid references pedidos(id) on delete set null,
  linea_id uuid, documento text, notas text,
  creado timestamptz default now()
);
create index if not exists mov_inv_art on mov_inventario (empresa_id, articulo_id);
create index if not exists pedido_lineas_p on pedido_lineas (pedido_id);
alter table facturas add column if not exists pedido_id uuid references pedidos(id) on delete set null;

do $$ declare t text; begin
  foreach t in array array['almacenes','articulos','pedidos','pedido_lineas','mov_inventario'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists p_all on %I', t);
    execute format('create policy p_all on %I for all using (exists (select 1 from empresas e where e.id = empresa_id and e.owner = auth.uid())) with check (exists (select 1 from empresas e where e.id = empresa_id and e.owner = auth.uid()))', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;
alter table factura_lineas add column if not exists pedido_linea_id uuid references pedido_lineas(id) on delete set null;

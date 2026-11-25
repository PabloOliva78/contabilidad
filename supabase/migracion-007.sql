-- Migración 007: ficha completa de clientes y proveedores (General, contactos, direcciones/país, condiciones de pago, factura y entrega).
alter table terceros add column if not exists ficha jsonb not null default '{}'::jsonb;
alter table terceros add column if not exists contactos jsonb not null default '[]'::jsonb;
alter table terceros add column if not exists direcciones jsonb not null default '[]'::jsonb;

-- Migración 009: diario general completo como en D365 (lotes con ficha y tipo de diario; líneas con tipo de cuenta, contrapartida y campos de las pestañas).
alter table diario_libros add column if not exists tipo text not null default 'general';
alter table diario_libros add column if not exists ficha jsonb not null default '{}'::jsonb;
alter table diario_libros add column if not exists creado_por text;
alter table diario_lineas add column if not exists tipo_cuenta text;
alter table diario_lineas add column if not exists contra_tipo text;
alter table diario_lineas add column if not exists contra_cuenta text;
alter table diario_lineas add column if not exists extra jsonb not null default '{}'::jsonb;

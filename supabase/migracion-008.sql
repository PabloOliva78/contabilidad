-- Migración 008: código de impuestos por línea de factura, recargo de equivalencia y código de retención en la factura.
alter table factura_lineas add column if not exists cod_iva text;
alter table factura_lineas add column if not exists cod_rec text;
alter table facturas add column if not exists cod_ret text;

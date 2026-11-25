// Códigos de impuestos (elegidos desde D365). Cada código define el tratamiento del IVA o de la retención.
// lado: C = compras, V = ventas.  tipo:
//   nac  = IVA nacional (cuenta cta)            ex  = exento / no sujeto / exportación / entrega UE (sin apunte de IVA)
//   ue   = adquisición intracomunitaria: soportado en cta y autorrepercutido en cta2
//   isp  = inversión del sujeto pasivo nacional: soportado en cta y autorrepercutido en cta2
//   inv  = bien de inversión (IVA nacional, cuenta cta)   rec = recargo de equivalencia (se suma a una venta)
//   imp  = compra a tercer país (la factura no lleva IVA; el IVA va por el DUA)   dua = documento aduanero (IVA en cta)
//   ret  = retención de IRPF practicada (compras)   retc = retención de IRPF que nos practican (ventas)
export const CODIGOS = [
  // Compras nacionales
  { cod: "S.NC.NR",    nombre: "Compras Nacionales 21 %",  lado: "C", tipo: "nac", pct: 21, cta: "472000001" },
  { cod: "S.NC.RD",    nombre: "Compras Nacionales 10 %",  lado: "C", tipo: "nac", pct: 10, cta: "472000001" },
  { cod: "S.NC.RDN",   nombre: "Compras Nacionales 5 %",   lado: "C", tipo: "nac", pct: 5,  cta: "472000001" },
  { cod: "S.NC.SR",    nombre: "Compras Nacionales 4 %",   lado: "C", tipo: "nac", pct: 4,  cta: "472000001" },
  { cod: "S.NC.SRN",   nombre: "Compras Nacionales 2 %",   lado: "C", tipo: "nac", pct: 2,  cta: "472000001" },
  { cod: "S.NC.EX",    nombre: "Compras Nacionales Exento",           lado: "C", tipo: "ex", pct: 0 },
  { cod: "S.NC.EX.S",  nombre: "Compras Nacionales Servicios Exentos", lado: "C", tipo: "ex", pct: 0 },
  { cod: "S.NAC.NS",   nombre: "Compras Nacionales no sujetas",       lado: "C", tipo: "ex", pct: 0 },
  // Compras con inversión del sujeto pasivo nacional (soportado y autorepercutido)
  { cod: "S.ISP.NR",   nombre: "Compras Nacionales ISP 21 %", lado: "C", tipo: "isp", pct: 21, cta: "472000001", cta2: "477300002", par: "R.ISP.NR" },
  { cod: "S.ISP.RD",   nombre: "Compras Nacionales ISP 10 %", lado: "C", tipo: "isp", pct: 10, cta: "472000001", cta2: "477300002", par: "R.ISP.RD" },
  { cod: "R.ISP.NR",   nombre: "Compras Nacionales ISP 21 % autorepercutido", lado: "C", tipo: "isp-par", pct: 21, cta: "477300002", oculto: true },
  { cod: "R.ISP.RD",   nombre: "Compras Nacionales ISP 10 % autorepercutido", lado: "C", tipo: "isp-par", pct: 10, cta: "477300002", oculto: true },
  // Bienes de inversión
  { cod: "IN.NR",      nombre: "Bienes de inversión 21 %", lado: "C", tipo: "inv", pct: 21, cta: "472000001" },
  { cod: "IN.RD",      nombre: "Bienes de inversión 10 %", lado: "C", tipo: "inv", pct: 10, cta: "472000001" },
  // Compras UE (soportado 472200001 y autorrepercutido 477300001)
  { cod: "S.UE.NR",    nombre: "Compras UE Normal Mercancías 21 %",   lado: "C", tipo: "ue", pct: 21, cta: "472200001", cta2: "477300001", par: "R.UE.NR",    bien: true },
  { cod: "S.UE.NR.SR", nombre: "Compras UE Normal Servicios 21 %",    lado: "C", tipo: "ue", pct: 21, cta: "472200001", cta2: "477300001", par: "R.UE.NR.SR", bien: false },
  { cod: "S.UE.RD",    nombre: "Compras UE Reducido Mercancías 10 %", lado: "C", tipo: "ue", pct: 10, cta: "472200001", cta2: "477300001", par: "R.UE.RD",    bien: true },
  { cod: "S.UE.RD.SR", nombre: "Compras UE Reducido Servicios 10 %",  lado: "C", tipo: "ue", pct: 10, cta: "472200001", cta2: "477300001", par: "R.UE.RD.SR", bien: false },
  { cod: "S.UE.SR",    nombre: "Compras UE Super Reducido Mercancías 4 %", lado: "C", tipo: "ue", pct: 4, cta: "472200001", cta2: "477300001", par: "R.UE.SR", bien: true },
  { cod: "R.UE.NR",    nombre: "Compras UE Normal Autorrepercutido Mercancías 21 %",   lado: "C", tipo: "ue-par", pct: 21, cta: "477300001", oculto: true },
  { cod: "R.UE.NR.SR", nombre: "Compras UE Normal Autorrepercutido Servicios 21 %",    lado: "C", tipo: "ue-par", pct: 21, cta: "477300001", oculto: true },
  { cod: "R.UE.RD",    nombre: "Compras UE Reducido Autorrepercutido Mercancías 10 %", lado: "C", tipo: "ue-par", pct: 10, cta: "477300001", oculto: true },
  { cod: "R.UE.RD.SR", nombre: "Compras UE Reducido Autorrepercutido Servicios 10 %",  lado: "C", tipo: "ue-par", pct: 10, cta: "477300001", oculto: true },
  { cod: "R.UE.SR",    nombre: "Compras UE Super Reducido Autorrepercutido Mercancías 4 %", lado: "C", tipo: "ue-par", pct: 4, cta: "477300001", oculto: true },
  // Compras a terceros países (la factura no lleva IVA; el IVA se registra con el DUA)
  { cod: "S.EX.NR",    nombre: "Compras terceros países normal",    lado: "C", tipo: "imp", pct: 0 },
  { cod: "S.EX.RD",    nombre: "Compras terceros países reducido",  lado: "C", tipo: "imp", pct: 0 },
  { cod: "S.EX.SR",    nombre: "Compras terceros países super reducido", lado: "C", tipo: "imp", pct: 0 },
  // DUAs (se registran por diario en 472200002; no se eligen en líneas de factura)
  { cod: "DUA",        nombre: "IVA DUA Importación",                      lado: "C", tipo: "dua", pct: 21, cta: "472200002", oculto: true },
  { cod: "DUARED",     nombre: "IVA DUA Importación Reducido",             lado: "C", tipo: "dua", pct: 10, cta: "472200002", oculto: true },
  { cod: "DUALC",      nombre: "IVA DUA Importación Liq. Complementaria",  lado: "C", tipo: "dua", pct: 21, cta: "472200002", oculto: true },
  { cod: "DUALCRED",   nombre: "IVA DUA Importación Liq. Compl. reducido", lado: "C", tipo: "dua", pct: 10, cta: "472200002", oculto: true },
  // Ventas nacionales
  { cod: "R.NC.NR",    nombre: "Ventas Nacionales 21 %",           lado: "V", tipo: "nac", pct: 21, cta: "477000001" },
  { cod: "R.NC.NR.S",  nombre: "Ventas Nacionales Servicios 21 %", lado: "V", tipo: "nac", pct: 21, cta: "477000001" },
  { cod: "R.NC.RD",    nombre: "Ventas Nacionales 10 %",           lado: "V", tipo: "nac", pct: 10, cta: "477000001" },
  { cod: "R.NC.SR",    nombre: "Ventas Nacionales 4 %",            lado: "V", tipo: "nac", pct: 4,  cta: "477000001" },
  { cod: "R.NC.SRN",   nombre: "Ventas Nacionales 2 %",            lado: "V", tipo: "nac", pct: 2,  cta: "477000001" },
  { cod: "R.NC.EX",    nombre: "Ventas Nacionales Exento",            lado: "V", tipo: "ex", pct: 0 },
  { cod: "R.NC.EX.S",  nombre: "Ventas Nacionales Servicios Exentos", lado: "V", tipo: "ex", pct: 0 },
  { cod: "R.NAC.NS",   nombre: "Ventas Nacionales No Sujetas",        lado: "V", tipo: "ex", pct: 0 },
  // Ventas UE y exportación (exentas)
  { cod: "R.UE",       nombre: "Ventas UE Mercancías", lado: "V", tipo: "ex", pct: 0, ue: "E" },
  { cod: "R.UE.S",     nombre: "Ventas UE Servicios",  lado: "V", tipo: "ex", pct: 0, ue: "S" },
  { cod: "R.EX",       nombre: "Ventas Exportación",   lado: "V", tipo: "ex", pct: 0 },
  // Recargo de equivalencia (se añade a una línea de venta)
  { cod: "R.RC.NR",    nombre: "Recargo de equivalencia 5,2 %", lado: "V", tipo: "rec", pct: 5.2, cta: "477100001" },
  { cod: "R.RC.RD",    nombre: "Recargo de equivalencia 1,4 %", lado: "V", tipo: "rec", pct: 1.4, cta: "477100001" },
  { cod: "R.RC.SR",    nombre: "Recargo de equivalencia 0,5 %", lado: "V", tipo: "rec", pct: 0.5, cta: "477100001" },
  // Retenciones de IRPF practicadas en compras (modelos 111, 115 y 123)
  { cod: "I.PR.GN",    nombre: "IRPF Profesionales General 15 %",         lado: "C", tipo: "ret", pct: 15, cta: "475100001", modelo: "111" },
  { cod: "I.PR.PRA",   nombre: "IRPF Profesionales Primeros Años 7 %",    lado: "C", tipo: "ret", pct: 7,  cta: "475100001", modelo: "111" },
  { cod: "I.PR.SR",    nombre: "IRPF Profesionales Super Reducido 1 %",   lado: "C", tipo: "ret", pct: 1,  cta: "475100001", modelo: "111" },
  { cod: "I.ALQ",      nombre: "IRPF Alquileres 19 %",                    lado: "C", tipo: "ret", pct: 19, cta: "475100003", modelo: "115" },
  { cod: "I.DV",       nombre: "IRPF Dividendos 19 %",                    lado: "C", tipo: "ret", pct: 19, cta: "475100004", modelo: "123" },
  { cod: "I.INT",      nombre: "IRPF Intereses Préstamos 19 %",           lado: "C", tipo: "ret", pct: 19, cta: "475100004", modelo: "123" },
  { cod: "I.NM",       nombre: "IRPF Nóminas",                            lado: "C", tipo: "ret", pct: 0,  cta: "475100002", modelo: "111", oculto: true },
  // Retenciones de IRPF que nos practican (ventas)
  { cod: "R.I.ALQ",    nombre: "Ventas IRPF Alquileres 19 %",             lado: "V", tipo: "retc", pct: 19, cta: "473000003" },
  { cod: "R.I.INT",    nombre: "IRPF Intereses Préstamos cobrados 19 %",  lado: "V", tipo: "retc", pct: 19, cta: "473000004" }
];
// Dirección del impuesto (como en D365): soportado (IVA que pagamos y deducimos), repercutido (IVA que cobramos y debemos),
// ambos (autorrepercusión: UE e inversión del sujeto pasivo, se registra soportado y repercutido), sin (exento / no sujeto / sin IVA)
// y, para retenciones de IRPF, practicada (la retenemos a un tercero) o soportada (nos la retienen a nosotros).
const DIRECCION = { nac: c => c.lado === "C" ? "soportado" : "repercutido", inv: () => "soportado", ex: () => "sin", imp: () => "sin", ue: () => "ambos", isp: () => "ambos",
  "ue-par": () => "repercutido", "isp-par": () => "repercutido", dua: () => "soportado", rec: () => "repercutido", ret: () => "practicada", retc: () => "soportada" };
CODIGOS.forEach(c => { if (!c.dir) c.dir = DIRECCION[c.tipo](c); });
export const DIR_NOMBRE = { soportado: "Impuesto soportado", repercutido: "Impuesto repercutido", ambos: "Soportado y repercutido (autorrepercusión)", sin: "Sin impuesto", practicada: "Retención practicada", soportada: "Retención soportada (cobrada)" };
export const CODIGO = Object.fromEntries(CODIGOS.map(c => [c.cod, c]));

// Combinaciones de impuestos (como los grupos de impuestos de D365): un código de IVA + una retención + un recargo opcionales.
// Al elegir una combinación en una factura (o en la ficha del cliente o proveedor) se aplican a la vez el IVA y la retención.
export const COMBINACIONES = [
  // Compras
  { id: "C-21",       nombre: "Compra nacional 21 %",                                  lado: "C", iva: "S.NC.NR" },
  { id: "C-10",       nombre: "Compra nacional 10 %",                                  lado: "C", iva: "S.NC.RD" },
  { id: "C-4",        nombre: "Compra nacional 4 %",                                   lado: "C", iva: "S.NC.SR" },
  { id: "C-EX",       nombre: "Compra nacional exenta",                                lado: "C", iva: "S.NC.EX" },
  { id: "C-NS",       nombre: "Compra nacional no sujeta",                             lado: "C", iva: "S.NAC.NS" },
  { id: "C-PROF-15",  nombre: "Profesional: IVA 21 % y retención 15 %",                lado: "C", iva: "S.NC.NR", ret: "I.PR.GN" },
  { id: "C-PROF-7",   nombre: "Nuevo profesional: IVA 21 % y retención 7 %",           lado: "C", iva: "S.NC.NR", ret: "I.PR.PRA" },
  { id: "C-PROF-1",   nombre: "Profesional (estimación objetiva): IVA 21 % y retención 1 %", lado: "C", iva: "S.NC.NR", ret: "I.PR.SR" },
  { id: "C-ALQ-19",   nombre: "Alquiler: IVA 21 % y retención 19 %",                   lado: "C", iva: "S.NC.NR", ret: "I.ALQ" },
  { id: "C-ALQ-EX",   nombre: "Alquiler exento de IVA y retención 19 %",               lado: "C", iva: "S.NC.EX", ret: "I.ALQ" },
  { id: "C-DIV",      nombre: "Dividendos: sin IVA y retención 19 %",                  lado: "C", iva: "S.NAC.NS", ret: "I.DV" },
  { id: "C-INT",      nombre: "Intereses: sin IVA y retención 19 %",                   lado: "C", iva: "S.NAC.NS", ret: "I.INT" },
  { id: "C-UE-B",     nombre: "Compra UE de mercancías 21 % (autorrepercusión)",       lado: "C", iva: "S.UE.NR" },
  { id: "C-UE-S",     nombre: "Compra UE de servicios 21 % (autorrepercusión)",        lado: "C", iva: "S.UE.NR.SR" },
  { id: "C-ISP",      nombre: "Compra con inversión del sujeto pasivo 21 %",           lado: "C", iva: "S.ISP.NR" },
  { id: "C-IMP",      nombre: "Compra a tercer país (IVA por el DUA)",                 lado: "C", iva: "S.EX.NR" },
  { id: "C-INV",      nombre: "Bien de inversión 21 %",                                lado: "C", iva: "IN.NR" },
  // Ventas
  { id: "V-21",       nombre: "Venta nacional 21 %",                                   lado: "V", iva: "R.NC.NR" },
  { id: "V-10",       nombre: "Venta nacional 10 %",                                   lado: "V", iva: "R.NC.RD" },
  { id: "V-4",        nombre: "Venta nacional 4 %",                                    lado: "V", iva: "R.NC.SR" },
  { id: "V-EX",       nombre: "Venta nacional exenta",                                 lado: "V", iva: "R.NC.EX" },
  { id: "V-NS",       nombre: "Venta nacional no sujeta",                              lado: "V", iva: "R.NAC.NS" },
  { id: "V-21-RE",    nombre: "Venta 21 % con recargo de equivalencia 5,2 %",          lado: "V", iva: "R.NC.NR", rec: "R.RC.NR" },
  { id: "V-10-RE",    nombre: "Venta 10 % con recargo de equivalencia 1,4 %",          lado: "V", iva: "R.NC.RD", rec: "R.RC.RD" },
  { id: "V-4-RE",     nombre: "Venta 4 % con recargo de equivalencia 0,5 %",           lado: "V", iva: "R.NC.SR", rec: "R.RC.SR" },
  { id: "V-ALQ-19",   nombre: "Alquiler cobrado: IVA 21 % y retención 19 %",           lado: "V", iva: "R.NC.NR", ret: "R.I.ALQ" },
  { id: "V-ALQ-EX",   nombre: "Alquiler cobrado exento y retención 19 %",              lado: "V", iva: "R.NC.EX", ret: "R.I.ALQ" },
  { id: "V-INT",      nombre: "Intereses cobrados: sin IVA y retención 19 %",          lado: "V", iva: "R.NAC.NS", ret: "R.I.INT" },
  { id: "V-UE-B",     nombre: "Entrega intracomunitaria de mercancías (exenta)",       lado: "V", iva: "R.UE" },
  { id: "V-UE-S",     nombre: "Servicios a la UE (exentos)",                           lado: "V", iva: "R.UE.S" },
  { id: "V-EXP",      nombre: "Exportación (exenta)",                                  lado: "V", iva: "R.EX" }
];

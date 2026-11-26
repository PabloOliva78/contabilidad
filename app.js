import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { PLAN_BASE } from "./plan-base.js";
import { CODIGOS, CODIGO, DIR_NOMBRE, COMBINACIONES } from "./codigos-iva.js";

const $app = document.getElementById("app");
const VERSION = new URL(import.meta.url).searchParams.get("v") || "?"; // el número viene de app.js?v=N en index.html
const LOCAL = !SUPABASE_URL || !SUPABASE_ANON_KEY;
const r2 = n => Math.round((+n || 0) * 100) / 100;
const eur = n => r2(n).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const uid = () => crypto.randomUUID();
const hoy = () => new Date().toISOString().slice(0, 10);

// Plan de cuentas básico PGC (se puede ampliar desde la pantalla)
const PGC = [
  ["100","Capital social"],["112","Reserva legal"],["113","Reservas voluntarias"],["129","Resultado del ejercicio"],
  ["170","Deudas a largo plazo con entidades de crédito"],["206","Aplicaciones informáticas"],["210","Terrenos y bienes naturales"],
  ["211","Construcciones"],["213","Maquinaria"],["216","Mobiliario"],["217","Equipos para procesos de información"],
  ["281","Amortización acumulada del inmovilizado material"],["300","Mercaderías"],
  ["400","Proveedores"],["410","Acreedores por prestaciones de servicios"],["430","Clientes"],["440","Deudores"],
  ["465","Remuneraciones pendientes de pago"],["472","H.P. IVA soportado"],["475","H.P. acreedora por conceptos fiscales"],
  ["4751","H.P. acreedora por retenciones practicadas"],["477","H.P. IVA repercutido"],["476","Organismos de la Seguridad Social, acreedores"],
  ["520","Deudas a corto plazo con entidades de crédito"],["570","Caja"],["572","Bancos c/c"],
  ["600","Compras de mercaderías"],["621","Arrendamientos y cánones"],["622","Reparaciones y conservación"],["623","Servicios de profesionales independientes"],
  ["625","Primas de seguros"],["626","Servicios bancarios"],["627","Publicidad y propaganda"],["628","Suministros"],["629","Otros servicios"],
  ["640","Sueldos y salarios"],["642","Seguridad Social a cargo de la empresa"],["662","Intereses de deudas"],["681","Amortización del inmovilizado material"],
  ["700","Ventas de mercaderías"],["705","Prestaciones de servicios"],["759","Ingresos por servicios diversos"],
  // títulos necesarios para el plan base
  ["121","Resultados negativos de ejercicios anteriores"],["460","Anticipos de remuneraciones"],["462","Embargos de salarios"],["470","H.P. deudora por diversos conceptos"],
  ["4709","H.P. deudora por devolución de impuestos"],["473","H.P. retenciones y pagos a cuenta"],["4745","Crédito por pérdidas a compensar del ejercicio"],
  ["4752","H.P. acreedora por Impuesto sobre Sociedades"],["4771","H.P. recargo de equivalencia"],["4773","H.P. IVA repercutido intracomunitario"],
  ["310","Materias primas"],["320","Elementos y conjuntos incorporables"],["350","Productos terminados"],["610","Variación de existencias de mercaderías"],["611","Variación de existencias de materias primas"],["612","Variación de existencias de otros aprovisionamientos"],["712","Variación de existencias de productos terminados"],
  ["218","Elementos de transporte"],["280","Amortización acumulada del inmovilizado intangible"],["2806","Amortización acumulada de aplicaciones informáticas"],["2811","Amortización acumulada de construcciones"],["2813","Amortización acumulada de maquinaria"],["2816","Amortización acumulada de mobiliario"],["2817","Amortización acumulada de equipos informáticos"],["2818","Amortización acumulada de elementos de transporte"],["671","Pérdidas procedentes del inmovilizado material"],["680","Amortización del inmovilizado intangible"],
  ["401","Proveedores, efectos comerciales a pagar"],["431","Clientes, efectos comerciales a cobrar"],["543","Créditos a corto plazo por enajenación de inmovilizado"],["665","Intereses por descuento de efectos"],["771","Beneficios procedentes del inmovilizado material"],["769","Otros ingresos financieros"],
  ["480","Gastos anticipados"],["485","Ingresos anticipados"],["668","Diferencias negativas de cambio"],["768","Diferencias positivas de cambio"],
  ["555","Partidas pendientes de aplicación"],["602","Compras de otros aprovisionamientos"],["606","Descuentos sobre compras por pronto pago"],["609","Rappels por compras"]
];

/* ---------------- Capa de datos (local o Supabase) ---------------- */
let sb = null, dbNube = null, dbLS = null;
const TABLAS_LOCAL = ["empresas", "cuentas", "asientos", "apuntes", "lineas", "terceros", "facturas", "flineas", "libros", "liquidaciones", "manual", "almacenes", "articulos", "pedidos", "plineas", "movinv"];
const upL = (arr, x) => { const i = arr.findIndex(y => y.id === x.id); if (i < 0) arr.push(x); else arr[i] = x; };
const normaliza = d => { for (const k of TABLAS_LOCAL) d[k] ||= []; return d; };
// Backend de datos con persistencia intercambiable: el navegador (localStorage) o un archivo de la carpeta de Drive
const mkLocal = (g, s) => ({
    async empresas() { return g().empresas; },
    async crearEmpresa(nombre, cif) { const d = g(); const e = { id: uid(), nombre, cif }; d.empresas.push(e); s(d); return e; },
    async cargar(eid) { const d = g(), f = x => x.empresa_id === eid; return { cuentas: d.cuentas.filter(f), asientos: d.asientos.filter(f), apuntes: d.apuntes.filter(f), lineas: d.lineas.filter(f), terceros: d.terceros.filter(f), facturas: d.facturas.filter(f), flineas: d.flineas.filter(f), libros: d.libros.filter(f), liquidaciones: d.liquidaciones.filter(f), manual: d.manual.filter(f), almacenes: d.almacenes.filter(f), articulos: d.articulos.filter(f), pedidos: d.pedidos.filter(f), plineas: d.plineas.filter(f), movinv: d.movinv.filter(f) }; },
    async guardarArticulo(a) { const d = g(); upL(d.articulos, a); s(d); },
    async borrarArticulo(id) { const d = g(); d.articulos = d.articulos.filter(a => a.id !== id); s(d); },
    async guardarAlmacen(a) { const d = g(); upL(d.almacenes, a); s(d); },
    async borrarAlmacen(id) { const d = g(); d.almacenes = d.almacenes.filter(a => a.id !== id); s(d); },
    async guardarPedido(p, ls) { const d = g(); upL(d.pedidos, p); const ids = new Set(ls.map(l => l.id)); d.plineas = d.plineas.filter(l => l.pedido_id !== p.id || ids.has(l.id)); ls.forEach(l => upL(d.plineas, l)); s(d); },
    async borrarPedido(id) { const d = g(); d.pedidos = d.pedidos.filter(p => p.id !== id); d.plineas = d.plineas.filter(l => l.pedido_id !== id); s(d); },
    async guardarMovs(ms) { const d = g(); ms.forEach(m => d.movinv.push(m)); s(d); },
    async borrarMovs(ids) { const d = g(); const k = new Set(ids); d.movinv = d.movinv.filter(m => !k.has(m.id)); s(d); },
    async guardarManual(m) { const d = g(); d.manual = d.manual.filter(x => !(x.empresa_id === m.empresa_id && x.modelo === m.modelo && x.ejercicio === m.ejercicio && x.periodo === m.periodo)); d.manual.push(m); s(d); },
    async guardarLiquidacion(l) { const d = g(); d.liquidaciones.push(l); s(d); },
    async borrarLiquidacion(id) { const d = g(); d.liquidaciones = d.liquidaciones.filter(l => l.id !== id); s(d); },
    async guardarLibro(l) { const d = g(); const i = d.libros.findIndex(x => x.id === l.id); if (i < 0) d.libros.push(l); else d.libros[i] = l; s(d); },
    async borrarLibro(id) { const d = g(); d.libros = d.libros.filter(l => l.id !== id); s(d); },
    async guardarTercero(t) { const d = g(); const i = d.terceros.findIndex(x => x.id === t.id); if (i < 0) d.terceros.push(t); else d.terceros[i] = t; s(d); },
    async borrarTercero(id) { const d = g(); d.terceros = d.terceros.filter(t => t.id !== id); s(d); },
    async guardarFactura(f, ls) { const d = g(); const i = d.facturas.findIndex(x => x.id === f.id); if (i < 0) d.facturas.push(f); else d.facturas[i] = f; d.flineas = d.flineas.filter(l => l.factura_id !== f.id).concat(ls); s(d); },
    async borrarFactura(id) { const d = g(); d.facturas = d.facturas.filter(f => f.id !== id); d.flineas = d.flineas.filter(l => l.factura_id !== id); s(d); },
    async crearCuentas(eid, lista) { const d = g(); for (const [codigo, nombre] of lista) if (!d.cuentas.some(c => c.empresa_id === eid && c.codigo === codigo)) d.cuentas.push({ id: uid(), empresa_id: eid, codigo, nombre }); s(d); },
    async borrarCuenta(id) { const d = g(); d.cuentas = d.cuentas.filter(c => c.id !== id); s(d); },
    async renombrarCuenta(id, nombre) { const d = g(); const c = d.cuentas.find(x => x.id === id); if (c) c.nombre = nombre; s(d); },
    async crearAsiento(eid, fecha, concepto, apuntes, origen = "manual", documento = null) {
      const d = g(); const ej = +fecha.slice(0, 4);
      const num = Math.max(0, ...d.asientos.filter(a => a.empresa_id === eid && a.ejercicio === ej).map(a => a.numero)) + 1;
      const id = uid(); d.asientos.push({ id, empresa_id: eid, ejercicio: ej, numero: num, fecha, concepto, origen, documento });
      apuntes.forEach(a => d.apuntes.push({ id: uid(), asiento_id: id, empresa_id: eid, ...a })); s(d); return id;
    },
    async modificarAsiento(id, fecha, concepto, documento, apuntes) {
      const d = g(); const a = d.asientos.find(x => x.id === id); Object.assign(a, { fecha, ejercicio: +fecha.slice(0, 4), concepto, documento });
      d.apuntes = d.apuntes.filter(p => p.asiento_id !== id); apuntes.forEach(p => d.apuntes.push({ id: uid(), asiento_id: id, empresa_id: a.empresa_id, ...p })); s(d);
    },
    async borrarAsiento(id) { const d = g(); d.asientos = d.asientos.filter(a => a.id !== id); d.apuntes = d.apuntes.filter(a => a.asiento_id !== id); d.liquidaciones = d.liquidaciones.filter(l => l.asiento_id !== id); s(d); },
    async guardarLinea(l) { const d = g(); const i = d.lineas.findIndex(x => x.id === l.id); if (i < 0) d.lineas.push(l); else d.lineas[i] = l; s(d); },
    async borrarLinea(id) { const d = g(); d.lineas = d.lineas.filter(l => l.id !== id); s(d); },
    async borrarLineas(eid, libro) { const d = g(); d.lineas = d.lineas.filter(l => !(l.empresa_id === eid && l.libro === libro)); s(d); }
});
if (LOCAL) {
  const K = "contab-local-v2";
  dbLS = mkLocal(() => normaliza(JSON.parse(localStorage.getItem(K) || "{}")), d => localStorage.setItem(K, JSON.stringify(d)));
} else {
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const ok = r => { if (r.error) throw new Error(r.error.message); return r.data; };
  const todo = async (tabla, eid) => { // pagina de 1000 en 1000
    let out = [], from = 0;
    for (;;) { const d = ok(await sb.from(tabla).select("*").eq("empresa_id", eid).order("id").range(from, from + 999)); out = out.concat(d); if (d.length < 1000) return out; from += 1000; }
  };
  dbNube = {
    async empresas() { return ok(await sb.from("empresas").select("*").order("nombre")); },
    async crearEmpresa(nombre, cif) { return ok(await sb.from("empresas").insert({ nombre, cif }).select().single()); },
    async cargar(eid) { const [cuentas, asientos, apuntes, lineas, terceros, facturas, flineas, libros, liquidaciones, manual, almacenes, articulos, pedidos, plineas, movinv] = await Promise.all(["cuentas", "asientos", "apuntes", "diario_lineas", "terceros", "facturas", "factura_lineas", "diario_libros", "liquidaciones", "modelos_manual", "almacenes", "articulos", "pedidos", "pedido_lineas", "mov_inventario"].map(t => todo(t, eid))); return { cuentas, asientos, apuntes, lineas, terceros, facturas, flineas, libros, liquidaciones, manual, almacenes, articulos, pedidos, plineas, movinv }; },
    async guardarArticulo(a) { ok(await sb.from("articulos").upsert(a)); },
    async borrarArticulo(id) { ok(await sb.from("articulos").delete().eq("id", id)); },
    async guardarAlmacen(a) { ok(await sb.from("almacenes").upsert(a)); },
    async borrarAlmacen(id) { ok(await sb.from("almacenes").delete().eq("id", id)); },
    async guardarPedido(p, ls) { ok(await sb.from("pedidos").upsert(p)); const q = sb.from("pedido_lineas").delete().eq("pedido_id", p.id); ok(await (ls.length ? q.not("id", "in", "(" + ls.map(l => l.id).join(",") + ")") : q)); if (ls.length) ok(await sb.from("pedido_lineas").upsert(ls)); },
    async borrarPedido(id) { ok(await sb.from("pedidos").delete().eq("id", id)); },
    async guardarMovs(ms) { if (ms.length) ok(await sb.from("mov_inventario").insert(ms)); },
    async borrarMovs(ids) { if (ids.length) ok(await sb.from("mov_inventario").delete().in("id", ids)); },
    async guardarManual(m) { ok(await sb.from("modelos_manual").upsert(m, { onConflict: "empresa_id,modelo,ejercicio,periodo" })); },
    async guardarLiquidacion(l) { ok(await sb.from("liquidaciones").insert(l)); },
    async borrarLiquidacion(id) { ok(await sb.from("liquidaciones").delete().eq("id", id)); },
    async guardarLibro(l) { ok(await sb.from("diario_libros").upsert(l)); },
    async borrarLibro(id) { ok(await sb.from("diario_libros").delete().eq("id", id)); },
    async guardarTercero(t) { ok(await sb.from("terceros").upsert(t)); },
    async borrarTercero(id) { ok(await sb.from("terceros").delete().eq("id", id)); },
    async guardarFactura(f, ls) { ok(await sb.from("facturas").upsert(f)); ok(await sb.from("factura_lineas").delete().eq("factura_id", f.id)); if (ls.length) ok(await sb.from("factura_lineas").insert(ls)); },
    async borrarFactura(id) { ok(await sb.from("facturas").delete().eq("id", id)); },
    async crearCuentas(eid, lista) { ok(await sb.from("cuentas").upsert(lista.map(([codigo, nombre]) => ({ empresa_id: eid, codigo, nombre })), { onConflict: "empresa_id,codigo", ignoreDuplicates: true })); },
    async borrarCuenta(id) { ok(await sb.from("cuentas").delete().eq("id", id)); },
    async renombrarCuenta(id, nombre) { ok(await sb.from("cuentas").update({ nombre }).eq("id", id)); },
    async crearAsiento(eid, fecha, concepto, apuntes, origen = "manual", documento = null) { return ok(await sb.rpc("crear_asiento", { p_empresa: eid, p_fecha: fecha, p_concepto: concepto, p_origen: origen, p_apuntes: apuntes, p_documento: documento })); },
    async modificarAsiento(id, fecha, concepto, documento, apuntes) { ok(await sb.rpc("modificar_asiento", { p_asiento: id, p_fecha: fecha, p_concepto: concepto, p_documento: documento, p_apuntes: apuntes })); },
    async borrarAsiento(id) { ok(await sb.from("asientos").delete().eq("id", id)); },
    async guardarLinea(l) { ok(await sb.from("diario_lineas").upsert(l)); },
    async borrarLinea(id) { ok(await sb.from("diario_lineas").delete().eq("id", id)); },
    async borrarLineas(eid, libro) { ok(await sb.from("diario_lineas").delete().eq("empresa_id", eid).eq("libro", libro)); }
  };
}

/* ---------------- Almacenamiento por empresa: nube (Supabase), navegador o carpeta de Google Drive ---------------- */
// Las empresas "Drive" guardan todos sus datos en un archivo JSON dentro de una carpeta que elige el usuario
// (la carpeta sincronizada de Google Drive para ordenador). Requiere Chrome o Edge (File System Access).
const SOPORTA_DRIVE = typeof window.showDirectoryPicker === "function";
const idb = () => new Promise((res, rej) => { const r = indexedDB.open("contab-drive", 1); r.onupgradeneeded = () => r.result.createObjectStore("empresas", { keyPath: "id" }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const idbTx = async (modo, f) => { const d = await idb(); return new Promise((res, rej) => { const t = d.transaction("empresas", modo), q = f(t.objectStore("empresas")); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }); };
const idbTodas = () => idbTx("readonly", st => st.getAll());
const idbGuardar = r => idbTx("readwrite", st => st.put(r));
const driveAbiertas = new Map(); // id de empresa -> backend con su archivo ya cargado
const slug = s => (s || "empresa").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "empresa";
function backendArchivo(reg, d) {
  const c = { timer: null, cola: Promise.resolve() };
  const escribir = () => { c.cola = c.cola.then(async () => { const fh = await reg.handle.getFileHandle(reg.archivo, { create: true }); const w = await fh.createWritable(); await w.write(JSON.stringify(d)); await w.close(); }).catch(e => alert("No se pudo guardar en la carpeta de Drive: " + e.message)); };
  return mkLocal(() => d, () => { clearTimeout(c.timer); c.timer = setTimeout(escribir, 250); });
}
async function pedirPermiso(handle) { const o = { mode: "readwrite" }; if ((await handle.queryPermission(o)) === "granted") return true; return (await handle.requestPermission(o)) === "granted"; }
async function abrirDrive(reg) { // debe llamarse desde un clic del usuario (el navegador pide permiso cada sesión)
  if (driveAbiertas.has(reg.id)) return;
  if (!(await pedirPermiso(reg.handle))) throw new Error("Sin permiso para leer y escribir en la carpeta de Drive.");
  const fh = await reg.handle.getFileHandle(reg.archivo);
  driveAbiertas.set(reg.id, backendArchivo(reg, normaliza(JSON.parse(await (await fh.getFile()).text()))));
}
async function crearEnDrive(nombre, cif, handle) {
  if (!(await pedirPermiso(handle))) throw new Error("Sin permiso para escribir en la carpeta elegida.");
  const id = uid(), archivo = `Contabilidad_${slug(nombre)}_${id.slice(0, 8)}.json`, reg = { id, nombre, cif, archivo, handle }, d = normaliza({ empresas: [{ id, nombre, cif }] });
  const fh = await handle.getFileHandle(archivo, { create: true }), w = await fh.createWritable(); await w.write(JSON.stringify(d)); await w.close();
  driveAbiertas.set(id, backendArchivo(reg, d)); await idbGuardar(reg);
  return { id, nombre, cif, almacen: "drive" };
}
const baseDb = () => LOCAL ? dbLS : dbNube;
const backendActual = () => {
  const e = S.emp;
  if (e && e.almacen === "drive") { const b = driveAbiertas.get(e.id); if (!b) throw new Error("La carpeta de Drive de esta empresa no está abierta. Selecciónela de nuevo."); return b; }
  return baseDb();
};
async function listarEmpresas() {
  const principal = (await baseDb().empresas()).map(e => ({ ...e, almacen: LOCAL ? "local" : "nube" }));
  let dr = []; try { dr = (await idbTodas()).map(r => ({ id: r.id, nombre: r.nombre, cif: r.cif, almacen: "drive", reg: r })); } catch { /* sin IndexedDB */ }
  return [...principal, ...dr].sort((a, b) => a.nombre.localeCompare(b.nombre));
}
// db enruta cada operación al almacén de la empresa activa (nube, navegador o archivo de Drive)
function vigilarPeriodo(m, a) { // en un período cerrado (calendario del libro mayor) no se tocan asientos
  const fechas = m === "crearAsiento" ? [a[1]] : m === "modificarAsiento" ? [a[1], (S.d.asientos.find(x => x.id === a[0]) || {}).fecha] : m === "borrarAsiento" ? [(S.d.asientos.find(x => x.id === a[0]) || {}).fecha] : [];
  const f = fechas.find(periodoCerrado); if (f) throw new Error("El período " + String(f).slice(0, 7) + " está cerrado en el calendario del libro mayor. Ábralo para registrar o modificar asientos de esa fecha.");
  const apuntes = m === "crearAsiento" ? a[3] : m === "modificarAsiento" ? a[4] : null, bl = apuntes && cuentaBloqueada(apuntes);
  if (bl) throw new Error("La cuenta " + bl + " está bloqueada (Control de cuentas principales). Desbloquéela para registrar en ella.");
}
const db = new Proxy({}, { get: (_, m) => (...a) => { if (m === "empresas") return listarEmpresas(); vigilarPeriodo(m, a); return backendActual()[m](...a); } });

/* ---------------- Estado ---------------- */
const S = { empresas: [], emp: null, vista: "inicio", sel: null, nueva: false, selAs: null, filtroCta: "", libro: null, selLote: null, nav: false, edit: null, selTer: null, terEdit: null, selFact: null, fact: null, filtroTer: "",
  d: { cuentas: [], asientos: [], apuntes: [], lineas: [], libros: [], terceros: [], facturas: [], flineas: [], liquidaciones: [], manual: [], almacenes: [], articulos: [], pedidos: [], plineas: [], movinv: [] }, revFecha: "", revSaldos: null, lcCta: "", lcMarcas: null, ccFiltro: "", ecMes: "", ocBuscar: "", ocSel: null, rdHasta: "", cdA: "", cdB: "", impTexto: "", taTer: "", taMarcas: null, taImp: {}, taSel: null, taModo: "", taFecha: "", albForm: null, albMarcas: null, selAlb: null, albValorado: false, glDesde: "", glHasta: "", glNivel: "", glCta: "", glOrigen: "", finTipo: "", selTA: null, dimId: "", dimSolo: "", asgDest: null, asgForm: null, selAsg: null, selPdf: null, pdfMes: "", conEmps: null, conExcl: "", consol: null, fsEstado: "", fsDias: "", fsFiltro: "", fsMarcas: null, selFS: null, selPlant: null, selPeriodica: null, fsHasta: "", rectTipo: "", liqTer: "", liqMarcas: null, imprFact: "", selCred: null, djAbierto: null, djSel: null, djMostrar: "", djHasta: "", efSel: null, carteraTipo: "", carteraEst: "", selRem: null, extracto: null, antFecha: "", extTer: "", extDesde: "", extHasta: "", perMes: "", selPerio: null, libDesde: "", libHasta: "", afEdit: null, selAF: null, bajaAF: false, amortHasta: "", bancoSel: "", concilFecha: "", concilSaldo: "", concilMarcas: null, fechaRegul: "", selRegul: null, cfgEdit: null, selCfg: {}, selPagoImp: null, selInf: null, liqPer: "", liqInt: "", filtroDirIR: "", ped: null, selPed: null, selArt: null, artEdit: null, almEdit: null, ajuste: null, selMov: null, filtroAlm: "", pagoF: null, selPend: null, periodo: Math.ceil((new Date().getMonth() + 1) / 3) + "T", libroIva: "V", tabs: {}, selLinea: null, navMod: "", navCerr: {}, fichaCerr: {}, selCombo: "", comboForm: null, selCod: "", filtroCod: "todos", liqAcre: "", liqDeud: "", liqBanco: "", ej: new Date().getFullYear(), lineas: null, fechaAs: "", conceptoAs: "", docAs: "" };
const nombreCuenta = c => (S.d.cuentas.find(x => x.codigo === c) || {}).nombre || "";

async function recargar() { S.d = await db.cargar(S.emp.id); render(); }

/* ---------------- Cálculos ---------------- */
function apuntesEj() {
  const ids = new Map(S.d.asientos.filter(a => a.ejercicio === S.ej).map(a => [a.id, a]));
  return S.d.apuntes.filter(p => ids.has(p.asiento_id)).map(p => ({ ...p, a: ids.get(p.asiento_id) }));
}
function saldos() {
  const m = new Map();
  for (const p of apuntesEj()) { const o = m.get(p.cuenta) || { debe: 0, haber: 0 }; o.debe += +p.debe; o.haber += +p.haber; m.set(p.cuenta, o); }
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([cuenta, o]) => ({ cuenta, debe: r2(o.debe), haber: r2(o.haber), saldo: r2(o.debe - o.haber) }));
}
function saldoPref(cod, soloEj) {
  const ids = new Set(S.d.asientos.filter(a => !soloEj || a.ejercicio === S.ej).map(a => a.id));
  let s = 0; for (const p of S.d.apuntes) if (ids.has(p.asiento_id) && p.cuenta.startsWith(cod)) s += +p.debe - +p.haber;
  return r2(s);
}
const sal = n => n === 0 ? "_" : eur(n);
/* Cuentas: los títulos del PGC (menos de 9 dígitos) no admiten movimientos; las cuentas de movimiento tienen 9 dígitos y cuelgan de un título */
const esMov = c => /^\d{9}$/.test(String(c || ""));
const nombreMaestro = m => (PGC.find(x => x[0] === m) || [])[1] || "";
const maestroDe = cod => { let best = ""; for (const c of S.d.cuentas) if (c.codigo.length < 9 && cod.startsWith(c.codigo) && c.codigo.length > best.length) best = c.codigo; return best; };
const cuentaValida = c => esMov(c) && S.d.cuentas.some(x => x.codigo === c);
function siguienteCuenta(m) { // siguiente código libre de 9 dígitos bajo el título m (p. ej. 430 -> 430000001)
  let mx = 0; for (const c of S.d.cuentas) if (c.codigo.length === 9 && c.codigo.startsWith(m)) mx = Math.max(mx, +c.codigo.slice(m.length));
  return m + String(mx + 1).padStart(9 - m.length, "0");
}
const movs = () => S.d.cuentas.filter(c => esMov(c.codigo)).sort((a, b) => a.codigo.localeCompare(b.codigo));
const optsCuentas = () => movs().map(c => `<option value="${esc(c.codigo)}">${esc(c.nombre)}</option>`).join("");
const primeraCuenta = m => (movs().find(c => c.codigo.startsWith(m)) || {}).codigo || "";
const cuentaSis = m => primeraCuenta(m) || siguienteCuenta(m); // la existente, o la que se creará
async function asegurarCuenta(cod, nombre) { // crea una cuenta de movimiento si cuelga de un título existente
  if (S.d.cuentas.some(c => c.codigo === cod)) return;
  const m = maestroDe(cod);
  if (!esMov(cod) || !m) throw new Error("La cuenta " + cod + " debe tener 9 dígitos y colgar de un título del plan de cuentas.");
  await db.crearCuentas(S.emp.id, [[cod, nombre || nombreMaestro(m) || cod]]);
  S.d.cuentas.push({ id: uid(), empresa_id: S.emp.id, codigo: cod, nombre: nombre || nombreMaestro(m) || cod });
}
function siguienteDoc() {
  let m = 0;
  for (const x of [...S.d.asientos.map(a => a.documento), ...S.d.lineas.map(l => l.documento)]) { const k = /^DG(\d+)$/.exec(x || ""); if (k) m = Math.max(m, +k[1]); }
  return "DG" + String(m + 1).padStart(6, "0");
}
function siguienteLote() {
  let m = 0; for (const x of lotes()) { const k = /^L(\d+)$/.exec(x.numero); if (k) m = Math.max(m, +k[1]); }
  return "L" + String(m + 1).padStart(6, "0");
}
// lotes de diario: los guardados más los que solo existen por tener líneas
function lotes(tipo) { // tipo: general, fprov (facturas de proveedor) o fcli (facturas de cliente); sin tipo, todos
  const l = S.d.libros.map(x => ({ ...x, tipo: x.tipo || "general" }));
  S.d.lineas.forEach(x => { if (!l.some(y => y.numero === x.libro)) l.push({ numero: x.libro, nombre: "GENERAL", descripcion: "", virtual: true, tipo: "general" }); });
  return l.filter(x => !tipo || x.tipo === tipo).sort((a, b) => a.numero.localeCompare(b.numero));
}
const tipoDeLibro = num => ((S.d.libros || []).find(x => x.numero === num) || {}).tipo || "general";
const esFactJ = l => tipoDeLibro(l.libro) !== "general"; // los diarios de facturas llevan una factura por línea
const lineasLibro = () => S.d.lineas.filter(l => l.libro === S.libro).sort((a, b) => (+a.orden || 0) - (+b.orden || 0));

/* ---------------- Vistas ---------------- */
const V = {};
const CATEG = { 1: "Pasivo / PN", 2: "Activo", 3: "Activo", 4: "Mixta", 5: "Mixta", 6: "Gastos", 7: "Ingresos" };
// Menú tipo D365: módulos > secciones > carpetas > pantallas (it = enlaces, sub = carpetas con enlaces)
const NAV = [
  { g: "Libro mayor", sec: [
    { n: "Entradas de diario", it: [["diario", "Diarios generales"], ["importar", "Importar asientos"]] },
    { n: "Consultas e informes", sub: [{ n: "Consultas", it: [["mayor", "Transacciones del libro mayor"]] }, { n: "Informes", it: [["sumas", "Balance de comprobación"], ["estados", "Estados financieros"]] }] },
    { n: "Consultas y saldos", it: [["saldosfecha", "Saldo de comprobación"], ["transasiento", "Transacciones de asiento"], ["extctas", "Extracto por cuenta principal"], ["origencont", "Explorador de origen contable"]] },
    { n: "Informes", it: [["financieros", "Informes financieros"], ["librodiario", "Libro diario"], ["regdiario", "Registro en diario (España)"], ["extdim", "Extracto de dimensión"], ["conjdim", "Saldos por conjunto de dimensiones"], ["pmp", "Período medio de pago a proveedores"], ["consolid", "Consolidación"]] },
    { n: "Tareas periódicas", it: [["periodicos", "Asientos periódicos"], ["periodif", "Esquemas de acumulación"], ["asignaciones", "Diarios de asignaciones"], ["comprobarserie", "Comprobar serie de asientos"], ["liqcont", "Liquidaciones de contabilidad"], ["revaluacion", "Revalorización de divisa extranjera"]] },
    { n: "Plan contable y divisas", it: [["ctacontrol", "Control de cuentas principales"], ["divisas", "Divisas y tipos de cambio"]] },
    { n: "Dimensiones financieras", it: [["dimensiones", "Dimensiones financieras"], ["asigdim", "Asignar dimensiones"]] },
    { n: "Cierre del periodo", it: [["espaciocierre", "Espacio de trabajo de cierre"], ["calendario", "Calendario del libro mayor"], ["cierre", "Cierre del ejercicio"]] },
    { n: "Configurar", sub: [{ n: "Plan de cuentas", it: [["cuentas", "Cuentas principales"]] }, { n: "Parámetros", it: [["parcont", "Parámetros de Contabilidad general"], ["empresa", "Datos de la empresa"]] }] },
    { n: "Presupuestación", it: [["presupuesto", "Control presupuestario"]] }] },
  { g: "Clientes", sec: [
    { n: "Clientes", it: [["clientes", "Todos los clientes"]] },
    { n: "Facturas y cobros", sub: [{ n: "Facturas", it: [["fventa", "Facturas de cliente"], ["diariofcli", "Diario de facturas de cliente"]] }, { n: "Cobros", it: [["cobros", "Cobros pendientes"]] }] },
    { n: "Pagos", it: [["dcobro", "Diario de pagos de clientes"]], sub: [{ n: "Letra de cambio", it: [["dletra", "Diario de creación de letras de cambio"], ["dletraimp", "Diario de impago de letras de cambio"], ["dletraren", "Diario de renegociación de letras de cambio"], ["dletraenv", "Diario de envíos"], ["dletraliq", "Diario de liquidación de letra de cambio"], ["cartera", "Cartera de efectos"], ["remesas", "Remesas"]] }, { n: "Consultas de letras", it: [["letdiario", "Diario de letras de cambio"], ["letabiertas", "Informe de letras abiertas"], ["letimpagadas", "Letras impagadas"], ["letfactura", "Relación letra-factura"], ["letestad", "Estadísticas de letra de cambio"]] }] },
    { n: "Consultas e informes", it: [["abiertas", "Transacciones abiertas de clientes"], ["antcli", "Antigüedad de saldos de clientes"], ["extcli", "Extracto de cuenta de cliente"]] },
    { n: "Facturas de servicios", it: [["fservicios", "Todas las facturas de servicios"], ["fsperiod", "Facturas periódicas"], ["plantfs", "Plantillas de factura de servicios"]] },
    { n: "Documentos y crédito", it: [["rectif", "Facturas rectificativas"], ["liquidar", "Liquidar transacciones"], ["imprfact", "Imprimir facturas"], ["credito", "Crédito y cobros"]] },
    { n: "Configurar", it: [["parcli", "Parámetros de clientes"]] }] },
  { g: "Proveedores", sec: [
    { n: "Proveedores", it: [["proveedores", "Todos los proveedores"]] },
    { n: "Facturas y pagos", sub: [{ n: "Facturas", it: [["fcompra", "Facturas de proveedor"], ["diariofprov", "Diario de facturas de proveedor"]] }, { n: "Pagos", it: [["pagos", "Pagos pendientes"]] }] },
    { n: "Pagos", it: [["dpago", "Diario de pagos a proveedores"]], sub: [{ n: "Pagarés", it: [["dpagare", "Diario de creación de pagarés"], ["dpagren", "Diario de renegociación de pagarés"], ["dpagliq", "Diario de liquidación de pagarés"], ["cartera", "Cartera de efectos"]] }] },
    { n: "Consultas e informes", it: [["antprov", "Antigüedad de saldos de proveedores"], ["extprov", "Extracto de cuenta de proveedor"]] },
    { n: "Documentos", it: [["rectif", "Facturas rectificativas"], ["liquidar", "Liquidar transacciones"]] },
    { n: "Configurar", it: [["parprov", "Parámetros de proveedores"]] }] },
  { g: "Gestión de efectivo y bancos", sec: [
    { n: "Bancos", it: [["bancos", "Cuentas bancarias"], ["movbanco", "Transacciones bancarias"], ["extractos", "Extractos bancarios"], ["conciliar", "Conciliación bancaria"], ["transfer", "Transferencias bancarias"]] },
    { n: "Efectivo", it: [["prevision", "Previsión de flujo de efectivo"], ["cartera", "Cartera de efectos"], ["remesas", "Remesas"]] }] },
  { g: "Activos fijos", sec: [
    { n: "Activos fijos", it: [["activos", "Activos fijos"]] },
    { n: "Periódico", it: [["amort", "Propuesta de amortización"]] },
    { n: "Consultas e informes", it: [["aftrans", "Transacciones de activos fijos"], ["afcuadro", "Cuadro de amortización"]] },
    { n: "Configurar", it: [["grupoact", "Grupos de activos fijos"]] }] },
  { g: "Ventas y marketing", sec: [
    { n: "Pedidos de venta", it: [["presupv", "Presupuestos de ventas"], ["pventa", "Todos los pedidos de venta"]] },
    { n: "Albaranes y facturas", it: [["albv", "Albaranes de venta (entregas)"], ["imprfact", "Imprimir facturas"]] }] },
  { g: "Compras y abastecimiento", sec: [
    { n: "Pedidos de compra", it: [["cotiz", "Solicitudes de cotización"], ["pcompra", "Todos los pedidos de compra"]] },
    { n: "Recepciones", it: [["albc", "Albaranes de compra (recepciones)"]] }] },
  { g: "Gestión del inventario", sec: [
    { n: "Artículos", it: [["articulos", "Todos los artículos"]] },
    { n: "Entradas y salidas", it: [["albc", "Albaranes de compra (recepciones)"], ["albv", "Albaranes de venta (entregas)"]] },
    { n: "Consultas e informes", sub: [{ n: "Consultas", it: [["existencias", "Existencias disponibles"], ["movinv", "Transacciones de inventario"]] }] },
    { n: "Periódico", it: [["regexist", "Regularización de existencias"]] },
    { n: "Configurar", sub: [{ n: "Almacenes", it: [["almacenes", "Almacenes"]] }] }] },
  { g: "Impuestos", sec: [
    { n: "Impuestos indirectos", sub: [{ n: "Impuestos", it: [["codigos", "Códigos de impuestos"], ["combos", "Combinaciones de impuestos"], ["gimpuestos", "Grupos de impuestos"], ["gartic", "Grupos de impuestos de artículos"], ["gregistro", "Grupos de registro"], ["autoridades", "Autoridades fiscales"], ["periodosliq", "Períodos de liquidación de impuestos"]] }] },
    { n: "Consultas e informes", sub: [{ n: "Consultas de impuestos", it: [["imptoreg", "Impuestos registrados"]] }, { n: "Libros de impuestos", it: [["libroiva", "Libros de IVA"]] }, { n: "Comercio exterior", it: [["intrastat", "Intrastat"]] }] },
    { n: "Declaraciones", sub: [
      { n: "Liquidación", it: [["liqreg", "Liquidar y registrar impuestos"], ["pagosimp", "Pagos de impuestos"], ["informar", "Informar impuestos para el período de liquidación"], ["infiva", "Informes de IVA españoles"]] },
      { n: "Impuestos", it: [["m303", "Modelo 303 · IVA y liquidación"], ["m390", "Modelo 390 · Resumen anual de IVA"], ["m111", "Modelo 111 · Retenciones trabajo y profesionales"], ["m115", "Modelo 115 · Retenciones de alquileres"], ["m123", "Modelo 123 · Retenciones de capital mobiliario"], ["m347", "Modelo 347 · Operaciones con terceros"]] },
      { n: "Comercio exterior", it: [["m349", "Modelo 349 · Operaciones intracomunitarias"]] }] }] }
];
const moduloDe = v => (NAV.find(m => m.sec.some(s => (s.it || []).some(i => i[0] === v) || (s.sub || []).some(b => b.it.some(i => i[0] === v)))) || {}).g || "";
const NOMBRES = { inicio: "Inicio", cuentas: "Cuentas principales", diario: "Diarios generales", mayor: "Transacciones del libro mayor", sumas: "Balance de comprobación", estados: "Estados financieros",
  clientes: "Todos los clientes", fventa: "Facturas de cliente", proveedores: "Todos los proveedores", fcompra: "Facturas de proveedor", cobros: "Cobros pendientes", pagos: "Pagos pendientes", diariofprov: "Diario de facturas de proveedor", diariofcli: "Diario de facturas de cliente", codigos: "Códigos de impuestos", combos: "Combinaciones de impuestos", libroiva: "Libros de IVA", m303: "Modelo 303", m390: "Modelo 390", m349: "Modelo 349", m347: "Modelo 347", m111: "Modelo 111", m115: "Modelo 115", m123: "Modelo 123", gimpuestos: "Grupos de impuestos", gartic: "Grupos de impuestos de artículos", gregistro: "Grupos de registro", autoridades: "Autoridades fiscales", periodosliq: "Períodos de liquidación de impuestos", imptoreg: "Impuestos registrados", liqreg: "Liquidar y registrar impuestos", pagosimp: "Pagos de impuestos", infiva: "Informes de IVA españoles", informar: "Informar impuestos para el período de liquidación", intrastat: "Intrastat", parcont: "Parámetros de Contabilidad general", parprov: "Parámetros de proveedores", parcli: "Parámetros de clientes", pventa: "Pedidos de venta", pcompra: "Pedidos de compra", articulos: "Todos los artículos", existencias: "Existencias disponibles", movinv: "Transacciones de inventario", almacenes: "Almacenes", regexist: "Regularización de existencias", cierre: "Cierre del ejercicio", bancos: "Cuentas bancarias", movbanco: "Transacciones bancarias", conciliar: "Conciliación bancaria", activos: "Activos fijos", amort: "Propuesta de amortización", grupoact: "Grupos de activos fijos", dpago: "Diario de pagos a proveedores", dcobro: "Diario de pagos de clientes", dpagare: "Diario de creación de pagarés", dletra: "Diario de creación de letras de cambio", cartera: "Cartera de efectos", remesas: "Remesas", extractos: "Extractos bancarios", transfer: "Transferencias bancarias", prevision: "Previsión de flujo de efectivo", antcli: "Antigüedad de saldos de clientes", antprov: "Antigüedad de saldos de proveedores", extcli: "Extracto de cuenta de cliente", extprov: "Extracto de cuenta de proveedor", periodicos: "Asientos periódicos", librodiario: "Libro diario", calendario: "Calendario del libro mayor", aftrans: "Transacciones de activos fijos", afcuadro: "Cuadro de amortización", dletraliq: "Diario de liquidación de letra de cambio", dletraenv: "Diario de envíos", importar: "Importar asientos", origencont: "Explorador de origen contable", regdiario: "Registro en diario (España)", conjdim: "Saldos por conjunto de dimensiones", liqcont: "Liquidaciones de contabilidad", revaluacion: "Revalorización de divisa extranjera", ctacontrol: "Control de cuentas principales", divisas: "Divisas y tipos de cambio", espaciocierre: "Espacio de trabajo de cierre", abiertas: "Transacciones abiertas de clientes", albv: "Albaranes de venta (entregas)", albc: "Albaranes de compra (recepciones)", saldosfecha: "Saldo de comprobación", transasiento: "Transacciones de asiento", extctas: "Extracto por cuenta principal", financieros: "Informes financieros", extdim: "Extracto de dimensión", pmp: "Período medio de pago a proveedores", consolid: "Consolidación", periodif: "Esquemas de acumulación", asignaciones: "Diarios de asignaciones", comprobarserie: "Comprobar serie de asientos", dimensiones: "Dimensiones financieras", asigdim: "Asignar dimensiones", fservicios: "Todas las facturas de servicios", fsperiod: "Facturas periódicas", plantfs: "Plantillas de factura de servicios", letdiario: "Diario de letras de cambio", letabiertas: "Informe de letras abiertas", letimpagadas: "Letras impagadas", letfactura: "Relación letra-factura", letestad: "Estadísticas de letra de cambio", dletraimp: "Diario de impago de letras de cambio", dletraren: "Diario de renegociación de letras de cambio", dpagliq: "Diario de liquidación de pagarés", dpagren: "Diario de renegociación de pagarés", rectif: "Facturas rectificativas", liquidar: "Liquidar transacciones", imprfact: "Imprimir facturas", credito: "Crédito y cobros", presupv: "Presupuestos de ventas", cotiz: "Solicitudes de cotización", empresa: "Datos de la empresa", presupuesto: "Control presupuestario" };

const btn = (a, t, extra = "", dis = false) => `<button data-a="${a}" ${extra} ${dis ? "disabled" : ""}>${t}</button>`;
const SEP = `<span class="sep"></span>`;
// estructura de página D365: panel de acciones, título con vista, filtros, pestañas, cuerpo
const pagina = (titulo, acciones, cuerpo, { tabs = ["Lista", "General"], vista = "Mi vista", filtros = "", tabKey = "" } = {}) =>
  `<div class="fo-ap">${acciones}</div><div class="fo-hd"><small>${esc(titulo)}</small><h1>${esc(vista)} <i>⌄</i></h1></div>${filtros ? `<div class="fo-filtros">${filtros}</div>` : ""}
   <div class="fo-tabs">${tabs.map((t, i) => tabKey ? `<a data-a="tab" data-k="${tabKey}" data-t="${esc(t)}" class="${(S.tabs[tabKey] || tabs[0]) === t ? "on" : ""}">${t}</a>` : `<a class="${i ? "" : "on"}">${t}</a>`).join("")}</div><div class="fo-cuerpo">${cuerpo}</div>`;

V.inicio = () => {
  const tot = pref => saldoPref(pref, true);
  const bancos = tot("57"), desc = r2(S.d.apuntes.reduce((a, p) => a + +p.debe - +p.haber, 0));
  const res = r2(-(tot("6") + tot("7")));
  const mos = (t, v, k = "", vista = "") => `<button class="mos ${k}" data-a="vista" data-v="${vista}"><span>${t}</span><b>${v}</b></button>`;
  return pagina("Contabilidad", "", `
  <div class="kpi"><div><small>Resultado del ejercicio ${S.ej}</small><b>${eur(res)} €</b></div><div><small>Caja y bancos</small><b>${eur(bancos)} €</b></div><div><small>Ingresos del ejercicio</small><b>${eur(-tot("7"))} €</b></div></div>
  <div class="sec">Diarios y transacciones</div>
  <div class="mosaicos">${mos("Líneas de diario sin registrar", S.d.lineas.length, S.d.lineas.length ? "rojo" : "", "diario")}${mos("Asientos del ejercicio", S.d.asientos.filter(a => a.ejercicio === S.ej).length, "", "mayor")}${mos("Cuentas principales", S.d.cuentas.length, "", "cuentas")}
   ${mos("Pendiente de cobro", eur(sumPend("V")), "", "cobros")}${mos("Pendiente de pago", eur(sumPend("C")), "", "pagos")}${mos("Descuadre global", eur(desc), desc ? "rojo" : "gris", "sumas")}</div>
  <div class="sec">Enlaces</div>
  <div class="atajos"><a data-a="vista" data-v="diario">Diarios generales</a><a data-a="vista" data-v="cuentas">Cuentas principales</a><a data-a="vista" data-v="mayor">Transacciones del libro mayor</a><a data-a="vista" data-v="estados">Estados financieros</a></div>`, { tabs: ["Espacio de trabajo"], vista: "Inicio" });
};

V.cuentas = () => {
  const fc = S.filtroCuentas || "todas";
  const lista = [...S.d.cuentas].filter(c => fc === "todas" || (fc === "mov" ? esMov(c.codigo) : !esMov(c.codigo))).sort((a, b) => a.codigo.localeCompare(b.codigo));
  const sel = S.d.cuentas.find(c => c.id === S.sel);
  const nivel = c => c.length <= 2 ? 0 : c.length === 3 ? 1 : c.length === 4 ? 2 : c.length < 9 ? 3 : 4;
  const filas = lista.map(c => `<tr data-sel class="${esMov(c.codigo) ? "" : "tit"} ${c.id === S.sel ? "sel" : ""}" data-a="selcuenta" data-id="${c.id}"><td style="padding-left:${.5 + nivel(c.codigo) * 1.1}rem">${esc(c.codigo)}</td><td>${esc(c.nombre)}</td><td>${esMov(c.codigo) ? "Movimiento" : "Título"}</td><td>${CATEG[c.codigo[0]] || ""}</td><td class="n">${sal(saldoPref(c.codigo, true))}</td><td class="n">${sal(saldoPref(c.codigo, false))}</td></tr>`).join("");
  const mov = sel ? S.d.apuntes.filter(p => p.cuenta === sel.codigo).length : 0;
  const acc = btn("togglenueva", "+ Nuevo") + btn("delcuentasel", "Eliminar", "", !sel) + SEP + btn("renombrar", "Editar nombre", "", !sel) + SEP + btn("pgc", "Cargar plan base") + SEP + btn("vermayor", "Transacciones", "", !sel);
  return pagina("Cuentas principales", acc, `
  ${S.nueva ? `<div class="card"><div class="row"><input id="cc" placeholder="Cuenta (9 dígitos)" size="14" value="${esc(S.nuevaCod || "")}"><input id="cn" placeholder="Nombre" size="40"><button class="p" data-a="addcuenta">Aceptar</button><button data-a="togglenueva">Cancelar</button></div>
   <small style="color:var(--tx2)">Las cuentas de movimiento tienen 9 dígitos y cuelgan de un título (p. ej. 572000001 bajo 572). Seleccione un título antes de pulsar Nuevo y se propone el siguiente código libre. Los títulos de menos de 9 dígitos no admiten movimientos.</small></div>` : ""}
  <div class="pagina"><div class="lista"><table><tr><th>Cuenta principal</th><th>Nombre de la cuenta principal</th><th>Tipo</th><th>Categoría</th><th class="n">Saldo del periodo</th><th class="n">Saldo</th></tr>${filas}</table></div>
  <aside class="factbox"><h3>Detalles</h3>${sel ? `<dl><dt>Cuenta</dt><dd>${esc(sel.codigo)}</dd><dt>Nombre</dt><dd>${esc(sel.nombre)}</dd><dt>Tipo</dt><dd>${esMov(sel.codigo) ? "Movimiento" : "Título"}</dd><dt>Saldo ${S.ej}</dt><dd>${eur(saldoPref(sel.codigo, true))}</dd><dt>Saldo total</dt><dd>${eur(saldoPref(sel.codigo, false))}</dd><dt>Transacciones</dt><dd>${mov}</dd></dl>` : `<p style="color:var(--tx2)">Seleccione una cuenta para ver sus detalles.</p>`}</aside></div>`, { filtros: `<label>Mostrar<select id="fc"><option value="todas" ${fc === "todas" ? "selected" : ""}>Todas</option><option value="mov" ${fc === "mov" ? "selected" : ""}>Solo cuentas de movimiento (9 dígitos)</option><option value="tit" ${fc === "tit" ? "selected" : ""}>Solo títulos</option></select></label>` });
};

/* Diarios generales (como D365): lista de lotes y, dentro, las líneas del lote.
   Solo se incluyen los campos que tienen efecto en el programa: tipo de cuenta, cuenta, contrapartida, código de impuestos y de retención,
   factura y vencimiento. Cada línea con contrapartida genera su apunte contrario y, si lleva código, el IVA y la retención. */
const TIPOS_CTA = ["Contabilidad", "Cliente", "Proveedor", "Banco"];
const CAMPOS_J = ["fecha", "documento", "tipo_cuenta", "cuenta", "descripcion", "debe", "haber", "contra_tipo", "contra_cuenta", "cod_iva", "cod_ret"];
const CAMPOS_JF = ["fecha", "documento", "cuenta", "fecha_factura", "factura", "descripcion", "total", "contra_cuenta", "cod_iva", "cod_ret", "vencimiento"]; // diarios de facturas
const camposJ = () => tipoDeLibro(S.libro) === "general" ? CAMPOS_J : CAMPOS_JF;
const EXTRA_J = ["cod_iva", "cod_ret", "factura", "vencimiento", "fecha_doc", "fecha_factura", "total"]; // se guardan dentro de la columna extra
// Una línea de un diario de facturas es una factura: proveedor o cliente, importe total (IVA incluido) y contrapartida de gasto o ingreso.
// Se convierte en la línea equivalente de un diario general (gasto o ingreso con su contrapartida) para generar el IVA y la retención.
function sinteticaFact(l) {
  const ex = l.extra || {}, prov = tipoDeLibro(l.libro) === "fprov", total = r2(ex.total || 0), c = ex.cod_iva ? CODIGO[ex.cod_iva] : null;
  const p = c && ["nac", "inv"].includes(c.tipo) ? (+c.pct || 0) : 0, t = Math.abs(total);
  const rcode = !prov && ex.cod_rec && ex.cod_rec === recDeCodigo(ex.cod_iva) ? CODIGO[ex.cod_rec] : null, pr = rcode ? rcode.pct : 0; // recargo de equivalencia de las ventas
  let b = r2(t / (1 + (p + pr) / 100)); for (const d of [0, 0.01, -0.01]) { const bb = r2(b + d); if (r2(bb + r2(bb * p / 100) + r2(bb * pr / 100)) === t) { b = bb; break; } }
  const base = total < 0 ? -b : b;
  return { ...l, tipo_cuenta: l.contra_tipo || "Contabilidad", cuenta: l.contra_cuenta || "", debe: prov ? base : 0, haber: prov ? 0 : base, contra_tipo: prov ? "Proveedor" : "Cliente", contra_cuenta: l.cuenta || "" };
}
const gJ = (l, k) => EXTRA_J.includes(k) ? ((l.extra || {})[k] ?? "") : (l[k] ?? "");
const sJ = (l, k, v) => { if (EXTRA_J.includes(k)) { l.extra = l.extra || {}; l.extra[k] = v; } else l[k] = v; };
const codsDiario = () => [...codsLinea("C"), ...codsLinea("V")].map(c => [c.cod, c.cod + " · " + (c.pct ? String(c.pct).replace(".", ",") + " %" : c.nombre)]);
const codsRetDiario = () => [...codsRet("C"), ...codsRet("V")].map(c => [c.cod, c.cod + " · " + String(c.pct).replace(".", ",") + " %"]);
function resolverCuenta(tipo, cod) { // cuenta contable y tercero de una línea según su tipo de cuenta
  cod = (cod || "").trim(); if (!cod) return { error: "falta la cuenta" };
  if (tipo === "Cliente" || tipo === "Proveedor") {
    const t = terPorCod(cod); if (!t || t.tipo !== (tipo === "Cliente" ? "C" : "P")) return { error: tipo.toLowerCase() + " " + cod + " inexistente" };
    if (!cuentaValida(t.cuenta)) return { error: "el " + tipo.toLowerCase() + " " + cod + " no tiene cuenta contable de 9 dígitos" };
    return { cuenta: t.cuenta, tercero_id: t.id, nombre: t.nombre };
  }
  if (!S.d.cuentas.some(c => c.codigo === cod)) return { error: "la cuenta " + cod + " no existe" };
  if (!esMov(cod)) return { error: "la cuenta " + cod + " es un título: use una cuenta de 9 dígitos" };
  return { cuenta: cod, nombre: nombreCuenta(cod) };
}
// Apuntes de una línea: la línea, su contrapartida y, si lleva código, el IVA y la retención (importes en signo débito = positivo)
function expandirLinea(l0) {
  const l = esFactJ(l0) ? sinteticaFact(l0) : l0;
  const ap = [], err = []; let iva = 0, ret = 0;
  const base = r2((+l.debe || 0) - (+l.haber || 0)), s = base >= 0 ? 1 : -1, ex = l.extra || {}, c = ex.cod_iva ? CODIGO[ex.cod_iva] : null, cr = ex.cod_ret ? CODIGO[ex.cod_ret] : null;
  const m = resolverCuenta(l.tipo_cuenta, l.cuenta); if (m.error) err.push(m.error);
  const hayContra = !!(l.contra_cuenta || "").trim(), mc = hayContra ? resolverCuenta(l.contra_tipo, l.contra_cuenta) : null; if (mc && mc.error) err.push("contrapartida: " + mc.error);
  if (ex.cod_iva && !c) err.push("código de impuestos desconocido"); if (ex.cod_ret && !cr) err.push("código de retención desconocido");
  const rc = ex.cod_rec ? CODIGO[ex.cod_rec] : null; if (rc && !(c && ex.cod_rec === recDeCodigo(ex.cod_iva))) err.push("el recargo " + ex.cod_rec + " no corresponde al código de impuestos");
  if ((c || cr || rc) && !hayContra) err.push("el código de impuestos o de retención necesita cuenta de contrapartida");
  const add = (cuenta, imp, extra = {}) => { imp = r2(imp); if (!imp) return; ap.push({ cuenta, concepto: l.descripcion || null, debe: imp > 0 ? imp : 0, haber: imp < 0 ? -imp : 0, ...extra }); };
  let suma = base;
  add(m.cuenta, base, m.tercero_id ? { tercero_id: m.tercero_id } : {});
  if (hayContra && (c || cr)) {
    if (c && ["nac", "inv"].includes(c.tipo)) { iva = r2(Math.abs(base) * c.pct / 100); add(c.cta, s * iva); suma = r2(suma + s * iva); }
    else if (c && ["ue", "isp"].includes(c.tipo)) { const q = r2(Math.abs(base) * c.pct / 100); iva = q; add(c.cta, s * q); add(c.cta2, -s * q); } // autorrepercusión: el soportado y el repercutido se anulan
    if (rc && c && ex.cod_rec === recDeCodigo(ex.cod_iva)) { const q = r2(Math.abs(base) * rc.pct / 100); iva = r2(iva + q); add(rc.cta, s * q); suma = r2(suma + s * q); } // recargo de equivalencia
    if (cr) { ret = r2(Math.abs(base) * cr.pct / 100); add(cr.cta, -s * ret); suma = r2(suma - s * ret); }
  }
  if (hayContra && !err.length) add(mc.cuenta, -suma, mc.tercero_id ? { tercero_id: mc.tercero_id } : {});
  return { ap, err, iva, ret };
}
function comprobar(ls) {
  const prob = [], porDoc = new Map(), tieneErr = new Set();
  ls.forEach((l, i) => {
    const fj = esFactJ(l), ex = l.extra || {}, p = [], e = expandirLinea(l); p.push(...e.err.filter(x => !(fj && x === "falta la cuenta")));
    if (fj) { if (!(l.cuenta || "").trim()) p.push("falta el " + (tipoDeLibro(l.libro) === "fprov" ? "proveedor" : "cliente")); if (!(l.contra_cuenta || "").trim()) p.push("falta la cuenta de contrapartida (" + (tipoDeLibro(l.libro) === "fprov" ? "gasto" : "ingreso") + ")"); if (!+ex.total) p.push("sin importe total"); if (!ex.factura) p.push("sin nº de factura"); if (!ex.fecha_factura) p.push("sin fecha de factura"); }
    else if (!(+l.debe || +l.haber)) p.push("sin importe");
    if (!l.fecha) p.push("sin fecha"); if (!l.documento) p.push("sin asiento");
    if (p.length) { prob.push({ i, id: l.id, texto: p.join(", ") }); tieneErr.add(i); }
    if (l.documento) { const o = porDoc.get(l.documento) || { d: 0, h: 0 }; e.ap.forEach(a => { o.d = r2(o.d + a.debe); o.h = r2(o.h + a.haber); }); porDoc.set(l.documento, o); }
  });
  porDoc.forEach((o, doc) => { if (o.d !== o.h) { const i = ls.findIndex(l => l.documento === doc); if (!tieneErr.has(i)) prob.push({ i, id: ls[i].id, texto: "el asiento " + doc + " no cuadra (" + eur(o.d - o.h) + ")" }); } });
  return prob.sort((a, b) => a.i - b.i);
}
function filaJ(l, i, prob, sel) {
  const nuevo = !l.id, m = resolverCuenta(l.tipo_cuenta, l.cuenta);
  const inp = (k, ex = "") => `<input data-j="${i}" data-k="${k}" ${ex} value="${esc(gJ(l, k))}">`;
  const selc = (k, opts) => `<select data-j="${i}" data-k="${k}">${optsHtml(opts, gJ(l, k))}</select>`;
  return `<tr data-jr="${i}" class="${prob ? "prob" : ""} ${sel ? "sel" : ""}"><td>${inp("fecha", 'type="date"')}</td><td>${inp("documento", 'size="9"')}</td><td>${selc("tipo_cuenta", TIPOS_CTA)}</td><td>${inp("cuenta", 'list="dlc" size="10"')}</td><td class="nc" data-nc="${i}">${esc(m.nombre || "")}</td>
   <td>${inp("descripcion", 'size="24"')}</td><td>${inp("debe", 'class="n" size="9"')}</td><td>${inp("haber", 'class="n" size="9"')}</td><td>${selc("contra_tipo", TIPOS_CTA)}</td><td>${inp("contra_cuenta", 'list="dlc" size="10"')}</td>
   <td>${selc("cod_iva", codsDiario())}</td><td>${selc("cod_ret", codsRetDiario())}</td><td>${nuevo ? "" : `<button class="d" data-a="dellineaj" data-id="${l.id}">✕</button>`}</td></tr>`;
}
function panelJ(ls) {
  const prob = comprobar(ls);
  return { prob, html: `<h3>Validación del diario</h3><div class="mosaicos"><div class="mos gris" style="width:6rem;height:5rem"><span>Líneas válidas</span><b>${ls.length - prob.length}</b></div><div class="mos ${prob.length ? "rojo" : "gris"}" style="width:6rem;height:5rem"><span>Con errores</span><b>${prob.length}</b></div></div>
   ${prob.length ? `<ul class="probs">${prob.slice(0, 8).map(p => `<li>Línea ${p.i + 1}: ${esc(p.texto)}</li>`).join("")}</ul>` : `<p class="ok">No se encontraron errores.</p>`}` };
}
// barra inferior de la línea seleccionada, con los totales del asiento y del diario (como D365)
function detalleJ(ls) {
  const l = ls.find(x => x.id === S.selLinea) || {}, m = resolverCuenta(l.tipo_cuenta, l.cuenta), mc = (l.contra_cuenta || "").trim() ? resolverCuenta(l.contra_tipo, l.contra_cuenta) : {};
  const e = l.id ? expandirLinea(l) : { iva: 0, ret: 0 };
  const tot = arr => { const ap = arr.flatMap(x => expandirLinea(x).ap); return { d: r2(ap.reduce((a, x) => a + (+x.debe || 0), 0)), h: r2(ap.reduce((a, x) => a + (+x.haber || 0), 0)) }; }; // totales de lo que se contabilizará: líneas, contrapartidas, IVA y retención
  const A = tot(ls.filter(x => l.documento && x.documento === l.documento)), D = tot(ls), ro = v => `<input class="n" readonly value="${eur(v)}" size="10">`;
  return `<div class="row" style="margin-top:.7rem">
    <label>Nombre de la cuenta<input readonly size="26" value="${esc(m.nombre || "")}"></label><label>Nombre de la cuenta de contrapartida<input readonly size="26" value="${esc(mc.nombre || "")}"></label>
    <label>Importe de impuestos calculado<input class="n" readonly size="10" value="${eur(e.iva)}"></label><label>Importe de retención calculado<input class="n" readonly size="10" value="${eur(e.ret)}"></label>
    <label>Factura<input data-jx="factura" size="14" value="${esc((l.extra || {}).factura || "")}" ${l.id ? "" : "disabled"}></label><label>Fecha de vencimiento<input type="date" data-jx="vencimiento" value="${esc((l.extra || {}).vencimiento || "")}" ${l.id ? "" : "disabled"}></label></div>
   <table style="width:auto;margin-top:.4rem"><tr><th></th><th class="n">Débito</th><th class="n">Crédito</th><th class="n">Saldo</th></tr>
   <tr><td><b>ASIENTO</b> ${esc(l.documento || "")}</td><td class="n">${eur(A.d)}</td><td class="n">${eur(A.h)}</td><td class="n ${A.d === A.h ? "" : "ko"}">${eur(A.d - A.h)}</td></tr>
   <tr><td><b>DIARIO</b></td><td class="n">${eur(D.d)}</td><td class="n">${eur(D.h)}</td><td class="n ${D.d === D.h ? "" : "ko"}">${eur(D.d - D.h)}</td></tr></table>`;
}
const TITULO_D = { general: "Diarios generales", fprov: "Diario de facturas de proveedor", fcli: "Diario de facturas de cliente" };
// fila editable de un diario de facturas: proveedor o cliente, fecha y número de factura, importe total, contrapartida, impuestos y vencimiento
function filaJF(l, i, prob, sel) {
  const nuevo = !l.id, m = resolverCuenta(l.tipo_cuenta, l.cuenta);
  const inp = (k, ex = "") => `<input data-j="${i}" data-k="${k}" ${ex} value="${esc(gJ(l, k))}">`;
  const selc = (k, opts) => `<select data-j="${i}" data-k="${k}">${optsHtml(opts, gJ(l, k))}</select>`;
  return `<tr data-jr="${i}" class="${prob ? "prob" : ""} ${sel ? "sel" : ""}"><td>${inp("fecha", 'type="date"')}</td><td>${inp("documento", 'size="9"')}</td><td>${inp("cuenta", 'list="dlc" size="9"')}</td><td class="nc" data-nc="${i}">${esc(m.nombre || "")}</td>
   <td>${inp("fecha_factura", 'type="date"')}</td><td>${inp("factura", 'size="12"')}</td><td>${inp("descripcion", 'size="20"')}</td><td>${inp("total", 'class="n" size="10"')}</td>
   <td>${inp("contra_cuenta", 'list="dlc" size="10"')}</td><td>${selc("cod_iva", codsDiario())}</td><td>${selc("cod_ret", codsRetDiario())}</td><td>${inp("vencimiento", 'type="date"')}</td><td>${nuevo ? "" : `<button class="d" data-a="dellineaj" data-id="${l.id}">✕</button>`}</td></tr>`;
}
const vistaDiario = tipoD => {
  const fj = tipoD !== "general", prov = tipoD === "fprov";
  if (!S.libro) { // lista de lotes (pestañas Lista, General e Historial)
    const L = lotes(tipoD), sel = L.find(x => x.numero === S.selLote), tab = S.tabs.lotes || "Lista";
    const sumas = x => { const ls = S.d.lineas.filter(l => l.libro === x.numero); return { n: ls.length, D: r2(ls.reduce((a, l) => a + (+l.debe || 0), 0)), H: r2(ls.reduce((a, l) => a + (+l.haber || 0), 0)) }; };
    const filas = L.map(x => { const t = sumas(x); return `<tr data-sel class="${x.numero === S.selLote ? "sel" : ""}" data-a="sellote" data-id="${esc(x.numero)}"><td><a data-a="abrirlote" data-id="${esc(x.numero)}">${esc(x.numero)}</a></td><td>${esc(x.nombre)}</td><td>${esc(x.descripcion || "")}</td><td class="n">${t.n}</td><td class="n">${eur(t.D)}</td><td class="n">${eur(t.H)}</td><td>${x.creado ? String(x.creado).slice(0, 10) : ""}</td></tr>`; }).join("");
    const acc = btn("nuevolote", "+ Nuevo") + btn("dellote", "Eliminar", "", !sel) + SEP + btn("abrirlote", "Líneas", `data-id="${esc(S.selLote || "")}"`, !sel);
    let cuerpo;
    if (tab === "Lista") cuerpo = `<div class="lista"><table><tr><th>Número de lote</th><th>Nombre</th><th>Descripción</th><th class="n">Líneas</th><th class="n">Débito</th><th class="n">Crédito</th><th>Creado</th></tr>${filas || `<tr><td colspan="7" class="vacio">No se encontró ningún elemento que mostrar aquí.</td></tr>`}</table></div>`;
    else if (!sel) cuerpo = `<p style="color:var(--tx2)">Seleccione un lote en la pestaña Lista.</p>`;
    else if (tab === "General") cuerpo = `<div class="card"><div class="row"><label>Número de lote<input readonly size="14" value="${esc(sel.numero)}"></label><label>Nombre del diario<input data-lt="nombre" size="14" value="${esc(sel.nombre)}"></label><label>Descripción<input data-lt="descripcion" size="44" value="${esc(sel.descripcion || "")}"></label></div><p style="color:var(--tx2)">El nombre identifica el tipo de diario (por ejemplo GENERAL, D001). Las líneas se registran agrupadas por asiento.</p></div>`;
    else { const t = sumas(sel); cuerpo = `<div class="card"><dl class="factbox" style="box-shadow:none;width:auto;position:static;padding:0"><dl><dt>Número de lote</dt><dd>${esc(sel.numero)}</dd><dt>Creado</dt><dd>${sel.creado ? String(sel.creado).slice(0, 19).replace("T", " ") : "—"}</dd><dt>Líneas sin registrar</dt><dd>${t.n}</dd><dt>Estado</dt><dd>No registrado</dd></dl></dl></div>`; }
    return pagina(TITULO_D[tipoD], acc, cuerpo, { tabs: ["Lista", "General", "Historial"], tabKey: "lotes", filtros: `<label>Mostrar<select><option>No registrado</option></select></label>` });
  }
  const lote = lotes().find(x => x.numero === S.libro) || { numero: S.libro, descripcion: "" };
  const ls = lineasLibro(), p = panelJ(ls), ultima = ls[ls.length - 1], tab = S.tabs.jlin || "Lista";
  const blanca = fj ? { fecha: ultima?.fecha || "", documento: siguienteDoc(), tipo_cuenta: prov ? "Proveedor" : "Cliente", cuenta: "", descripcion: "", debe: 0, haber: 0, contra_tipo: "Contabilidad", contra_cuenta: "", extra: {} }
    : { fecha: ultima?.fecha || "", documento: ultima?.documento || "", tipo_cuenta: ultima?.tipo_cuenta || "Contabilidad", cuenta: "", descripcion: "", debe: "", haber: "", contra_tipo: "", contra_cuenta: "", extra: {} };
  const hay = ls.some(x => x.id === S.selLinea);
  const acc = btn("volverlotes", "← Diarios") + SEP + btn("nuevodoc", "+ Crear nuevo") + btn("dellineaj", "Eliminar", `data-id="${S.selLinea || ""}"`, !hay) + SEP + btn("validar", "Validar") + `<button class="p" data-a="registrar">Registrar</button>` + SEP +
    btn("copiarj", "Copiar línea", "", !hay) + (fj ? "" : btn("invertirj", "Invertir débito/crédito", "", !hay)) + btn("saldocta", "Saldo de la cuenta", "", !hay);
  const lt = S.d.terceros;
  const cab = fj ? `<th>Fecha</th><th>Asiento</th><th>${prov ? "Proveedor" : "Cliente"}</th><th>Nombre</th><th>Fecha de la factura</th><th>Factura</th><th>Descripción</th><th class="n">Importe total</th><th>${prov ? "Cuenta de gasto" : "Cuenta de ingresos"}</th><th>Código de impuestos</th><th>Código de retención</th><th>Fecha de vencimiento</th><th></th>`
    : `<th>Fecha</th><th>Asiento</th><th>Tipo de cuenta</th><th>Cuenta</th><th>Nombre de la cuenta</th><th>Descripción</th><th class="n">Débito</th><th class="n">Crédito</th><th>Tipo de contrapartida</th><th>Cuenta de contrapartida</th><th>Código de impuestos</th><th>Código de retención</th><th></th>`;
  const fila = fj ? filaJF : filaJ;
  const lista = `<table class="editable"><tr>${cab}</tr>${ls.map((l, i) => fila(l, i, p.prob.some(x => x.id === l.id), l.id === S.selLinea)).join("")}${fila(blanca, ls.length, false, false)}</table><div id="detJ">${detalleJ(ls)}</div>`;
  const l0 = ls.find(x => x.id === S.selLinea), tt = l0 && l0.tipo_cuenta !== "Contabilidad" && l0.tipo_cuenta !== "Banco" ? terPorCod(l0.cuenta) : null;
  const factura = !l0 ? `<p style="color:var(--tx2)">Seleccione una línea en la pestaña Lista.</p>` : `<div class="card"><div class="row"><label>Factura<input data-jx="factura" size="16" value="${esc((l0.extra || {}).factura || "")}"></label><label>Fecha de documento<input type="date" data-jx="fecha_doc" value="${esc((l0.extra || {}).fecha_doc || "")}"></label><label>Fecha de vencimiento<input type="date" data-jx="vencimiento" value="${esc((l0.extra || {}).vencimiento || "")}"></label></div>
    ${tt ? `<p style="color:var(--tx2)">${esc(tt.nombre)} · NIF ${esc(tt.cif || "")} · Condiciones de pago: ${esc(((CONDICIONES.find(c => c[0] === ((tt.ficha || {}).pago || {}).cond) || [])[1]) || "sin definir")}</p>` : ""}</div>`;
  return pagina(fj ? TITULO_D[tipoD] : "Entradas de diario", acc, `
  <datalist id="dlc">${optsCuentas()}${lt.map(x => `<option value="${esc(x.codigo)}">${esc(x.nombre)}</option>`).join("")}</datalist>
  <div class="pagina"><div class="lista">${tab === "Lista" ? lista : factura}</div><aside class="factbox" id="boxJ">${p.html}</aside></div>`, { tabs: ["Lista", "Factura"], tabKey: "jlin", vista: `${lote.numero}${lote.descripcion ? " · " + lote.descripcion : ""}` });
};
async function facturaDeLinea(l, aid) { // crea la factura registrada de una línea de un diario de facturas, enlazada a su asiento
  const ex = l.extra || {}, prov = tipoDeLibro(l.libro) === "fprov", tp = prov ? "C" : "V", t = terPorCod(l.cuenta), s = sinteticaFact(l), base = prov ? s.debe : s.haber;
  const c = ex.cod_iva ? CODIGO[ex.cod_iva] : null, cr = ex.cod_ret ? CODIGO[ex.cod_ret] : null;
  const numero = !prov && ex.factura && !S.d.facturas.some(f => f.tipo === "V" && f.numero === ex.factura) ? ex.factura : siguienteFact(tp);
  const f = { id: uid(), empresa_id: S.emp.id, tipo: tp, numero, tercero_id: t.id, num_externo: prov ? ex.factura : null, fecha_emision: ex.fecha_factura || l.fecha, fecha_registro: l.fecha, fecha_iva: l.fecha, fecha_vencimiento: ex.vencimiento || null, estado: "registrado", asiento_id: aid, notas: null,
    retencion_tipo: cr && prov ? cr.modelo : null, retencion_pct: cr ? cr.pct : 0, cod_ret: cr ? cr.cod : null };
  const ld = { id: uid(), factura_id: f.id, empresa_id: S.emp.id, orden: 0, descripcion: l.descripcion || null, cuenta: l.contra_cuenta, cantidad: 1, precio: base, iva: c ? c.pct : 0, cod_iva: ex.cod_iva || null, cod_rec: ex.cod_rec || null };
  await db.guardarFactura(f, [ld]); S.d.facturas.push(f); // se añade en memoria para que el siguiente número de factura no se repita
}
V.diario = () => vistaDiario("general");
V.diariofprov = () => vistaDiario("fprov");
V.diariofcli = () => vistaDiario("fcli");
function refrescaJ() { // actualiza la validación, los nombres, la línea seleccionada y los totales sin volver a dibujar la rejilla
  const ls = lineasLibro(), p = panelJ(ls), box = document.getElementById("boxJ"), det = document.getElementById("detJ");
  if (box) box.innerHTML = p.html; if (det) det.innerHTML = detalleJ(ls);
  document.querySelectorAll("[data-nc]").forEach(td => { const l = ls[+td.dataset.nc]; td.textContent = l ? (resolverCuenta(l.tipo_cuenta, l.cuenta).nombre || "") : ""; });
  document.querySelectorAll("tr[data-jr]").forEach(tr => { const l = ls[+tr.dataset.jr]; tr.classList.toggle("prob", !!l && p.prob.some(x => x.id === l.id)); tr.classList.toggle("sel", !!l && l.id === S.selLinea); });
}

/* Transacciones del libro mayor (los asientos registrados se pueden modificar y eliminar) */
V.mayor = () => {
  const cs = [...new Set(apuntesEj().map(p => p.cuenta))].sort();
  const f = S.filtroCta;
  let acc = 0;
  const rows = apuntesEj().filter(p => (!f || p.cuenta === f) && (!S.filtroTer || p.tercero_id === S.filtroTer)).sort((a, b) => a.a.fecha.localeCompare(b.a.fecha) || a.a.numero - b.a.numero);
  const sel = S.d.asientos.find(a => a.id === S.selAs);
  const lsel = sel ? S.d.apuntes.filter(p => p.asiento_id === sel.id) : [];
  const filas = rows.map(p => { if (f) acc = r2(acc + +p.debe - +p.haber);
    return `<tr data-sel data-a="selas" data-id="${p.a.id}" class="${p.a.id === S.selAs ? "sel" : ""}"><td>${p.a.fecha}</td><td>${esc(p.a.documento || "")}</td><td>${p.a.numero}</td><td>${esc(p.cuenta)}</td><td>${esc(nombreCuenta(p.cuenta))}</td><td>${esc((terPorId(p.tercero_id) || {}).codigo || "")}</td><td>${esc(p.concepto || p.a.concepto)}</td><td class="n">${+p.debe ? eur(p.debe) : ""}</td><td class="n">${+p.haber ? eur(p.haber) : ""}</td><td class="n">${f ? eur(acc) : ""}</td></tr>`; }).join("");
  const acciones = btn("modasiento", "Modificar asiento", "", !sel) + btn("delasiento", "Eliminar asiento", "", !sel) + (S.filtroTer ? SEP + btn("quitarter", "Quitar filtro: " + ((terPorId(S.filtroTer) || {}).nombre || "")) : "");
  return pagina("Transacciones del libro mayor", acciones, `
  ${S.edit ? `<div class="card"><b>Modificar asiento ${S.edit.numero}</b>${formAsiento()}</div>` : ""}
  <div class="pagina"><div class="lista"><table><tr><th>Fecha</th><th>Comprobante</th><th>Asiento</th><th>Cuenta</th><th>Nombre de la cuenta</th><th>Cliente / proveedor</th><th>Descripción</th><th class="n">Débito</th><th class="n">Crédito</th><th class="n">Saldo</th></tr>${filas || `<tr><td colspan="10" class="vacio">No se encontró ningún elemento que mostrar aquí.</td></tr>`}</table></div>
  <aside class="factbox"><h3>Asiento</h3>${sel ? `<dl><dt>Asiento</dt><dd>${sel.numero}</dd><dt>Fecha</dt><dd>${sel.fecha}</dd><dt>Comprobante</dt><dd>${esc(sel.documento || "")}</dd><dt>Origen</dt><dd>${esc(sel.origen)}</dd></dl><p>${esc(sel.concepto)}</p><dl>${lsel.map(p => `<dt>${esc(p.cuenta)} ${esc(nombreCuenta(p.cuenta))}</dt><dd>${+p.debe ? eur(p.debe) : "-" + eur(p.haber)}</dd>`).join("")}</dl>` : `<p style="color:var(--tx2)">Seleccione una transacción.</p>`}</aside></div>`,
    { filtros: `<label>Cuenta principal<select id="cm"><option value="">Todas</option>${cs.map(x => `<option ${x === f ? "selected" : ""} value="${esc(x)}">${esc(x)} ${esc(nombreCuenta(x))}</option>`).join("")}</select></label>` });
};
function formAsiento() {
  const l = S.lineas, d = r2(l.reduce((s, x) => s + (+x.debe || 0), 0)), h = r2(l.reduce((s, x) => s + (+x.haber || 0), 0));
  return `<div class="row"><input type="date" id="af" value="${S.fechaAs}"><input id="ad" placeholder="Comprobante" size="12" value="${esc(S.docAs)}"><input id="ac" placeholder="Descripción" size="40" value="${esc(S.conceptoAs)}"></div>
  <datalist id="dl">${optsCuentas()}</datalist>
  <table><tr><th>Cuenta</th><th>Descripción</th><th class="n">Débito</th><th class="n">Crédito</th><th></th></tr>
  ${l.map((x, i) => `<tr><td><input list="dl" data-l="${i}" data-k="cuenta" value="${esc(x.cuenta)}" size="9"> <small>${esc(nombreCuenta(x.cuenta))}</small></td>
   <td><input data-l="${i}" data-k="concepto" value="${esc(x.concepto)}"></td>
   <td><input data-l="${i}" data-k="debe" value="${x.debe}" size="10" class="n"></td><td><input data-l="${i}" data-k="haber" value="${x.haber}" size="10" class="n"></td>
   <td><button class="d" data-a="dellinea" data-i="${i}">✕</button></td></tr>`).join("")}
  <tr class="tot"><td colspan="2">Totales</td><td class="n">${eur(d)}</td><td class="n">${eur(h)}</td><td></td></tr></table>
  <div class="row" style="margin-top:.6rem"><button data-a="addlinea">+ Línea</button>
   <span class="${d === h && d > 0 ? "ok" : "ko"}">${d === h && d > 0 ? "Cuadra" : "Descuadre: " + eur(d - h)}</span>
   <button class="p" data-a="guardar" ${d === h && d > 0 ? "" : "disabled"}>Guardar cambios</button><button data-a="cancelar">Cancelar</button></div>`;
}

V.sumas = () => {
  const s = saldos(), D = r2(s.reduce((a, x) => a + x.debe, 0)), H = r2(s.reduce((a, x) => a + x.haber, 0));
  return pagina("Balance de comprobación", "", `<table><tr><th>Cuenta principal</th><th>Nombre</th><th class="n">Débito</th><th class="n">Crédito</th><th class="n">Saldo deudor</th><th class="n">Saldo acreedor</th></tr>
  ${s.map(x => `<tr><td>${esc(x.cuenta)}</td><td>${esc(nombreCuenta(x.cuenta))}</td><td class="n">${eur(x.debe)}</td><td class="n">${eur(x.haber)}</td><td class="n">${x.saldo > 0 ? eur(x.saldo) : ""}</td><td class="n">${x.saldo < 0 ? eur(-x.saldo) : ""}</td></tr>`).join("")}
  <tr class="tot"><td colspan="2">Totales</td><td class="n">${eur(D)}</td><td class="n">${eur(H)}</td><td></td><td></td></tr></table>
  <p class="${D === H ? "ok" : "ko"}">${D === H ? "Débito = Crédito: contabilidad cuadrada" : "DESCUADRE " + eur(D - H)}</p>`, { tabs: ["Informe"], vista: `Ejercicio ${S.ej}` });
};

V.estados = () => {
  const s = saldos(), suma = f => r2(s.filter(x => f(x.cuenta)).reduce((a, x) => a + x.saldo, 0));
  const ing = -suma(c => c[0] === "7"), gas = suma(c => c[0] === "6"), res = r2(ing - gas);
  const fila = (n, v) => `<tr><td>${n}</td><td class="n">${eur(v)}</td></tr>`;
  const grupo = (n, f) => fila(n, suma(f));
  return pagina("Estados financieros", "", `<h3>Pérdidas y ganancias</h3><table>${fila("Ingresos (grupo 7)", ing)}${fila("Gastos (grupo 6)", gas)}<tr class="tot"><td>Resultado</td><td class="n">${eur(res)}</td></tr></table>
  <h3 style="margin-top:1.2rem">Balance por grupos</h3><table>
  ${grupo("1 Financiación básica", c => c[0] === "1")}${grupo("2 Activo no corriente", c => c[0] === "2")}${grupo("3 Existencias", c => c[0] === "3")}
  ${grupo("4 Acreedores y deudores", c => c[0] === "4")}${grupo("5 Cuentas financieras", c => c[0] === "5")}${fila("Resultado del ejercicio (6 y 7)", r2(gas - ing))}
  <tr class="tot"><td>Suma (debe ser 0)</td><td class="n">${eur(suma(c => "12345".includes(c[0])) + r2(gas - ing))}</td></tr></table>
  <p><small>Saldos con signo: deudor positivo, acreedor negativo. El balance formal (activo/pasivo/PN) vendrá en la siguiente fase.</small></p>`, { tabs: ["Informe"], vista: `Ejercicio ${S.ej}` });
};

/* ---------------- Cuentas a cobrar / a pagar ---------------- */
const terPorId = id => S.d.terceros.find(t => t.id === id);
const terPorCod = c => S.d.terceros.find(t => t.codigo.toLowerCase() === String(c).trim().toLowerCase());
const IVAS = [0, 4, 10, 21];
function siguienteTer(tipo) { let m = 0; for (const t of S.d.terceros) { const k = new RegExp("^" + tipo + "(\\d+)$").exec(t.codigo); if (k) m = Math.max(m, +k[1]); } return tipo + String(m + 1).padStart(5, "0"); }
function siguienteFact(tipo) { let m = 0; for (const f of S.d.facturas) { if (f.tipo !== tipo) continue; const k = /^F[VC](\d+)$/.exec(f.numero); if (k) m = Math.max(m, +k[1]); } return (tipo === "V" ? "FV" : "FC") + String(m + 1).padStart(6, "0"); }
const saldoTer = t => r2(S.d.apuntes.filter(p => p.tercero_id === t.id).reduce((a, p) => a + (t.tipo === "C" ? +p.debe - +p.haber : +p.haber - +p.debe), 0));
// Totales de una factura a partir de sus líneas. Cada línea lleva un código de impuestos (l.cod) y, en ventas, un recargo opcional (l.rec).
// Las líneas con autorrepercusión (UE e inversión del sujeto pasivo, l.auto) no llevan IVA en la factura: su cuota no se paga al proveedor.
function totalesF(ls) {
  let base = 0, rec = 0; const porKey = new Map();
  ls.forEach(l => {
    const b = r2((+l.cantidad || 0) * (+l.precio || 0)); base = r2(base + b);
    const k = (l.auto ? "A" : "N") + "|" + (+l.iva || 0); porKey.set(k, r2((porKey.get(k) || 0) + b));
    const rc = l.rec && CODIGO[l.rec] ? CODIGO[l.rec].pct : 0; if (rc) rec = r2(rec + r2(b * rc / 100));
  });
  let cuotaN = 0, cuotaA = 0; porKey.forEach((b, k) => { const [t, p] = k.split("|"), c = r2(b * (+p) / 100); if (t === "A") cuotaA = r2(cuotaA + c); else cuotaN = r2(cuotaN + c); });
  return { base, cuota: cuotaN, cuotaA, rec, total: r2(base + cuotaN + rec), auto: ls.some(l => l.auto) };
}
const estadoF = f => (f.estado === "registrado" && S.d.asientos.some(a => a.id === f.asiento_id)) ? "Registrado" : "Abierto";
// código de impuestos de las líneas antiguas (sin código): se deduce del porcentaje
const INFERIDOS = { C: { 21: "S.NC.NR", 10: "S.NC.RD", 5: "S.NC.RDN", 4: "S.NC.SR", 2: "S.NC.SRN", 0: "S.NC.EX" }, V: { 21: "R.NC.NR", 10: "R.NC.RD", 4: "R.NC.SR", 2: "R.NC.SRN", 0: "R.NC.EX" } };
const inferCod = (tipo, pct) => (INFERIDOS[tipo] || {})[+pct || 0] || (tipo === "C" ? "S.NC.NR" : "R.NC.NR");
const codLinea = (f, l) => CODIGO[l.cod] || CODIGO[inferCod(f.tipo, l.iva)];
const lineasF = f => S.d.flineas.filter(l => l.factura_id === f.id).sort((a, b) => a.orden - b.orden).map(l => { const x = { ...l, cod: l.cod_iva || "", rec: l.cod_rec || "" }, c = codLinea(f, x); x.cod = c.cod; x.auto = c.tipo === "ue" || c.tipo === "isp"; return x; });
// código de impuestos por defecto de un tercero: el de su ficha o, si no tiene, el normal según su grupo de impuestos
function codDefecto(t, tipo) {
  const c = t && t.ficha && t.ficha.cod_iva; if (c && CODIGO[c] && CODIGO[c].lado === tipo_a_lado(tipo)) return c;
  const g = t ? t.grupo_iva : "NAC";
  return tipo === "C" ? (g === "UE" ? "S.UE.NR" : g === "EXT" ? "S.EX.NR" : "S.NC.NR") : (g === "UE" ? "R.UE" : g === "EXT" ? "R.EX" : "R.NC.NR");
}
const tipo_a_lado = tipo => tipo === "C" ? "C" : "V"; // el tipo de factura ya coincide con el lado del código (C compras, V ventas)
const codsLinea = tipo => CODIGOS.filter(c => !c.oculto && (tipo === "C" ? ["nac", "ex", "inv", "ue", "isp", "imp"].includes(c.tipo) && c.lado === "C" : ["nac", "ex"].includes(c.tipo) && c.lado === "V"));
const codsRec = () => CODIGOS.filter(c => c.tipo === "rec");
// Recargo de equivalencia de las facturas emitidas: cada tipo de IVA lleva el suyo (21 % con 5,2 %, 10 % con 1,4 % y 4 % con 0,5 %)
const RECARGO_DE = { 21: "R.RC.NR", 10: "R.RC.RD", 4: "R.RC.SR" };
const recDe = pct => RECARGO_DE[+pct] || "";
const recDeCodigo = cod => { const c = CODIGO[cod]; return c && c.tipo === "nac" && c.lado === "V" ? recDe(c.pct) : ""; };
const aplicaRec = t => !!(t && t.ficha && (t.ficha.recargo || t.ficha.cod_rec)); // el cliente está sujeto a recargo de equivalencia
const codsRet = tipo => CODIGOS.filter(c => tipo === "C" ? c.tipo === "ret" && !c.oculto : c.tipo === "retc");
// cuentas fijas de IVA: 472000001 soportado nacional (todos los tipos), 472200001 soportado intracomunitario (autorrepercusión),
// 472200002 DUAs, 477000001 repercutido nacional (todos los tipos), 477300001 repercutido intracomunitario (autorrepercusión)
const CTA = { sop: "472000001", sopUE: "472200001", sopDUA: "472200002", rep: "477000001", repUE: "477300001" };
const nombreBase = c => (PLAN_BASE.find(x => x[0] === c) || [])[1] || "";
// La autorrepercusión se activará cuando el código de impuestos se elija en cada línea de factura (pendiente); por ahora desactivada.
const esAutoRep = f => false;

function vistaTerceros(tipo) {
  const cli = tipo === "C";
  const L = S.d.terceros.filter(t => t.tipo === tipo).sort((a, b) => a.codigo.localeCompare(b.codigo));
  const sel = L.find(t => t.id === S.selTer);
  const filas = L.map(t => `<tr data-sel class="${t.id === S.selTer ? "sel" : ""}" data-a="selter" data-id="${t.id}"><td><a data-a="editter" data-id="${t.id}">${esc(t.codigo)}</a></td><td>${esc(t.nombre)}</td><td>${esc(t.cif || "")}</td><td>${esc((t.ficha || {}).pais || "")}</td><td>${esc(t.grupo_iva)}</td><td>${esc(((CONDICIONES.find(c => c[0] === ((t.ficha || {}).pago || {}).cond) || [])[1]) || "")}</td><td>${esc(t.telefono || "")}</td><td class="n">${sal(saldoTer(t))}</td></tr>`).join("");
  const acc = btn("nuevoter", "+ Nuevo", `data-t="${tipo}"`) + btn("editter", "Editar", `data-id="${sel ? sel.id : ""}"`, !sel) + btn("delter", "Eliminar", "", !sel) + SEP + btn("verter", "Transacciones", "", !sel) + SEP + btn("nuevafact", cli ? "Nueva factura de cliente" : "Nueva factura de proveedor", `data-t="${cli ? "V" : "C"}" data-ter="${sel ? sel.id : ""}"`);
  if (S.terEdit && S.terEdit.tipo === tipo) return fichaTercero(tipo);
  const fs = sel ? S.d.facturas.filter(f => f.tercero_id === sel.id) : [];
  const fact = fs.filter(f => estadoF(f) === "Registrado" && (f.fecha_registro || "").startsWith(String(S.ej))).reduce((a, f) => a + totalesF(lineasF(f)).total, 0);
  return pagina(cli ? "Todos los clientes" : "Todos los proveedores", acc, `
  <div class="pagina"><div class="lista"><table><tr><th>${cli ? "Cuenta de cliente" : "Cuenta de proveedor"}</th><th>Nombre</th><th>NIF / CIF</th><th>País</th><th>Grupo de impuestos</th><th>Condiciones de pago</th><th>Teléfono</th><th class="n">Saldo</th></tr>${filas || `<tr><td colspan="8" class="vacio">No se encontró ningún elemento que mostrar aquí.</td></tr>`}</table></div>
  <aside class="factbox"><h3>Estadísticas ${cli ? "del cliente" : "del proveedor"}</h3>${sel ? `<dl><dt>Cuenta</dt><dd>${esc(sel.codigo)}</dd><dt>Saldo</dt><dd>${eur(saldoTer(sel))}</dd><dt>Facturas abiertas</dt><dd>${fs.filter(f => estadoF(f) === "Abierto").length}</dd><dt>Facturado ${S.ej}</dt><dd>${eur(fact)}</dd><dt>Correo</dt><dd>${esc(sel.email || "")}</dd></dl>` : `<p style="color:var(--tx2)">Seleccione ${cli ? "un cliente" : "un proveedor"}.</p>`}</aside></div>`);
}
/* Ficha de cliente / proveedor, con secciones como D365: General, Información de contacto, País y direcciones, Condiciones de pago, Factura y entrega */
const TIPOS_CONTACTO = ["Teléfono", "Móvil", "Fax", "Correo electrónico", "Correo electrónico documentos técnicos", "Sitio web", "Otro"];
const PROPOSITOS_DIR = ["Negocio", "Facturación", "Entrega", "Otro"];
const CONDICIONES = [["CONT", "Contado", 0], ["7", "7 días", 7], ["15", "15 días", 15], ["30", "30 días", 30], ["45", "45 días", 45], ["60", "60 días", 60], ["75", "75 días", 75], ["90", "90 días", 90], ["120", "120 días", 120]];
const FORMAS_PAGO = ["Transferencia", "Recibo domiciliado", "Confirming", "Cheque", "Pagaré", "Efectivo", "Tarjeta"];
const INCOTERMS = ["EXW", "FCA", "CPT", "CIP", "DAP", "DPU", "DDP", "FAS", "FOB", "CFR", "CIF"];
const PAISES = [["ES", "España"], ["PT", "Portugal"], ["FR", "Francia"], ["DE", "Alemania"], ["IT", "Italia"], ["NL", "Países Bajos"], ["BE", "Bélgica"], ["LU", "Luxemburgo"], ["IE", "Irlanda"], ["AT", "Austria"], ["GR", "Grecia"], ["PL", "Polonia"], ["RO", "Rumanía"], ["BG", "Bulgaria"], ["HU", "Hungría"], ["CZ", "Chequia"], ["SK", "Eslovaquia"], ["SE", "Suecia"], ["DK", "Dinamarca"], ["FI", "Finlandia"], ["HR", "Croacia"], ["SI", "Eslovenia"], ["LT", "Lituania"], ["LV", "Letonia"], ["EE", "Estonia"], ["CY", "Chipre"], ["MT", "Malta"], ["GB", "Reino Unido"], ["AD", "Andorra"], ["CH", "Suiza"], ["MA", "Marruecos"], ["TR", "Turquía"], ["US", "Estados Unidos"], ["CN", "China"], ["IN", "India"], ["BR", "Brasil"], ["MX", "México"]];
const getPath = (o, p) => p.split(".").reduce((a, k) => (a == null ? undefined : a[k]), o);
const setPath = (o, p, v) => { const ks = p.split("."); let a = o; ks.slice(0, -1).forEach(k => { a[k] = a[k] || {}; a = a[k]; }); a[ks[ks.length - 1]] = v; };
const terNuevo = tp => ({ id: uid(), tipo: tp, codigo: siguienteTer(tp), nombre: "", cif: "", grupo_iva: "NAC", telefono: "", email: "", cuenta: "", ficha: { tipoPersona: "Organización", pais: "ES", idioma: "es", pago: parm(tp === "C" ? "cli" : "prov", "condPago", "") ? { cond: parm(tp === "C" ? "cli" : "prov", "condPago") } : {}, fact: {}, ent: {}, ...(tp === "C" && parm("cli", "recargoDef", false) ? { recargo: true } : {}) }, contactos: [], direcciones: [] });
const terClon = t => { const c = JSON.parse(JSON.stringify(t)); c.ficha = c.ficha || {}; ["pago", "fact", "ent"].forEach(k => { c.ficha[k] = c.ficha[k] || {}; }); c.ficha.pais = c.ficha.pais || "ES"; c.contactos = c.contactos || []; c.direcciones = c.direcciones || []; return c; };
const optsHtml = (lista, v) => `<option value=""></option>` + lista.map(x => { const [k, n] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(k)}" ${String(k) === String(v ?? "") ? "selected" : ""}>${esc(n)}</option>`; }).join("");
function campo(et, path, o = {}) {
  const v = getPath(S.terEdit, path);
  if (o.check) return `<label class="chk"><input type="checkbox" data-tf="${path}" ${v ? "checked" : ""}> ${et}</label>`;
  if (o.opts) return `<label class="fld">${et}<select data-tf="${path}">${optsHtml(o.opts, v)}</select></label>`;
  return `<label class="fld">${et}<input data-tf="${path}" type="${o.tipo || "text"}" value="${esc(v ?? "")}" ${o.list ? `list="${o.list}"` : ""} ${o.ph ? `placeholder="${esc(o.ph)}"` : ""}></label>`;
}
const secFicha = (id, titulo, cuerpo) => { const cerr = S.fichaCerr[id]; return `<div class="fsec"><a class="fh" data-a="fichasec" data-id="${id}"><span>${titulo}</span><span class="chev">${cerr ? "⌄" : "⌃"}</span></a>${cerr ? "" : `<div class="fb">${cuerpo}</div>`}</div>`; };
function tablaLista(nombre, cols) { // lista editable (contactos o direcciones); cols: [clave, etiqueta, opciones opcionales]
  const L = S.terEdit[nombre];
  return `<table class="editable"><tr>${cols.map(c => `<th>${c[1]}</th>`).join("")}<th>Principal</th><th></th></tr>
   ${L.map((r, i) => `<tr>${cols.map(c => `<td>${c[2] ? `<select data-tl="${nombre}" data-i="${i}" data-k="${c[0]}">${optsHtml(c[2], r[c[0]])}</select>` : `<input data-tl="${nombre}" data-i="${i}" data-k="${c[0]}" value="${esc(r[c[0]] ?? "")}">`}</td>`).join("")}<td><input type="checkbox" data-tl="${nombre}" data-i="${i}" data-k="principal" ${r.principal ? "checked" : ""}></td><td><button class="d" data-a="deltl" data-l="${nombre}" data-i="${i}">✕</button></td></tr>`).join("")}</table>
   <div class="row" style="margin-top:.4rem"><button data-a="addtl" data-l="${nombre}">+ Agregar</button></div>`;
}
function fichaTercero(tipo) {
  const e = S.terEdit, cli = tipo === "C", lado = cli ? "V" : "C", otros = S.d.terceros.filter(t => t.tipo === tipo && t.id !== e.id);
  const acc = `<button class="p" data-a="guardarter">Guardar</button>` + btn("cancelter", "Cancelar");
  const general = `<div class="fgrid">
    <div class="fcol"><h4>${cli ? "CLIENTE" : "PROVEEDOR"}</h4>${campo("Cuenta", "codigo")}${campo("Tipo", "ficha.tipoPersona", { opts: ["Organización", "Persona"] })}${campo("Nombre", "nombre")}${campo("Nombre de búsqueda", "ficha.busqueda")}${campo(cli ? "Grupo de clientes" : "Grupo de proveedores", "ficha.grupo")}${campo("Grupo de clasificación", "ficha.clasificacion")}${campo("Prioridad de pago", "ficha.prioridad")}</div>
    <div class="fcol"><h4>DETALLES DE LA ORGANIZACIÓN</h4>${campo("Número de empleados", "ficha.empleados", { tipo: "number" })}${campo("Número de organización", "ficha.org_num")}${campo("Código ABC", "ficha.abc", { opts: ["Ninguno", "A", "B", "C"] })}${campo("Número DUNS", "ficha.duns")}</div>
    <div class="fcol"><h4>OTRA INFORMACIÓN</h4>${campo("Libretas de direcciones", "ficha.libretas")}${campo("Idioma", "ficha.idioma")}${campo("Nombre fonético", "ficha.fonetico")}${campo("Conocido como", "ficha.conocido")}<h4>GESTIÓN DE COMUNICACIONES RETO</h4>${campo("Código ROPO", "ficha.ropo")}</div></div>`;
  const contacto = tablaLista("contactos", [["desc", "Descripción"], ["tipo", "Tipo", TIPOS_CONTACTO], ["valor", "Dirección y número de contacto"], ["ext", "Extensión"]]);
  const pais = `<div class="fgrid"><div class="fcol">${campo("País/región", "ficha.pais", { opts: PAISES })}${campo("Estado / provincia", "ficha.estado")}${campo("Número de identificación (id. gubernamental)", "ficha.id_gub")}</div></div>
    <h4 style="margin:1rem 0 .3rem">DIRECCIONES</h4>${tablaLista("direcciones", [["desc", "Nombre o descripción"], ["dir", "Dirección"], ["cp", "Código postal"], ["poblacion", "Población"], ["provincia", "Provincia"], ["pais", "País", PAISES], ["proposito", "Propósito", PROPOSITOS_DIR]])}`;
  const pago = `<div class="fgrid"><div class="fcol"><h4>PAGO</h4>${campo("Condiciones de pago", "ficha.pago.cond", { opts: CONDICIONES.map(c => [c[0], c[1]]) })}${campo("Forma de pago", "ficha.pago.forma", { opts: FORMAS_PAGO })}${campo("Especificación del pago", "ficha.pago.esp")}${campo("Día de pago (día del mes)", "ficha.pago.dia", { tipo: "number" })}${campo("Cuenta bancaria (IBAN)", "ficha.pago.banco")}</div>
    <div class="fcol"><h4>DESCUENTO POR PRONTO PAGO</h4>${campo("Descuento (%)", "ficha.pago.dto_pct", { tipo: "number" })}${campo("Días para el descuento", "ficha.pago.dto_dias", { tipo: "number" })}${campo("Días de base de las condiciones de pago", "ficha.pago.base", { tipo: "number" })}</div>
    <div class="fcol"><h4>OPCIONES</h4>${campo("Multivencimientos", "ficha.pago.multi", { check: true })}${campo("Permitir a cuenta", "ficha.pago.a_cuenta", { check: true })}${campo("Apto para plazos", "ficha.pago.plazos", { check: true })}${campo("Notas", "ficha.pago.notas")}</div></div>
    <p style="color:var(--tx2);margin:.5rem 0 0">Con las condiciones de pago (y el día de pago) el vencimiento de cada factura se calcula solo.</p>`;
  const fyE = `<div class="fgrid"><div class="fcol"><h4>FACTURA</h4>${campo("Cuenta de facturación", "ficha.fact.cuenta_fact", { opts: otros.map(t => [t.id, t.codigo + " · " + t.nombre]) })}${campo("Dirección de la factura", "ficha.fact.dir_fact", { opts: e.direcciones.map((d, i) => [String(i), d.desc || d.dir || "Dirección " + (i + 1)]) })}${campo("Grupo de secuencias numéricas", "ficha.fact.seq")}${campo("Plantilla de factura", "ficha.fact.plantilla")}</div>
    <div class="fcol"><h4>ENTREGA</h4>${campo("Zona de porte", "ficha.ent.zona")}${campo("Condiciones de entrega", "ficha.ent.cond", { opts: INCOTERMS })}${campo("Modo de entrega", "ficha.ent.modo")}${campo("Motivo de la entrega", "ficha.ent.motivo")}${campo("Código de destino", "ficha.ent.destino")}${campo("Calendario de recepción", "ficha.ent.calendario")}</div>
    <div class="fcol"><h4>IMPUESTOS Y CONTABILIDAD</h4>${campo("NIF", "cif")}${campo("Grupo de impuestos", "grupo_iva", { opts: [["NAC", "NAC · Nacional"], ["UE", "UE · Intracomunitario"], ["EXT", "EXT · Terceros países"]] })}${campo("Cuenta contable (9 dígitos)", "cuenta", { list: "dl", ph: "automática" })}
      <h4 style="margin-top:.8rem">IMPUESTOS POR DEFECTO EN FACTURAS</h4>${campo("Combinación de impuestos", "ficha.comb", { opts: combos(lado).map(c => [c.id, c.nombre]) })}${campo("Código de impuestos", "ficha.cod_iva", { opts: codsLinea(lado).map(c => [c.cod, c.cod + " · " + (c.pct ? String(c.pct).replace(".", ",") + " %" : c.nombre)]) })}${campo("Código de retención", "ficha.cod_ret", { opts: codsRet(lado).map(c => [c.cod, c.cod + " · " + String(c.pct).replace(".", ",") + " %"]) })}${cli ? campo("Cliente con recargo de equivalencia (5,2 % con IVA 21 %, 1,4 % con 10 % y 0,5 % con 4 %)", "ficha.recargo", { check: true }) : ""}</div></div>`;
  return pagina(cli ? "Cliente" : "Proveedor", acc, `<datalist id="dl">${optsCuentas()}</datalist>${secFicha("gen", "General", general)}${secFicha("con", "Información de contacto", contacto)}${secFicha("pais", "País y direcciones", pais)}${secFicha("pago", "Condiciones de pago", pago)}${secFicha("fye", "Factura y entrega", fyE)}`,
    { tabs: ["Ficha"], vista: e.codigo + (e.nombre ? " : " + e.nombre : "") });
}
// vencimiento = fecha de la factura + días de las condiciones de pago; si hay día de pago, se pasa al siguiente día de pago
function calcVenc(t, fecha) {
  const p = ((t || {}).ficha || {}).pago || {}, c = CONDICIONES.find(x => x[0] === p.cond);
  if (!c || !fecha) return "";
  const d = new Date(fecha + "T00:00:00"); d.setDate(d.getDate() + c[2]);
  const dia = Math.min(31, Math.max(0, Math.round(+p.dia || 0)));
  if (dia) { const ult = (y, m) => new Date(y, m + 1, 0).getDate(); let y = d.getFullYear(), m = d.getMonth(); let obj = new Date(y, m, Math.min(dia, ult(y, m))); if (obj < d) { m += 1; obj = new Date(y, m, Math.min(dia, ult(y, m))); } return obj.getFullYear() + "-" + String(obj.getMonth() + 1).padStart(2, "0") + "-" + String(obj.getDate()).padStart(2, "0"); }
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
V.clientes = () => vistaTerceros("C");
V.proveedores = () => vistaTerceros("P");

function vistaFacturas(tipo) {
  const cli = tipo === "V";
  const L = S.d.facturas.filter(f => f.tipo === tipo).sort((a, b) => b.numero.localeCompare(a.numero));
  const sel = L.find(f => f.id === S.selFact);
  const filas = L.map(f => { const t = terPorId(f.tercero_id) || {}; return `<tr data-sel class="${f.id === S.selFact ? "sel" : ""}" data-a="selfact" data-id="${f.id}"><td><a data-a="abrirfact" data-id="${f.id}">${esc(f.numero)}</a></td><td>${esc(t.codigo || "")}</td><td>${esc(t.nombre || "")}</td>${cli ? "" : `<td>${esc(f.num_externo || "")}</td>`}<td>${f.fecha_emision || ""}</td><td>${f.fecha_vencimiento || ""}</td><td class="n">${eur(totalesF(lineasF(f)).total)}</td><td>${estadoF(f)}</td></tr>`; }).join("");
  const acc = btn("nuevafact", "+ Nuevo", `data-t="${tipo}"`) + btn("abrirfact", "Editar", `data-id="${sel ? sel.id : ""}"`, !sel) + btn("delfact", "Eliminar", "", !sel);
  const t = sel ? terPorId(sel.tercero_id) : null;
  return pagina(cli ? "Facturas de cliente" : "Facturas de proveedor", acc, `<div class="pagina"><div class="lista"><table><tr><th>Factura</th><th>${cli ? "Cliente" : "Proveedor"}</th><th>Nombre</th>${cli ? "" : "<th>Nº factura del proveedor</th>"}<th>Fecha de factura</th><th>Vencimiento</th><th class="n">Importe</th><th>Estado</th></tr>${filas || `<tr><td colspan="8" class="vacio">No se encontró ningún elemento que mostrar aquí.</td></tr>`}</table></div>
  <aside class="factbox"><h3>Detalles</h3>${sel ? `<dl><dt>Factura</dt><dd>${esc(sel.numero)}</dd><dt>${cli ? "Cliente" : "Proveedor"}</dt><dd>${esc(t ? t.nombre : "")}</dd><dt>Saldo</dt><dd>${t ? eur(saldoTer(t)) : ""}</dd><dt>Estado</dt><dd>${estadoF(sel)}</dd></dl>` : `<p style="color:var(--tx2)">Seleccione una factura.</p>`}</aside></div>`);
}
function vistaFacturaEdit() {
  const { f, ls } = S.fact, cli = f.tipo === "V", reg = estadoF(f) === "Registrado", dis = reg ? "disabled" : "";
  const t = terPorId(f.tercero_id), tot = totalesF(ls);
  const acc = btn("volverfact", "← Facturas") + (reg ? "" : btn("guardarfact", "Guardar")) + SEP + (reg ? btn("deshacerfact", "Deshacer registro") : `<button class="p" data-a="registrarfact">Registrar</button>`);
  const cab = `<div class="card"><div class="row">
   <label>${cli ? "Cliente" : "Proveedor"}<br><input data-f="tercero" list="dlter" size="12" ${dis} value="${esc(t ? t.codigo : "")}"></label><span style="min-width:14rem">${esc(t ? t.nombre : "")}</span>
   ${cli ? "" : `<label>Nº factura del proveedor<br><input data-f="num_externo" size="16" ${dis} value="${esc(f.num_externo || "")}"></label>`}
   <label>Fecha de factura<br><input type="date" data-f="fecha_emision" ${dis} value="${f.fecha_emision || ""}"></label>
   <label>Fecha de registro<br><input type="date" data-f="fecha_registro" ${dis} value="${f.fecha_registro || ""}"></label>
   <label>Vencimiento<br><input type="date" data-f="fecha_vencimiento" ${dis} value="${f.fecha_vencimiento || ""}"></label>
   <label>Combinación de impuestos<br><select data-f="combo" ${dis}>${optsHtml(combos(f.tipo).map(c => [c.id, c.nombre]), f.comb)}</select></label>
   <label>Retención IRPF<br><select data-f="retencion_tipo" ${dis}>${opcionesRetencion(f)}</select></label>
   <label>% ret.<br><input data-f="retencion_pct" size="5" ${dis || (f.cod_ret ? "" : "disabled")} value="${f.retencion_pct || 0}"></label>
   <label>Estado<br><b>${estadoF(f)}</b></label></div></div>
  <datalist id="dlter">${S.d.terceros.filter(x => x.tipo === (cli ? "C" : "P")).map(x => `<option value="${esc(x.codigo)}">${esc(x.nombre)}</option>`).join("")}</datalist>
  <datalist id="dl">${optsCuentas()}</datalist>`;
  const filas = ls.map((l, i) => `<tr><td><input data-fl="${i}" data-k="descripcion" size="34" ${dis} value="${esc(l.descripcion || "")}"></td><td><input data-fl="${i}" data-k="cuenta" list="dl" size="9" ${dis} value="${esc(l.cuenta || "")}"></td>
   <td><input class="n" data-fl="${i}" data-k="cantidad" size="7" ${dis} value="${l.cantidad}"></td><td><input class="n" data-fl="${i}" data-k="precio" size="10" ${dis} value="${l.precio}"></td>
   <td><select data-fl="${i}" data-k="cod" ${dis}>${optsHtml(codsLinea(f.tipo).map(c => [c.cod, c.cod + " · " + (c.pct ? String(c.pct).replace(".", ",") + " %" : c.nombre)]), l.cod)}</select></td>
   ${cli ? `<td><select data-fl="${i}" data-k="rec" ${dis}>${optsHtml(codsRec().filter(c => c.cod === recDeCodigo(l.cod)).map(c => [c.cod, c.cod + " · " + String(c.pct).replace(".", ",") + " %"]), l.rec)}</select></td>` : ""}
   <td class="n" data-imp="${i}">${eur((+l.cantidad || 0) * (+l.precio || 0))}</td><td>${reg ? "" : `<button class="d" data-a="dellineaf" data-i="${i}">✕</button>`}</td></tr>`).join("");
  return pagina(cli ? "Factura de cliente" : "Factura de proveedor", acc, `${cab}
  <div class="pagina"><div class="lista"><table class="editable"><tr><th>Descripción</th><th>${cli ? "Cuenta de ingresos" : "Cuenta de gastos"}</th><th class="n">Cantidad</th><th class="n">Precio unitario</th><th>Código de impuestos</th>${cli ? "<th>Recargo</th>" : ""}<th class="n">Importe</th><th></th></tr>${filas}</table>
   ${reg ? "" : `<div class="row" style="margin-top:.5rem"><button data-a="addlineaf">+ Línea</button></div>`}
   <div class="pie" id="pieF">${pieHtml(f, ls, reg)}</div></div>
  <aside class="factbox"><h3>${cli ? "Cliente" : "Proveedor"}</h3>${t ? `<dl><dt>Cuenta</dt><dd>${esc(t.codigo)}</dd><dt>NIF</dt><dd>${esc(t.cif || "")}</dd><dt>Grupo de impuestos</dt><dd>${esc(t.grupo_iva)}</dd><dt>Saldo</dt><dd>${eur(saldoTer(t))}</dd></dl>` : `<p style="color:var(--tx2)">Seleccione ${cli ? "un cliente" : "un proveedor"}.</p>`}
   <h3 style="margin-top:1rem">Factura</h3><dl><dt>Número</dt><dd>${esc(f.numero)}</dd></dl></aside></div>`, { tabs: ["Líneas", "General"], vista: `${f.numero}${t ? " · " + t.nombre : ""}` });
}
V.fventa = () => S.fact && S.fact.f.tipo === "V" ? vistaFacturaEdit() : vistaFacturas("V");
V.fcompra = () => S.fact && S.fact.f.tipo === "C" ? vistaFacturaEdit() : vistaFacturas("C");
function pieHtml(f, ls, reg) { // totales al pie de la factura: base, IVA, autorrepercutido, recargo, total y retención
  const cli = f.tipo === "V", tot = totalesF(ls), r = retDe(f, tot.base);
  return `<span>Base imponible <b>${eur(tot.base)}</b></span><span>IVA <b>${eur(tot.cuota)}</b></span>${tot.cuotaA ? `<span>IVA autorrepercutido <b>${eur(tot.cuotaA)}</b></span>` : ""}${tot.rec ? `<span>Recargo <b>${eur(tot.rec)}</b></span>` : ""}<span>Total <b>${eur(tot.total)}</b></span>${r ? `<span>Retención <b>${eur(r)}</b></span><span>${cli ? "A cobrar" : "A pagar"} <b>${eur(r2(tot.total - r))}</b></span>` : ""}${reg ? `<span>${cli ? "Cobrado" : "Pagado"} <b>${eur(pagadoF(f))}</b></span><span>Pendiente <b>${eur(pendienteF(f))}</b></span>` : ""}`;
}
function refrescaF() {
  const { f, ls } = S.fact;
  document.getElementById("pieF").innerHTML = pieHtml(f, ls, estadoF(f) === "Registrado");
  document.querySelectorAll("[data-imp]").forEach(td => { const l = ls[+td.dataset.imp]; td.textContent = l ? eur((+l.cantidad || 0) * (+l.precio || 0)) : ""; });
}
// IVA por defecto: nacional 21 %; proveedor UE 21 % que se autorrepercute; cliente UE o terceros países 0 % (exento)
function nuevaLineaF(f) {
  const t = terPorId(f.tercero_id), cod = codDefecto(t, f.tipo), k = CODIGO[cod];
  return { id: null, descripcion: "", cuenta: primeraCuenta(f.tipo === "V" ? "700" : "600"), cantidad: 1, precio: 0, iva: k ? k.pct : 0, cod, rec: f.tipo === "V" && aplicaRec(t) ? recDeCodigo(cod) : "", auto: !!k && (k.tipo === "ue" || k.tipo === "isp") };
}
function abrirFactura(id) { const f = S.d.facturas.find(x => x.id === id); if (!f) return; S.fact = { f: { ...f }, ls: lineasF(f).map(l => ({ ...l })) }; S.selFact = id; if (!S.fact.ls.length) S.fact.ls.push(nuevaLineaF(S.fact.f)); render(); }
async function guardarFactura() {
  const { f, ls } = S.fact; const fila = x => (x === "" || x === undefined) ? null : x;
  const fdb = { id: f.id, empresa_id: S.emp.id, tipo: f.tipo, numero: f.numero, tercero_id: f.tercero_id || null, num_externo: fila(f.num_externo), fecha_emision: fila(f.fecha_emision), fecha_registro: fila(f.fecha_registro), fecha_iva: fila(f.fecha_iva || f.fecha_registro), fecha_vencimiento: fila(f.fecha_vencimiento), estado: f.estado, asiento_id: f.asiento_id || null, notas: fila(f.notas), retencion_tipo: f.tipo === "C" ? fila(f.retencion_tipo) : null, retencion_pct: (f.cod_ret || (f.tipo === "C" && f.retencion_tipo)) ? (+f.retencion_pct || 0) : 0, cod_ret: fila(f.cod_ret), pedido_id: f.pedido_id || null };
  const ldb = ls.filter(l => (l.descripcion || l.cuenta) && (+l.precio || +l.cantidad)).map((l, i) => ({ id: l.id || uid(), factura_id: f.id, empresa_id: S.emp.id, orden: i, descripcion: l.descripcion || null, cuenta: l.cuenta || null, cantidad: +l.cantidad || 0, precio: +l.precio || 0, iva: +l.iva || 0, cod_iva: l.cod || null, cod_rec: l.rec || null, pedido_linea_id: l.pedido_linea_id || null }));
  await db.guardarFactura(fdb, ldb);
  S.d = await db.cargar(S.emp.id); S.fact = { f: { ...S.d.facturas.find(x => x.id === f.id) }, ls: lineasF(f).map(l => ({ ...l })) };
  if (!S.fact.ls.length) S.fact.ls.push(nuevaLineaF(S.fact.f));
}
async function registrarFactura() {
  const { f, ls } = S.fact, cli = f.tipo === "V", t = terPorId(f.tercero_id);
  const err = [];
  if (!t) err.push("Falta " + (cli ? "el cliente." : "el proveedor."));
  if (!f.fecha_registro) err.push("Falta la fecha de registro.");
  if (!cli && !(f.num_externo || "").trim()) err.push("Falta el nº de factura del proveedor.");
  const validas = ls.filter(l => (+l.cantidad || 0) * (+l.precio || 0) !== 0);
  if (!validas.length) err.push("La factura no tiene líneas con importe.");
  validas.forEach((l, i) => {
    if (!cuentaValida(l.cuenta)) err.push("Línea " + (i + 1) + ": la cuenta " + (l.cuenta || "(vacía)") + " no existe o no es de movimiento (9 dígitos).");
    if (l.rec && l.rec !== recDeCodigo(codLinea(f, l).cod)) err.push("Línea " + (i + 1) + ": el recargo " + l.rec + " no corresponde a su código de impuestos (5,2 % con IVA 21 %, 1,4 % con 10 % y 0,5 % con 4 %).");
  });
  const ctrl = t ? (t.cuenta || "") : "";
  if (t && !cuentaValida(ctrl)) err.push("El " + (cli ? "cliente" : "proveedor") + " no tiene una cuenta contable de 9 dígitos válida. Edítelo y guárdelo.");
  const tot = totalesF(validas), ret = retDe(f, tot.base), cr = CODIGO[codRetEfectivo(f)];
  if (ret && !cr) err.push("La factura tiene retención pero no un código de retención válido.");
  if (err.length) return alert("No se puede registrar:\n" + err.join("\n"));
  // El asiento sale del código de impuestos de cada línea: cuenta de IVA según el código, autorrepercusión (UE e inversión del sujeto pasivo),
  // recargo de equivalencia y retención. Los apuntes con igual cuenta y lado se agrupan.
  const ap = [], idx = new Map();
  const add = (cuenta, imp, lado, extra = {}) => {
    imp = r2(imp); if (!imp) return; const otro = lado === "debe" ? "haber" : "debe", l = imp > 0 ? lado : otro, key = cuenta + "|" + l + "|" + (extra.tercero_id || "");
    const ex = idx.get(key); if (ex) ex[l] = r2(ex[l] + Math.abs(imp)); else { const x = { cuenta, concepto: null, debe: 0, haber: 0, ...extra, [l]: Math.abs(imp) }; idx.set(key, x); ap.push(x); }
  };
  const gIva = new Map(), gAuto = new Map(); // base por cuenta de IVA y porcentaje (nacional) o por código (autorrepercusión)
  validas.forEach(l => {
    const c = codLinea(f, l), b = r2((+l.cantidad || 0) * (+l.precio || 0));
    add(l.cuenta, b, cli ? "haber" : "debe");
    if (c.tipo === "nac" || c.tipo === "inv") { const k = c.cta + "|" + c.pct; gIva.set(k, r2((gIva.get(k) || 0) + b)); }
    else if (c.tipo === "ue" || c.tipo === "isp") gAuto.set(c.cod, r2((gAuto.get(c.cod) || 0) + b));
    const rc = cli && l.rec ? CODIGO[l.rec] : null; if (rc) add(rc.cta, r2(b * rc.pct / 100), "haber");
  });
  gIva.forEach((b, k) => { const [cta, pct] = k.split("|"); add(cta, r2(b * (+pct) / 100), cli ? "haber" : "debe"); });
  gAuto.forEach((b, cod) => { const c = CODIGO[cod], cuota = r2(b * c.pct / 100); add(c.cta, cuota, "debe"); add(c.cta2, cuota, "haber"); });
  if (cli) { add(ctrl, r2(tot.total - ret), "debe", { tercero_id: t.id }); if (ret) add(cr.cta, ret, "debe"); }
  else { add(ctrl, r2(tot.total - ret), "haber", { tercero_id: t.id }); if (ret) add(cr.cta, ret, "haber"); }
  for (const a of ap) if (!S.d.cuentas.some(c => c.codigo === a.cuenta)) await asegurarCuenta(a.cuenta, nombreBase(a.cuenta)); // cuentas de IVA y retención: se crean bajo su título si aún no existen
  await guardarFactura();
  const concepto = (cli ? "Factura de venta " : "Factura de compra ") + (cli ? f.numero : (f.num_externo || f.numero)) + " " + t.nombre;
  const aid = await db.crearAsiento(S.emp.id, f.fecha_registro, concepto, ap, "factura", f.numero);
  S.fact.f.asiento_id = aid; S.fact.f.estado = "registrado"; await guardarFactura();
  S.d = await db.cargar(S.emp.id); abrirFactura(f.id);
}

/* ---------------- Cobros y pagos pendientes (liquidación de facturas) ---------------- */
const liqsF = f => S.d.liquidaciones.filter(l => l.factura_id === f.id).sort((a, b) => a.fecha.localeCompare(b.fecha));
const pagadoF = f => { const s = r2(liqsF(f).reduce((a, l) => a + +l.importe, 0)); return s && netoF(f) < 0 ? -s : s; }; // en una rectificativa (importe negativo) lo compensado resta
// Retenciones de IRPF predefinidas (modelo : porcentaje). El porcentaje se puede cambiar a mano en la factura.
// Retención de IRPF de la factura: código de retención (I.* en compras, R.I.* en ventas) y porcentaje editable.
// Las facturas antiguas solo tienen retencion_tipo (111, 115 o 123) y el porcentaje: se deduce su código.
const codRetEfectivo = f => f.cod_ret || (f.tipo === "C" && f.retencion_tipo ? (CODIGOS.find(c => c.tipo === "ret" && c.modelo === f.retencion_tipo && +c.pct === +f.retencion_pct) || {}).cod || "" : "");
function opcionesRetencion(f) {
  const ef = codRetEfectivo(f);
  return `<option value=""></option>` + codsRet(f.tipo).map(c => `<option value="${esc(c.cod)}" ${c.cod === ef ? "selected" : ""}>${esc(c.cod)} · ${String(c.pct).replace(".", ",")} %</option>`).join("");
}
const retDe = (f, base) => (f.cod_ret || (f.tipo === "C" && f.retencion_tipo)) ? r2(base * (+f.retencion_pct || 0) / 100) : 0; // retención de IRPF (practicada al proveedor o que nos practica el cliente)
// combinaciones de impuestos: las preparadas más las propias de la empresa (se guardan en modelos_manual con modelo "combos")
const combosPropias = () => (((S.d.manual || []).find(m => m.modelo === "combos") || {}).datos || {}).lista || [];
const combos = tipo => [...COMBINACIONES, ...combosPropias()].filter(c => !tipo || c.lado === tipo);
const comboDe = id => combos().find(c => c.id === id);
function aplicarRet(F, cod) { const c = CODIGO[cod]; F.cod_ret = c ? cod : ""; F.retencion_pct = c ? c.pct : 0; F.retencion_tipo = c && F.tipo === "C" ? c.modelo : ""; }
function aplicarCombo(F, ls, c) { // pone el código de IVA en todas las líneas, el recargo (ventas) y la retención
  const k = CODIGO[c.iva]; F.comb = c.id;
  ls.forEach(l => { l.cod = c.iva; l.iva = k ? k.pct : 0; l.auto = !!k && (k.tipo === "ue" || k.tipo === "isp"); l.rec = F.tipo === "V" && c.rec ? recDeCodigo(c.iva) : ""; l.tocado = true; });
  aplicarRet(F, c.ret || "");
}
const retF = f => retDe(f, totalesF(lineasF(f)).base);
const netoF = f => r2(totalesF(lineasF(f)).total - retF(f));
const pendienteF = f => r2(netoF(f) - pagadoF(f));
const sumPend = tipo => r2(S.d.facturas.filter(f => f.tipo === tipo && estadoF(f) === "Registrado").reduce((a, f) => a + pendienteF(f), 0));

function vistaPendientes(tipo) {
  const cli = tipo === "V", todas = S.filtroPend === "todas", hoyS = hoy();
  const L = S.d.facturas.filter(f => f.tipo === tipo && estadoF(f) === "Registrado" && (todas || pendienteF(f) > 0))
    .sort((a, b) => (a.fecha_vencimiento || a.fecha_emision || "").localeCompare(b.fecha_vencimiento || b.fecha_emision || ""));
  const sel = L.find(f => f.id === S.selPend);
  const estado = f => pendienteF(f) <= 0 ? "Liquidada" : (f.fecha_vencimiento && f.fecha_vencimiento < hoyS ? "Vencida" : "Pendiente");
  const filas = L.map(f => { const t = terPorId(f.tercero_id) || {}, est = estado(f);
    return `<tr data-sel class="${f.id === S.selPend ? "sel" : ""}" data-a="selpend" data-id="${f.id}"><td><a data-a="abrirfact" data-id="${f.id}">${esc(f.numero)}</a></td><td>${esc(t.codigo || "")}</td><td>${esc(t.nombre || "")}</td>${cli ? "" : `<td>${esc(f.num_externo || "")}</td>`}<td class="${est === "Vencida" ? "ko" : ""}">${f.fecha_vencimiento || ""}</td><td class="n">${eur(netoF(f))}</td><td class="n">${sal(pagadoF(f))}</td><td class="n">${eur(pendienteF(f))}</td><td class="${est === "Vencida" ? "ko" : ""}">${est}</td></tr>`; }).join("");
  const totalPend = r2(L.reduce((a, f) => a + pendienteF(f), 0));
  const puede = sel && pendienteF(sel) > 0;
  const acc = btn("abrirpago", cli ? "Registrar cobro" : "Registrar pago", "", !puede) + btn("deshacerpago", "Deshacer último " + (cli ? "cobro" : "pago"), "", !sel || !liqsF(sel).length) + SEP + btn("abrirfact", "Abrir factura", `data-id="${sel ? sel.id : ""}"`, !sel);
  const form = sel && S.pagoF === sel.id ? `<div class="card"><b>${cli ? "Registrar cobro" : "Registrar pago"} · ${esc(sel.numero)}</b><div class="row" style="margin-top:.5rem">
    <label>Fecha<br><input type="date" id="pg-fecha" value="${hoyS}"></label><label>Importe<br><input id="pg-importe" size="12" value="${pendienteF(sel)}"></label>
    <label>Cuenta de tesorería<br><input id="pg-banco" list="dl" size="12" value="${parm(cli ? "cli" : "prov", "cuentaTes", "") || cuentaSis("572")}"></label>
    <button class="p" data-a="guardarpago">Registrar</button><button data-a="cancelarpago">Cancelar</button></div>
    <datalist id="dl">${optsCuentas()}</datalist></div>` : "";
  const t = sel ? terPorId(sel.tercero_id) : null;
  return pagina(cli ? "Cobros pendientes" : "Pagos pendientes", acc, `${form}
  <div class="pagina"><div class="lista"><table><tr><th>Factura</th><th>${cli ? "Cliente" : "Proveedor"}</th><th>Nombre</th>${cli ? "" : "<th>Nº factura del proveedor</th>"}<th>Vencimiento</th><th class="n">Importe</th><th class="n">${cli ? "Cobrado" : "Pagado"}</th><th class="n">Pendiente</th><th>Estado</th></tr>${filas || `<tr><td colspan="9" class="vacio">No se encontró ningún elemento que mostrar aquí.</td></tr>`}
   ${L.length ? `<tr class="tot"><td colspan="${cli ? 6 : 7}">Total pendiente</td><td class="n">${eur(totalPend)}</td><td></td></tr>` : ""}</table></div>
  <aside class="factbox"><h3>${cli ? "Cobros" : "Pagos"} de la factura</h3>${sel ? `<dl><dt>${cli ? "Cliente" : "Proveedor"}</dt><dd>${esc(t ? t.nombre : "")}</dd><dt>Saldo del tercero</dt><dd>${t ? eur(saldoTer(t)) : ""}</dd></dl>
   ${liqsF(sel).length ? `<dl style="margin-top:.6rem">${liqsF(sel).map(l => `<dt>${l.fecha}</dt><dd>${eur(l.importe)}</dd>`).join("")}</dl>` : `<p style="color:var(--tx2)">Sin ${cli ? "cobros" : "pagos"} registrados.</p>`}` : `<p style="color:var(--tx2)">Seleccione una factura.</p>`}</aside></div>`,
    { filtros: `<label>Mostrar<select id="fp"><option value="pendientes" ${todas ? "" : "selected"}>Pendientes</option><option value="todas" ${todas ? "selected" : ""}>Todas las registradas</option></select></label>` });
}
V.cobros = () => S.fact && S.fact.f.tipo === "V" ? vistaFacturaEdit() : vistaPendientes("V");
V.pagos = () => S.fact && S.fact.f.tipo === "C" ? vistaFacturaEdit() : vistaPendientes("C");
async function registrarPago(f, fecha, importe, banco) {
  const cli = f.tipo === "V", t = terPorId(f.tercero_id), ctrl = t.cuenta || "";
  const err = [];
  if (!fecha) err.push("Falta la fecha.");
  if (!(importe > 0)) err.push("El importe debe ser mayor que cero.");
  if (importe > pendienteF(f)) err.push("El importe supera lo pendiente (" + eur(pendienteF(f)) + ").");
  if (!cuentaValida(ctrl)) err.push("El " + (cli ? "cliente" : "proveedor") + " no tiene una cuenta contable de 9 dígitos válida.");
  if (!esMov(banco)) err.push("La cuenta de tesorería debe tener 9 dígitos (por ejemplo " + cuentaSis("572") + ").");
  else if (!S.d.cuentas.some(x => x.codigo === banco) && !maestroDe(banco)) err.push("La cuenta de tesorería " + banco + " no cuelga de ningún título del plan (570, 572…).");
  if (err.length) return alert(err.join("\n"));
  await asegurarCuenta(banco, nombreMaestro(maestroDe(banco)) || "Tesorería"); // si no existe, se crea bajo su título
  const ap = cli ? [{ cuenta: banco, concepto: null, debe: importe, haber: 0 }, { cuenta: ctrl, concepto: null, debe: 0, haber: importe, tercero_id: t.id }]
                 : [{ cuenta: ctrl, concepto: null, debe: importe, haber: 0, tercero_id: t.id }, { cuenta: banco, concepto: null, debe: 0, haber: importe }];
  const aid = await db.crearAsiento(S.emp.id, fecha, (cli ? "Cobro factura " : "Pago factura ") + (cli ? f.numero : (f.num_externo || f.numero)) + " " + t.nombre, ap, cli ? "cobro" : "pago", f.numero);
  await db.guardarLiquidacion({ id: uid(), empresa_id: S.emp.id, factura_id: f.id, asiento_id: aid, fecha, importe });
  S.pagoF = null; await recargar();
}

/* ---------------- Impuestos: libros de IVA y modelos ---------------- */
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const PERIODOS = [["1T", "Primer trimestre", 1, 3], ["2T", "Segundo trimestre", 4, 6], ["3T", "Tercer trimestre", 7, 9], ["4T", "Cuarto trimestre", 10, 12], ["0A", "Año completo", 1, 12], ...MESES.map((m, i) => ["M" + String(i + 1).padStart(2, "0"), m, i + 1, i + 1])];
function rangoPeriodo(cod) {
  const p = PERIODOS.find(x => x[0] === cod) || PERIODOS[0], y = S.ej, d2 = n => String(n).padStart(2, "0");
  const fin = new Date(y, p[3], 0).getDate();
  return [`${y}-${d2(p[2])}-01`, `${y}-${d2(p[3])}-${d2(fin)}`];
}
const fechaIva = f => f.fecha_iva || f.fecha_registro || "";
function facturasIva(tipo, per) {
  const [d, h] = rangoPeriodo(per);
  return S.d.facturas.filter(f => f.tipo === tipo && estadoF(f) === "Registrado" && fechaIva(f) >= d && fechaIva(f) <= h).sort((a, b) => fechaIva(a).localeCompare(fechaIva(b)) || a.numero.localeCompare(b.numero));
}
// Desglose de una factura por código de impuestos: base y cuota por tipo de IVA (líneas con IVA en la factura), adquisiciones intracomunitarias
// (ue) e inversión del sujeto pasivo (isp), que se autorrepercuten, recargo de equivalencia y entregas a la UE (ventasUE).
function desgloseF(f) {
  const out = {}; [0, 2, 4, 5, 10, 21].forEach(k => { out[k] = { base: 0, cuota: 0 }; });
  const ue = { base: 0, cuota: 0, bienes: 0, serv: 0 }, isp = { base: 0, cuota: 0 }, ventasUE = { E: 0, S: 0 }, porCod = new Map(); let rec = 0;
  lineasF(f).forEach(l => {
    const c = codLinea(f, l), b = r2((+l.cantidad || 0) * (+l.precio || 0)), pct = +c.pct || 0;
    if (c.tipo === "ue" || c.tipo === "isp") porCod.set(c.cod, r2((porCod.get(c.cod) || 0) + b));
    else { (out[pct] = out[pct] || { base: 0, cuota: 0 }).base = r2(out[pct].base + b); if (c.ue) ventasUE[c.ue] = r2(ventasUE[c.ue] + b); }
    const rc = f.tipo === "V" && l.rec ? CODIGO[l.rec] : null; if (rc) rec = r2(rec + r2(b * rc.pct / 100));
  });
  Object.keys(out).forEach(k => { out[k].cuota = r2(out[k].base * (+k) / 100); });
  porCod.forEach((b, cod) => { const c = CODIGO[cod], cuota = r2(b * c.pct / 100), x = c.tipo === "ue" ? ue : isp; x.base = r2(x.base + b); x.cuota = r2(x.cuota + cuota); if (c.tipo === "ue") { if (c.bien) ue.bienes = r2(ue.bienes + b); else ue.serv = r2(ue.serv + b); } });
  return { ...out, ue, isp, ventasUE, rec, total: totalesF(lineasF(f)).total };
}
const nCSV = n => String(r2(n)).replace(".", ",");
function descargarCSV(nombre, filas) {
  const q = c => { const s = String(c ?? ""); return /^-?\d+(,\d+)?$/.test(s) ? s : `"${s.replace(/"/g, '""')}"`; }; // números sin comillas para que Excel los lea como números
  const csv = "﻿" + filas.map(r => r.map(q).join(";")).join("\r\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
}
const nomPer = () => (PERIODOS.find(x => x[0] === S.periodo) || PERIODOS[0])[1] + " " + S.ej;
const selPeriodo = () => `<label>Período<select id="per">${PERIODOS.map(p => `<option value="${p[0]}" ${p[0] === S.periodo ? "selected" : ""}>${p[1]}</option>`).join("")}</select></label>`;

function datosLibro() {
  const cli = S.libroIva === "V", L = facturasIva(S.libroIva, S.periodo);
  const cab = ["Fecha", "Registro", "Nº factura", "NIF", "Nombre", "Base 0 % / exenta", "Base 4 %", "Cuota 4 %", "Base 10 %", "Cuota 10 %", "Base 21 %", "Cuota 21 %", "Base otros tipos", "Cuota otros tipos", "Recargo de equivalencia", "Base autorrepercutida", "IVA autorrepercutido", "Total"];
  const tot = new Array(13).fill(0); // b0, b4, c4, b10, c10, b21, c21, bOtros, cOtros, recargo, bAuto, cAuto, total
  const filas = L.map(f => { const t = terPorId(f.tercero_id) || {}, d = desgloseF(f);
    const v = [d[0].base, d[4].base, d[4].cuota, d[10].base, d[10].cuota, d[21].base, d[21].cuota, r2(d[2].base + d[5].base), r2(d[2].cuota + d[5].cuota), d.rec, r2(d.ue.base + d.isp.base), r2(d.ue.cuota + d.isp.cuota), d.total];
    v.forEach((x, i) => { tot[i] = r2(tot[i] + x); });
    return [fechaIva(f), f.numero, cli ? f.numero : (f.num_externo || ""), t.cif || "", t.nombre || "", ...v]; });
  const resumen = { base: r2(tot[0] + tot[1] + tot[3] + tot[5] + tot[7] + tot[10]), cuota: r2(tot[2] + tot[4] + tot[6] + tot[8] + tot[9] + tot[11]), total: tot[12] };
  return { cab, filas, tot: ["", "", "", "", "Totales", ...tot], resumen };
}
V.libroiva = () => {
  const cli = S.libroIva === "V", D = datosLibro();
  const acc = btn("exportar", "Exportar a Excel (CSV)", "", !D.filas.length);
  const fila = r => `<tr>${r.map((c, i) => i >= 5 ? `<td class="n">${sal(c)}</td>` : `<td>${esc(c)}</td>`).join("")}</tr>`;
  const baseT = D.resumen.base, cuotaT = D.resumen.cuota;
  return pagina("Libros de IVA", acc, `<div class="pagina"><div class="lista"><table><tr>${D.cab.map((c, i) => `<th class="${i >= 5 ? "n" : ""}">${c}</th>`).join("")}</tr>${D.filas.map(fila).join("") || `<tr><td colspan="18" class="vacio">No hay facturas registradas en este período.</td></tr>`}${D.filas.length ? `<tr class="tot">${D.tot.map((c, i) => i >= 5 ? `<td class="n">${eur(c)}</td>` : `<td>${esc(c)}</td>`).join("")}</tr>` : ""}</table></div>
   <aside class="factbox"><h3>Resumen ${cli ? "repercutido" : "soportado"}</h3><dl><dt>Período</dt><dd>${esc(nomPer())}</dd><dt>Facturas</dt><dd>${D.filas.length}</dd><dt>Base imponible</dt><dd>${eur(baseT)}</dd><dt>Cuota de IVA</dt><dd>${eur(cuotaT)}</dd><dt>Total</dt><dd>${eur(D.resumen.total)}</dd></dl></aside></div>`,
    { tabs: ["Libro registro"], vista: cli ? "IVA repercutido (facturas emitidas)" : "IVA soportado (facturas recibidas)", filtros: `<label>Libro<select id="tl"><option value="V" ${cli ? "selected" : ""}>Repercutido (ventas)</option><option value="C" ${cli ? "" : "selected"}>Soportado (compras)</option></select></label>${selPeriodo()}` });
};

function datos303(per = S.periodo) {
  const V_ = facturasIva("V", per), C_ = facturasIva("C", per);
  const dev = { 4: [0, 0], 10: [0, 0], 21: [0, 0] }; let ex0 = 0, otrosB = 0, otrosC = 0, rec = 0;
  V_.forEach(f => { const d = desgloseF(f); ex0 = r2(ex0 + d[0].base); [4, 10, 21].forEach(k => { dev[k][0] = r2(dev[k][0] + d[k].base); dev[k][1] = r2(dev[k][1] + d[k].cuota); }); otrosB = r2(otrosB + d[2].base + d[5].base); otrosC = r2(otrosC + d[2].cuota + d[5].cuota); rec = r2(rec + d.rec); });
  let sBase = 0, sCuota = 0, c0 = 0, adqB = 0, adqC = 0, ispB = 0, ispC = 0;
  C_.forEach(f => { const d = desgloseF(f); c0 = r2(c0 + d[0].base); [2, 4, 5, 10, 21].forEach(k => { sBase = r2(sBase + d[k].base); sCuota = r2(sCuota + d[k].cuota); }); adqB = r2(adqB + d.ue.base); adqC = r2(adqC + d.ue.cuota); ispB = r2(ispB + d.isp.base); ispC = r2(ispC + d.isp.cuota); });
  // devengado: tipos 4/10/21 y otros, adquisiciones intracomunitarias (10-11), inversión del sujeto pasivo (12-13) y recargo (16-18)
  // deducible: operaciones interiores corrientes, incluida la inversión del sujeto pasivo (28-29), y adquisiciones intracomunitarias (36-37)
  const totDev = r2(dev[4][1] + dev[10][1] + dev[21][1] + otrosC + adqC + ispC + rec), totDed = r2(sCuota + ispC + adqC);
  return { dev, ex0, otrosB, otrosC, rec, sBase: r2(sBase + ispB), sCuota: r2(sCuota + ispC), adqB, adqC, ispB, ispC, c0, totDev, totDed, resultado: r2(totDev - totDed), nV: V_.length, nC: C_.length };
}
V.m303 = () => {
  const D = datos303(), c = (cas, txt, v, extra = "") => `<tr><td style="width:4rem"><b>${cas}</b></td><td>${txt}</td><td class="n">${extra}</td><td class="n">${eur(v)}</td></tr>`;
  const acc = btn("exportar", "Exportar a Excel (CSV)");
  return pagina("Modelo 303", acc, `<div class="lista"><p class="aviso">Cálculo orientativo a partir de las facturas registradas y su código de impuestos (por fecha de IVA). Incluye adquisiciones intracomunitarias, inversión del sujeto pasivo y recargo de equivalencia. No incluye importaciones (DUAs), prorrata ni regularizaciones, y no sustituye a la presentación en la AEAT.</p>
  <h3>IVA devengado</h3><table><tr><th>Casilla</th><th>Concepto</th><th class="n">Base / tipo</th><th class="n">Importe</th></tr>
  ${c("01 · 03", "Régimen general 4 %: base imponible y cuota", D.dev[4][1], eur(D.dev[4][0]))}${c("04 · 06", "Régimen general 10 %: base imponible y cuota", D.dev[10][1], eur(D.dev[10][0]))}${c("07 · 09", "Régimen general 21 %: base imponible y cuota", D.dev[21][1], eur(D.dev[21][0]))}
  ${D.otrosB || D.otrosC ? c("—", "Otros tipos (2 % y 5 %): base imponible y cuota", D.otrosC, eur(D.otrosB)) : ""}
  ${c("10 · 11", "Adquisiciones intracomunitarias de bienes y servicios: base y cuota", D.adqC, eur(D.adqB))}${c("12 · 13", "Inversión del sujeto pasivo: base y cuota", D.ispC, eur(D.ispB))}${c("16 · 18", "Recargo de equivalencia: cuota", D.rec)}
  <tr class="tot"><td>27</td><td>Total cuota devengada</td><td></td><td class="n">${eur(D.totDev)}</td></tr></table>
  <h3 style="margin-top:1.2rem">IVA deducible</h3><table><tr><th>Casilla</th><th>Concepto</th><th class="n">Base</th><th class="n">Cuota</th></tr>
  <tr><td><b>28 · 29</b></td><td>Cuotas soportadas en operaciones interiores corrientes (incluida la inversión del sujeto pasivo)</td><td class="n">${eur(D.sBase)}</td><td class="n">${eur(D.sCuota)}</td></tr>
  <tr><td><b>36 · 37</b></td><td>Cuotas soportadas en adquisiciones intracomunitarias de bienes y servicios</td><td class="n">${eur(D.adqB)}</td><td class="n">${eur(D.adqC)}</td></tr>
  <tr class="tot"><td>45</td><td>Total a deducir</td><td></td><td class="n">${eur(D.totDed)}</td></tr></table>
  <h3 style="margin-top:1.2rem">Resultado</h3><table><tr class="tot"><td style="width:4rem">46</td><td>Diferencia (27 − 45)</td><td class="n">${eur(D.resultado)}</td></tr></table>
  <p class="${D.resultado > 0 ? "ko" : "ok"}">${D.resultado > 0 ? "A ingresar" : D.resultado < 0 ? "A compensar o devolver" : "Sin resultado"}: ${eur(Math.abs(D.resultado))} €</p>
  <p style="color:var(--tx2)">Operaciones a tipo 0 %/exentas: ventas ${eur(D.ex0)} € · compras ${eur(D.c0)} € (informativo). Facturas incluidas: ${D.nV} emitidas y ${D.nC} recibidas.</p>${panelLiq("m303")}</div>`,
    { tabs: ["Autoliquidación"], vista: nomPer(), filtros: selPeriodo() });
};

function datos347() {
  const m = new Map();
  S.d.facturas.filter(f => estadoF(f) === "Registrado" && fechaIva(f).startsWith(String(S.ej))).forEach(f => {
    const q = Math.ceil(+fechaIva(f).slice(5, 7) / 3) - 1, k = f.tipo + "|" + f.tercero_id; const o = m.get(k) || { tipo: f.tipo, t: terPorId(f.tercero_id) || {}, q: [0, 0, 0, 0] };
    o.q[q] = r2(o.q[q] + desgloseF(f).total); m.set(k, o);
  });
  const filas = [...m.values()].map(o => ({ ...o, total: r2(o.q.reduce((a, x) => a + x, 0)) })).filter(o => Math.abs(o.total) > 3005.06).sort((a, b) => (a.t.nombre || "").localeCompare(b.t.nombre || ""));
  return { cli: filas.filter(o => o.tipo === "V"), pro: filas.filter(o => o.tipo === "C") };
}
V.m347 = () => {
  const D = datos347(), tabla = (tit, L) => `<h3>${tit}</h3><table><tr><th>NIF</th><th>Nombre</th><th class="n">1T</th><th class="n">2T</th><th class="n">3T</th><th class="n">4T</th><th class="n">Total anual</th></tr>
   ${L.map(o => `<tr><td>${esc(o.t.cif || "")}</td><td>${esc(o.t.nombre || "")}</td>${o.q.map(x => `<td class="n">${sal(x)}</td>`).join("")}<td class="n">${eur(o.total)}</td></tr>`).join("") || `<tr><td colspan="7" class="vacio">Ninguna operación supera 3.005,06 €.</td></tr>`}</table>`;
  return pagina("Modelo 347", btn("exportar", "Exportar a Excel (CSV)", "", !(D.cli.length + D.pro.length)), `<div class="lista"><p class="aviso">Operaciones con terceros que superan 3.005,06 € en el año (IVA incluido, por fecha de IVA). Importes por trimestre. No incluye cobros en metálico ni operaciones de inmuebles, y no sustituye a la presentación en la AEAT.</p>
   ${tabla("Clientes", D.cli)}<div style="height:1.2rem"></div>${tabla("Proveedores", D.pro)}</div>`, { tabs: ["Declaración anual"], vista: "Ejercicio " + S.ej });
};
/* Modelo 390: resumen anual a partir de los cuatro trimestres */
function datos390() {
  const T = ["1T", "2T", "3T", "4T"].map(q => datos303(q));
  const suma = f => r2(T.reduce((a, d) => a + f(d), 0));
  const filas = [
    ["Base 4 %", d => d.dev[4][0]], ["Cuota 4 %", d => d.dev[4][1]], ["Base 10 %", d => d.dev[10][0]], ["Cuota 10 %", d => d.dev[10][1]], ["Base 21 %", d => d.dev[21][0]], ["Cuota 21 %", d => d.dev[21][1]],
    ["Cuota otros tipos (2 % y 5 %)", d => d.otrosC], ["Adquisiciones intracomunitarias: base", d => d.adqB], ["Adquisiciones intracomunitarias: cuota", d => d.adqC], ["Inversión del sujeto pasivo: base", d => d.ispB], ["Inversión del sujeto pasivo: cuota", d => d.ispC], ["Recargo de equivalencia", d => d.rec],
    ["Total cuota devengada", d => d.totDev], ["Base deducible (interiores corrientes e inversión del sujeto pasivo)", d => d.sBase], ["Cuota deducible (interiores corrientes e inversión del sujeto pasivo)", d => d.sCuota], ["Cuota deducible adquisiciones intracomunitarias", d => d.adqC], ["Total a deducir", d => d.totDed], ["Resultado (devengado − deducible)", d => d.resultado]];
  const volumen = suma(d => d.dev[4][0] + d.dev[10][0] + d.dev[21][0] + d.otrosB + d.ex0), compras = suma(d => d.sBase + d.c0 + d.adqB);
  return { T, filas: filas.map(([n, f]) => [n, ...T.map(f), suma(f)]), volumen, compras };
}
V.m390 = () => {
  const D = datos390(), tot = new Set(["Total cuota devengada", "Total a deducir", "Resultado (devengado − deducible)"]);
  return pagina("Modelo 390", btn("exportar", "Exportar a Excel (CSV)"), `<div class="lista"><p class="aviso">Resumen anual orientativo calculado con las facturas registradas de cada trimestre y su código de impuestos. No sustituye a la presentación en la AEAT ni incluye importaciones (DUAs), prorrata ni regularizaciones.</p>
  <table><tr><th>Concepto</th><th class="n">1T</th><th class="n">2T</th><th class="n">3T</th><th class="n">4T</th><th class="n">Año ${S.ej}</th></tr>
  ${D.filas.map(r => `<tr class="${tot.has(r[0]) ? "tot" : ""}"><td>${r[0]}</td>${r.slice(1).map(x => `<td class="n">${sal(x)}</td>`).join("")}</tr>`).join("")}</table>
  <p style="color:var(--tx2)">Volumen de operaciones (ventas, base): ${eur(D.volumen)} € · Compras y gastos (base): ${eur(D.compras)} €</p></div>`, { tabs: ["Resumen anual"], vista: "Ejercicio " + S.ej });
};

/* Modelo 349: operaciones intracomunitarias (terceros con grupo de impuestos UE) */
function datos349(per = S.periodo) {
  const m = new Map();
  const add = (f, clave, base) => { if (!base) return; const k = clave + "|" + f.tercero_id, o = m.get(k) || { clave, t: terPorId(f.tercero_id) || {}, base: 0 }; o.base = r2(o.base + base); m.set(k, o); };
  // claves: E entregas de bienes (R.UE), S servicios prestados (R.UE.S), A adquisiciones de bienes (S.UE.* de mercancías), I servicios adquiridos (S.UE.* de servicios)
  facturasIva("V", per).forEach(f => { const d = desgloseF(f); add(f, "E", d.ventasUE.E); add(f, "S", d.ventasUE.S); });
  facturasIva("C", per).forEach(f => { const d = desgloseF(f); add(f, "A", d.ue.bienes); add(f, "I", d.ue.serv); });
  const filas = [...m.values()].sort((a, b) => a.clave.localeCompare(b.clave) || (a.t.nombre || "").localeCompare(b.t.nombre || ""));
  const totC = c => r2(filas.filter(o => o.clave === c).reduce((a, o) => a + o.base, 0));
  return { filas, E: totC("E"), S: totC("S"), A: totC("A"), I: totC("I") };
}
V.m349 = () => {
  const D = datos349();
  return pagina("Modelo 349", btn("exportar", "Exportar a Excel (CSV)", "", !D.filas.length), `<div class="lista"><p class="aviso">Operaciones intracomunitarias según el código de impuestos de cada línea: E entregas de bienes y S servicios prestados (ventas con código R.UE o R.UE.S), A adquisiciones de bienes e I servicios adquiridos (compras con código S.UE.*). No incluye operaciones triangulares ni rectificaciones, y el NIF-IVA es el NIF del tercero. No sustituye a la presentación en la AEAT.</p>
  <table><tr><th>Clave</th><th>NIF-IVA</th><th>Nombre</th><th class="n">Base imponible</th></tr>
  ${D.filas.map(o => `<tr><td>${o.clave}</td><td>${esc(o.t.cif || "")}</td><td>${esc(o.t.nombre || "")}</td><td class="n">${eur(o.base)}</td></tr>`).join("") || `<tr><td colspan="4" class="vacio">No hay operaciones intracomunitarias en este período.</td></tr>`}
  ${D.filas.length ? [["E", "Total entregas de bienes (E)", D.E], ["S", "Total servicios prestados (S)", D.S], ["A", "Total adquisiciones de bienes (A)", D.A], ["I", "Total servicios adquiridos (I)", D.I]].filter(x => x[2]).map(x => `<tr class="tot"><td colspan="3">${x[1]}</td><td class="n">${eur(x[2])}</td></tr>`).join("") : ""}</table></div>`, { tabs: ["Declaración recapitulativa"], vista: nomPer(), filtros: selPeriodo() });
};

/* Modelos 111, 115 y 123: retenciones practicadas en facturas de proveedor registradas */
function datosRet(tipo, per = S.periodo) {
  const [d, h] = rangoPeriodo(per);
  const fs = S.d.facturas.filter(f => f.tipo === "C" && f.retencion_tipo === tipo && estadoF(f) === "Registrado" && fechaIva(f) >= d && fechaIva(f) <= h);
  let base = 0, ret = 0; fs.forEach(f => { base = r2(base + totalesF(lineasF(f)).base); ret = r2(ret + retF(f)); });
  return { fs, n: new Set(fs.map(f => f.tercero_id)).size, base, ret };
}
const manual111 = () => (S.d.manual.find(m => m.modelo === "111" && m.ejercicio === S.ej && m.periodo === S.periodo) || {}).datos || {};
function detalleRet(D) {
  return `<h3 style="margin-top:1.2rem">Facturas con retención incluidas</h3><table><tr><th>Fecha</th><th>Factura</th><th>NIF</th><th>Proveedor</th><th class="n">Base</th><th class="n">%</th><th class="n">Retención</th></tr>
  ${D.fs.map(f => { const t = terPorId(f.tercero_id) || {}; return `<tr><td>${fechaIva(f)}</td><td>${esc(f.num_externo || f.numero)}</td><td>${esc(t.cif || "")}</td><td>${esc(t.nombre || "")}</td><td class="n">${eur(totalesF(lineasF(f)).base)}</td><td class="n">${+f.retencion_pct}</td><td class="n">${eur(retF(f))}</td></tr>`; }).join("") || `<tr><td colspan="7" class="vacio">No hay facturas con retención en este período.</td></tr>`}</table>`;
}
const casilla = (c, t, v, esN = false) => `<tr><td style="width:3.5rem"><b>${c}</b></td><td>${t}</td><td class="n">${esN ? v : eur(v)}</td></tr>`;
V.m111 = () => {
  const D = datosRet("111"), M = manual111(), mn = +M.n || 0, mi = r2(M.imp), mr = r2(M.ret), tot = r2(mr + D.ret);
  const inp = (id, v, sz = 8) => `<input data-man id="${id}" size="${sz}" value="${v || ""}" placeholder="0">`;
  return pagina("Modelo 111", btn("exportar", "Exportar a Excel (CSV)"), `<div class="lista"><p class="aviso">Retenciones e ingresos a cuenta de IRPF. Las de profesionales salen de las facturas de proveedor registradas con retención 111 (por fecha de IVA). Las del trabajo (nóminas) no hay módulo de nóminas: escríbalas a mano abajo y se guardan por período. Orientativo; no sustituye a la presentación en la AEAT.</p>
  <h3>Rendimientos del trabajo (a mano)</h3><div class="row"><label>01 · Nº de perceptores<br>${inp("man-n", M.n)}</label><label>02 · Importe de percepciones<br>${inp("man-imp", M.imp, 12)}</label><label>03 · Retenciones<br>${inp("man-ret", M.ret, 12)}</label></div>
  <h3>Rendimientos de actividades económicas (profesionales)</h3><table>${casilla("07", "Nº de perceptores", D.n, true)}${casilla("08", "Importe de las percepciones", D.base)}${casilla("09", "Importe de las retenciones", D.ret)}</table>
  <h3 style="margin-top:1.2rem">Liquidación</h3><table>${casilla("28", "Total liquidación (03 + 09)", tot)}<tr class="tot"><td>30</td><td>Resultado a ingresar</td><td class="n">${eur(tot)}</td></tr></table>${detalleRet(D)}${panelLiq("m111")}</div>`, { tabs: ["Autoliquidación"], vista: nomPer(), filtros: selPeriodo() });
};
V.m115 = () => {
  const D = datosRet("115");
  return pagina("Modelo 115", btn("exportar", "Exportar a Excel (CSV)"), `<div class="lista"><p class="aviso">Retenciones por arrendamiento de inmuebles urbanos: salen de las facturas de proveedor registradas con retención 115 (por fecha de IVA). Orientativo; no sustituye a la presentación en la AEAT.</p>
  <table>${casilla("01", "Nº de perceptores", D.n, true)}${casilla("02", "Base de las retenciones e ingresos a cuenta", D.base)}${casilla("03", "Retenciones e ingresos a cuenta", D.ret)}${casilla("04", "A deducir (declaraciones anteriores)", 0)}<tr class="tot"><td>05</td><td>Resultado a ingresar</td><td class="n">${eur(D.ret)}</td></tr></table>${detalleRet(D)}${panelLiq("m115")}</div>`, { tabs: ["Autoliquidación"], vista: nomPer(), filtros: selPeriodo() });
};
V.m123 = () => {
  const D = datosRet("123");
  return pagina("Modelo 123", btn("exportar", "Exportar a Excel (CSV)"), `<div class="lista"><p class="aviso">Retenciones sobre rendimientos del capital mobiliario (dividendos, intereses…): salen de las facturas de proveedor registradas con retención 123 (por fecha de IVA). Orientativo; no sustituye a la presentación en la AEAT.</p>
  <table>${casilla("01", "Nº de perceptores", D.n, true)}${casilla("02", "Importe de las percepciones", D.base)}${casilla("03", "Importe de las retenciones e ingresos a cuenta", D.ret)}<tr class="tot"><td>10</td><td>Resultado a ingresar</td><td class="n">${eur(D.ret)}</td></tr></table>${detalleRet(D)}${panelLiq("m123")}</div>`, { tabs: ["Autoliquidación"], vista: nomPer(), filtros: selPeriodo() });
};
function exportarActual() {
  const base = (S.emp.nombre || "empresa").replace(/[^\w]+/g, "_") + "_";
  if (S.vista === "m390") { const D = datos390(); return descargarCSV(base + "modelo390_" + S.ej + ".csv", [["Concepto", "1T", "2T", "3T", "4T", "Año"], ...D.filas.map(r => [r[0], ...r.slice(1).map(nCSV)])]); }
  if (S.vista === "m349") { const D = datos349(); return descargarCSV(base + "modelo349_" + S.periodo + "_" + S.ej + ".csv", [["Clave", "NIF-IVA", "Nombre", "Base imponible"], ...D.filas.map(o => [o.clave, o.t.cif || "", o.t.nombre || "", nCSV(o.base)])]); }
  if (["m111", "m115", "m123"].includes(S.vista)) {
    const tipo = S.vista.slice(1), D = datosRet(tipo), M = manual111();
    const cab = [["Casilla", "Concepto", "Importe"]];
    const filas = tipo === "111" ? [["01", "Perceptores trabajo (manual)", M.n || 0], ["02", "Percepciones trabajo (manual)", nCSV(M.imp)], ["03", "Retenciones trabajo (manual)", nCSV(M.ret)], ["07", "Perceptores profesionales", D.n], ["08", "Percepciones profesionales", nCSV(D.base)], ["09", "Retenciones profesionales", nCSV(D.ret)], ["28/30", "Total a ingresar", nCSV(r2(r2(M.ret) + D.ret))]]
      : [["01", "Perceptores", D.n], ["02", "Base / percepciones", nCSV(D.base)], ["03", "Retenciones", nCSV(D.ret)], [tipo === "115" ? "05" : "10", "Resultado a ingresar", nCSV(D.ret)]];
    const det = [[], ["Fecha", "Factura", "NIF", "Proveedor", "Base", "%", "Retención"], ...D.fs.map(f => { const t = terPorId(f.tercero_id) || {}; return [fechaIva(f), f.num_externo || f.numero, t.cif || "", t.nombre || "", nCSV(totalesF(lineasF(f)).base), nCSV(f.retencion_pct), nCSV(retF(f))]; })];
    return descargarCSV(base + "modelo" + tipo + "_" + S.periodo + "_" + S.ej + ".csv", [...cab, ...filas, ...det]);
  }
  if (S.vista === "libroiva") { const D = datosLibro(); descargarCSV(base + (S.libroIva === "V" ? "IVA_repercutido_" : "IVA_soportado_") + S.periodo + "_" + S.ej + ".csv", [D.cab, ...D.filas.map(r => r.map((c, i) => i >= 5 ? nCSV(c) : c)), D.tot.map((c, i) => i >= 5 ? nCSV(c) : c)]); }
  else if (S.vista === "m303") { const D = datos303(); descargarCSV(base + "modelo303_" + S.periodo + "_" + S.ej + ".csv", [["Casilla", "Concepto", "Base", "Importe"], ["01/03", "Devengado 4 %", nCSV(D.dev[4][0]), nCSV(D.dev[4][1])], ["04/06", "Devengado 10 %", nCSV(D.dev[10][0]), nCSV(D.dev[10][1])], ["07/09", "Devengado 21 %", nCSV(D.dev[21][0]), nCSV(D.dev[21][1])], ["10/11", "Adquisiciones intracomunitarias", nCSV(D.adqB), nCSV(D.adqC)], ["12/13", "Inversión del sujeto pasivo", nCSV(D.ispB), nCSV(D.ispC)], ["16/18", "Recargo de equivalencia", "", nCSV(D.rec)], ["27", "Total cuota devengada", "", nCSV(D.totDev)], ["28/29", "Deducible operaciones interiores corrientes e ISP", nCSV(D.sBase), nCSV(D.sCuota)], ["36/37", "Deducible adquisiciones intracomunitarias", nCSV(D.adqB), nCSV(D.adqC)], ["45", "Total a deducir", "", nCSV(D.totDed)], ["46", "Diferencia", "", nCSV(D.resultado)]]); }
  else if (S.vista === "m347") { const D = datos347(), f = (t, L) => L.map(o => [t, o.t.cif || "", o.t.nombre || "", ...o.q.map(nCSV), nCSV(o.total)]); descargarCSV(base + "modelo347_" + S.ej + ".csv", [["Tipo", "NIF", "Nombre", "1T", "2T", "3T", "4T", "Total"], ...f("Cliente", D.cli), ...f("Proveedor", D.pro)]); }
}

/* Códigos de impuestos: maestro con dirección (soportado / repercutido), tipo, porcentaje y cuentas */
const TIPO_NOMBRE = { nac: "IVA nacional", ex: "Exento / no sujeto", ue: "Adquisición intracomunitaria", "ue-par": "Autorrepercusión UE", isp: "Inversión del sujeto pasivo", "isp-par": "Autorrepercusión ISP", inv: "Bien de inversión", rec: "Recargo de equivalencia", imp: "Compra a tercer país", dua: "DUA (importación)", ret: "Retención IRPF practicada", retc: "Retención IRPF cobrada" };
V.codigos = () => {
  const f = S.filtroCod || "todos";
  const L = CODIGOS.filter(c => f === "todos" || c.dir === f || (f === "C" && c.lado === "C") || (f === "V" && c.lado === "V"));
  const filas = L.map(c => `<tr data-sel class="${c.cod === S.selCod ? "sel" : ""}" data-a="selcod" data-id="${esc(c.cod)}"><td><b>${esc(c.cod)}</b></td><td>${esc(c.nombre)}</td><td>${c.lado === "C" ? "Compras" : "Ventas"}</td><td>${esc(DIR_NOMBRE[c.dir])}</td><td>${esc(TIPO_NOMBRE[c.tipo] || c.tipo)}</td><td class="n">${c.pct ? String(c.pct).replace(".", ",") + " %" : "—"}</td><td>${esc(c.cta || "")}</td><td>${esc(c.cta2 || "")}</td></tr>`).join("");
  const sel = CODIGO[S.selCod];
  return pagina("Códigos de impuestos", "", `<div class="pagina"><div class="lista"><table><tr><th>Código</th><th>Nombre</th><th>Operación</th><th>Dirección del impuesto</th><th>Tipo</th><th class="n">Porcentaje</th><th>Cuenta (soportado / repercutido)</th><th>Cuenta autorrepercusión</th></tr>${filas}</table></div>
  <aside class="factbox"><h3>Detalles</h3>${sel ? `<dl><dt>Código</dt><dd>${esc(sel.cod)}</dd><dt>Dirección</dt><dd>${esc(DIR_NOMBRE[sel.dir])}</dd><dt>Tipo</dt><dd>${esc(TIPO_NOMBRE[sel.tipo] || sel.tipo)}</dd><dt>Porcentaje</dt><dd>${sel.pct ? String(sel.pct).replace(".", ",") + " %" : "—"}</dd>${sel.cta ? `<dt>Cuenta</dt><dd>${esc(sel.cta)}</dd><dt>Nombre</dt><dd style="text-align:right">${esc(nombreCuenta(sel.cta))}</dd>` : ""}${sel.cta2 ? `<dt>Cuenta 2</dt><dd>${esc(sel.cta2)}</dd><dt>Nombre</dt><dd style="text-align:right">${esc(nombreCuenta(sel.cta2))}</dd>` : ""}${sel.par ? `<dt>Código par</dt><dd>${esc(sel.par)}</dd>` : ""}${sel.modelo ? `<dt>Modelo</dt><dd>${esc(sel.modelo)}</dd>` : ""}</dl>
   ${sel.dir === "ambos" ? `<p style="color:var(--tx2)">Autorrepercusión: se registra el IVA soportado en ${esc(sel.cta)} y el repercutido en ${esc(sel.cta2)}; al proveedor solo se le debe la base.</p>` : ""}` : `<p style="color:var(--tx2)">Seleccione un código.</p>`}</aside></div>`,
    { tabs: ["Lista"], filtros: `<label>Mostrar<select id="fcod"><option value="todos" ${f === "todos" ? "selected" : ""}>Todos</option><option value="C" ${f === "C" ? "selected" : ""}>Solo compras</option><option value="V" ${f === "V" ? "selected" : ""}>Solo ventas</option><option value="soportado" ${f === "soportado" ? "selected" : ""}>Impuesto soportado</option><option value="repercutido" ${f === "repercutido" ? "selected" : ""}>Impuesto repercutido</option><option value="ambos" ${f === "ambos" ? "selected" : ""}>Autorrepercusión</option><option value="sin" ${f === "sin" ? "selected" : ""}>Sin impuesto</option><option value="practicada" ${f === "practicada" ? "selected" : ""}>Retención practicada</option><option value="soportada" ${f === "soportada" ? "selected" : ""}>Retención soportada</option></select></label>` });
};

/* Combinaciones de impuestos: IVA + retención + recargo, para elegirlos juntos en facturas y fichas */
V.combos = () => {
  const L = combos(), propias = new Set(combosPropias().map(c => c.id)), sel = L.find(c => c.id === S.selCombo), F = S.comboForm;
  const txt = cod => { const c = CODIGO[cod]; return c ? c.cod + (c.pct ? " · " + String(c.pct).replace(".", ",") + " %" : "") : ""; };
  const filas = L.map(c => `<tr data-sel class="${c.id === S.selCombo ? "sel" : ""}" data-a="selcombo" data-id="${esc(c.id)}"><td><b>${esc(c.id)}</b></td><td>${esc(c.nombre)}</td><td>${c.lado === "C" ? "Compras" : "Ventas"}</td><td>${esc(txt(c.iva))}</td><td>${esc(txt(c.ret))}</td><td>${esc(txt(c.rec))}</td><td>${propias.has(c.id) ? "Propia" : "Preparada"}</td></tr>`).join("");
  const form = F ? `<div class="card"><b>Nueva combinación de impuestos</b><div class="row" style="margin-top:.5rem">
    <label class="fld">Nombre<input data-cf="nombre" size="40" value="${esc(F.nombre)}"></label>
    <label class="fld">Operación<select data-cf="lado"><option value="C" ${F.lado === "C" ? "selected" : ""}>Compras</option><option value="V" ${F.lado === "V" ? "selected" : ""}>Ventas</option></select></label>
    <label class="fld">Código de impuestos<select data-cf="iva">${optsHtml(codsLinea(F.lado).map(c => [c.cod, c.cod + " · " + (c.pct ? String(c.pct).replace(".", ",") + " %" : c.nombre)]), F.iva)}</select></label>
    <label class="fld">Código de retención<select data-cf="ret">${optsHtml(codsRet(F.lado).map(c => [c.cod, c.cod + " · " + String(c.pct).replace(".", ",") + " %"]), F.ret)}</select></label>
    ${F.lado === "V" ? `<label class="fld">Recargo de equivalencia (el que acompaña a ese IVA)<select data-cf="rec">${optsHtml(codsRec().filter(c => c.cod === recDeCodigo(F.iva)).map(c => [c.cod, c.cod + " · " + String(c.pct).replace(".", ",") + " %"]), F.rec)}</select></label>` : ""}
    <button class="p" data-a="guardarcombo">Guardar</button><button data-a="cancelarcombo">Cancelar</button></div></div>` : "";
  return pagina("Combinaciones de impuestos", btn("nuevocombo", "+ Nueva combinación") + btn("delcombo", "Eliminar", "", !sel || !propias.has(sel.id)),
    `${form}<div class="lista"><table><tr><th>Id.</th><th>Nombre</th><th>Operación</th><th>Código de impuestos</th><th>Retención</th><th>Recargo</th><th>Origen</th></tr>${filas}</table></div>
    <p style="color:var(--tx2);margin-top:.8rem">Una combinación aplica a la vez el código de IVA, la retención y el recargo. Se elige en la factura o se deja como valor por defecto en la ficha del cliente o proveedor. Las preparadas no se pueden borrar; crea las tuyas con "+ Nueva combinación".</p>`, { tabs: ["Lista"] });
};
async function guardarCombos(lista) { const ex = S.d.manual.find(m => m.modelo === "combos"); await db.guardarManual({ id: ex ? ex.id : uid(), empresa_id: S.emp.id, modelo: "combos", ejercicio: 0, periodo: "-", datos: { lista } }); }

/* ---------------- Liquidaciones: IVA (303) y retenciones 111, 115 y 123 ---------------- */
// Se calculan con los saldos contables del período (no con los modelos), de modo que incluyen también lo registrado a mano (p. ej. DUAs).
const LIQ = { m303: { nombre: "IVA", modelo: "303" }, m111: { nombre: "retenciones IRPF 111", modelo: "111", cuentas: ["475100001", "475100002"] }, m115: { nombre: "retenciones IRPF 115", modelo: "115", cuentas: ["475100003"] }, m123: { nombre: "retenciones IRPF 123", modelo: "123", cuentas: ["475100004"] } };
const ctaLiq = { acre: "475000001", deud: "470000001" }; // IVA: H.P. acreedora (a ingresar) y H.P. deudora (a compensar o devolver)
function movsPeriodo(per, filtro) { // saldo (debe - haber) por cuenta de los asientos del período, sin contar las propias liquidaciones
  const [d, h] = rangoPeriodo(per), ids = new Set(S.d.asientos.filter(a => a.fecha >= d && a.fecha <= h && !(a.origen || "").startsWith("liquidacion")).map(a => a.id)), m = new Map();
  S.d.apuntes.filter(p => ids.has(p.asiento_id) && filtro(p.cuenta)).forEach(p => m.set(p.cuenta, r2((m.get(p.cuenta) || 0) + +p.debe - +p.haber)));
  return m;
}
function saldoAntes(per, filtro) { const [d] = rangoPeriodo(per), ids = new Set(S.d.asientos.filter(a => a.fecha < d).map(a => a.id)); return r2(S.d.apuntes.filter(p => ids.has(p.asiento_id) && filtro(p.cuenta)).reduce((a, p) => a + +p.debe - +p.haber, 0)); }
const liqClave = clave => `LIQ${LIQ[clave].modelo}-${S.ej}-${S.periodo}`;
const liqExistente = clave => S.d.asientos.find(a => a.documento === liqClave(clave) && (a.origen || "").startsWith("liquidacion"));
function liqPropuesta(clave) {
  const L = LIQ[clave], lineas = [], add = (cuenta, debe, haber, nota = "") => { debe = r2(debe); haber = r2(haber); if (debe || haber) lineas.push({ cuenta, debe, haber, nota }); };
  const r = { clave, lineas, resultado: 0, texto: "", tipo: "" };
  if (clave === "m303") {
    const rep = movsPeriodo(S.periodo, c => c.startsWith("477")), sop = movsPeriodo(S.periodo, c => c.startsWith("472"));
    rep.forEach((s, c) => s < 0 ? add(c, -s, 0, "IVA repercutido") : add(c, 0, s, "IVA repercutido"));
    sop.forEach((s, c) => s > 0 ? add(c, 0, s, "IVA soportado") : add(c, -s, 0, "IVA soportado"));
    const totRep = r2(-[...rep.values()].reduce((a, x) => a + x, 0)), totSop = r2([...sop.values()].reduce((a, x) => a + x, 0)), net = r2(totRep - totSop);
    const prev = Math.max(0, saldoAntes(S.periodo, c => c === ctaLiq.deud)); // IVA pendiente de compensar de períodos anteriores
    r.totRep = totRep; r.totSop = totSop; r.resultado = net; r.prev = prev;
    if (net > 0) { const comp = r2(Math.min(prev, net)); if (comp > 0) add(S.liqDeud || ctaLiq.deud, 0, comp, "Compensación de períodos anteriores"); add(S.liqAcre || ctaLiq.acre, 0, r2(net - comp), "Hacienda Pública acreedora por IVA (a ingresar)"); r.tipo = "acreedor"; r.comp = comp; }
    else if (net < 0) { add(S.liqDeud || ctaLiq.deud, -net, 0, "Hacienda Pública deudora por IVA (a compensar o devolver)"); r.tipo = "deudor"; }
    r.texto = net > 0 ? "Resultado A INGRESAR " + eur(net) + " €" + (r.comp ? " (se compensan " + eur(r.comp) + " € de períodos anteriores; queda a ingresar " + eur(r2(net - r.comp)) + " €)" : "") + ": se propone la cuenta acreedora." : net < 0 ? "Resultado A COMPENSAR / DEVOLVER " + eur(-net) + " €: se propone la cuenta deudora." : "Sin resultado en el período.";
  } else {
    const m = movsPeriodo(S.periodo, c => L.cuentas.includes(c)); let tot = 0;
    m.forEach((s, c) => { if (s < 0) { add(c, -s, 0, "Retenciones practicadas en el período"); tot = r2(tot - s); } else if (s > 0) { add(c, 0, s, "Retenciones practicadas en el período"); tot = r2(tot - s); } });
    r.resultado = tot; if (tot > 0) add(S.liqBanco || cuentaSis("572"), 0, tot, "Ingreso en Hacienda por banco"); else if (tot < 0) add(S.liqBanco || cuentaSis("572"), -tot, 0, "Devolución");
    r.texto = tot ? "Retenciones a ingresar: " + eur(tot) + " €." : "No hay retenciones contabilizadas en este período.";
  }
  const D = r2(lineas.reduce((a, l) => a + l.debe, 0)), H = r2(lineas.reduce((a, l) => a + l.haber, 0)); r.cuadra = D === H && D > 0; r.D = D; r.H = H;
  return r;
}
function panelLiq(clave) {
  const L = LIQ[clave], P = liqPropuesta(clave), ex = liqExistente(clave), [, hasta] = rangoPeriodo(S.periodo);
  const filas = P.lineas.map(l => `<tr><td>${esc(l.cuenta)}</td><td>${esc(nombreCuenta(l.cuenta))}</td><td>${esc(l.nota)}</td><td class="n">${l.debe ? eur(l.debe) : ""}</td><td class="n">${l.haber ? eur(l.haber) : ""}</td></tr>`).join("");
  const ctas = clave === "m303"
    ? `<label>Cuenta acreedora (a ingresar)<br><input id="liq-acre" list="dl" size="12" value="${esc(S.liqAcre || ctaLiq.acre)}"></label><label>Cuenta deudora (a compensar / devolver)<br><input id="liq-deud" list="dl" size="12" value="${esc(S.liqDeud || ctaLiq.deud)}"></label>`
    : `<label>Cuenta de tesorería<br><input id="liq-banco" list="dl" size="12" value="${esc(S.liqBanco || cuentaSis("572"))}"></label>`;
  return `<h3 style="margin-top:1.4rem">Liquidación ${L.nombre} · ${esc(nomPer())}</h3><div class="card">
   <datalist id="dl">${optsCuentas()}</datalist>
   ${ex ? `<p class="ok">Liquidación registrada: asiento nº ${ex.numero} del ${ex.fecha}.</p><div class="row"><button data-a="deshacerliq" data-k="${clave}">Deshacer liquidación (elimina el asiento)</button></div>`
        : `<p class="${P.tipo === "deudor" ? "ko" : ""}"><b>${esc(P.texto)}</b>${clave === "m303" && P.totRep !== undefined ? ` <span style="color:var(--tx2)">Repercutido ${eur(P.totRep)} − Soportado ${eur(P.totSop)}${P.comp ? ` · compensado de períodos anteriores ${eur(P.comp)}` : (P.prev ? ` · pendiente anterior ${eur(P.prev)}` : "")}</span>` : ""}</p>
   <div class="row">${ctas}<label>Fecha del asiento<br><input type="date" id="liq-fecha" value="${hasta}"></label></div>
   ${P.lineas.length ? `<table><tr><th>Cuenta</th><th>Nombre</th><th>Concepto</th><th class="n">Debe</th><th class="n">Haber</th></tr>${filas}<tr class="tot"><td colspan="3">Totales</td><td class="n">${eur(P.D)}</td><td class="n">${eur(P.H)}</td></tr></table>` : ""}
   <div class="row" style="margin-top:.6rem"><button class="p" data-a="generarliq" data-k="${clave}" ${P.cuadra ? "" : "disabled"}>Generar asiento de liquidación</button></div>`}</div>`;
}

/* ---------------- Inventario y pedidos de compra y de venta (como D365) ---------------- */
const r3 = n => Math.round((+n + Number.EPSILON) * 1000) / 1000;
const q3 = n => String(r3(n)).replace(".", ",");
const ART_TIPOS = ["Artículo", "Servicio"];
const artPorId = id => S.d.articulos.find(a => a.id === id);
const artPorCod = c => S.d.articulos.find(a => a.codigo.toLowerCase() === String(c).trim().toLowerCase());
const almPorId = id => S.d.almacenes.find(a => a.id === id);
const almNombre = id => (almPorId(id) || {}).nombre || "";
const movsArt = (aid, alm) => S.d.movinv.filter(m => m.articulo_id === aid && (!alm || m.almacen_id === alm));
const stockArt = (aid, alm) => r3(movsArt(aid, alm).reduce((a, m) => a + (+m.cantidad), 0));
function costeMedio(a) { // coste medio ponderado de las entradas (recepciones y ajustes positivos)
  let q = 0, v = 0; S.d.movinv.forEach(m => { if (m.articulo_id === a.id && (m.tipo === "Recepción" || m.tipo === "Ajuste") && +m.cantidad > 0) { q += +m.cantidad; v += +m.cantidad * (+m.coste || 0); } });
  return q ? v / q : (+a.precio_compra || 0);
}
async function asegurarAlmacen() {
  if (S.d.almacenes.length) return S.d.almacenes[0];
  const a = { id: uid(), empresa_id: S.emp.id, codigo: "ALM01", nombre: "Almacén principal", direccion: null };
  await db.guardarAlmacen(a); S.d.almacenes.push(a); return a;
}
function siguienteCod(lista, pref, n = 5) { let m = 0; for (const x of lista) { const k = new RegExp("^" + pref + "(\\d+)$").exec(x.codigo); if (k) m = Math.max(m, +k[1]); } return pref + String(m + 1).padStart(n, "0"); }
const siguientePed = tipo => { let m = 0; const pf = tipo === "V" ? "PV" : "PC"; for (const p of S.d.pedidos) { if (p.tipo !== tipo) continue; const k = /^P[VC](\d+)$/.exec(p.numero); if (k) m = Math.max(m, +k[1]); } return pf + String(m + 1).padStart(6, "0"); };
const plineasDe = p => S.d.plineas.filter(l => l.pedido_id === p.id).sort((a, b) => (+a.orden || 0) - (+b.orden || 0));
const netoPed = (p, l) => (+l.precio || 0) * (1 - (+l.dto_pct || 0) / 100) * (1 - (+p.dto_pct || 0) / 100);
function totalesPed(p, ls) {
  return totalesF(ls.map(l => { const c = CODIGO[l.cod_iva] || CODIGO[inferCod(p.tipo, 21)]; return { cantidad: +l.cantidad || 0, precio: netoPed(p, l), iva: c ? c.pct : 0, auto: !!c && (c.tipo === "ue" || c.tipo === "isp"), rec: l.cod_rec || "" }; }));
}
const esServ = l => { const a = artPorId(l.articulo_id); return !a || a.tipo === "Servicio"; };
const recibidoL = l => esServ(l) ? 0 : r3(S.d.movinv.filter(m => m.linea_id === l.id).reduce((a, m) => a + Math.abs(+m.cantidad), 0));
const facturadoL = l => r3(S.d.flineas.filter(x => x.pedido_linea_id === l.id).reduce((a, x) => a + (+x.cantidad || 0), 0));
const docsMov = p => [...new Set(S.d.movinv.filter(m => m.pedido_id === p.id).map(m => m.documento))].sort((a, b) => (+String(a).split("-").pop()) - (+String(b).split("-").pop()));
function estadoPed(p, ls) {
  if (p.estado === "cancelado") return "Cancelado";
  if (p.estado === "presupuesto") return "Presupuesto";
  const cli = p.tipo === "V", st = ls.filter(l => !esServ(l)), cant = l => +l.cantidad || 0;
  if (ls.length && ls.every(l => facturadoL(l) >= cant(l) && cant(l) > 0)) return "Facturado";
  if (ls.some(l => facturadoL(l) > 0)) return "Facturado parcialmente";
  if (st.length && st.every(l => recibidoL(l) >= cant(l))) return cli ? "Entregado" : "Recibido";
  if (st.some(l => recibidoL(l) > 0)) return (cli ? "Entregado" : "Recibido") + " parcialmente";
  return "Pedido abierto";
}
const campoE = (et, attr, root, path, o = {}) => {
  const v = getPath(root, path);
  if (o.check) return `<label class="chk"><input type="checkbox" data-${attr}="${path}" ${v ? "checked" : ""}> ${et}</label>`;
  if (o.opts) return `<label class="fld">${et}<select data-${attr}="${path}">${optsHtml(o.opts, v)}</select></label>`;
  return `<label class="fld">${et}<input data-${attr}="${path}" type="${o.tipo || "text"}" value="${esc(v ?? "")}" ${o.list ? `list="${o.list}"` : ""} ${o.ph ? `placeholder="${esc(o.ph)}"` : ""} ${o.ro ? "disabled" : ""}></label>`;
};

/* Artículos */
const artNuevo = () => ({ id: uid(), codigo: siguienteCod(S.d.articulos, "A"), nombre: "", tipo: "Artículo", unidad: "ud", grupo: "", cod_iva_c: "", cod_iva_v: "", cuenta_compra: "", cuenta_venta: "", precio_compra: "0", precio_venta: "0", stock_min: "0", activo: true, ficha: {} });
function vistaArticulos() {
  if (S.artEdit) return fichaArticulo();
  const L = [...S.d.articulos].sort((a, b) => a.codigo.localeCompare(b.codigo)), sel = L.find(a => a.id === S.selArt);
  const tot = a => a.tipo === "Servicio" ? "" : q3(stockArt(a.id));
  const filas = L.map(a => `<tr data-sel class="${a.id === S.selArt ? "sel" : ""}" data-a="selart" data-id="${a.id}"><td><a data-a="editart" data-id="${a.id}">${esc(a.codigo)}</a></td><td>${esc(a.nombre)}</td><td>${esc(a.tipo)}</td><td>${esc(a.grupo || "")}</td><td>${esc(a.unidad || "")}</td><td class="n">${eur(a.precio_compra)}</td><td class="n">${eur(a.precio_venta)}</td><td class="n">${tot(a)}</td><td>${a.activo === false ? "Bloqueado" : ""}</td></tr>`).join("");
  const acc = btn("nuevoart", "+ Nuevo") + btn("editart", "Editar", `data-id="${sel ? sel.id : ""}"`, !sel) + btn("delart", "Eliminar", "", !sel) + SEP + btn("verexist", "Existencias", "", !sel || sel.tipo === "Servicio");
  return pagina("Todos los artículos", acc, `<div class="pagina"><div class="lista"><table><tr><th>Número de artículo</th><th>Nombre</th><th>Tipo</th><th>Grupo de artículos</th><th>Unidad</th><th class="n">Precio de compra</th><th class="n">Precio de venta</th><th class="n">Existencias</th><th>Estado</th></tr>${filas || `<tr><td colspan="9" class="vacio">No se encontró ningún elemento que mostrar aquí.</td></tr>`}</table></div>
   <aside class="factbox"><h3>Información del artículo</h3>${sel ? `<dl><dt>Artículo</dt><dd>${esc(sel.codigo)}</dd><dt>Existencias</dt><dd>${sel.tipo === "Servicio" ? "—" : q3(stockArt(sel.id)) + " " + esc(sel.unidad || "")}</dd><dt>Coste medio</dt><dd>${sel.tipo === "Servicio" ? "—" : eur(costeMedio(sel))}</dd><dt>Valor</dt><dd>${sel.tipo === "Servicio" ? "—" : eur(stockArt(sel.id) * costeMedio(sel))}</dd><dt>En pedidos de compra</dt><dd>${q3(pendienteArt(sel, "C"))}</dd><dt>En pedidos de venta</dt><dd>${q3(pendienteArt(sel, "V"))}</dd></dl>` : `<p style="color:var(--tx2)">Seleccione un artículo.</p>`}</aside></div>`);
}
const pendienteArt = (a, tipo) => S.d.plineas.filter(l => l.articulo_id === a.id).reduce((s, l) => { const p = S.d.pedidos.find(x => x.id === l.pedido_id); return p && p.tipo === tipo && !["cancelado", "presupuesto"].includes(p.estado) ?s + Math.max(0, (+l.cantidad || 0) - recibidoL(l)) : s; }, 0);
function fichaArticulo() {
  const e = S.artEdit, ctas = movs();
  const acc = `<button class="p" data-a="guardarart">Guardar</button>` + btn("cancelart", "Cancelar");
  const gen = `<div class="fgrid"><div class="fcol"><h4>ARTÍCULO</h4>${campoE("Número de artículo", "ae", e, "codigo")}${campoE("Nombre", "ae", e, "nombre")}${campoE("Nombre de búsqueda", "ae", e, "ficha.busqueda")}${campoE("Tipo", "ae", e, "tipo", { opts: ART_TIPOS })}${campoE("Grupo de artículos", "ae", e, "grupo")}${campoE("Descripción", "ae", e, "ficha.descripcion")}</div>
    <div class="fcol"><h4>UNIDADES</h4>${campoE("Unidad de medida", "ae", e, "unidad", { list: "dlund" })}${campoE("Código de barras", "ae", e, "ficha.ean")}${campoE("Peso (kg)", "ae", e, "ficha.peso", { tipo: "number" })}${campoE("Bloqueado", "ae", e, "bloq", { check: true })}</div>
    <div class="fcol"><h4>IMPUESTOS Y COMERCIO EXTERIOR</h4>${campoE("Grupo de impuestos de artículos", "ae", e, "ficha.grupo_art", { opts: CF("gruposArt").map(g => [g.id, g.id + " · " + g.desc]) })}${campoE("Código Intrastat de la mercancía", "ae", e, "ficha.intrastat")}</div></div><datalist id="dlund">${["ud", "kg", "l", "m", "m²", "t", "caja", "h"].map(u => `<option value="${u}">`).join("")}</datalist>`;
  const comp = `<div class="fgrid"><div class="fcol"><h4>COMPRAS</h4>${campoE("Precio de compra", "ae", e, "precio_compra", { tipo: "number" })}${campoE("Código de impuestos (compras)", "ae", e, "cod_iva_c", { opts: codsLinea("C").map(c => [c.cod, c.cod + " · " + (c.pct ? String(c.pct).replace(".", ",") + " %" : c.nombre)]) })}${campoE("Cuenta de gastos (9 dígitos)", "ae", e, "cuenta_compra", { list: "dlcta", ph: "600…" })}${campoE("Proveedor principal", "ae", e, "ficha.proveedor", { list: "dlprov" })}</div></div>`;
  const vent = `<div class="fgrid"><div class="fcol"><h4>VENTAS</h4>${campoE("Precio de venta", "ae", e, "precio_venta", { tipo: "number" })}${campoE("Código de impuestos (ventas)", "ae", e, "cod_iva_v", { opts: codsLinea("V").map(c => [c.cod, c.cod + " · " + (c.pct ? String(c.pct).replace(".", ",") + " %" : c.nombre)]) })}${campoE("Cuenta de ingresos (9 dígitos)", "ae", e, "cuenta_venta", { list: "dlcta", ph: "700…" })}</div></div>`;
  const inv = `<div class="fgrid"><div class="fcol"><h4>INVENTARIO</h4>${campoE("Existencias mínimas", "ae", e, "stock_min", { tipo: "number" })}<label class="fld">Modelo de inventario<input value="Coste medio ponderado" disabled></label></div>
    <div class="fcol"><h4>CONTABILIDAD DE EXISTENCIAS</h4>${campoE("Cuenta de existencias (9 dígitos)", "ae", e, "ficha.cta_exist", { list: "dlcta", ph: CTA_EXIST })}${campoE("Cuenta de variación de existencias (9 dígitos)", "ae", e, "ficha.cta_var", { list: "dlcta", ph: CTA_VAR })}</div>
    <div class="fcol"><h4>EXISTENCIAS ACTUALES</h4>${S.d.articulos.some(a => a.id === e.id) ? S.d.almacenes.map(al => `<label class="fld">${esc(al.nombre)}<input disabled value="${q3(stockArt(e.id, al.id))}"></label>`).join("") || "<p>Sin almacenes.</p>" : "<p style='color:var(--tx2)'>Guarde el artículo para ver sus existencias.</p>"}</div></div>`;
  return pagina("Artículo", acc, `<datalist id="dlcta">${optsCuentas()}</datalist><datalist id="dlprov">${S.d.terceros.filter(t => t.tipo === "P").map(t => `<option value="${esc(t.codigo)}">${esc(t.nombre)}</option>`).join("")}</datalist>${secFicha("a_gen", "General", gen)}${secFicha("a_comp", "Compras", comp)}${secFicha("a_vent", "Ventas", vent)}${e.tipo === "Servicio" ? "" : secFicha("a_inv", "Gestión del inventario", inv)}`, { tabs: ["Ficha"], vista: e.codigo + (e.nombre ? " : " + e.nombre : "") });
}
async function guardarArt() {
  const e = S.artEdit, a = { id: e.id, empresa_id: S.emp.id, codigo: (e.codigo || "").trim(), nombre: (e.nombre || "").trim(), tipo: e.tipo || "Artículo", unidad: (e.unidad || "").trim() || "ud", grupo: (e.grupo || "").trim() || null, cod_iva_c: e.cod_iva_c || null, cod_iva_v: e.cod_iva_v || null, cuenta_compra: (e.cuenta_compra || "").trim() || null, cuenta_venta: (e.cuenta_venta || "").trim() || null, precio_compra: +num(e.precio_compra) || 0, precio_venta: +num(e.precio_venta) || 0, stock_min: +num(e.stock_min) || 0, activo: !e.bloq, ficha: e.ficha || {} };
  if (!a.codigo || !a.nombre) return alert("Faltan el número y el nombre del artículo.");
  if (S.d.articulos.some(x => x.id !== a.id && x.codigo.toLowerCase() === a.codigo.toLowerCase())) return alert("Ya existe ese número de artículo.");
  for (const [c, n] of [[a.cuenta_compra, "de gastos"], [a.cuenta_venta, "de ingresos"]]) if (c && !cuentaValida(c)) return alert("La cuenta " + n + " " + c + " no existe o no es de movimiento (9 dígitos).");
  for (const [k, n] of [["cta_exist", "de existencias"], ["cta_var", "de variación"]]) { const c = String(a.ficha[k] || "").trim(); a.ficha[k] = c; if (c && !esMov(c)) return alert("La cuenta " + n + " debe tener 9 dígitos."); }
  if (a.ficha.cta_exist && !a.ficha.cta_exist.startsWith("3")) return alert("La cuenta de existencias debe ser del grupo 3 (300, 310, 320, 350…).");
  if (a.ficha.cta_var && !/^(61|71)/.test(a.ficha.cta_var)) return alert("La cuenta de variación debe ser 61x o 71x.");
  await db.guardarArticulo(a); S.artEdit = null; S.selArt = a.id; await recargar();
}
V.articulos = vistaArticulos;

/* Almacenes */
V.almacenes = () => {
  const L = [...S.d.almacenes].sort((a, b) => a.codigo.localeCompare(b.codigo)), e = S.almEdit;
  const filas = L.map(a => `<tr data-sel data-a="editalm" data-id="${a.id}" class="${e && e.id === a.id ? "sel" : ""}"><td>${esc(a.codigo)}</td><td>${esc(a.nombre)}</td><td>${esc(a.direccion || "")}</td></tr>`).join("");
  const form = e ? `<div class="card"><b>${S.d.almacenes.some(a => a.id === e.id) ? "Editar almacén" : "Nuevo almacén"}</b><div class="row" style="margin-top:.5rem"><label>Almacén<br><input data-ak="codigo" size="10" value="${esc(e.codigo)}"></label><label>Nombre<br><input data-ak="nombre" size="26" value="${esc(e.nombre)}"></label><label>Dirección<br><input data-ak="direccion" size="36" value="${esc(e.direccion || "")}"></label><button class="p" data-a="guardaralm">Guardar</button><button data-a="cancelaralm">Cancelar</button></div></div>` : "";
  return pagina("Almacenes", btn("nuevoalm", "+ Nuevo") + btn("delalm", "Eliminar", "", !(e && S.d.almacenes.some(a => a.id === e.id))), `${form}<div class="pagina"><div class="lista"><table><tr><th>Almacén</th><th>Nombre</th><th>Dirección</th></tr>${filas || `<tr><td colspan="3" class="vacio">No se encontró ningún elemento que mostrar aquí.</td></tr>`}</table></div></div>`);
};

/* Existencias y transacciones de inventario */
V.existencias = () => {
  const f = S.filtroAlm, filas = [];
  S.d.articulos.filter(a => a.tipo !== "Servicio").sort((a, b) => a.codigo.localeCompare(b.codigo)).forEach(a => {
    const alms = S.d.almacenes.filter(al => (!f || al.id === f) && movsArt(a.id, al.id).length);
    const cm = costeMedio(a);
    (alms.length ? alms : (f ? [] : [null])).forEach(al => { const q = al ? stockArt(a.id, al.id) : 0; filas.push(`<tr class="${q < +a.stock_min ? "ko" : ""}"><td>${esc(a.codigo)}</td><td>${esc(a.nombre)}</td><td>${esc(al ? al.nombre : "")}</td><td class="n">${q3(q)}</td><td>${esc(a.unidad || "")}</td><td class="n">${eur(cm)}</td><td class="n">${eur(q * cm)}</td><td class="n">${q3(a.stock_min)}</td></tr>`); });
  });
  const A = S.ajuste;
  const form = A ? `<div class="card"><b>Ajuste de inventario</b><div class="row" style="margin-top:.5rem">
    <label>Operación<br><select data-aj="tipo">${optsHtml(["Ajuste", "Transferencia"], A.tipo).replace('<option value=""></option>', "")}</select></label>
    <label>Artículo<br><input data-aj="art" list="dlart" size="12" value="${esc(A.art)}"></label>
    <label>${A.tipo === "Transferencia" ? "Almacén origen" : "Almacén"}<br><select data-aj="alm">${optsHtml(S.d.almacenes.map(a => [a.id, a.codigo + " · " + a.nombre]), A.alm).replace('<option value=""></option>', "")}</select></label>
    ${A.tipo === "Transferencia" ? `<label>Almacén destino<br><select data-aj="alm2">${optsHtml(S.d.almacenes.map(a => [a.id, a.codigo + " · " + a.nombre]), A.alm2)}</select></label>` : ""}
    <label>Cantidad${A.tipo === "Transferencia" ? "" : " (+ entrada, − salida)"}<br><input data-aj="cant" size="8" value="${esc(A.cant)}"></label>
    ${A.tipo === "Transferencia" ? "" : `<label>Coste unitario<br><input data-aj="coste" size="8" value="${esc(A.coste)}" placeholder="coste medio"></label>`}
    <label>Fecha<br><input type="date" data-aj="fecha" value="${esc(A.fecha)}"></label><label>Notas<br><input data-aj="notas" size="22" value="${esc(A.notas)}"></label>
    <button class="p" data-a="guardaraj">Registrar</button><button data-a="cancelaraj">Cancelar</button></div>
    <datalist id="dlart">${S.d.articulos.filter(a => a.tipo !== "Servicio").map(a => `<option value="${esc(a.codigo)}">${esc(a.nombre)}</option>`).join("")}</datalist></div>` : "";
  const totalVal = r2(S.d.articulos.reduce((s, a) => s + stockArt(a.id) * costeMedio(a), 0));
  return pagina("Existencias disponibles", btn("nuevoaj", "Ajuste de inventario") + btn("verestado", "Transacciones de inventario"), `${form}<div class="pagina"><div class="lista"><table><tr><th>Artículo</th><th>Nombre</th><th>Almacén</th><th class="n">Existencias</th><th>Unidad</th><th class="n">Coste medio</th><th class="n">Valor</th><th class="n">Mínimo</th></tr>${filas.join("") || `<tr><td colspan="8" class="vacio">No se encontró ningún elemento que mostrar aquí.</td></tr>`}${filas.length ? `<tr class="tot"><td colspan="6">Valor total del inventario</td><td class="n">${eur(totalVal)}</td><td></td></tr>` : ""}</table></div></div>`,
    { filtros: `<label>Almacén<select id="fal"><option value="">Todos</option>${S.d.almacenes.map(a => `<option value="${a.id}" ${a.id === f ? "selected" : ""}>${esc(a.nombre)}</option>`).join("")}</select></label>`, vista: "Existencias" });
};
V.movinv = () => {
  const L = [...S.d.movinv].sort((a, b) => b.fecha.localeCompare(a.fecha) || String(b.creado || "").localeCompare(String(a.creado || ""))).slice(0, 500), sel = L.find(m => m.id === S.selMov);
  const filas = L.map(m => { const a = artPorId(m.articulo_id) || {}, p = S.d.pedidos.find(x => x.id === m.pedido_id); return `<tr data-sel data-a="selmov" data-id="${m.id}" class="${m.id === S.selMov ? "sel" : ""}"><td>${m.fecha}</td><td>${esc(a.codigo || "")}</td><td>${esc(a.nombre || "")}</td><td>${esc(almNombre(m.almacen_id))}</td><td>${esc(m.tipo)}</td><td class="n">${q3(m.cantidad)}</td><td class="n">${eur(m.coste)}</td><td>${esc(m.documento || "")}</td><td>${esc(p ? p.numero : "")}</td></tr>`; }).join("");
  return pagina("Transacciones de inventario", btn("eliminarmov", "Eliminar ajuste", "", !sel || !!sel.pedido_id), `<div class="pagina"><div class="lista"><table><tr><th>Fecha</th><th>Artículo</th><th>Nombre</th><th>Almacén</th><th>Tipo</th><th class="n">Cantidad</th><th class="n">Coste unitario</th><th>Documento</th><th>Pedido</th></tr>${filas || `<tr><td colspan="9" class="vacio">No se encontró ningún elemento que mostrar aquí.</td></tr>`}</table></div></div>`);
};
async function guardarAjuste() {
  const A = S.ajuste, a = artPorCod(A.art), cant = r3(+num(A.cant));
  if (!a || a.tipo === "Servicio") return alert("Elija un artículo de inventario.");
  if (!A.alm) return alert("Elija el almacén.");
  if (!cant) return alert("Indique la cantidad.");
  if (!A.fecha) return alert("Falta la fecha.");
  const base = { id: null, empresa_id: S.emp.id, fecha: A.fecha, articulo_id: a.id, pedido_id: null, linea_id: null, notas: A.notas || null, creado: new Date().toISOString() };
  const pf = A.tipo === "Transferencia" ? "TR" : "AJ", docs = new Set(S.d.movinv.filter(m => (m.documento || "").startsWith(pf)).map(m => m.documento)), doc = pf + String(docs.size + 1).padStart(6, "0");
  let ms;
  if (A.tipo === "Transferencia") {
    if (!A.alm2 || A.alm2 === A.alm) return alert("Elija un almacén de destino distinto del de origen.");
    if (cant < 0) return alert("En una transferencia la cantidad debe ser positiva.");
    if (stockArt(a.id, A.alm) < cant && !confirm("El almacén de origen tiene " + q3(stockArt(a.id, A.alm)) + " y se transfieren " + q3(cant) + ". ¿Continuar?")) return;
    const c = r2(costeMedio(a) * 10000) / 10000;
    ms = [{ ...base, id: uid(), almacen_id: A.alm, tipo: "Transferencia", cantidad: -cant, coste: c, documento: doc }, { ...base, id: uid(), almacen_id: A.alm2, tipo: "Transferencia", cantidad: cant, coste: c, documento: doc }];
  } else {
    if (cant < 0 && stockArt(a.id, A.alm) + cant < 0 && !confirm("Las existencias quedarán en negativo (" + q3(stockArt(a.id, A.alm) + cant) + "). ¿Continuar?")) return;
    const coste = A.coste === "" ? costeMedio(a) : +num(A.coste) || 0;
    ms = [{ ...base, id: uid(), almacen_id: A.alm, tipo: "Ajuste", cantidad: cant, coste: Math.round(coste * 10000) / 10000, documento: doc }];
  }
  await db.guardarMovs(ms); S.ajuste = null; await recargar();
}

/* Pedidos de compra y de venta */
// código de impuestos de un artículo para un tercero: por grupos de impuestos si el artículo tiene grupo; si no, el suyo o el del tercero
const codArtPed = (a, t, tipo) => (a && codigoPorGrupos(grupoImpDe(t, tipo), (a.ficha || {}).grupo_art || parm("cont", "grupoArt", ""))) || (a && (tipo === "V" ? a.cod_iva_v : a.cod_iva_c)) || codDefecto(t, tipo);
const nuevaLineaPed = p => {
  const t = terPorId(p.tercero_id), cod = codDefecto(t, p.tipo);
  return { id: uid(), articulo_id: null, descripcion: "", almacen_id: p.almacen_id || null, cantidad: 1, unidad: "", precio: 0, dto_pct: 0, cod_iva: cod, cod_rec: p.tipo === "V" && aplicaRec(t) ? recDeCodigo(cod) : "", tocado: false };
};
const fichaPedBase = () => ({ ref: "", modo: "", cond_ent: "", cond: "", forma: "", cod_ret: "", notas: "" });
function abrirPedido(id) {
  const p = S.d.pedidos.find(x => x.id === id); if (!p) return;
  S.ped = { p: { ...p, ficha: { ...fichaPedBase(), ...(p.ficha || {}) } }, ls: plineasDe(p).map(l => ({ ...l })), fechaMov: hoy() }; S.selPed = id; S.tabs.ped = "Líneas"; render();
}
function vistaPedidos(tipo) {
  if (S.ped && S.ped.p.tipo === tipo) return vistaPedidoEdit();
  const cli = tipo === "V", L = S.d.pedidos.filter(p => p.tipo === tipo && p.estado !== "presupuesto").sort((a, b) => b.numero.localeCompare(a.numero)), sel = L.find(p => p.id === S.selPed);
  const filas = L.map(p => { const t = terPorId(p.tercero_id) || {}, ls = plineasDe(p); return `<tr data-sel class="${p.id === S.selPed ? "sel" : ""}" data-a="selped" data-id="${p.id}"><td><a data-a="abrirped" data-id="${p.id}">${esc(p.numero)}</a></td><td>${esc(t.codigo || "")}</td><td>${esc(t.nombre || "")}</td><td>${p.fecha || ""}</td><td>${p.fecha_entrega || ""}</td><td>${esc(almNombre(p.almacen_id))}</td><td>${estadoPed(p, ls)}</td><td>EUR</td><td class="n">${eur(totalesPed(p, ls).total)}</td></tr>`; }).join("");
  const acc = btn("nuevoped", "+ Nuevo", `data-t="${tipo}"`) + btn("abrirped", "Editar", `data-id="${sel ? sel.id : ""}"`, !sel) + btn("delped", "Eliminar", "", !sel);
  const fs = sel ? S.d.facturas.filter(f => f.pedido_id === sel.id) : [];
  return pagina(cli ? "Todos los pedidos de venta" : "Todos los pedidos de compra", acc, `<div class="pagina"><div class="lista"><table><tr><th>${cli ? "Pedido de ventas" : "Pedido de compra"}</th><th>${cli ? "Cuenta de cliente" : "Cuenta de proveedor"}</th><th>${cli ? "Nombre del cliente" : "Nombre del proveedor"}</th><th>Fecha del pedido</th><th>${cli ? "Fecha de entrega" : "Fecha de recepción solicitada"}</th><th>Almacén</th><th>Estado</th><th>Divisa</th><th class="n">Importe</th></tr>${filas || `<tr><td colspan="9" class="vacio">No se encontró ningún elemento que mostrar aquí.</td></tr>`}</table></div>
   <aside class="factbox"><h3>Detalles del pedido</h3>${sel ? `<dl><dt>Pedido</dt><dd>${esc(sel.numero)}</dd><dt>Estado</dt><dd>${estadoPed(sel, plineasDe(sel))}</dd><dt>Líneas</dt><dd>${plineasDe(sel).length}</dd><dt>Facturas</dt><dd>${fs.map(f => `<a data-a="factdeped" data-id="${f.id}" data-t="${f.tipo}">${esc(f.numero)}</a>`).join(", ") || "—"}</dd></dl>` : `<p style="color:var(--tx2)">Seleccione un pedido.</p>`}</aside></div>`);
}
V.pcompra = () => vistaPedidos("C");
V.pventa = () => vistaPedidos("V");
function vistaPedidoEdit() {
  const { p, ls } = S.ped, cli = p.tipo === "V", t = terPorId(p.tercero_id), guardado = S.d.pedidos.some(x => x.id === p.id), pres = p.estado === "presupuesto", canc = p.estado === "cancelado" || pres, tab = S.tabs.ped || "Líneas";
  const est = estadoPed(p, ls), tot = totalesPed(p, ls), hayDocs = guardado && docsMov(p).length > 0;
  const acc = pres ? btn("volverped", "← " + (cli ? "Presupuestos" : "Cotizaciones")) + btn("guardarped", "Guardar") + SEP + `<button class="p" data-a="convertirpres" ${guardado ? "" : "disabled"}>Convertir en pedido</button>` + btn("imprimirpres", "Vista de impresión", "", !guardado) :btn("volverped", "← Pedidos") + btn("guardarped", "Guardar") + SEP + btn("recibirped", cli ? "Registrar entrega" : "Registrar recepción", "", !guardado || canc) + btn("deshacerrec", cli ? "Deshacer última entrega" : "Deshacer última recepción", "", !hayDocs) + SEP + `<button class="p" data-a="facturarped" ${!guardado || canc ? "disabled" : ""}>Generar factura</button>` + SEP + btn("cancelarped", canc ? "Reabrir pedido" : "Cancelar pedido", "", !guardado);
  const fx = S.d.facturas.filter(f => f.pedido_id === p.id);
  let cuerpo;
  if (tab === "Encabezado") {
    const gen = `<div class="fgrid"><div class="fcol"><h4>${cli ? "PEDIDO DE VENTAS" : "PEDIDO DE COMPRA"}</h4><label class="fld">Pedido<input disabled value="${esc(p.numero)}"></label><label class="fld">Estado<input disabled value="${esc(est)}"></label>${campoE(cli ? "Referencia del cliente" : "Referencia del proveedor", "pe", p, "ficha.ref")}</div>
      <div class="fcol"><h4>${cli ? "CLIENTE" : "PROVEEDOR"}</h4><label class="fld">Cuenta<input disabled value="${esc(t ? t.codigo : "")}"></label><label class="fld">Nombre<input disabled value="${esc(t ? t.nombre : "")}"></label><label class="fld">NIF<input disabled value="${esc(t ? t.cif || "" : "")}"></label><label class="fld">Grupo de impuestos<input disabled value="${esc(t ? t.grupo_iva : "")}"></label></div></div>`;
    const ent = `<div class="fgrid"><div class="fcol">${campoE("Almacén", "pe", p, "almacen_id", { opts: S.d.almacenes.map(a => [a.id, a.codigo + " · " + a.nombre]) })}${campoE(cli ? "Fecha de entrega" : "Fecha de recepción solicitada", "pe", p, "fecha_entrega", { tipo: "date" })}${campoE("Modo de entrega", "pe", p, "ficha.modo")}${campoE("Condiciones de entrega", "pe", p, "ficha.cond_ent", { opts: INCOTERMS })}</div></div>`;
    const pre = `<div class="fgrid"><div class="fcol"><h4>PAGO</h4>${campoE("Condiciones de pago", "pe", p, "ficha.cond", { opts: CONDICIONES.map(c => [c[0], c[1]]) })}${campoE("Forma de pago", "pe", p, "ficha.forma", { opts: FORMAS_PAGO })}</div>
      <div class="fcol"><h4>DESCUENTO</h4>${campoE("Descuento total (%)", "pe", p, "dto_pct", { tipo: "number" })}</div>
      <div class="fcol"><h4>IMPUESTOS</h4>${campoE(cli ? "Retención que nos practica el cliente" : "Retención de IRPF", "pe", p, "ficha.cod_ret", { opts: codsRet(p.tipo).map(c => [c.cod, c.cod + " · " + String(c.pct).replace(".", ",") + " %"]) })}</div></div>`;
    cuerpo = `${secFicha("p_gen", "General", gen)}${secFicha("p_ent", "Entrega", ent)}${secFicha("p_pre", "Precio y descuento", pre)}${secFicha("p_not", "Notas", `<div class="fgrid"><div class="fcol">${campoE("Notas internas", "pe", p, "ficha.notas")}</div></div>`)}`;
  } else {
    const cab = `<div class="card"><div class="row">
      <label>${cli ? "Cliente" : "Proveedor"}<br><input data-pe="tercero" list="dlter" size="12" value="${esc(t ? t.codigo : "")}"></label><span style="min-width:14rem">${esc(t ? t.nombre : "")}</span>
      <label>Fecha del pedido<br><input type="date" data-pe="fecha" value="${p.fecha || ""}"></label>
      <label>${cli ? "Fecha de entrega" : "Fecha de recepción"}<br><input type="date" data-pe="fecha_entrega" value="${p.fecha_entrega || ""}"></label>
      <label>Almacén<br><select data-pe="almacen_id">${optsHtml(S.d.almacenes.map(a => [a.id, a.codigo + " · " + a.nombre]), p.almacen_id)}</select></label>
      <label>Estado<br><b>${est}</b></label>
      ${guardado ? `<label>${cli ? "Fecha de la entrega" : "Fecha de la recepción"}<br><input type="date" data-pe="fechaMov" value="${S.ped.fechaMov || hoy()}"></label>` : ""}</div></div>
      <datalist id="dlter">${S.d.terceros.filter(x => x.tipo === (cli ? "C" : "P")).map(x => `<option value="${esc(x.codigo)}">${esc(x.nombre)}</option>`).join("")}</datalist>
      <datalist id="dlart">${S.d.articulos.filter(a => a.activo !== false).map(a => `<option value="${esc(a.codigo)}">${esc(a.nombre)}</option>`).join("")}</datalist>`;
    const filas = ls.map((l, i) => { const a = artPorId(l.articulo_id), rec = recibidoL(l), pend = Math.max(0, r3((+l.cantidad || 0) - rec)), svc = esServ(l);
      return `<tr><td>${i + 1}</td><td><input data-pl="${i}" data-k="art" list="dlart" size="9" value="${esc(a ? a.codigo : "")}"></td><td><input data-pl="${i}" data-k="descripcion" size="28" value="${esc(l.descripcion || "")}"></td>
       <td><select data-pl="${i}" data-k="almacen_id">${optsHtml(S.d.almacenes.map(x => [x.id, x.codigo]), l.almacen_id)}</select></td>
       <td><input class="n" data-pl="${i}" data-k="cantidad" size="7" value="${l.cantidad}"></td><td>${esc(l.unidad || (a ? a.unidad : "") || "")}</td><td><input class="n" data-pl="${i}" data-k="precio" size="9" value="${l.precio}"></td><td><input class="n" data-pl="${i}" data-k="dto_pct" size="4" value="${l.dto_pct || 0}"></td>
       <td><select data-pl="${i}" data-k="cod_iva">${optsHtml(codsLinea(p.tipo).map(c => [c.cod, c.cod + " · " + (c.pct ? String(c.pct).replace(".", ",") + " %" : c.nombre)]), l.cod_iva)}</select></td>
       ${cli ? `<td><select data-pl="${i}" data-k="cod_rec">${optsHtml(codsRec().filter(c => c.cod === recDeCodigo(l.cod_iva)).map(c => [c.cod, c.cod + " · " + String(c.pct).replace(".", ",") + " %"]), l.cod_rec)}</select></td>` : ""}
       <td class="n" data-pimp="${i}">${eur(importeL(p, l))}</td><td class="n">${guardado && !svc ? q3(rec) : ""}</td><td class="n">${guardado ? q3(facturadoL(l)) : ""}</td>
       <td>${guardado && !svc ? `<input class="n" data-pl="${i}" data-k="ahora" size="6" value="${l.ahora === undefined ? q3(pend) : l.ahora}">` : ""}</td><td><button class="d" data-a="dellineaped" data-i="${i}">✕</button></td></tr>`; }).join("");
    cuerpo = `${cab}<div class="pagina"><div class="lista"><table class="editable"><tr><th>Línea</th><th>Artículo</th><th>Descripción</th><th>Almacén</th><th class="n">Cantidad</th><th>Unidad</th><th class="n">Precio unitario</th><th class="n">% descuento</th><th>Código de impuestos</th>${cli ? "<th>Recargo</th>" : ""}<th class="n">Importe neto</th><th class="n">${cli ? "Entregado" : "Recibido"}</th><th class="n">Facturado</th><th class="n">${cli ? "Entregar ahora" : "Recibir ahora"}</th><th></th></tr>${filas}</table>
      <div class="row" style="margin-top:.5rem"><button data-a="addlineaped">+ Línea</button></div><div class="pie" id="piePed">${piePed(p, ls)}</div></div>
      <aside class="factbox"><h3>${cli ? "Cliente" : "Proveedor"}</h3>${t ? `<dl><dt>Cuenta</dt><dd>${esc(t.codigo)}</dd><dt>NIF</dt><dd>${esc(t.cif || "")}</dd><dt>Saldo</dt><dd>${eur(saldoTer(t))}</dd></dl>` : `<p style="color:var(--tx2)">Seleccione ${cli ? "un cliente" : "un proveedor"}.</p>`}
      <h3 style="margin-top:1rem">Facturas</h3>${fx.length ? `<dl>${fx.map(f => `<dt><a data-a="factdeped" data-id="${f.id}" data-t="${f.tipo}">${esc(f.numero)}</a></dt><dd>${estadoF(f)}</dd>`).join("")}</dl>` : `<p style="color:var(--tx2)">Sin facturas.</p>`}</aside></div>`;
  }
  return pagina(cli ? "Pedido de ventas" : "Pedido de compra", acc, cuerpo, { tabs: ["Líneas", "Encabezado"], tabKey: "ped", vista: `${p.numero}${t ? " · " + t.nombre : ""}` });
}
const importeL = (p, l) => r2((+l.cantidad || 0) * netoPed(p, l));
const piePed = (p, ls) => { const tot = totalesPed(p, ls); return `<span>Base imponible <b>${eur(tot.base)}</b></span><span>IVA <b>${eur(tot.cuota)}</b></span>${tot.cuotaA ? `<span>IVA autorrepercutido <b>${eur(tot.cuotaA)}</b></span>` : ""}${tot.rec ? `<span>Recargo <b>${eur(tot.rec)}</b></span>` : ""}<span>Total <b>${eur(tot.total)}</b></span>`; };
function refrescaPed() {
  const { p, ls } = S.ped, e = document.getElementById("piePed"); if (e) e.innerHTML = piePed(p, ls);
  document.querySelectorAll("[data-pimp]").forEach(td => { const l = ls[+td.dataset.pimp]; td.textContent = l ? eur(importeL(p, l)) : ""; });
}
async function guardarPed(silencioso) {
  const { p, ls } = S.ped, t = terPorId(p.tercero_id), fila = x => (x === "" || x === undefined) ? null : x;
  if (!t) { alert("Falta " + (p.tipo === "V" ? "el cliente." : "el proveedor.")); return false; }
  const val = ls.filter(l => l.articulo_id || (l.descripcion || "").trim());
  if (!val.length) { alert("El pedido no tiene líneas."); return false; }
  const pdb = { id: p.id, empresa_id: S.emp.id, tipo: p.tipo, numero: p.numero, tercero_id: p.tercero_id, fecha: fila(p.fecha), fecha_entrega: fila(p.fecha_entrega), almacen_id: p.almacen_id || null, estado: p.estado || "abierto", dto_pct: +num(p.dto_pct) || 0, ficha: p.ficha || {} };
  const ldb = val.map((l, i) => ({ id: l.id, pedido_id: p.id, empresa_id: S.emp.id, orden: i, articulo_id: l.articulo_id || null, descripcion: l.descripcion || null, almacen_id: l.almacen_id || null, cantidad: +l.cantidad || 0, unidad: l.unidad || null, precio: +l.precio || 0, dto_pct: +l.dto_pct || 0, cod_iva: l.cod_iva || null, cod_rec: l.cod_rec || null }));
  await db.guardarPedido(pdb, ldb);
  S.d = await db.cargar(S.emp.id); S.ped.ls = S.ped.ls.filter(l => val.includes(l)); if (!silencioso) render(); return true;
}
async function registrarMovPed() {
  const cli = S.ped.p.tipo === "V";
  if (!(await guardarPed(true))) return;
  const { p, ls } = S.ped, fecha = S.ped.fechaMov || hoy(), n = docsMov(p).length + 1, doc = (cli ? "ENT" : "REC") + "-" + p.numero + "-" + n, ms = [], acum = new Map();
  for (const l of ls) {
    const a = artPorId(l.articulo_id); if (!a || a.tipo === "Servicio") continue;
    const pend = r3((+l.cantidad || 0) - recibidoL(l)), q = r3(l.ahora === undefined ? pend : (+l.ahora || 0)); if (q <= 0) continue;
    const alm = l.almacen_id || p.almacen_id; if (!alm) return alert("Falta el almacén en la línea de " + a.codigo + ".");
    if (q > pend && !confirm("Se " + (cli ? "entregan " : "reciben ") + q3(q) + " de " + a.codigo + " y solo hay " + q3(pend) + " pendientes. ¿Continuar?")) return;
    if (cli) { const k = a.id + "|" + alm, ya = acum.get(k) || 0; if (stockArt(a.id, alm) - ya - q < 0 && !confirm("Las existencias de " + a.codigo + " en " + almNombre(alm) + " quedarán en negativo. ¿Continuar?")) return; acum.set(k, ya + q); }
    ms.push({ id: uid(), empresa_id: S.emp.id, fecha, articulo_id: a.id, almacen_id: alm, tipo: cli ? "Entrega" : "Recepción", cantidad: cli ? -q : q, coste: Math.round((cli ? costeMedio(a) : netoPed(p, l)) * 10000) / 10000, pedido_id: p.id, linea_id: l.id, documento: doc, notas: null, creado: new Date().toISOString() });
  }
  if (!ms.length) return alert(cli ? "No hay nada que entregar." : "No hay nada que recibir.");
  await db.guardarMovs(ms); await guardarAlb({ doc, tipo: p.tipo, num: siguienteAlb(p.tipo), tercero_id: p.tercero_id, externo: "", transporte: (p.ficha || {}).modo || "", matricula: "", bultos: "", notas: "", det: {} });
  S.d = await db.cargar(S.emp.id); S.ped.ls.forEach(l => { l.ahora = undefined; }); render();
  alert("Registrado el albarán " + albaran(p.tipo, doc).num + ". Lo tiene en Albaranes, donde puede descargar el PDF.");
}
async function deshacerMovPed() {
  const { p } = S.ped, docs = docsMov(p), ult = docs[docs.length - 1]; if (!ult) return;
  const ms = S.d.movinv.filter(m => m.pedido_id === p.id && m.documento === ult);
  for (const l of S.ped.ls) { const q = ms.filter(m => m.linea_id === l.id).reduce((s, m) => s + Math.abs(+m.cantidad), 0); if (q && r3(recibidoL(l) - q) < facturadoL(l)) return alert("La línea de " + (l.descripcion || "") + " ya está facturada por una cantidad mayor. Elimine antes la factura."); }
  if (!confirm("¿Deshacer " + ult + "? Se eliminarán sus " + ms.length + " movimientos de inventario.")) return;
  await db.borrarMovs(ms.map(m => m.id)); S.d = await db.cargar(S.emp.id); render();
}
async function facturarPed() {
  if (!(await guardarPed(true))) return;
  const { p, ls } = S.ped, cli = p.tipo === "V", t = terPorId(p.tercero_id), fl = [];
  for (const l of ls) {
    const q = r3((esServ(l) ? (+l.cantidad || 0) : recibidoL(l)) - facturadoL(l)); if (q <= 0) continue;
    const a = artPorId(l.articulo_id), c = CODIGO[l.cod_iva];
    fl.push({ id: null, descripcion: l.descripcion || (a ? a.nombre : ""), cuenta: (a && (cli ? a.cuenta_venta : a.cuenta_compra)) || primeraCuenta(cli ? "700" : "600"), cantidad: q, precio: Math.round(netoPed(p, l) * 10000) / 10000, iva: c ? c.pct : 0, cod: l.cod_iva || "", rec: l.cod_rec || "", auto: !!c && (c.tipo === "ue" || c.tipo === "isp"), pedido_linea_id: l.id, tocado: true });
  }
  if (!fl.length) return alert(cli ? "No hay nada pendiente de facturar. Registre antes la entrega." : "No hay nada pendiente de facturar. Registre antes la recepción.");
  const pg = (t && t.ficha && t.ficha.pago) || {}, cond = p.ficha.cond ? { ficha: { pago: { cond: p.ficha.cond, dia: pg.dia } } } : t;
  const f = { id: uid(), empresa_id: S.emp.id, tipo: p.tipo, numero: siguienteFact(p.tipo), tercero_id: p.tercero_id, num_externo: "", fecha_emision: hoy(), fecha_registro: hoy(), fecha_iva: hoy(), fecha_vencimiento: calcVenc(cond, hoy()), vencAuto: true, estado: "abierto", asiento_id: null, notas: "Pedido " + p.numero, retencion_tipo: "", retencion_pct: 0, pedido_id: p.id };
  const rc = p.ficha.cod_ret || (t && t.ficha && t.ficha.cod_ret); if (rc) aplicarRet(f, rc);
  S.fact = { f, ls: fl }; await guardarFactura();
  S.ped = null; S.vista = cli ? "fventa" : "fcompra"; S.selFact = f.id; await recargar();
}
function aplicarTerceroPed(x) { // al elegir proveedor/cliente: condiciones de pago, retención y códigos de impuestos de sus líneas
  const { p, ls } = S.ped, fi = (x && x.ficha) || {};
  p.tercero_id = x ? x.id : null;
  if (x) { p.ficha.cond = (fi.pago || {}).cond || p.ficha.cond; p.ficha.forma = (fi.pago || {}).forma || p.ficha.forma; if (fi.cod_ret) p.ficha.cod_ret = fi.cod_ret; }
  ls.forEach(l => { if (!l.tocado) { l.cod_iva = codDefecto(x, p.tipo); l.cod_rec = p.tipo === "V" && aplicaRec(x) ? recDeCodigo(l.cod_iva) : ""; } });
}
function cambioInv(t) { // cambios en formularios del inventario y los pedidos; devuelve true si lo ha tratado
  const d = t.dataset; if (!d) return false;
  if (d.ae !== undefined) { setPath(S.artEdit, d.ae, t.type === "checkbox" ? t.checked : t.value); if (d.ae === "tipo") render(); return true; }
  if (d.ak !== undefined) { S.almEdit[d.ak] = t.value; return true; }
  if (d.aj !== undefined) { S.ajuste[d.aj] = t.value; if (d.aj === "tipo") render(); return true; }
  if (t.id === "fal") { S.filtroAlm = t.value; render(); return true; }
  if (d.pe !== undefined) {
    const { p } = S.ped, k = d.pe;
    if (k === "tercero") {
      const x = t.value.trim() ? terPorCod(t.value) : null, tp = p.tipo === "V" ? "C" : "P";
      if (t.value.trim() && (!x || x.tipo !== tp)) { alert("No existe esa cuenta de " + (tp === "C" ? "cliente." : "proveedor.")); aplicarTerceroPed(null); } else aplicarTerceroPed(x);
      render();
    } else if (k === "fechaMov") S.ped.fechaMov = t.value;
    else if (k === "almacen_id") { const ant = p.almacen_id; p.almacen_id = t.value; S.ped.ls.forEach(l => { if (!l.almacen_id || l.almacen_id === ant) l.almacen_id = t.value; }); render(); }
    else { setPath(p, k, t.type === "checkbox" ? t.checked : (k === "dto_pct" ? (+num(t.value) || 0) : t.value)); if (k === "dto_pct") refrescaPed(); }
    return true;
  }
  if (d.pl !== undefined) {
    const { p } = S.ped, l = S.ped.ls[+d.pl], k = d.k, t0 = terPorId(p.tercero_id);
    if (k === "art") {
      const a = t.value.trim() ? artPorCod(t.value) : null;
      if (t.value.trim() && !a) { alert("No existe ese artículo."); l.articulo_id = null; }
      else if (a) { l.articulo_id = a.id; l.descripcion = a.nombre; l.unidad = a.unidad || ""; l.precio = +(p.tipo === "V" ? a.precio_venta : a.precio_compra) || 0; const cod = codArtPed(a, t0, p.tipo); l.cod_iva = cod; l.cod_rec = p.tipo === "V" && aplicaRec(t0) ? recDeCodigo(cod) : ""; l.tocado = true; }
      else l.articulo_id = null;
      render();
    } else if (k === "cod_iva") { l.cod_iva = t.value; l.tocado = true; if (l.cod_rec || (p.tipo === "V" && aplicaRec(t0))) l.cod_rec = recDeCodigo(t.value); render(); }
    else if (k === "cantidad" || k === "precio" || k === "dto_pct" || k === "ahora") { l[k] = +num(t.value) || 0; refrescaPed(); }
    else l[k] = t.value;
    return true;
  }
  return false;
}
async function accionInv(a, b) { // clics del inventario y los pedidos; devuelve true si lo ha tratado
  const id = b.dataset.id;
  switch (a) {
    case "selart": S.selArt = id; render(); return true;
    case "nuevoart": S.artEdit = artNuevo(); render(); return true;
    case "editart": { const x = artPorId(id || S.selArt); if (x) { S.artEdit = JSON.parse(JSON.stringify(x)); S.artEdit.ficha = S.artEdit.ficha || {}; S.artEdit.bloq = x.activo === false; S.selArt = x.id; render(); } return true; }
    case "cancelart": S.artEdit = null; render(); return true;
    case "guardarart": await guardarArt(); return true;
    case "delart": {
      const x = artPorId(S.selArt); if (!x) return true;
      if (S.d.movinv.some(m => m.articulo_id === x.id) || S.d.plineas.some(l => l.articulo_id === x.id)) { alert("El artículo tiene movimientos o pedidos y no se puede eliminar. Puede bloquearlo."); return true; }
      if (confirm("¿Eliminar " + x.codigo + " " + x.nombre + "?")) { await db.borrarArticulo(x.id); S.selArt = null; await recargar(); }
      return true;
    }
    case "verexist": { S.vista = "existencias"; S.filtroAlm = ""; render(); return true; }
    case "verestado": S.vista = "movinv"; render(); return true;
    case "nuevoalm": S.almEdit = { id: uid(), codigo: siguienteCod(S.d.almacenes, "ALM", 2), nombre: "", direccion: "" }; render(); return true;
    case "editalm": { const x = almPorId(id); if (x) { S.almEdit = { ...x }; render(); } return true; }
    case "cancelaralm": S.almEdit = null; render(); return true;
    case "guardaralm": {
      const e = S.almEdit, x = { id: e.id, empresa_id: S.emp.id, codigo: (e.codigo || "").trim(), nombre: (e.nombre || "").trim(), direccion: (e.direccion || "").trim() || null };
      if (!x.codigo || !x.nombre) { alert("Faltan el código y el nombre."); return true; }
      if (S.d.almacenes.some(y => y.id !== x.id && y.codigo.toLowerCase() === x.codigo.toLowerCase())) { alert("Ya existe ese almacén."); return true; }
      await db.guardarAlmacen(x); S.almEdit = null; await recargar(); return true;
    }
    case "delalm": {
      const x = S.almEdit && almPorId(S.almEdit.id); if (!x) return true;
      if (S.d.movinv.some(m => m.almacen_id === x.id) || S.d.pedidos.some(p => p.almacen_id === x.id)) { alert("El almacén tiene movimientos o pedidos y no se puede eliminar."); return true; }
      if (confirm("¿Eliminar el almacén " + x.nombre + "?")) { await db.borrarAlmacen(x.id); S.almEdit = null; await recargar(); }
      return true;
    }
    case "nuevoaj": { const al = await asegurarAlmacen(); S.ajuste = { tipo: "Ajuste", art: "", alm: S.filtroAlm || al.id, alm2: "", cant: "", coste: "", fecha: hoy(), notas: "" }; render(); return true; }
    case "cancelaraj": S.ajuste = null; render(); return true;
    case "guardaraj": await guardarAjuste(); return true;
    case "selmov": S.selMov = id; render(); return true;
    case "eliminarmov": {
      const m = S.d.movinv.find(x => x.id === S.selMov); if (!m || m.pedido_id) return true;
      if (m.tipo === "Entrega" || m.tipo === "Recepción") { alert("Es un movimiento de albarán: anúlelo desde la pantalla de Albaranes."); return true; }
      const ids = S.d.movinv.filter(x => x.documento === m.documento && !x.pedido_id).map(x => x.id);
      if (confirm("¿Eliminar " + m.documento + " (" + ids.length + " movimiento" + (ids.length > 1 ? "s" : "") + ")?")) { await db.borrarMovs(ids); S.selMov = null; await recargar(); }
      return true;
    }
    case "selped": S.selPed = id; render(); return true;
    case "nuevoped": {
      const tp = b.dataset.t, al = await asegurarAlmacen(), p = { id: uid(), empresa_id: S.emp.id, tipo: tp, numero: siguientePed(tp), tercero_id: null, fecha: hoy(), fecha_entrega: "", almacen_id: al.id, estado: "abierto", dto_pct: 0, ficha: fichaPedBase() };
      S.ped = { p, ls: [nuevaLineaPed(p)], fechaMov: hoy() }; S.tabs.ped = "Líneas"; render(); return true;
    }
    case "abrirped": abrirPedido(id || S.selPed); return true;
    case "volverped": S.ped = null; await recargar(); return true;
    case "guardarped": await guardarPed(); return true;
    case "addlineaped": S.ped.ls.push(nuevaLineaPed(S.ped.p)); render(); return true;
    case "dellineaped": {
      const l = S.ped.ls[+b.dataset.i]; if (l && (recibidoL(l) > 0 || facturadoL(l) > 0)) { alert("La línea tiene " + (S.ped.p.tipo === "V" ? "entregas" : "recepciones") + " o facturas y no se puede quitar."); return true; }
      S.ped.ls.splice(+b.dataset.i, 1); if (!S.ped.ls.length) S.ped.ls.push(nuevaLineaPed(S.ped.p)); render(); return true;
    }
    case "recibirped": await registrarMovPed(); return true;
    case "deshacerrec": await deshacerMovPed(); return true;
    case "facturarped": await facturarPed(); return true;
    case "cancelarped": {
      const { p, ls } = S.ped;
      if (p.estado !== "cancelado" && ls.some(l => recibidoL(l) > 0 || facturadoL(l) > 0)) { alert("El pedido ya tiene movimientos o facturas y no se puede cancelar."); return true; }
      p.estado = p.estado === "cancelado" ? "abierto" : "cancelado"; await guardarPed(); return true;
    }
    case "delped": {
      const p = S.d.pedidos.find(x => x.id === S.selPed); if (!p) return true;
      if (S.d.movinv.some(m => m.pedido_id === p.id) || S.d.facturas.some(f => f.pedido_id === p.id)) { alert("El pedido tiene movimientos de inventario o facturas y no se puede eliminar."); return true; }
      if (confirm("¿Eliminar el pedido " + p.numero + "?")) { await db.borrarPedido(p.id); S.selPed = null; await recargar(); }
      return true;
    }
    case "factdeped": S.ped = null; S.vista = b.dataset.t === "V" ? "fventa" : "fcompra"; abrirFactura(id); return true;
  }
  return false;
}

/* ---------------- Existencias en contabilidad: regularización (variación de existencias) ---------------- */
// Método del PGC: las compras van al gasto (60x) y, en la fecha de cierre, se ajusta la cuenta de existencias (grupo 3) a lo que vale
// el inventario, contra la cuenta de variación de existencias (61x / 71x).
const CTA_EXIST = "300000001", CTA_VAR = "610000001";
function valorArt(a, fecha) { // existencias y valor a una fecha, a coste medio ponderado de las entradas hasta esa fecha
  let q = 0, qe = 0, ve = 0;
  S.d.movinv.forEach(m => { if (m.articulo_id !== a.id || m.fecha > fecha) return; q += +m.cantidad; if ((m.tipo === "Recepción" || m.tipo === "Ajuste") && +m.cantidad > 0) { qe += +m.cantidad; ve += +m.cantidad * (+m.coste || 0); } });
  const coste = qe ? ve / qe : (+a.precio_compra || 0);
  return { q: r3(q), coste, valor: r2(q * coste) };
}
const aperturaEn = (cta, ej) => { const ids = new Set(S.d.asientos.filter(x => x.ejercicio === ej && /apertura/i.test((x.concepto || "") + " " + (x.origen || ""))).map(x => x.id)); return S.d.apuntes.some(p => p.cuenta === cta && ids.has(p.asiento_id)); };
function saldoExist(cta, fecha) { // saldo contable de la cuenta de existencias a la fecha; si el ejercicio tiene asiento de apertura, solo ese ejercicio
  const ej = +fecha.slice(0, 4), soloEj = aperturaEn(cta, ej);
  const ids = new Set(S.d.asientos.filter(a => a.fecha <= fecha && (!soloEj || a.ejercicio === ej)).map(a => a.id));
  return r2(S.d.apuntes.reduce((s, p) => p.cuenta === cta && ids.has(p.asiento_id) ? s + +p.debe - +p.haber : s, 0));
}
function datosRegul(fecha) {
  const det = S.d.articulos.filter(a => a.tipo !== "Servicio").map(a => ({ a, ...valorArt(a, fecha), exist: (a.ficha || {}).cta_exist || CTA_EXIST, vari: (a.ficha || {}).cta_var || CTA_VAR })).filter(x => x.q || x.valor).sort((x, y) => x.a.codigo.localeCompare(y.a.codigo));
  const m = new Map(), errores = [];
  const grupo = (exist, vari) => { if (!m.has(exist)) m.set(exist, { exist, vari, valor: 0 }); return m.get(exist); };
  S.d.articulos.filter(a => a.tipo !== "Servicio").forEach(a => { const f = a.ficha || {}, g = grupo(f.cta_exist || CTA_EXIST, f.cta_var || CTA_VAR); if (g.vari !== (f.cta_var || CTA_VAR)) errores.push("La cuenta de existencias " + g.exist + " está asignada a dos cuentas de variación distintas (artículo " + a.codigo + "). Use una sola por cuenta."); });
  det.forEach(x => { const g = grupo(x.exist, x.vari); g.valor = r2(g.valor + x.valor); });
  const cuentas = [...m.values()].map(g => { const saldo = saldoExist(g.exist, fecha); return { ...g, saldo, ajuste: r2(g.valor - saldo) }; }).sort((a, b) => a.exist.localeCompare(b.exist));
  det.filter(x => x.q < 0).forEach(x => errores.push("El artículo " + x.a.codigo + " tiene existencias negativas (" + q3(x.q) + ") a esa fecha. Corríjalo antes de regularizar."));
  const apuntes = [];
  cuentas.filter(c => c.ajuste).forEach(c => { const imp = Math.abs(c.ajuste), sube = c.ajuste > 0;
    apuntes.push({ cuenta: c.exist, concepto: "Regularización de existencias", debe: sube ? imp : 0, haber: sube ? 0 : imp }, { cuenta: c.vari, concepto: "Variación de existencias", debe: sube ? 0 : imp, haber: sube ? imp : 0 }); });
  return { det, cuentas, apuntes, errores };
}
const regulaciones = () => S.d.asientos.filter(a => a.origen === "existencias").sort((a, b) => b.fecha.localeCompare(a.fecha) || b.numero - a.numero);
const fechaRegul = () => S.fechaRegul || `${S.ej}-12-31`;
V.regexist = () => {
  const f = fechaRegul(), D = datosRegul(f), hechas = regulaciones(), posterior = hechas.find(a => a.fecha > f), sel = hechas.find(a => a.id === S.selRegul);
  const nom = c => nombreCuenta(c) || nombreMaestro(c.slice(0, 3));
  const tDebe = r2(D.apuntes.reduce((s, p) => s + p.debe, 0));
  const acc = `<button class="p" data-a="generarregul" ${D.apuntes.length && !D.errores.length && !posterior ? "" : "disabled"}>Generar asiento de variación de existencias</button>` + SEP + btn("deshacerregul", "Deshacer regularización", "", !sel);
  return pagina("Regularización de existencias", acc, `${D.errores.map(e => `<p class="ko">${esc(e)}</p>`).join("")}${posterior ? `<p class="ko">Hay una regularización posterior (${posterior.fecha}). Deshágala antes de regularizar a una fecha anterior.</p>` : ""}
   <div class="lista"><table><tr><th>Cuenta de existencias</th><th>Nombre</th><th>Cuenta de variación</th><th class="n">Saldo contable</th><th class="n">Valor del inventario</th><th class="n">Variación</th></tr>${D.cuentas.map(c => `<tr><td>${c.exist}</td><td>${esc(nom(c.exist))}</td><td>${c.vari}</td><td class="n">${eur(c.saldo)}</td><td class="n">${eur(c.valor)}</td><td class="n">${eur(c.ajuste)}</td></tr>`).join("") || `<tr><td colspan="6" class="vacio">No hay artículos de inventario.</td></tr>`}</table></div>
   <h3 style="margin-top:1rem">Asiento propuesto a ${f}</h3><div class="lista"><table><tr><th>Cuenta</th><th>Nombre</th><th>Concepto</th><th class="n">Debe</th><th class="n">Haber</th></tr>${D.apuntes.map(p => `<tr><td>${p.cuenta}</td><td>${esc(nom(p.cuenta))}</td><td>${p.concepto}</td><td class="n">${sal(p.debe)}</td><td class="n">${sal(p.haber)}</td></tr>`).join("") || `<tr><td colspan="5" class="vacio">La contabilidad ya coincide con el inventario: no hay nada que regularizar.</td></tr>`}${D.apuntes.length ? `<tr class="tot"><td colspan="3">Totales</td><td class="n">${eur(tDebe)}</td><td class="n">${eur(tDebe)}</td></tr>` : ""}</table></div>
   <h3 style="margin-top:1rem">Detalle del inventario valorado a ${f}</h3><div class="lista"><table><tr><th>Artículo</th><th>Nombre</th><th class="n">Existencias</th><th class="n">Coste medio</th><th class="n">Valor</th><th>Cuenta</th></tr>${D.det.map(x => `<tr class="${x.q < 0 ? "ko" : ""}"><td>${esc(x.a.codigo)}</td><td>${esc(x.a.nombre)}</td><td class="n">${q3(x.q)}</td><td class="n">${eur(x.coste)}</td><td class="n">${eur(x.valor)}</td><td>${x.exist}</td></tr>`).join("") || `<tr><td colspan="6" class="vacio">Sin existencias a esa fecha.</td></tr>`}</table></div>
   <h3 style="margin-top:1rem">Regularizaciones registradas</h3><div class="lista"><table><tr><th>Fecha</th><th>Asiento</th><th>Concepto</th></tr>${hechas.map(a => `<tr data-sel class="${a.id === S.selRegul ? "sel" : ""}" data-a="selregul" data-id="${a.id}"><td>${a.fecha}</td><td>${a.ejercicio}-${String(a.numero).padStart(5, "0")}</td><td>${esc(a.concepto)}</td></tr>`).join("") || `<tr><td colspan="3" class="vacio">Ninguna todavía.</td></tr>`}</table></div>
   <p style="color:var(--tx2)">Ajusta cada cuenta de existencias al valor del inventario a la fecha elegida, contra su cuenta de variación. El saldo contable que no esté respaldado por artículos del inventario se dará de baja: cargue antes las existencias iniciales con un ajuste de inventario.</p>`,
    { tabs: ["Regularización"], filtros: `<label>Fecha de regularización<input type="date" id="fregul" value="${f}"></label>` });
};
async function generarRegul() {
  const f = fechaRegul(), D = datosRegul(f); if (!D.apuntes.length || D.errores.length) return;
  const bajas = D.cuentas.filter(c => c.ajuste < 0 && !c.valor);
  if (!confirm("Se registrará el asiento de variación de existencias a " + f + "." + (bajas.length ? "\n\nATENCIÓN: " + bajas.map(c => c.exist + " quedará a cero (saldo actual " + eur(c.saldo) + ")").join(", ") + " porque no hay existencias de artículos en esa cuenta." : "") + "\n\n¿Continuar?")) return;
  for (const p of D.apuntes) { // crea los títulos y las cuentas que falten
    if (S.d.cuentas.some(c => c.codigo === p.cuenta)) continue;
    const t = p.cuenta.slice(0, 3);
    if (!maestroDe(p.cuenta)) { if (!nombreMaestro(t)) return alert("No existe el título " + t + " en el plan de cuentas. Créelo antes en Cuentas principales."); await db.crearCuentas(S.emp.id, [[t, nombreMaestro(t)]]); S.d.cuentas.push({ id: uid(), empresa_id: S.emp.id, codigo: t, nombre: nombreMaestro(t) }); }
    await asegurarCuenta(p.cuenta, nombreMaestro(t) || nombreMaestro(maestroDe(p.cuenta)));
  }
  await db.crearAsiento(S.emp.id, f, "Variación de existencias a " + f, D.apuntes, "existencias", "EXIST-" + f);
  await recargar();
}

/* ---------------- Modelo de impuestos de D365: grupos, autoridades, períodos, impuestos registrados, parámetros ---------------- */
// La configuración se guarda en modelos_manual (modelo "taxcfg"), sin tablas nuevas. Los valores iniciales salen de los códigos de impuestos.
const lista = (f) => CODIGOS.filter(f).map(c => c.cod);
const esArt = c => !["ret", "retc", "rec"].includes(c.tipo) && !c.oculto;
const SEED = {
  gruposReg: () => [
    { id: "NACIONAL", desc: "Operaciones nacionales", rep: CTA.rep, sop: CTA.sop, gastoImp: "", impRep: "", liq: "475000001" },
    { id: "INTRACOM", desc: "Operaciones intracomunitarias", rep: CTA.repUE, sop: CTA.sopUE, gastoImp: "", impRep: "", liq: "475000001" },
    { id: "DUA", desc: "Operaciones con DUA", rep: "", sop: CTA.sopDUA, gastoImp: "", impRep: "", liq: "475000001" },
    { id: "R.REC", desc: "Ventas con recargo", rep: "477100001", sop: "", gastoImp: "", impRep: "", liq: "" },
    { id: "IRPF_PROF", desc: "IRPF profesionales y nóminas", rep: "", sop: "", gastoImp: "", impRep: "", liq: "475100001" },
    { id: "IRPF_ALQ", desc: "IRPF alquileres", rep: "", sop: "", gastoImp: "", impRep: "", liq: "475100003" },
    { id: "IRPF_DIV", desc: "IRPF dividendos e intereses", rep: "", sop: "", gastoImp: "", impRep: "", liq: "475100004" }],
  gruposImp: () => [
    { id: "S.NAC", desc: "Compras nacionales", lado: "C", codigos: lista(c => /^(S\.(NC|NAC)|IN)\./.test(c.cod)) },
    { id: "S.UE", desc: "Compras intracomunitarias", lado: "C", codigos: lista(c => /^S\.UE\./.test(c.cod)) },
    { id: "S.ISP", desc: "Compras con inversión del sujeto pasivo", lado: "C", codigos: lista(c => /^S\.ISP\./.test(c.cod)) },
    { id: "S.EXT", desc: "Compras de terceros países", lado: "C", codigos: lista(c => /^S\.EX\./.test(c.cod) || /^DUA/.test(c.cod)) },
    { id: "R.NAC", desc: "Ventas nacionales", lado: "V", codigos: lista(c => /^R\.(NC|NAC)\./.test(c.cod)) },
    { id: "R.NAC_RC", desc: "Ventas nacionales con recargo", lado: "V", codigos: lista(c => /^R\.(NC|NAC|RC)\./.test(c.cod)) },
    { id: "R.UE", desc: "Ventas intracomunitarias", lado: "V", codigos: lista(c => /^R\.UE(\.S)?$/.test(c.cod)) },
    { id: "R.EXT", desc: "Ventas a terceros países", lado: "V", codigos: ["R.EX"] }],
  gruposArt: () => { const g = (id, desc, f) => ({ id, desc, codigos: lista(c => esArt(c) && f(c)) }), p = n => c => c.pct === n && c.tipo !== "ex" && !/NS/.test(c.cod);
    return [g("OP.NR", "Operaciones normales (21 %)", p(21)), g("OP.RD", "Operaciones reducidas (10 %)", p(10)), g("OP.RDN", "Operaciones reducidas (5 %)", p(5)), g("OP.SR", "Operaciones superreducidas (4 %)", p(4)), g("OP.SRN", "Operaciones superreducidas (2 %)", p(2)), g("OP.EX", "Operaciones exentas", c => !c.pct && !/NS/.test(c.cod)), g("OP.NS", "Operaciones no sujetas", c => /NS/.test(c.cod))]; },
  autoridades: () => [], informes: () => [],
  periodos: () => [{ id: "IVA", desc: "IVA modelo 303", autoridad: "", unidad: "Meses", duracion: 3, modelo: "303" }, { id: "IRPF", desc: "IRPF modelo 111", autoridad: "", unidad: "Meses", duracion: 3, modelo: "111" }, { id: "IRPF 115", desc: "IRPF modelo 115", autoridad: "", unidad: "Meses", duracion: 3, modelo: "115" }, { id: "IRPF 123", desc: "IRPF modelo 123", autoridad: "", unidad: "Meses", duracion: 3, modelo: "123" }],
  params: () => ({})
};
const CF = k => { const d = ((S.d.manual || []).find(m => m.modelo === "taxcfg") || {}).datos || {}; return d[k] !== undefined ? d[k] : SEED[k](); };
async function guardarCfg(k, v) {
  const ex = S.d.manual.find(m => m.modelo === "taxcfg"), datos = { ...(ex ? ex.datos : {}), [k]: v }, rec = { id: ex ? ex.id : uid(), empresa_id: S.emp.id, modelo: "taxcfg", ejercicio: 0, periodo: "-", datos };
  await db.guardarManual(rec); if (ex) ex.datos = datos; else S.d.manual.push(rec);
}
// determinador de código: el código de impuestos es el que está a la vez en el grupo de impuestos del tercero y en el grupo de impuestos del artículo
const grupoImpDe = (t, tipo) => { const g = t ? t.grupo_iva : "NAC"; return tipo === "C" ? (g === "UE" ? "S.UE" : g === "EXT" ? "S.EXT" : "S.NAC") : (g === "UE" ? "R.UE" : g === "EXT" ? "R.EXT" : aplicaRec(t) ? "R.NAC_RC" : "R.NAC"); };
const grupoArtDe = cod => (CF("gruposArt").find(g => g.codigos.includes(cod)) || {}).id || "";
function codigoPorGrupos(gi, ga) {
  const a = CF("gruposImp").find(g => g.id === gi), b = CF("gruposArt").find(g => g.id === ga); if (!a || !b) return "";
  return a.codigos.filter(c => b.codigos.includes(c) && CODIGO[c] && CODIGO[c].tipo !== "rec").sort((x, y) => x.length - y.length)[0] || "";
}
const parm = (pg, k, def = "") => { const v = (CF("params")[pg] || {})[k]; return v === undefined ? def : v; };

/* Páginas de mantenimiento con la misma forma: lista + formulario */
const nCod = x => (x.codigos || []).length;
const CFGDEF = {
  gruposReg: { titulo: "Grupos de registro", cols: [["id", "Grupo de registro"], ["desc", "Descripción"], ["rep", "Impuestos repercutidos"], ["sop", "Impuestos soportados"], ["liq", "Cuenta de liquidación"]],
    form: () => [["id", "Grupo de registro"], ["desc", "Descripción"], ["rep", "Impuestos repercutidos", { list: "dlcta" }], ["sop", "Impuestos soportados", { list: "dlcta" }], ["gastoImp", "Gasto de IVA de importación", { list: "dlcta" }], ["impRep", "IVA de importación repercutido", { list: "dlcta" }], ["liq", "Cuenta de liquidación", { list: "dlcta" }]], ctas: ["rep", "sop", "gastoImp", "impRep", "liq"] },
  gruposImp: { titulo: "Grupos de impuestos", cols: [["id", "Grupo de impuestos"], ["desc", "Descripción"], ["lado", "Operación", x => x.lado === "C" ? "Compras" : "Ventas"], ["codigos", "Códigos de impuestos", x => nCod(x)]], form: () => [["id", "Grupo de impuestos"], ["desc", "Descripción"], ["lado", "Operación", { opts: [["C", "Compras"], ["V", "Ventas"]] }]], codigos: x => CODIGOS.filter(c => !c.oculto && c.tipo !== "ret" && c.tipo !== "retc" && c.lado === x.lado) },
  gruposArt: { titulo: "Grupos de impuestos de artículos", cols: [["id", "Grupo de impuestos de artículos"], ["desc", "Descripción"], ["codigos", "Códigos de impuestos", x => nCod(x)]], form: () => [["id", "Grupo de impuestos de artículos"], ["desc", "Descripción"]], codigos: () => CODIGOS.filter(esArt) },
  autoridades: { titulo: "Autoridades fiscales", cols: [["id", "Autoridad"], ["nombre", "Nombre"], ["nif", "Identificación de la autoridad"], ["proveedor", "Cuenta de proveedor"], ["tel", "Teléfono"]],
    form: () => [["id", "Autoridad"], ["nombre", "Nombre"], ["nif", "Identificación de la autoridad"], ["proveedor", "Cuenta de proveedor", { list: "dlprov" }], ["redondeo", "Forma de redondear", { opts: ["Normal", "Hacia arriba", "Hacia abajo"] }], ["redondeoVal", "Redondear", { tipo: "number" }], ["direccion", "Dirección"], ["tel", "Teléfono"], ["movil", "Teléfono móvil"], ["email", "Correo electrónico"], ["web", "Dirección de Internet"]] },
  periodos: { titulo: "Períodos de liquidación de impuestos", cols: [["id", "Período de liquidación"], ["desc", "Descripción"], ["autoridad", "Autoridad"], ["unidad", "Unidad de intervalo"], ["duracion", "Duración"], ["modelo", "Modelo"]],
    form: () => [["id", "Período de liquidación"], ["desc", "Descripción"], ["autoridad", "Autoridad", { opts: CF("autoridades").map(a => [a.id, a.id + " · " + a.nombre]) }], ["unidad", "Unidad de intervalo de período", { opts: ["Meses"] }], ["duracion", "Duración del intervalo de período", { opts: [["1", "1 (mensual)"], ["3", "3 (trimestral)"], ["12", "12 (anual)"]] }], ["modelo", "Modelo (liquidación)", { opts: ["303", "111", "115", "123", "—"] }]] }
};
const perCod = (dur, i) => +dur === 3 ? (i + 1) + "T" : +dur === 1 ? "M" + String(i + 1).padStart(2, "0") : +dur === 12 ? "0A" : "";
function intervalos(p, ej) { // intervalos del año según la duración del período de liquidación
  const d = +p.duracion || 3, out = [], d2 = n => String(n).padStart(2, "0");
  for (let i = 0; i * d < 12; i++) { const m1 = i * d + 1, m2 = Math.min(12, m1 + d - 1); out.push({ cod: perCod(d, i), desde: `${ej}-${d2(m1)}-01`, hasta: `${ej}-${d2(m2)}-${d2(new Date(ej, m2, 0).getDate())}` }); }
  return out;
}
const liqDe = (modelo, ej, cod) => S.d.asientos.find(a => a.documento === `LIQ${modelo}-${ej}-${cod}`);
function vistaCfg(k) {
  const D = CFGDEF[k], L = CF(k), E = S.cfgEdit && S.cfgEdit.k === k ? S.cfgEdit : null, sel = L.find(x => x.id === S.selCfg[k]);
  const filas = L.map(x => `<tr data-sel class="${sel && sel.id === x.id ? "sel" : ""}" data-a="cfgedit" data-k="${k}" data-id="${esc(x.id)}">${D.cols.map(c => `<td>${esc(c[2] ? c[2](x) : (x[c[0]] ?? ""))}</td>`).join("")}</tr>`).join("");
  let form = "";
  if (E) {
    const campos = D.form().map(([f, et, o = {}]) => `<label class="fld">${et}${o.opts ? `<select data-cg="${f}">${optsHtml(o.opts, E.obj[f])}</select>` : `<input data-cg="${f}" type="${o.tipo || "text"}" ${o.list ? `list="${o.list}"` : ""} value="${esc(E.obj[f] ?? "")}" ${f === "id" && !E.nuevo ? "disabled" : ""}>`}</label>`).join("");
    const cods = D.codigos ? `<h4 style="margin:.8rem 0 .3rem">CÓDIGOS DE IMPUESTOS DEL GRUPO</h4><div class="chkgrid">${D.codigos(E.obj).map(c => `<label class="chk"><input type="checkbox" data-cgc="${esc(c.cod)}" ${(E.obj.codigos || []).includes(c.cod) ? "checked" : ""}> ${esc(c.cod)} <span style="color:var(--tx2)">${c.pct ? String(c.pct).replace(".", ",") + " %" : esc(c.nombre)}</span></label>`).join("")}</div>` : "";
    form = `<div class="card"><b>${E.nuevo ? "Nuevo" : "Editar"} · ${esc(D.titulo)}</b><div class="row" style="margin-top:.5rem">${campos}</div>${cods}<div class="row" style="margin-top:.6rem"><button class="p" data-a="cfgsave">Guardar</button><button data-a="cfgcancel">Cancelar</button></div></div>`;
  }
  let extra = "";
  if (k === "periodos" && sel) {
    const iv = intervalos(sel, S.ej);
    extra = `<h3 style="margin-top:1rem">Intervalos de período ${S.ej} · ${esc(sel.id)}</h3><table><tr><th>Desde fecha</th><th>Hasta fecha</th><th>Código</th><th>Liquidado</th></tr>${iv.map(v => `<tr><td>${v.desde}</td><td>${v.hasta}</td><td>${v.cod}</td><td>${sel.modelo !== "—" && liqDe(sel.modelo, S.ej, v.cod) ? "Sí" : ""}</td></tr>`).join("")}</table>`;
  }
  if (k === "gruposImp" || k === "gruposArt") extra = sel ? `<h3 style="margin-top:1rem">Códigos de ${esc(sel.id)}</h3><table><tr><th>Código</th><th>Nombre</th><th class="n">Porcentaje</th></tr>${(sel.codigos || []).map(c => `<tr><td>${esc(c)}</td><td>${esc((CODIGO[c] || {}).nombre || "")}</td><td class="n">${(CODIGO[c] || {}).pct ? String(CODIGO[c].pct).replace(".", ",") + " %" : "—"}</td></tr>`).join("")}</table>` : "";
  const acc = btn("cfgnuevo", "+ Nuevo", `data-k="${k}"`) + btn("cfgedit", "Editar", `data-k="${k}" data-id="${sel ? esc(sel.id) : ""}"`, !sel) + btn("cfgdel", "Eliminar", `data-k="${k}"`, !sel);
  return pagina(D.titulo, acc, `<datalist id="dlcta">${optsCuentas()}</datalist><datalist id="dlprov">${S.d.terceros.filter(t => t.tipo === "P").map(t => `<option value="${esc(t.codigo)}">${esc(t.nombre)}</option>`).join("")}</datalist>${form}<div class="pagina"><div class="lista"><table><tr>${D.cols.map(c => `<th>${c[1]}</th>`).join("")}</tr>${filas || `<tr><td colspan="${D.cols.length}" class="vacio">No se encontró ningún elemento que mostrar aquí.</td></tr>`}</table>${extra}</div></div>`);
}
V.gimpuestos = () => vistaCfg("gruposImp"); V.gartic = () => vistaCfg("gruposArt"); V.gregistro = () => vistaCfg("gruposReg"); V.autoridades = () => vistaCfg("autoridades"); V.periodosliq = () => vistaCfg("periodos");

/* Impuestos registrados: una fila por código de impuestos de cada factura registrada */
function impuestosReg() {
  const out = [];
  S.d.facturas.filter(f => estadoF(f) === "Registrado").forEach(f => {
    const t = terPorId(f.tercero_id) || {}, asi = S.d.asientos.find(a => a.id === f.asiento_id) || {}, cli = f.tipo === "V", gi = grupoImpDe(t, f.tipo);
    const base = { asiento: asi.numero ? asi.ejercicio + "-" + String(asi.numero).padStart(5, "0") : "", fecha: fechaIva(f), factura: f.numero, origen: cli ? "Factura de venta" : "Factura de compra", gi, divisa: "EUR", tercero: t.nombre || "" };
    const porCod = new Map(); let rec = new Map();
    lineasF(f).forEach(l => { const c = codLinea(f, l), b = r2((+l.cantidad || 0) * (+l.precio || 0)); porCod.set(c.cod, r2((porCod.get(c.cod) || 0) + b)); if (cli && l.rec && CODIGO[l.rec]) rec.set(l.rec, r2((rec.get(l.rec) || 0) + b)); });
    porCod.forEach((b, cod) => { const c = CODIGO[cod], cuota = r2(b * (+c.pct || 0) / 100), ga = grupoArtDe(cod);
      if (c.tipo === "ue" || c.tipo === "isp") { out.push({ ...base, cod, ga, dir: "Impuestos soportados", base: b, cuota, pct: c.pct, auto: true, ue: c.tipo === "ue", exento: false }); out.push({ ...base, cod, ga, dir: "Impuestos repercutidos", base: b, cuota, pct: c.pct, auto: true, ue: c.tipo === "ue", exento: false }); }
      else out.push({ ...base, cod, ga, dir: cli ? "Impuestos repercutidos" : "Impuestos soportados", base: b, cuota, pct: c.pct, auto: false, ue: !!c.ue, exento: !c.pct });
    });
    rec.forEach((b, cod) => { const c = CODIGO[cod]; out.push({ ...base, cod, ga: "", dir: "Impuestos repercutidos", base: b, cuota: r2(b * c.pct / 100), pct: c.pct, auto: false, ue: false, exento: false }); });
    const cr = codRetEfectivo(f), ret = retF(f); if (cr && ret) out.push({ ...base, cod: cr, ga: "", dir: cli ? "Retención soportada" : "Retención practicada", base: totalesF(lineasF(f)).base, cuota: ret, pct: (CODIGO[cr] || {}).pct, auto: false, ue: false, exento: false });
  });
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.factura.localeCompare(b.factura));
}
const selPer = () => `<label>Período<select id="per">${PERIODOS.map(p => `<option value="${p[0]}" ${p[0] === S.periodo ? "selected" : ""}>${p[1]}</option>`).join("")}</select></label>`;
V.imptoreg = () => {
  const [d, h] = rangoPeriodo(S.periodo), dirF = S.filtroDirIR || "", tab = S.tabs.ir || "Visión general";
  const L = impuestosReg().filter(r => r.fecha >= d && r.fecha <= h && (!dirF || r.dir === dirF));
  const pc = n => n ? String(n).replace(".", ",") + " %" : "";
  const cols = { "Visión general": [["Asiento", r => r.asiento], ["Fecha", r => r.fecha], ["Factura", r => r.factura], ["Origen", r => r.origen], ["Dirección del impuesto", r => r.dir], ["Grupo de impuestos", r => r.gi], ["Código de impuestos", r => r.cod], ["Grupo de impuestos de artículos", r => r.ga], ["Origen de importe", r => eur(r.base), 1], ["Importe de impuestos", r => eur(r.cuota), 1], ["Divisa", r => r.divisa]],
    "General": [["Asiento", r => r.asiento], ["Código de impuestos", r => r.cod], ["Dirección del impuesto", r => r.dir], ["Exento", r => r.exento ? "Sí" : "No"], ["Automático", r => r.auto ? "Sí" : "No"], ["IVA intracomunitario", r => r.ue ? "Sí" : "No"], ["Período", r => (PERIODOS.find(p => p[0] === S.periodo) || [])[1]], ["Fecha del registro del IVA", r => r.fecha], ["Grupo de impuestos", r => r.gi], ["Grupo de impuestos de artículos", r => r.ga], ["Tercero", r => r.tercero]],
    "Importe": [["Asiento", r => r.asiento], ["Código de impuestos", r => r.cod], ["Porcentaje / Importe", r => pc(r.pct), 1], ["Origen de importe", r => eur(r.base), 1], ["Importe de impuestos calculado", r => eur(r.cuota), 1], ["Importe real de impuestos", r => eur(r.cuota), 1], ["Impuestos no deducibles reales", r => eur(0), 1], ["Divisa", r => r.divisa]] }[tab];
  const filas = L.map(r => `<tr>${cols.map(c => `<td class="${c[2] ? "n" : ""}">${esc(c[1](r))}</td>`).join("")}</tr>`).join("");
  const sum = dir => eur(L.filter(r => r.dir === dir).reduce((a, r) => a + r.cuota, 0));
  return pagina("Impuestos registrados", btn("irexport", "Exportar CSV") + btn("irliq", "Liquidar y registrar impuestos"), `<div class="lista"><table><tr>${cols.map(c => `<th class="${c[2] ? "n" : ""}">${c[0]}</th>`).join("")}</tr>${filas || `<tr><td colspan="${cols.length}" class="vacio">No se encontró ningún elemento que mostrar aquí.</td></tr>`}</table></div>
   <div class="pie"><span>Repercutidos <b>${sum("Impuestos repercutidos")}</b></span><span>Soportados <b>${sum("Impuestos soportados")}</b></span><span>Retenciones practicadas <b>${sum("Retención practicada")}</b></span><span>Retenciones soportadas <b>${sum("Retención soportada")}</b></span></div>`,
    { tabs: ["Visión general", "General", "Importe"], tabKey: "ir", filtros: selPer() + `<label>Dirección del impuesto<select id="fdirir"><option value="">Todas</option>${["Impuestos repercutidos", "Impuestos soportados", "Retención practicada", "Retención soportada"].map(x => `<option ${x === dirF ? "selected" : ""}>${x}</option>`).join("")}</select></label>` });
};
/* Liquidar y registrar impuestos / Pagos de impuestos / Informar impuestos / Informes de IVA */
const MOD_VISTA = { "303": "m303", "111": "m111", "115": "m115", "123": "m123" };
function selLiq() { // período de liquidación e intervalo elegidos
  const ps = CF("periodos"), p = ps.find(x => x.id === S.liqPer) || ps[0] || null; if (!p) return {};
  const iv = intervalos(p, S.ej), v = iv.find(x => x.cod === S.liqInt) || iv[Math.min(iv.length - 1, Math.floor(new Date().getMonth() / (+p.duracion || 3)))] || iv[0];
  return { p, iv, v };
}
V.liqreg = () => {
  const { p, iv, v } = selLiq(); if (!p) return pagina("Liquidar y registrar impuestos", "", `<p>No hay períodos de liquidación. Créelos en Períodos de liquidación de impuestos.</p>`);
  const L = impuestosReg().filter(r => r.fecha >= v.desde && r.fecha <= v.hasta), s = d => r2(L.filter(r => r.dir === d).reduce((a, r) => a + r.cuota, 0));
  const porCod = [...L.reduce((m, r) => { const k = r.dir + "|" + r.cod; const o = m.get(k) || { dir: r.dir, cod: r.cod, base: 0, cuota: 0 }; o.base = r2(o.base + r.base); o.cuota = r2(o.cuota + r.cuota); m.set(k, o); return m; }, new Map()).values()];
  const ex = p.modelo !== "—" ? liqDe(p.modelo, S.ej, v.cod) : null, iva = p.modelo === "303", res = r2(s("Impuestos repercutidos") - s("Impuestos soportados"));
  const form = `<div class="card"><div class="row"><label>Período de liquidación<br><select id="lq-per">${CF("periodos").map(x => `<option value="${esc(x.id)}" ${x.id === p.id ? "selected" : ""}>${esc(x.id)} · ${esc(x.desc)}</option>`).join("")}</select></label>
    <label>Intervalo<br><select id="lq-int">${iv.map(x => `<option value="${x.cod}" ${x.cod === v.cod ? "selected" : ""}>${x.desde} – ${x.hasta}</option>`).join("")}</select></label>
    <label>Versión de pago del impuesto<br><input disabled value="Original"></label><label>Estado<br><b>${ex ? "Liquidado (asiento " + ex.ejercicio + "-" + ex.numero + ")" : "Pendiente"}</b></label></div></div>`;
  return pagina("Liquidar y registrar impuestos", btn("irliq2", ex ? "Ver liquidación" : "Liquidar y registrar", "", !MOD_VISTA[p.modelo]) + btn("pagosdeper", "Pagos de impuestos"), `${form}<div class="lista"><table><tr><th>Dirección del impuesto</th><th>Código de impuestos</th><th class="n">Base</th><th class="n">Importe de impuestos</th></tr>${porCod.map(o => `<tr><td>${esc(o.dir)}</td><td>${esc(o.cod)}</td><td class="n">${eur(o.base)}</td><td class="n">${eur(o.cuota)}</td></tr>`).join("") || `<tr><td colspan="4" class="vacio">Sin impuestos registrados en el intervalo.</td></tr>`}</table></div>
   <div class="pie">${iva ? `<span>Repercutido <b>${eur(s("Impuestos repercutidos"))}</b></span><span>Soportado <b>${eur(s("Impuestos soportados"))}</b></span><span>${res >= 0 ? "A ingresar" : "A compensar / devolver"} <b>${eur(Math.abs(res))}</b></span>` : `<span>Retenciones practicadas <b>${eur(s("Retención practicada"))}</b></span>`}</div>
   <p style="color:var(--tx2)">"Liquidar y registrar" abre la liquidación del modelo, que propone el asiento según el saldo de las cuentas de impuestos y permite generarlo o deshacerlo.</p>`, { tabs: ["Parámetros"] });
};
const NOM_LIQ = { "303": "IVA", "111": "IRPF 111", "115": "IRPF 115", "123": "IRPF 123" };
const perRango = (ej, cod) => { const p = PERIODOS.find(x => x[0] === cod); if (!p) return ["", ""]; const d2 = n => String(n).padStart(2, "0"); return [`${ej}-${d2(p[2])}-01`, `${ej}-${d2(p[3])}-${d2(new Date(ej, p[3], 0).getDate())}`]; };
V.pagosimp = () => {
  const L = S.d.asientos.filter(a => (a.origen || "").startsWith("liquidacion-")).map(a => { const m = /^LIQ(\d+)-(\d{4})-(.+)$/.exec(a.documento || ""), [d, h] = m ? perRango(+m[2], m[3]) : ["", ""]; return { a, modelo: m ? m[1] : "", ej: m ? +m[2] : a.ejercicio, cod: m ? m[3] : "", d, h }; }).sort((x, y) => y.a.fecha.localeCompare(x.a.fecha)), sel = L.find(x => x.a.id === S.selPagoImp);
  const filas = L.map(x => `<tr data-sel class="${sel && sel.a.id === x.a.id ? "sel" : ""}" data-a="selpagoimp" data-id="${x.a.id}"><td>${x.a.fecha}</td><td>${x.a.ejercicio}-${String(x.a.numero).padStart(5, "0")}</td><td>${esc(NOM_LIQ[x.modelo] || x.modelo)}</td><td>${x.d}</td><td>${x.h}</td><td>Original</td></tr>`).join("");
  const ap = sel ? S.d.apuntes.filter(p => p.asiento_id === sel.a.id) : [];
  return pagina("Pagos de impuestos", btn("verasiento", "Asiento", "", !sel) + btn("verimpreg", "Impuestos registrados", "", !sel), `<div class="pagina"><div class="lista"><table><tr><th>Fecha</th><th>Asiento</th><th>Período de liquidación</th><th>Desde fecha</th><th>Hasta fecha</th><th>Versión de pago del impuesto</th></tr>${filas || `<tr><td colspan="6" class="vacio">No se encontró ningún elemento que mostrar aquí.</td></tr>`}</table></div>
   <aside class="factbox"><h3>Asiento de la liquidación</h3>${sel ? `<dl>${ap.map(p => `<dt>${esc(p.cuenta)} ${esc(nombreCuenta(p.cuenta))}</dt><dd>${+p.debe ? "D " + eur(p.debe) : "H " + eur(p.haber)}</dd>`).join("")}</dl>` : `<p style="color:var(--tx2)">Seleccione un pago.</p>`}</aside></div>`, { tabs: ["Visión general", "General", "Historial"] });
};
const infDe = () => CF("informes");
V.infiva = () => {
  const L = [...infDe()].sort((a, b) => b.desde.localeCompare(a.desde)), sel = L.find(x => x.id === S.selInf);
  const filas = L.map(x => `<tr data-sel class="${sel && sel.id === x.id ? "sel" : ""}" data-a="selinf" data-id="${x.id}"><td>${x.desde}</td><td>${esc(x.libro)}</td><td>${esc(x.desc)}</td><td>${x.notificado ? "Sí · " + (x.fnot || "") : "No"}</td><td>${x.sustitutiva ? "Sí" : "No"}</td></tr>`).join("");
  return pagina("Informes de IVA españoles", btn("informar", "Crear nuevo") + btn("marcarnot", sel && sel.notificado ? "Quitar notificado" : "Marcar notificado", "", !sel) + btn("delinf", "Eliminar", "", !sel) + SEP + btn("abrirmodelo", "Líneas / Totales / Salida", "", !sel), `<div class="lista"><table><tr><th>Desde fecha</th><th>Libro de IVA</th><th>Descripción</th><th>Notificado</th><th>Declaración sustitutiva</th></tr>${filas || `<tr><td colspan="5" class="vacio">No se encontró ningún elemento que mostrar aquí.</td></tr>`}</table></div>`, { tabs: ["Visión general", "General"] });
};
V.informar = () => {
  const { p, iv, v } = selLiq(); if (!p) return pagina("Informar impuestos para el período de liquidación", "", `<p>No hay períodos de liquidación.</p>`);
  const ya = infDe().find(x => x.modelo === p.modelo && x.ej === S.ej && x.cod === v.cod);
  return pagina("Informar impuestos para el período de liquidación", `<button class="p" data-a="informar2">Informar impuestos</button>`, `<div class="card"><div class="row"><label>Período de liquidación<br><select id="lq-per">${CF("periodos").map(x => `<option value="${esc(x.id)}" ${x.id === p.id ? "selected" : ""}>${esc(x.id)} · ${esc(x.desc)}</option>`).join("")}</select></label><label>Intervalo<br><select id="lq-int">${iv.map(x => `<option value="${x.cod}" ${x.cod === v.cod ? "selected" : ""}>${x.desde} – ${x.hasta}</option>`).join("")}</select></label><label>Estado<br><b>${ya ? (ya.notificado ? "Notificado" : "Informe creado") : "Sin informar"}</b></label></div></div><p style="color:var(--tx2)">Crea (o actualiza) el informe de IVA del intervalo en "Informes de IVA españoles" y lo marca como notificado, con la fecha de hoy. Si ya estaba notificado, pregunta si es una declaración sustitutiva.</p>`, { tabs: ["Parámetros"] });
};
/* Intrastat: entregas y adquisiciones intracomunitarias de bienes de las facturas registradas */
function filasIntrastat() {
  const out = [];
  S.d.facturas.filter(f => estadoF(f) === "Registrado").forEach(f => {
    const t = terPorId(f.tercero_id) || {}, cli = f.tipo === "V", fi = t.ficha || {};
    lineasF(f).forEach(l => {
      const c = codLinea(f, l), bien = cli ? c.ue === "E" : (c.tipo === "ue" && c.bien); if (!bien) return;
      const pl = S.d.plineas.find(x => x.id === l.pedido_linea_id), a = pl ? artPorId(pl.articulo_id) : null, imp = r2((+l.cantidad || 0) * (+l.precio || 0)), merc = a ? ((a.ficha || {}).intrastat || "") : "";
      out.push({ fecha: fechaIva(f), dir: cli ? "Expedición" : "Llegada", pais: fi.pais || "", prov: parm("intrastat", "provincia", ""), trans: parm("intrastat", "transaccion", "11"), transp: parm("intrastat", "transporte", "3"), merc, peso: a ? r3((+(a.ficha || {}).peso || 0) * (+l.cantidad || 0)) : 0, imp, nif: t.cif || "", valido: !!(t.cif && fi.pais && fi.pais !== "ES" && merc), art: a ? a.codigo : "", cat: a ? (a.grupo || "") : "", factura: f.numero });
    });
  });
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha));
}
V.intrastat = () => {
  const [d, h] = rangoPeriodo(S.periodo), L = filasIntrastat().filter(r => r.fecha >= d && r.fecha <= h);
  const filas = L.map(r => `<tr class="${r.valido ? "" : "ko"}"><td>${r.fecha}</td><td>${r.dir}</td><td>${esc(r.pais)}</td><td>${esc(r.prov)}</td><td>${esc(r.trans)}</td><td>${esc(r.transp)}</td><td>${esc(r.merc)}</td><td class="n">${q3(r.peso)}</td><td class="n">${eur(r.imp)}</td><td class="n">${eur(r.imp)}</td><td>${esc(r.nif)}</td><td>${r.valido ? "Sí" : "No"}</td><td>${esc(r.art)}</td><td>${esc(r.cat)}</td><td>${esc(r.factura)}</td></tr>`).join("");
  return pagina("Intrastat", btn("intraexport", "Archivo de Intrastat (CSV)"), `<div class="lista"><table><tr><th>Fecha</th><th>Dirección</th><th>País/región</th><th>Provincia de origen o destino</th><th>Código de transacción</th><th>Transporte</th><th>Código Intrastat de la mercancía</th><th class="n">Peso</th><th class="n">Importe de la factura</th><th class="n">Importe estadístico</th><th>NIF</th><th>Es válido</th><th>Código de artículo</th><th>Categoría</th><th>Factura</th></tr>${filas || `<tr><td colspan="15" class="vacio">No hay operaciones intracomunitarias de bienes en el período.</td></tr>`}</table></div>
   <p style="color:var(--tx2)">Una fila es válida si el tercero tiene NIF y país (distinto de España) y el artículo tiene código Intrastat. Las facturas de pedidos enlazan con el artículo; las demás salen sin código.</p>`, { tabs: ["Visión general", "General"], filtros: selPer() });
};
/* Parámetros de contabilidad general, de proveedores y de clientes */
const NIFC = ["", "Sí", "No"];
const PARAM = {
  parcont: { pg: "cont", titulo: "Parámetros de Contabilidad general", secs: { "Contabilidad": [["Comprobar los números continuos", "contInt", "chk", true], ["Interrumpir en caso de cuenta de errores", "interrumpir", "chk", true], ["Permitir varias transacciones en un asiento", "varias", "chk", true], ["Comprobar registro en diario", "compReg", "chk", true], ["Diario contable ampliado", "ampliado", "chk", false]],
    "Impuestos": [["Grupo de impuestos de artículos por defecto", "grupoArt", "sel", "", () => CF("gruposArt").map(g => g.id)], ["Método de cálculo", "metodo", "sel", "Línea", () => ["Línea", "Total"]], ["Validar código de impuestos", "validarCod", "chk", true], ["Importe de impuestos incluidos", "incluidos", "chk", true], ["Impuesto no realizado", "noRealizado", "chk", true], ["Liquidación de IVA trimestral", "trimestral", "chk", false]],
    "Cierre del ejercicio": [["Eliminar entradas existentes de fin de año al volver a cerrar", "elimCierre", "chk", true], ["Crear el asiento de cierre al lanzar el proceso", "crearCierre", "chk", true], ["Establecer el ejercicio en cerrado de forma permanente", "cerrarPerm", "chk", false]],
    "Intrastat": [["Provincia de origen o destino", "provincia", "txt", ""], ["Código de transacción por defecto", "transaccion", "txt", "11"], ["Transporte por defecto", "transporte", "txt", "3"]] }, pgOf: { Intrastat: "intrastat" } },
  parprov: { pg: "prov", titulo: "Parámetros de proveedores", secs: { "General": [["Requisito de NIF", "requisitoNIF", "chk", false], ["Grupo de impuestos obligatorio", "grupoObl", "chk", true], ["Copiar configuración Precios con impuestos incluidos del proveedor", "copiarPrecios", "chk", true]],
    "Impuestos y contabilidad": [["Condiciones de pago por defecto", "condPago", "sel", "", () => CONDICIONES.map(c => [c[0], c[1]])], ["Cuenta de tesorería para pagos (9 dígitos)", "cuentaTes", "txt", ""], ["Registro del impuesto", "regImp", "sel", "Registro de facturas", () => ["Registro de facturas", "Registro de pagos"]], ["IVA intracomunitario", "ivaIntra", "chk", true]],
    "Liquidación": [["Liquidar automáticamente al pagar", "liqAuto", "chk", true]] } },
  parcli: { pg: "cli", titulo: "Parámetros de clientes", secs: { "General": [["Requisito de NIF", "requisitoNIF", "chk", false], ["Grupo de impuestos obligatorio", "grupoObl", "chk", true], ["Correo electrónico y teléfono obligatorios", "contactoObl", "chk", false]],
    "Impuestos y contabilidad": [["Condiciones de pago por defecto", "condPago", "sel", "", () => CONDICIONES.map(c => [c[0], c[1]])], ["Cuenta de tesorería para cobros (9 dígitos)", "cuentaTes", "txt", ""], ["Recargo de equivalencia por defecto en clientes nuevos", "recargoDef", "chk", false]],
    "Liquidación": [["Liquidar automáticamente al cobrar", "liqAuto", "chk", true]] } }
};
function vistaParam(k) {
  const D = PARAM[k], tabs = Object.keys(D.secs), tab = S.tabs["par" + k] && tabs.includes(S.tabs["par" + k]) ? S.tabs["par" + k] : tabs[0];
  const f = D.secs[tab].map(([et, c, tp, def, opts]) => { const pg = D.pgOf && D.pgOf[tab] ? D.pgOf[tab] : D.pg, v = parm(pg, c, def), at = `data-pm="${pg}|${c}"`;
    return tp === "chk" ? `<label class="chk"><input type="checkbox" ${at} ${v ? "checked" : ""}> ${et}</label>` : tp === "sel" ? `<label class="fld">${et}<select ${at}>${optsHtml(opts(), v)}</select></label>` : `<label class="fld">${et}<input ${at} value="${esc(v)}"></label>`; }).join("");
  return pagina(D.titulo, "", `<div class="fgrid"><div class="fcol">${f}</div></div><p style="color:var(--tx2)">Los cambios se guardan al momento. Aplicados hoy: requisito de NIF, condiciones de pago por defecto y cuenta de tesorería en terceros, y el grupo de impuestos de artículos por defecto. El resto queda registrado para las próximas fases.</p>`, { tabs, tabKey: "par" + k, vista: D.titulo });
}
V.parcont = () => vistaParam("parcont"); V.parprov = () => vistaParam("parprov"); V.parcli = () => vistaParam("parcli");

async function accionImp(a, b) {
  const id = b.dataset.id, k = b.dataset.k;
  switch (a) {
    case "selregul": S.selRegul = id; render(); return true;
    case "generarregul": await generarRegul(); return true;
    case "deshacerregul": {
      const x = regulaciones().find(y => y.id === S.selRegul); if (!x) return true;
      const post = regulaciones().find(y => y.fecha > x.fecha); if (post) { alert("Deshaga antes la regularización posterior (" + post.fecha + ")."); return true; }
      if (confirm("¿Deshacer la regularización del " + x.fecha + "? Se eliminará el asiento nº " + x.numero + ".")) { await db.borrarAsiento(x.id); S.selRegul = null; await recargar(); }
      return true;
    }
    case "cfgnuevo": S.cfgEdit = { k, nuevo: true, obj: k === "gruposImp" ? { id: "", desc: "", lado: "V", codigos: [] } : k === "gruposArt" ? { id: "", desc: "", codigos: [] } : k === "periodos" ? { id: "", desc: "", autoridad: "", unidad: "Meses", duracion: 3, modelo: "—" } : {} }; render(); return true;
    case "cfgedit": { const x = CF(k).find(y => y.id === id); if (x) { S.selCfg[k] = x.id; S.cfgEdit = { k, nuevo: false, obj: JSON.parse(JSON.stringify(x)) }; render(); } return true; }
    case "cfgcancel": S.cfgEdit = null; render(); return true;
    case "cfgsave": {
      const E = S.cfgEdit, o = E.obj, L = CF(E.k); o.id = (o.id || "").trim(); if (!o.id) { alert("Falta el código."); return true; }
      if (E.nuevo && L.some(x => x.id.toLowerCase() === o.id.toLowerCase())) { alert("Ya existe ese código."); return true; }
      for (const c of CFGDEF[E.k].ctas || []) if (o[c] && !esMov(o[c])) { alert("La cuenta " + o[c] + " debe tener 9 dígitos."); return true; }
      if (E.k === "periodos") o.duracion = +o.duracion || 3;
      await guardarCfg(E.k, E.nuevo ? [...L, o] : L.map(x => x.id === o.id ? o : x)); S.selCfg[E.k] = o.id; S.cfgEdit = null; render(); return true;
    }
    case "cfgdel": { const x = CF(k).find(y => y.id === S.selCfg[k]); if (x && confirm("¿Eliminar " + x.id + "?")) { await guardarCfg(k, CF(k).filter(y => y.id !== x.id)); S.selCfg[k] = null; render(); } return true; }
    case "irexport": { const [d, h] = rangoPeriodo(S.periodo), L = impuestosReg().filter(r => r.fecha >= d && r.fecha <= h); descargarCSV("impuestos_registrados_" + S.periodo + "_" + S.ej + ".csv", [["Asiento", "Fecha", "Factura", "Origen", "Dirección", "Grupo de impuestos", "Código", "Grupo de artículos", "Base", "Importe"], ...L.map(r => [r.asiento, r.fecha, r.factura, r.origen, r.dir, r.gi, r.cod, r.ga, nCSV(r.base), nCSV(r.cuota)])]); return true; }
    case "irliq": S.vista = "liqreg"; render(); return true;
    case "irliq2": { const { p, v } = selLiq(); if (MOD_VISTA[p.modelo]) { S.periodo = v.cod; S.vista = MOD_VISTA[p.modelo]; render(); } return true; }
    case "pagosdeper": S.vista = "pagosimp"; render(); return true;
    case "selpagoimp": S.selPagoImp = id; render(); return true;
    case "verasiento": case "verimpreg": { const m = S.d.asientos.find(x => x.id === S.selPagoImp), r = m && /^LIQ\d+-\d{4}-(.+)$/.exec(m.documento || ""); if (a === "verimpreg" && r) { S.periodo = r[1]; S.vista = "imptoreg"; render(); } else if (a === "verasiento") alert("El asiento aparece a la derecha, y en Transacciones del libro mayor."); return true; }
    case "selinf": S.selInf = id; render(); return true;
    case "informar": S.vista = "informar"; render(); return true;
    case "informar2": {
      const { p, v } = selLiq(); let L = infDe(), ya = L.find(x => x.modelo === p.modelo && x.ej === S.ej && x.cod === v.cod), hoyS = hoy();
      if (ya && ya.notificado) { if (!confirm("Ya estaba notificado. ¿Marcarlo como declaración sustitutiva?")) return true; ya.sustitutiva = true; ya.fnot = hoyS; }
      else if (ya) { ya.notificado = true; ya.fnot = hoyS; }
      else { ya = { id: uid(), modelo: p.modelo, ej: S.ej, cod: v.cod, desde: v.desde, libro: "Modelo " + (p.modelo === "—" ? p.id : p.modelo), desc: p.desc + " " + v.cod + " " + S.ej, notificado: true, fnot: hoyS, sustitutiva: false }; L = [...L, ya]; }
      await guardarCfg("informes", L); S.selInf = ya.id; S.vista = "infiva"; render(); return true;
    }
    case "marcarnot": { const L = infDe().map(x => x.id === S.selInf ? { ...x, notificado: !x.notificado, fnot: x.notificado ? "" : hoy() } : x); await guardarCfg("informes", L); render(); return true; }
    case "delinf": if (confirm("¿Eliminar el informe?")) { await guardarCfg("informes", infDe().filter(x => x.id !== S.selInf)); S.selInf = null; render(); } return true;
    case "abrirmodelo": { const x = infDe().find(y => y.id === S.selInf); if (x && MOD_VISTA[x.modelo]) { S.ej = x.ej; S.periodo = x.cod; S.vista = MOD_VISTA[x.modelo]; render(); } return true; }
    case "intraexport": { const [d, h] = rangoPeriodo(S.periodo), L = filasIntrastat().filter(r => r.fecha >= d && r.fecha <= h); descargarCSV("intrastat_" + S.periodo + "_" + S.ej + ".csv", [["Fecha", "Dirección", "País", "Provincia", "Transacción", "Transporte", "Código mercancía", "Peso", "Importe factura", "Importe estadístico", "NIF", "Válido", "Artículo", "Categoría", "Factura"], ...L.map(r => [r.fecha, r.dir, r.pais, r.prov, r.trans, r.transp, r.merc, nCSV(r.peso), nCSV(r.imp), nCSV(r.imp), r.nif, r.valido ? "Sí" : "No", r.art, r.cat, r.factura])]); return true; }
  }
  return false;
}
async function cambioImp(t) {
  const d = t.dataset;
  if (d.cg !== undefined) { S.cfgEdit.obj[d.cg] = t.value; if (d.cg === "lado") { S.cfgEdit.obj.codigos = []; render(); } return true; }
  if (d.cgc !== undefined) { const o = S.cfgEdit.obj, s = new Set(o.codigos || []); if (t.checked) s.add(d.cgc); else s.delete(d.cgc); o.codigos = [...s]; return true; }
  if (d.pm !== undefined) { const [pg, c] = d.pm.split("|"), P = { ...CF("params") }; P[pg] = { ...(P[pg] || {}), [c]: t.type === "checkbox" ? t.checked : t.value }; if (c === "cuentaTes" && t.value && !esMov(t.value)) { alert("La cuenta debe tener 9 dígitos."); render(); return true; } await guardarCfg("params", P); return true; }
  if (t.id === "fregul") { S.fechaRegul = t.value; render(); return true; }
  if (t.id === "lq-per") { S.liqPer = t.value; S.liqInt = ""; render(); return true; }
  if (t.id === "lq-int") { S.liqInt = t.value; render(); return true; }
  if (t.id === "fdirir") { S.filtroDirIR = t.value; render(); return true; }
  return false;
}

/* ---------------- Activos fijos, bancos y cierre del ejercicio (como D365) ---------------- */
// Los datos se guardan con la misma configuración de empresa que los impuestos (modelos_manual), sin tablas nuevas.
async function asegurarCta(cod, nombre) { // cuenta de movimiento, creando antes su título si falta
  if (S.d.cuentas.some(c => c.codigo === cod)) return;
  if (!maestroDe(cod)) { const t = cod.slice(0, 3); if (!nombreMaestro(t)) throw new Error("No existe el título " + t + " en el plan de cuentas. Créelo en Cuentas principales."); await db.crearCuentas(S.emp.id, [[t, nombreMaestro(t)]]); S.d.cuentas.push({ id: uid(), empresa_id: S.emp.id, codigo: t, nombre: nombreMaestro(t) }); }
  await asegurarCuenta(cod, nombre || nombreMaestro(cod.slice(0, 4)) || nombreMaestro(cod.slice(0, 3)));
}
const hayAsiento = id => S.d.asientos.some(a => a.id === id);
const asNum = a => a ? a.ejercicio + "-" + String(a.numero).padStart(5, "0") : "";
const saldoCta = (cta, hasta) => r2(S.d.apuntes.reduce((s, p) => { if (p.cuenta !== cta) return s; const a = S.d.asientos.find(x => x.id === p.asiento_id); return a && (!hasta || a.fecha <= hasta) ? s + +p.debe - +p.haber : s; }, 0));

/* Activos fijos */
SEED.activos = () => [];
SEED.gruposActivo = () => [
  ["APL", "Aplicaciones informáticas", "206000001", "280600001", "680000001", 4], ["CON", "Construcciones", "211000001", "281100001", "681000001", 33], ["MAQ", "Maquinaria", "213000001", "281300001", "681000001", 8],
  ["MOB", "Mobiliario", "216000001", "281600001", "681000001", 10], ["INF", "Equipos informáticos", "217000001", "281700001", "681000001", 4], ["VEH", "Elementos de transporte", "218000001", "281800001", "681000001", 6]
].map(([id, desc, ctaActivo, ctaAcum, ctaGasto, vida]) => ({ id, desc, ctaActivo, ctaAcum, ctaGasto, vida }));
CFGDEF.gruposActivo = { titulo: "Grupos de activos fijos", cols: [["id", "Grupo de activos fijos"], ["desc", "Nombre"], ["ctaActivo", "Cuenta de activo"], ["ctaAcum", "Amortización acumulada"], ["ctaGasto", "Gasto de amortización"], ["vida", "Vida útil (años)"]],
  form: () => [["id", "Grupo de activos fijos"], ["desc", "Nombre"], ["ctaActivo", "Cuenta de activo", { list: "dlcta" }], ["ctaAcum", "Cuenta de amortización acumulada", { list: "dlcta" }], ["ctaGasto", "Cuenta de gasto de amortización", { list: "dlcta" }], ["vida", "Vida útil (años)", { tipo: "number" }]], ctas: ["ctaActivo", "ctaAcum", "ctaGasto"] };
const grupoAF = id => CF("gruposActivo").find(g => g.id === id) || {};
const amortRegistrada = x => r2((x.hist || []).filter(h => hayAsiento(h.asiento)).reduce((s, h) => s + h.importe, 0));
const amortAcum = x => r2((+x.acumIni || 0) + amortRegistrada(x));
const estadoAF = x => x.baja && hayAsiento(x.baja.asiento) ? "Dado de baja" : "Abierto";
const baseAF = x => r2((+x.coste || 0) - (+x.residual || 0));
function pendienteAF(x, hasta) { // amortización lineal pendiente hasta el mes de la fecha, contando desde el mes de inicio
  if (!x.inicio || !(+x.meses) || x.inicio > hasta || estadoAF(x) !== "Abierto") return 0;
  const m = (+hasta.slice(0, 4) - +x.inicio.slice(0, 4)) * 12 + (+hasta.slice(5, 7) - +x.inicio.slice(5, 7)) + 1, n = Math.max(0, Math.min(+x.meses, m));
  const objetivo = n >= +x.meses ? baseAF(x) : r2(baseAF(x) * n / +x.meses);
  return Math.max(0, r2(objetivo - amortAcum(x)));
}
V.activos = () => {
  if (S.afEdit) return fichaActivo();
  const L = [...CF("activos")].sort((a, b) => a.id.localeCompare(b.id)), sel = L.find(x => x.id === S.selAF);
  const filas = L.map(x => `<tr data-sel class="${sel && sel.id === x.id ? "sel" : ""}" data-a="selaf" data-id="${esc(x.id)}"><td><a data-a="editaf" data-id="${esc(x.id)}">${esc(x.id)}</a></td><td>${esc(x.nombre)}</td><td>${esc(x.grupo)}</td><td>${x.alta || ""}</td><td class="n">${eur(+x.coste || 0)}</td><td class="n">${eur(amortAcum(x))}</td><td class="n">${eur(estadoAF(x) === "Abierto" ? r2((+x.coste || 0) - amortAcum(x)) : 0)}</td><td>${estadoAF(x)}</td></tr>`).join("");
  const acc = btn("nuevoaf", "+ Nuevo") + btn("editaf", "Editar", `data-id="${sel ? esc(sel.id) : ""}"`, !sel) + btn("delaf", "Eliminar", "", !sel) + SEP + btn("vista", "Propuesta de amortización", 'data-v="amort"') + btn("bajaaf", "Dar de baja", "", !sel || estadoAF(sel) !== "Abierto") + btn("deshacerbaja", "Deshacer baja", "", !sel || estadoAF(sel) === "Abierto");
  return pagina("Activos fijos", acc, `${S.bajaAF && sel ? `<div class="card"><b>Baja de ${esc(sel.id)} · ${esc(sel.nombre)}</b><div class="row" style="margin-top:.5rem"><label>Fecha de baja<br><input type="date" id="baja-fecha" value="${hoy()}"></label><span>Valor neto: <b>${eur(r2(+sel.coste - amortAcum(sel)))}</b></span><label>Importe de venta (si se vende)<br><input id="baja-venta" size="10"></label><button class="p" data-a="confirmarbaja">Registrar baja</button><button data-a="cancelarbaja">Cancelar</button></div><p style="color:var(--tx2)">Da de baja el coste y la amortización acumulada. Sin venta, el valor neto va a pérdidas (671000001). Con venta, el importe (sin IVA) queda a cobrar en 543000001 y la diferencia va a beneficio (771000001) o pérdida (671000001); la factura con su IVA se registra aparte contra la 543. Registre antes la amortización hasta la fecha.</p></div>` : ""}
   <div class="pagina"><div class="lista"><table><tr><th>Número de activo fijo</th><th>Nombre</th><th>Grupo</th><th>Fecha de adquisición</th><th class="n">Precio de adquisición</th><th class="n">Amortización acumulada</th><th class="n">Valor neto contable</th><th>Estado</th></tr>${filas || `<tr><td colspan="8" class="vacio">No se encontró ningún elemento que mostrar aquí.</td></tr>`}</table></div></div>`);
};
function fichaActivo() {
  const e = S.afEdit, hist = (e.hist || []).filter(h => hayAsiento(h.asiento));
  const gen = `<div class="fgrid"><div class="fcol"><h4>ACTIVO FIJO</h4>${campoE("Número de activo fijo", "af", e, "id", { ro: !e.nuevo })}${campoE("Nombre", "af", e, "nombre")}${campoE("Grupo de activos fijos", "af", e, "grupo", { opts: CF("gruposActivo").map(g => [g.id, g.id + " · " + g.desc]) })}${campoE("Número de serie", "af", e, "serie")}${campoE("Ubicación", "af", e, "ubicacion")}${campoE("Responsable", "af", e, "responsable")}</div>
    <div class="fcol"><h4>ADQUISICIÓN</h4>${campoE("Fecha de adquisición", "af", e, "alta", { tipo: "date" })}${campoE("Precio de adquisición", "af", e, "coste", { tipo: "number" })}${campoE("Proveedor", "af", e, "proveedor")}${campoE("Factura", "af", e, "factura")}</div></div>`;
  const am = `<div class="fgrid"><div class="fcol"><h4>LIBRO DE AMORTIZACIÓN</h4>${campoE("Inicio de la amortización", "af", e, "inicio", { tipo: "date" })}${campoE("Vida útil (meses)", "af", e, "meses", { tipo: "number" })}${campoE("Valor residual", "af", e, "residual", { tipo: "number" })}<label class="fld">Método<input disabled value="Lineal"></label></div>
    <div class="fcol"><h4>SITUACIÓN</h4>${campoE("Amortización acumulada inicial", "af", e, "acumIni", { tipo: "number" })}<label class="fld">Amortizado en el programa<input disabled value="${eur(amortRegistrada(e))}"></label><label class="fld">Estado<input disabled value="${estadoAF(e)}"></label></div></div>`;
  const mv = `<table><tr><th>Hasta</th><th>Asiento</th><th class="n">Importe</th></tr>${hist.map(h => `<tr><td>${h.hasta}</td><td>${asNum(S.d.asientos.find(a => a.id === h.asiento))}</td><td class="n">${eur(h.importe)}</td></tr>`).join("") || `<tr><td colspan="3" class="vacio">Sin amortizaciones registradas.</td></tr>`}</table>`;
  return pagina("Activo fijo", `<button class="p" data-a="guardaraf">Guardar</button>` + btn("cancelaraf", "Cancelar"), `${secFicha("af_g", "General", gen)}${secFicha("af_a", "Amortización", am)}${secFicha("af_t", "Transacciones", mv)}`, { tabs: ["Ficha"], vista: e.id + (e.nombre ? " : " + e.nombre : "") });
}
V.amort = () => {
  const hasta = S.amortHasta || `${S.ej}-12-31`, L = CF("activos").map(x => ({ x, imp: pendienteAF(x, hasta) })).filter(o => o.imp > 0), tot = r2(L.reduce((s, o) => s + o.imp, 0));
  return pagina("Propuesta de amortización", `<button class="p" data-a="registraramort" ${L.length ? "" : "disabled"}>Registrar amortización</button>` + SEP + btn("vista", "Activos fijos", 'data-v="activos"'), `<div class="lista"><table><tr><th>Activo fijo</th><th>Nombre</th><th>Grupo</th><th>Cuenta de gasto</th><th>Cuenta de amortización acumulada</th><th class="n">Importe</th></tr>${L.map(o => { const g = grupoAF(o.x.grupo); return `<tr><td>${esc(o.x.id)}</td><td>${esc(o.x.nombre)}</td><td>${esc(o.x.grupo)}</td><td>${g.ctaGasto || ""}</td><td>${g.ctaAcum || ""}</td><td class="n">${eur(o.imp)}</td></tr>`; }).join("") || `<tr><td colspan="6" class="vacio">No hay amortización pendiente a esa fecha.</td></tr>`}${L.length ? `<tr class="tot"><td colspan="5">Total</td><td class="n">${eur(tot)}</td></tr>` : ""}</table></div>
   <p style="color:var(--tx2)">Amortización lineal por meses completos desde el mes de inicio hasta el mes de la fecha elegida, descontando lo ya amortizado. Para deshacerla, elimine el asiento desde Transacciones del libro mayor.</p>`, { tabs: ["Propuesta"], filtros: `<label>Amortizar hasta<input type="date" id="amort-hasta" value="${hasta}"></label>` });
};

/* Bancos */
SEED.bancos = () => []; SEED.concil = () => [];
CFGDEF.bancos = { titulo: "Cuentas bancarias", cols: [["id", "Cuenta bancaria"], ["nombre", "Nombre"], ["iban", "IBAN"], ["cuenta", "Cuenta contable"], ["saldo", "Saldo contable", x => x.cuenta ? eur(saldoCta(x.cuenta)) : ""]],
  form: () => [["id", "Cuenta bancaria"], ["nombre", "Nombre"], ["entidad", "Entidad"], ["iban", "IBAN"], ["swift", "SWIFT / BIC"], ["numero", "Número de cuenta"], ["cuenta", "Cuenta contable (572…)", { list: "dlcta" }], ["divisa", "Divisa", { opts: ["EUR", "USD", "GBP"] }], ["contacto", "Contacto"], ["tel", "Teléfono"]], ctas: ["cuenta"] };
const bancoSel = () => { const L = CF("bancos"); return L.find(b => b.id === S.bancoSel) || L[0]; };
const movsBanco = b => S.d.apuntes.filter(p => p.cuenta === b.cuenta).map(p => ({ ...p, a: S.d.asientos.find(x => x.id === p.asiento_id) })).filter(p => p.a && !["cierre", "apertura"].includes(p.a.origen)).sort((x, y) => x.a.fecha.localeCompare(y.a.fecha) || x.a.numero - y.a.numero);
const conciliados = b => new Set(CF("concil").filter(c => c.banco === b.id).flatMap(c => c.apuntes));
const selBanco = b => `<label>Cuenta bancaria<select id="banco">${CF("bancos").map(x => `<option value="${esc(x.id)}" ${x.id === b.id ? "selected" : ""}>${esc(x.id)} · ${esc(x.nombre || "")}</option>`).join("")}</select></label>`;
const sinBanco = t => pagina(t, btn("vista", "Cuentas bancarias", 'data-v="bancos"'), `<p>Cree primero una cuenta bancaria con su cuenta contable (572…).</p>`, { tabs: ["Lista"] });
V.bancos = () => vistaCfg("bancos"); V.grupoact = () => vistaCfg("gruposActivo");
V.movbanco = () => {
  const b = bancoSel(); if (!b || !b.cuenta) return sinBanco("Transacciones bancarias");
  const c = conciliados(b); let s = 0;
  const filas = movsBanco(b).map(p => { s = r2(s + +p.debe - +p.haber); return `<tr><td>${p.a.fecha}</td><td>${asNum(p.a)}</td><td>${esc(p.a.concepto || "")}</td><td class="n">${sal(r2(+p.debe - +p.haber))}</td><td class="n">${eur(s)}</td><td>${c.has(p.id) ? "Sí" : "No"}</td></tr>`; }).join("");
  return pagina("Transacciones bancarias", btn("vista", "Conciliación bancaria", 'data-v="conciliar"'), `<div class="lista"><table><tr><th>Fecha</th><th>Asiento</th><th>Descripción</th><th class="n">Importe</th><th class="n">Saldo</th><th>Conciliado</th></tr>${filas || `<tr><td colspan="6" class="vacio">Sin transacciones.</td></tr>`}</table></div>`, { tabs: ["Lista"], filtros: selBanco(b) });
};
function datosConcil() {
  const b = bancoSel(), fecha = S.concilFecha || hoy(), ya = conciliados(b), todos = movsBanco(b).filter(p => p.a.fecha <= fecha), pend = todos.filter(p => !ya.has(p.id)), marc = S.concilMarcas || (S.concilMarcas = new Set());
  const saldoLibro = r2(todos.reduce((s, p) => s + +p.debe - +p.haber, 0)), sinConciliar = r2(pend.filter(p => !marc.has(p.id)).reduce((s, p) => s + +p.debe - +p.haber, 0)), extracto = S.concilSaldo === "" || S.concilSaldo == null ? null : r2(num(S.concilSaldo));
  return { b, fecha, pend, marc, saldoLibro, sinConciliar, extracto, dif: extracto === null ? null : r2(extracto - (saldoLibro - sinConciliar)) };
}
V.conciliar = () => {
  const b0 = bancoSel(); if (!b0 || !b0.cuenta) return sinBanco("Conciliación bancaria");
  const D = datosConcil(), hechas = CF("concil").filter(c => c.banco === D.b.id).sort((a, b) => b.fecha.localeCompare(a.fecha));
  const filas = D.pend.map(p => `<tr><td><input type="checkbox" data-con="${p.id}" ${D.marc.has(p.id) ? "checked" : ""}></td><td>${p.a.fecha}</td><td>${asNum(p.a)}</td><td>${esc(p.a.concepto || "")}</td><td class="n">${eur(r2(+p.debe - +p.haber))}</td></tr>`).join("");
  return pagina("Conciliación bancaria", `<button class="p" data-a="guardarconcil" ${D.dif === 0 ? "" : "disabled"}>Conciliar</button>` + btn("marcartodo", "Marcar todo") + btn("deshacerconcil", "Deshacer última conciliación", "", !hechas.length), `<div class="lista"><table><tr><th>En extracto</th><th>Fecha</th><th>Asiento</th><th>Descripción</th><th class="n">Importe</th></tr>${filas || `<tr><td colspan="5" class="vacio">No hay transacciones sin conciliar hasta esa fecha.</td></tr>`}</table></div>
   <div class="pie"><span>Saldo contable <b>${eur(D.saldoLibro)}</b></span><span>Sin conciliar <b>${eur(D.sinConciliar)}</b></span><span>Saldo del extracto <b>${D.extracto === null ? "—" : eur(D.extracto)}</b></span><span>Diferencia <b class="${D.dif ? "ko" : ""}">${D.dif === null ? "—" : eur(D.dif)}</b></span></div>
   <h3 style="margin-top:1rem">Conciliaciones registradas</h3><div class="lista"><table><tr><th>Fecha del extracto</th><th class="n">Saldo del extracto</th><th class="n">Movimientos</th></tr>${hechas.map(c => `<tr><td>${c.fecha}</td><td class="n">${eur(c.saldo)}</td><td class="n">${c.apuntes.length}</td></tr>`).join("") || `<tr><td colspan="3" class="vacio">Ninguna todavía.</td></tr>`}</table></div>`,
    { tabs: ["Líneas"], filtros: selBanco(D.b) + `<label>Fecha del extracto<input type="date" id="con-fecha" value="${D.fecha}"></label><label>Saldo final del extracto<input id="con-saldo" size="14" value="${esc(S.concilSaldo || "")}"></label>` });
};

/* Cierre del ejercicio: regularización de gastos e ingresos, asiento de cierre y asiento de apertura */
const CTA_RDO = "129000001";
const asientosCierre = ej => S.d.asientos.filter(a => a.documento === "CIERRE-" + ej);
function datosCierre(ej) {
  const ids = new Set(S.d.asientos.filter(a => a.ejercicio === ej).map(a => a.id)), m = new Map();
  S.d.apuntes.forEach(p => { if (ids.has(p.asiento_id)) m.set(p.cuenta, r2((m.get(p.cuenta) || 0) + +p.debe - +p.haber)); });
  const lin = (cuenta, saldo, concepto) => ({ cuenta, concepto, debe: saldo < 0 ? -saldo : 0, haber: saldo > 0 ? saldo : 0 }); // apunte que deja la cuenta a cero
  const L = [...m].filter(([, s]) => s).sort((a, b) => a[0].localeCompare(b[0]));
  const reg = L.filter(([c]) => /^[67]/.test(c)).map(([c, s]) => lin(c, s, "Regularización"));
  const rdo = r2(L.filter(([c]) => /^[67]/.test(c)).reduce((a, [, s]) => a + s, 0)); // deudor = pérdida
  if (rdo) reg.push({ cuenta: CTA_RDO, concepto: "Resultado del ejercicio", debe: rdo > 0 ? rdo : 0, haber: rdo < 0 ? -rdo : 0 });
  const bal = new Map(L.filter(([c]) => !/^[67]/.test(c))); if (rdo) bal.set(CTA_RDO, r2((bal.get(CTA_RDO) || 0) + rdo));
  const B = [...bal].filter(([, s]) => s).sort((a, b) => a[0].localeCompare(b[0]));
  const cierre = B.map(([c, s]) => lin(c, s, "Cierre del ejercicio")), apertura = B.map(([c, s]) => lin(c, -s, "Apertura del ejercicio"));
  const avisos = [], imp = B.filter(([c]) => /^(472|477|4751)/.test(c));
  if (imp.length) avisos.push("Hay cuentas de impuestos con saldo (" + imp.map(([c, s]) => c + ": " + eur(s)).join(", ") + "). Liquide antes el IVA y las retenciones del último período.");
  const otros = L.filter(([c]) => !/^[1-7]/.test(c)); if (otros.length) avisos.push("Hay cuentas de los grupos 8 o 9 con saldo; se tratarán como cuentas de balance.");
  if (S.d.lineas.some(l => String(l.fecha).startsWith(String(ej)))) avisos.push("Hay líneas de diario sin registrar en " + ej + ".");
  return { reg, cierre, apertura, resultado: r2(-rdo), avisos };
}
V.cierre = () => {
  const ej = S.ej, hechos = asientosCierre(ej), D = datosCierre(ej);
  const tabla = (t, L) => `<h3 style="margin-top:1rem">${t}</h3><div class="lista"><table><tr><th>Cuenta</th><th>Nombre</th><th class="n">Debe</th><th class="n">Haber</th></tr>${L.map(p => `<tr><td>${p.cuenta}</td><td>${esc(nombreCuenta(p.cuenta) || nombreMaestro(p.cuenta.slice(0, 3)))}</td><td class="n">${sal(p.debe)}</td><td class="n">${sal(p.haber)}</td></tr>`).join("") || `<tr><td colspan="4" class="vacio">Sin apuntes.</td></tr>`}${L.length ? `<tr class="tot"><td colspan="2">Totales</td><td class="n">${eur(L.reduce((s, p) => s + p.debe, 0))}</td><td class="n">${eur(L.reduce((s, p) => s + p.haber, 0))}</td></tr>` : ""}</table></div>`;
  const cuerpo = hechos.length ? `<p class="ok">El ejercicio ${ej} está cerrado.</p><div class="lista"><table><tr><th>Fecha</th><th>Asiento</th><th>Concepto</th></tr>${hechos.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.numero - b.numero).map(a => `<tr><td>${a.fecha}</td><td>${asNum(a)}</td><td>${esc(a.concepto)}</td></tr>`).join("")}</table></div>`
    : `${D.avisos.map(a => `<p class="ko">${esc(a)}</p>`).join("")}<div class="card">Resultado del ejercicio ${ej}: <b>${eur(Math.abs(D.resultado))} ${D.resultado >= 0 ? "(beneficio)" : "(pérdida)"}</b></div>${tabla("1. Regularización de gastos e ingresos (31-12-" + ej + ")", D.reg)}${tabla("2. Asiento de cierre (31-12-" + ej + ")", D.cierre)}${tabla("3. Asiento de apertura (01-01-" + (ej + 1) + ")", D.apertura)}`;
  return pagina("Cierre del ejercicio", `<button class="p" data-a="cerrarej" ${!hechos.length && (D.reg.length || D.cierre.length) ? "" : "disabled"}>Cerrar el ejercicio ${ej}</button>` + btn("reabrirej", "Deshacer el cierre", "", !hechos.length), `${cuerpo}<p style="color:var(--tx2)">Haga antes la amortización, la regularización de existencias, las liquidaciones de impuestos y, si procede, el asiento del Impuesto sobre Sociedades. Con el ejercicio cerrado, el balance y los estados de ${ej} salen a cero; deshaga el cierre para volver a consultarlos o corregir.</p>`, { tabs: ["Proceso"], vista: "Ejercicio " + ej });
};

async function accionFin(a, b) {
  const id = b.dataset.id, L = () => CF("activos"), sel = () => L().find(x => x.id === S.selAF);
  switch (a) {
    case "selaf": S.selAF = id; S.bajaAF = false; render(); return true;
    case "nuevoaf": { let m = 0; L().forEach(x => { const k = /^AF(\d+)$/.exec(x.id); if (k) m = Math.max(m, +k[1]); }); S.afEdit = { nuevo: true, id: "AF" + String(m + 1).padStart(5, "0"), nombre: "", grupo: "", alta: hoy(), coste: "", inicio: hoy(), meses: "", residual: "0", acumIni: "0", hist: [] }; render(); return true; }
    case "editaf": { const x = L().find(y => y.id === (id || S.selAF)); if (x) { S.afEdit = JSON.parse(JSON.stringify(x)); S.selAF = x.id; render(); } return true; }
    case "cancelaraf": S.afEdit = null; render(); return true;
    case "guardaraf": {
      const { nuevo, ...e } = S.afEdit; e.id = (e.id || "").trim(); ["coste", "residual", "acumIni", "meses"].forEach(k => { e[k] = +num(e[k]) || 0; });
      if (!e.id || !(e.nombre || "").trim()) { alert("Faltan el número y el nombre."); return true; }
      if (!e.grupo) { alert("Elija el grupo de activos fijos."); return true; }
      if (!(e.coste > 0) || !(e.meses > 0) || !e.inicio) { alert("Indique el precio de adquisición, la vida útil en meses y el inicio de la amortización."); return true; }
      if (e.residual + e.acumIni > e.coste) { alert("El valor residual más la amortización inicial superan el precio."); return true; }
      if (nuevo && L().some(x => x.id === e.id)) { alert("Ya existe ese número."); return true; }
      await guardarCfg("activos", nuevo ? [...L(), e] : L().map(x => x.id === e.id ? e : x)); S.afEdit = null; S.selAF = e.id; render(); return true;
    }
    case "delaf": { const x = sel(); if (!x) return true; if (amortRegistrada(x) || estadoAF(x) !== "Abierto") { alert("El activo tiene transacciones y no se puede eliminar."); return true; } if (confirm("¿Eliminar " + x.id + " " + x.nombre + "?")) { await guardarCfg("activos", L().filter(y => y.id !== x.id)); S.selAF = null; render(); } return true; }
    case "bajaaf": S.bajaAF = true; render(); return true;
    case "cancelarbaja": S.bajaAF = false; render(); return true;
    case "confirmarbaja": {
      const x = sel(), fecha = document.getElementById("baja-fecha").value, g = grupoAF(x.grupo); if (!fecha) return true;
      if (pendienteAF(x, fecha) > 0 && !confirm("Queda amortización sin registrar hasta esa fecha (" + eur(pendienteAF(x, fecha)) + "). ¿Dar de baja igualmente?")) return true;
      const acum = amortAcum(x), neto = r2(x.coste - acum);
      if (saldoCta(g.ctaActivo, fecha) < x.coste && !confirm("La cuenta " + g.ctaActivo + " no tiene saldo suficiente (¿está contabilizada la compra?). ¿Continuar?")) return true;
      if (!confirm("¿Registrar la baja de " + x.id + " con fecha " + fecha + "?")) return true;
      const venta = r2(num(document.getElementById("baja-venta").value || 0)) || 0, res = r2(venta - neto);
      const ap = []; if (acum) ap.push({ cuenta: g.ctaAcum, concepto: null, debe: acum, haber: 0 }); if (venta) ap.push({ cuenta: "543000001", concepto: null, debe: venta, haber: 0 }); if (res < 0) ap.push({ cuenta: "671000001", concepto: null, debe: -res, haber: 0 }); ap.push({ cuenta: g.ctaActivo, concepto: null, debe: 0, haber: r2(x.coste) }); if (res > 0) ap.push({ cuenta: "771000001", concepto: null, debe: 0, haber: res });
      for (const p of ap) await asegurarCta(p.cuenta);
      const aid = await db.crearAsiento(S.emp.id, fecha, "Baja de activo fijo " + x.id + " " + x.nombre, ap, "activo-baja", x.id);
      await guardarCfg("activos", L().map(y => y.id === x.id ? { ...y, baja: { fecha, asiento: aid, venta } } : y)); S.bajaAF = false; await recargar(); return true;
    }
    case "deshacerbaja": { const x = sel(); if (x && x.baja && confirm("¿Deshacer la baja? Se eliminará su asiento.")) { await db.borrarAsiento(x.baja.asiento); await guardarCfg("activos", L().map(y => y.id === x.id ? { ...y, baja: null } : y)); await recargar(); } return true; }
    case "registraramort": {
      const hasta = S.amortHasta || `${S.ej}-12-31`, P = L().map(x => ({ x, imp: pendienteAF(x, hasta) })).filter(o => o.imp > 0); if (!P.length) return true;
      const m = new Map(), add = (c, lado, v) => { const k = c + "|" + lado; if (!m.has(k)) m.set(k, { cuenta: c, concepto: null, debe: 0, haber: 0 }); m.get(k)[lado] = r2(m.get(k)[lado] + v); };
      for (const o of P) { const g = grupoAF(o.x.grupo); if (!g.ctaGasto || !g.ctaAcum) { alert("El grupo " + o.x.grupo + " no tiene cuentas de amortización."); return true; } add(g.ctaGasto, "debe", o.imp); add(g.ctaAcum, "haber", o.imp); }
      if (!confirm("¿Registrar la amortización hasta " + hasta + "?")) return true;
      const ap = [...m.values()]; for (const p of ap) await asegurarCta(p.cuenta);
      const aid = await db.crearAsiento(S.emp.id, hasta, "Amortización del inmovilizado hasta " + hasta, ap, "amortizacion", "AMORT-" + hasta);
      await guardarCfg("activos", L().map(x => { const o = P.find(y => y.x.id === x.id); return o ? { ...x, hist: [...(x.hist || []).filter(h => hayAsiento(h.asiento) || h.asiento === aid), { asiento: aid, hasta, importe: o.imp }] } : x; })); await recargar(); return true;
    }
    case "marcartodo": { const D = datosConcil(); D.pend.forEach(p => D.marc.add(p.id)); render(); return true; }
    case "guardarconcil": { const D = datosConcil(); if (D.dif !== 0) return true; const ids = D.pend.filter(p => D.marc.has(p.id)).map(p => p.id); await guardarCfg("concil", [...CF("concil"), { id: uid(), banco: D.b.id, fecha: D.fecha, saldo: D.extracto, apuntes: ids }]); S.concilMarcas = null; S.concilSaldo = ""; render(); return true; }
    case "deshacerconcil": { const D = datosConcil(), ult = CF("concil").filter(c => c.banco === D.b.id).slice(-1)[0]; if (ult && confirm("¿Deshacer la conciliación del " + ult.fecha + "?")) { await guardarCfg("concil", CF("concil").filter(c => c.id !== ult.id)); S.concilMarcas = null; render(); } return true; }
    case "cerrarej": {
      const ej = S.ej, D = datosCierre(ej); if (asientosCierre(ej).length) return true;
      if (!confirm((D.avisos.length ? "ATENCIÓN:\n- " + D.avisos.join("\n- ") + "\n\n" : "") + "Se registrarán los asientos de regularización, cierre y apertura del ejercicio " + ej + ". ¿Continuar?")) return true;
      if (D.reg.length) await asegurarCta(CTA_RDO, "Resultado del ejercicio");
      const pasos = [[D.reg, `${ej}-12-31`, "Regularización de gastos e ingresos " + ej, "regularizacion"], [D.cierre, `${ej}-12-31`, "Asiento de cierre " + ej, "cierre"], [D.apertura, `${ej + 1}-01-01`, "Asiento de apertura " + (ej + 1), "apertura"]];
      for (const [ap, f, c, o] of pasos) if (ap.length) await db.crearAsiento(S.emp.id, f, c, ap, o, "CIERRE-" + ej);
      await recargar(); return true;
    }
    case "reabrirej": {
      const ej = S.ej, H = asientosCierre(ej); if (!H.length) return true;
      if (asientosCierre(ej + 1).length) { alert("El ejercicio " + (ej + 1) + " también está cerrado. Deshaga antes su cierre."); return true; }
      if (confirm("¿Deshacer el cierre de " + ej + "? Se eliminarán " + H.length + " asientos.")) { for (const x of H) await db.borrarAsiento(x.id); await recargar(); }
      return true;
    }
  }
  return false;
}
function cambioFin(t) {
  const d = t.dataset;
  if (d.af !== undefined) { setPath(S.afEdit, d.af, t.value); if (d.af === "grupo") { const g = grupoAF(t.value); if (g.vida && !(+S.afEdit.meses)) S.afEdit.meses = g.vida * 12; render(); } return true; }
  if (d.con !== undefined) { const m = S.concilMarcas || (S.concilMarcas = new Set()); if (t.checked) m.add(d.con); else m.delete(d.con); render(); return true; }
  if (t.id === "amort-hasta") { S.amortHasta = t.value; render(); return true; }
  if (t.id === "banco") { S.bancoSel = t.value; S.concilMarcas = null; S.concilSaldo = ""; render(); return true; }
  if (t.id === "con-fecha") { S.concilFecha = t.value; render(); return true; }
  if (t.id === "con-saldo") { S.concilSaldo = t.value.trim(); render(); return true; }
  return false;
}

/* ---------------- Diarios de cobros y pagos, efectos (pagarés y letras), cartera y remesas ---------------- */
SEED.diariosPago = () => []; SEED.efectos = () => []; SEED.remesas = () => [];
const EF = { cart: "431000001", desc: "431100001", gest: "431200001", imp: "431500001", deuda: "520800001", pagar: "401000001", gastos: "626000001", int: "665000001" };
const DJ = {
  pago: { titulo: "Diario de pagos a proveedores", lado: "C", ter: "P", pref: "PP", forma: "Transferencia" },
  cobro: { titulo: "Diario de pagos de clientes", lado: "V", ter: "C", pref: "PC", forma: "Transferencia" },
  pagare: { titulo: "Diario de creación de pagarés", lado: "C", ter: "P", pref: "CP", forma: "Pagaré", efecto: true },
  letra: { titulo: "Diario de creación de letras de cambio", lado: "V", ter: "C", pref: "CL", forma: "Letra de cambio", efecto: true }
};
const VIVOS = ["En cartera", "En gestión de cobro", "Descontado"];
Object.assign(DJ, { // diarios que operan sobre efectos ya creados
  letraliq: { titulo: "Diario de liquidación de letra de cambio", lado: "V", ter: "C", pref: "LL", op: "efcobrar", estados: VIVOS, efTab: "Letra" },
  letraimp: { titulo: "Diario de impago de letras de cambio", lado: "V", ter: "C", pref: "IL", op: "efimpago", estados: VIVOS, efTab: "Letra" },
  letraren: { titulo: "Diario de renegociación de letras de cambio", lado: "V", ter: "C", pref: "RL", op: "renegociar", estados: ["En cartera", "Impagado"], efTab: "Letra" },
  letraenv: { titulo: "Diario de envíos", lado: "V", ter: "C", pref: "EL", op: "envio", estados: ["En cartera"], efTab: "Letra" },
  pagliq: { titulo: "Diario de liquidación de pagarés", lado: "C", ter: "P", pref: "LP", op: "efcobrar", estados: ["Pendiente"], efTab: "Pagaré" },
  pagren: { titulo: "Diario de renegociación de pagarés", lado: "C", ter: "P", pref: "RP", op: "renegociar", estados: ["Pendiente"], efTab: "Pagaré" }
});
const FORMAS_DJ = ["Transferencia", "Recibo domiciliado", "Confirming", "Cheque", "Efectivo", "Tarjeta"];
const bancoDef = tipo => parm(DJ[tipo].lado === "V" ? "cli" : "prov", "cuentaTes", "") || (CF("bancos").find(b => b.cuenta) || {}).cuenta || cuentaSis("572");
const dlCtas = () => `<datalist id="dl">${optsCuentas()}</datalist><datalist id="dlbancos">${[...new Set([...CF("bancos").map(b => b.cuenta).filter(Boolean), ...movs().filter(c => c.codigo.startsWith("57")).map(c => c.codigo)])].map(c => `<option value="${c}">${esc(nombreCuenta(c))}</option>`).join("")}</datalist>`;
const pendientesDe = (lado, ter) => S.d.facturas.filter(f => f.tipo === lado && estadoF(f) === "Registrado" && pendienteF(f) > 0 && (!ter || f.tercero_id === ter));
const numExt = f => f.tipo === "V" ? f.numero : (f.num_externo || f.numero);
const djSel = () => CF("diariosPago").find(d => d.id === S.djAbierto);
const guardarDJ = d => guardarCfg("diariosPago", CF("diariosPago").map(x => x.id === d.id ? d : x));
function vistaDJ(tipo) {
  const D = DJ[tipo], abierto = djSel();
  if (abierto && abierto.tipo === tipo) return vistaDJLineas(abierto);
  const mostrar = S.djMostrar || "No registrado";
  const L = CF("diariosPago").filter(d => d.tipo === tipo && (mostrar === "Todo" || (mostrar === "Registrado") === !!d.registrado)).sort((a, b) => b.num.localeCompare(a.num)), sel = L.find(d => d.id === S.djSel);
  const filas = L.map(d => `<tr data-sel class="${sel && sel.id === d.id ? "sel" : ""}" data-a="seldj" data-id="${d.id}"><td><a data-a="abrirdj" data-id="${d.id}">${d.num}</a></td><td>${esc(d.nombre)}</td><td><input data-djc="${d.id}" value="${esc(d.desc || "")}" size="50" ${d.registrado ? "disabled" : ""}></td><td>${d.registrado ? "✓" : ""}</td><td>${d.registrado || ""}</td><td class="n">${eur(d.lineas.reduce((s, l) => s + (+l.importe || 0), 0))}</td></tr>`).join("");
  return pagina(D.titulo, btn("nuevodj", "+ Nuevo", `data-t="${tipo}"`) + btn("abrirdj", "Líneas", `data-id="${sel ? sel.id : ""}"`, !sel) + btn("deldj", "Eliminar", "", !sel || !!sel.registrado), `<div class="lista"><table class="editable"><tr><th>Número de lote de diario</th><th>Nombre</th><th>Descripción</th><th>Contabilizado</th><th>Registrado en</th><th class="n">Importe</th></tr>${filas || `<tr><td colspan="6" class="vacio">No se encontró ningún elemento que mostrar aquí.</td></tr>`}</table></div>`,
    { tabs: ["Lista"], filtros: `<label>Mostrar<select id="dj-mostrar">${["No registrado", "Registrado", "Todo"].map(x => `<option ${x === mostrar ? "selected" : ""}>${x}</option>`).join("")}</select></label>` });
}
function vistaDJLineas(d) {
  if (DJ[d.tipo].op) return vistaDJEfectos(d);
  const D = DJ[d.tipo], reg = !!d.registrado, dis = reg ? "disabled" : "", tab = S.tabs.djl || "Visión general", ef = D.efecto;
  const ters = S.d.terceros.filter(t => t.tipo === D.ter);
  const filas = d.lineas.map((l, i) => {
    const t = terPorId(l.tercero_id), fs = pendientesDe(D.lado, l.tercero_id), act = S.d.facturas.find(f => f.id === l.factura_id);
    if (act && !fs.includes(act)) fs.unshift(act);
    const inp = (k, size, extra = "") => `<input data-dj="${i}" data-k="${k}" size="${size}" value="${esc(l[k] ?? "")}" ${extra} ${dis}>`;
    const comunes = `<td><input type="date" data-dj="${i}" data-k="fecha" value="${l.fecha || ""}" ${dis}></td><td><input data-dj="${i}" data-k="tercero" list="dlter" size="8" value="${esc(t ? t.codigo : "")}" ${dis}></td><td>${esc(t ? t.nombre : "")}</td>`;
    const fin = `<td>${l.asiento ? asNum(S.d.asientos.find(a => a.id === l.asiento)) : ""}</td><td>${reg ? "" : `<button class="d" data-a="deldjl" data-i="${i}">✕</button>`}</td></tr>`;
    if (tab === "General") return `<tr>${comunes}<td>${inp("desc", 40)}</td><td>${inp("referencia", 16)}</td>${fin}`;
    if (tab === (ef ? DJ[d.tipo].forma.split(" ")[0] : "Pago")) return `<tr>${comunes}${ef ? `<td><input type="date" data-dj="${i}" data-k="venc" value="${l.venc || ""}" ${dis}></td><td>${inp("numero", 14)}</td><td>${inp("banco", 10, 'list="dlbancos"')}</td><td>${inp("lugar", 14)}</td>` : `<td><select data-dj="${i}" data-k="forma" ${dis}>${optsHtml(FORMAS_DJ, l.forma)}</select></td><td>${inp("especificacion", 16)}</td><td>${inp("numero", 14)}</td>`}${fin}`;
    return `<tr>${comunes}<td><select data-dj="${i}" data-k="factura_id" ${dis}>${optsHtml(fs.map(f => [f.id, numExt(f) + " · " + (f.fecha_vencimiento || "") + " · " + eur(pendienteF(f))]), l.factura_id)}</select></td><td><input class="n" data-dj="${i}" data-k="importe" size="10" value="${l.importe ?? ""}" ${dis}></td><td>${inp("desc", 26)}</td>${ef ? `<td><input type="date" data-dj="${i}" data-k="venc" value="${l.venc || ""}" ${dis}></td>` : `<td>${inp("banco", 10, 'list="dlbancos"')}</td>`}${fin}`;
  }).join("");
  const tabEf = ef ? D.forma.split(" ")[0] : "Pago";
  const heads = tab === "General" ? ["Descripción", "Referencia del pago"] : tab === tabEf ? (ef ? ["Fecha de vencimiento", "N.º de " + tabEf.toLowerCase(), "Cuenta bancaria", "Lugar de expedición"] : ["Forma de pago", "Especificación del pago", "Referencia / n.º"]) : ["Factura (vencimiento · pendiente)", "Importe", "Descripción", ef ? "Fecha de vencimiento" : "Cuenta de contrapartida (banco)"];
  const tot = r2(d.lineas.reduce((s, l) => s + (+l.importe || 0), 0));
  const acc = btn("volverdj", "← Diarios") + (reg ? "" : btn("adddjl", "+ Línea") + btn("propuesta", ef ? "Propuesta de efectos" : "Propuesta de pago") + btn("validardj", "Validar") + `<button class="p" data-a="registrardj">Registrar</button>`);
  return pagina(D.titulo, acc, `${dlCtas()}<datalist id="dlter">${ters.map(t => `<option value="${esc(t.codigo)}">${esc(t.nombre)}</option>`).join("")}</datalist>
   <div class="lista"><table class="editable"><tr><th>Fecha</th><th>Cuenta</th><th>Nombre</th>${heads.map(h => `<th>${h}</th>`).join("")}<th>Asiento</th><th></th></tr>${filas || `<tr><td colspan="9" class="vacio">Sin líneas. Use "+ Línea" o la propuesta.</td></tr>`}</table></div><div class="pie"><span>Líneas <b>${d.lineas.length}</b></span><span>Total del diario <b>${eur(tot)}</b></span></div>`,
    { tabs: ["Visión general", "General", tabEf], tabKey: "djl", vista: d.num + " : " + d.nombre, filtros: reg ? "" : `<label>Propuesta: vencimientos hasta<input type="date" id="dj-hasta" value="${S.djHasta || hoy()}"></label>` });
}
V.dletraenv = () => vistaDJ("letraenv"); V.dletraliq = () => vistaDJ("letraliq"); V.dletraimp = () => vistaDJ("letraimp"); V.dletraren = () => vistaDJ("letraren"); V.dpagliq = () => vistaDJ("pagliq"); V.dpagren = () => vistaDJ("pagren");
V.dpago = () => vistaDJ("pago"); V.dcobro = () => vistaDJ("cobro"); V.dpagare = () => vistaDJ("pagare"); V.dletra = () => vistaDJ("letra");
function validarDJ(d) {
  if (DJ[d.tipo].op) return validarDJEfectos(d);
  const D = DJ[d.tipo], err = [], usado = new Map();
  if (!d.lineas.length) err.push("El diario no tiene líneas.");
  d.lineas.forEach((l, i) => {
    if (l.asiento && hayAsiento(l.asiento)) return;
    const n = "Línea " + (i + 1) + ": ", t = terPorId(l.tercero_id), f = S.d.facturas.find(x => x.id === l.factura_id), imp = r2(+l.importe || 0);
    if (!l.fecha) err.push(n + "falta la fecha.");
    if (!t) return err.push(n + "falta la cuenta."); if (!cuentaValida(t.cuenta)) err.push(n + "el tercero no tiene cuenta contable válida.");
    if (!f || f.tercero_id !== t.id) return err.push(n + "elija la factura que se liquida.");
    if (!(imp > 0)) err.push(n + "el importe debe ser mayor que cero.");
    const u = r2((usado.get(f.id) || 0) + imp); usado.set(f.id, u); if (u > pendienteF(f)) err.push(n + "se supera lo pendiente de " + numExt(f) + " (" + eur(pendienteF(f)) + ").");
    if (D.efecto) { if (!l.venc) err.push(n + "falta la fecha de vencimiento del efecto."); else if (l.venc < l.fecha) err.push(n + "el vencimiento es anterior a la fecha."); }
    else if (!esMov(l.banco) || !String(l.banco).startsWith("5")) err.push(n + "la cuenta de contrapartida debe ser una cuenta de 9 dígitos de tesorería (57…).");
  });
  return err;
}
const efectos = () => CF("efectos").filter(e => hayAsiento(e.hist[0].asiento));
async function registrarDJ(d) {
  if (DJ[d.tipo].op) return registrarDJEfectos(d);
  const D = DJ[d.tipo], err = validarDJ(d); if (err.length) return alert("No se puede registrar:\n" + err.join("\n"));
  if (!confirm("¿Registrar el diario " + d.num + " (" + d.lineas.length + " líneas)?")) return;
  for (const [n, l] of d.lineas.entries()) {
    if (l.asiento && hayAsiento(l.asiento)) continue;
    const t = terPorId(l.tercero_id), f = S.d.facturas.find(x => x.id === l.factura_id), imp = r2(+l.importe), cli = D.lado === "V";
    const contra = D.efecto ? (cli ? EF.cart : EF.pagar) : l.banco;
    await asegurarCta(contra, D.efecto ? (cli ? "Efectos comerciales en cartera" : "Proveedores, efectos comerciales a pagar") : "");
    const tl = { cuenta: t.cuenta, concepto: null, debe: cli ? 0 : imp, haber: cli ? imp : 0, tercero_id: t.id }, cl = { cuenta: contra, concepto: null, debe: cli ? imp : 0, haber: cli ? 0 : imp };
    const concepto = (d.tipo === "pago" ? "Pago factura " : d.tipo === "cobro" ? "Cobro factura " : d.tipo === "pagare" ? "Pagaré factura " : "Letra factura ") + numExt(f) + " " + t.nombre;
    l.asiento = await db.crearAsiento(S.emp.id, l.fecha, concepto, cli ? [cl, tl] : [tl, cl], d.tipo, d.num);
    await db.guardarLiquidacion({ id: uid(), empresa_id: S.emp.id, factura_id: f.id, asiento_id: l.asiento, fecha: l.fecha, importe: imp });
    await guardarDJ(d);
    if (D.efecto) await guardarCfg("efectos", [...CF("efectos"), { id: uid(), tipo: D.ter, numero: l.numero || d.num + "-" + (n + 1), tercero_id: t.id, factura: numExt(f), importe: imp, emision: l.fecha, venc: l.venc, banco: l.banco || "", estado: cli ? "En cartera" : "Pendiente", hist: [{ fecha: l.fecha, estado: cli ? "En cartera" : "Pendiente", asiento: l.asiento, asientos: [l.asiento] }] }]);
    S.d = await db.cargar(S.emp.id);
  }
  d.registrado = hoy(); await guardarDJ(d); await recargar();
}
/* Cartera de efectos y remesas */
const ESTADOS_EF = { C: ["En cartera", "En gestión de cobro", "Descontado", "Cobrado", "Impagado", "Renegociado"], P: ["Pendiente", "Pagado", "Renegociado"] };
function vistaCartera() {
  const tp = S.carteraTipo || "C", est = S.carteraEst || "", cli = tp === "C";
  const L = efectos().filter(e => e.tipo === tp && (!est || e.estado === est)).sort((a, b) => a.venc.localeCompare(b.venc)), sel = S.efSel || (S.efSel = new Set());
  const filas = L.map(e => { const t = terPorId(e.tercero_id) || {}; return `<tr class="${e.venc < hoy() && !["Cobrado", "Pagado", "Renegociado"].includes(e.estado) ? "ko" : ""}"><td><input type="checkbox" data-ef="${e.id}" ${sel.has(e.id) ? "checked" : ""}></td><td>${esc(e.numero)}</td><td>${esc(t.codigo || "")}</td><td>${esc(t.nombre || "")}</td><td>${esc(e.factura)}</td><td>${e.emision}</td><td>${e.venc}</td><td class="n">${eur(e.importe)}</td><td>${e.estado}</td></tr>`; }).join("");
  const marc = L.filter(e => sel.has(e.id)), todos = estados => marc.length && marc.every(e => estados.includes(e.estado));
  const acc = (cli ? btn("remcobro", "Remesar al cobro", "", !todos(["En cartera"])) + btn("remdesc", "Remesar al descuento", "", !todos(["En cartera"])) + SEP + btn("efcobrar", "Registrar cobro", "", !todos(["En cartera", "En gestión de cobro", "Descontado"])) + btn("efimpago", "Registrar impago", "", !todos(["En cartera", "En gestión de cobro", "Descontado"])) : btn("efcobrar", "Registrar pago", "", !todos(["Pendiente"]))) + SEP + btn("efdeshacer", "Deshacer última operación", "", !marc.length);
  return pagina("Cartera de efectos", acc, `${dlCtas()}<div class="card"><div class="row"><label>Fecha de la operación<br><input type="date" id="ef-fecha" value="${hoy()}"></label><label>Cuenta bancaria<br><input id="ef-banco" list="dlbancos" size="12" value="${bancoDef(cli ? "cobro" : "pago")}"></label>${cli ? `<label>Gastos bancarios<br><input id="ef-gastos" size="8"></label><label>Intereses de descuento<br><input id="ef-int" size="8"></label>` : ""}<span>Seleccionados: <b>${marc.length}</b> · <b>${eur(marc.reduce((s, e) => s + e.importe, 0))}</b></span></div></div>
   <div class="lista"><table><tr><th></th><th>N.º de efecto</th><th>Cuenta</th><th>Nombre</th><th>Factura</th><th>Emisión</th><th>Vencimiento</th><th class="n">Importe</th><th>Estado</th></tr>${filas || `<tr><td colspan="9" class="vacio">No hay efectos. Se crean en el diario de creación de ${cli ? "letras de cambio" : "pagarés"}.</td></tr>`}${L.length ? `<tr class="tot"><td colspan="7">Total</td><td class="n">${eur(L.reduce((s, e) => s + e.importe, 0))}</td><td></td></tr>` : ""}</table></div>`,
    { tabs: ["Cartera"], filtros: `<label>Cartera<select id="car-tipo"><option value="C" ${cli ? "selected" : ""}>Efectos a cobrar (clientes)</option><option value="P" ${cli ? "" : "selected"}>Efectos a pagar (proveedores)</option></select></label><label>Estado<select id="car-est"><option value="">Todos</option>${ESTADOS_EF[tp].map(x => `<option ${x === est ? "selected" : ""}>${x}</option>`).join("")}</select></label>` });
}
V.cartera = vistaCartera;
V.remesas = () => {
  const L = [...CF("remesas")].sort((a, b) => b.fecha.localeCompare(a.fecha)), E = CF("efectos"), sel = L.find(r => r.id === S.selRem);
  return pagina("Remesas", btn("remcsv", "Exportar remesa (CSV)", "", !sel), `<div class="pagina"><div class="lista"><table><tr><th>Remesa</th><th>Fecha</th><th>Tipo</th><th>Cuenta bancaria</th><th class="n">Efectos</th><th class="n">Importe</th></tr>${L.map(r => `<tr data-sel class="${sel && sel.id === r.id ? "sel" : ""}" data-a="selrem" data-id="${r.id}"><td>${r.num}</td><td>${r.fecha}</td><td>${r.tipo}</td><td>${r.banco}</td><td class="n">${r.efectos.length}</td><td class="n">${eur(r.importe)}</td></tr>`).join("") || `<tr><td colspan="6" class="vacio">Sin remesas. Se crean desde la cartera de efectos.</td></tr>`}</table></div>
   <aside class="factbox"><h3>Efectos de la remesa</h3>${sel ? `<dl>${sel.efectos.map(i => E.find(e => e.id === i)).filter(Boolean).map(e => `<dt>${esc(e.numero)} · ${e.venc}</dt><dd>${eur(e.importe)} · ${e.estado}</dd>`).join("")}</dl>` : `<p style="color:var(--tx2)">Seleccione una remesa.</p>`}</aside></div>`, { tabs: ["Lista"] });
};
function asientoEfecto(e, op, banco, gg = 0, ii = 0) { // apuntes de una operación sobre un efecto y estado en que queda
  const ap = (cuenta, debe, haber) => ({ cuenta, concepto: null, debe: r2(debe), haber: r2(haber) });
  const v = e.importe, orig = e.estado === "En gestión de cobro" ? EF.gest : e.estado === "Descontado" ? EF.desc : e.estado === "Impagado" ? EF.imp : EF.cart;
  const gastos = () => gg ? [ap(EF.gastos, gg, 0), ap(banco, 0, gg)] : [];
  if (op === "remcobro") return { L: [ap(EF.gest, v, 0), ap(EF.cart, 0, v), ...gastos()], estado: "En gestión de cobro", txt: "Remesa al cobro" };
  if (op === "remdesc") return { L: [ap(banco, v - gg - ii, 0), ...(ii ? [ap(EF.int, ii, 0)] : []), ...(gg ? [ap(EF.gastos, gg, 0)] : []), ap(EF.deuda, 0, v), ap(EF.desc, v, 0), ap(EF.cart, 0, v)], estado: "Descontado", txt: "Remesa al descuento" };
  if (op === "renegociar") { const extra = r2(gg + ii), nuevo = r2(v + extra);
    return { nuevo, estado: "Renegociado", txt: "Renegociación de " + (e.tipo === "C" ? "letra" : "pagaré"), L: e.tipo === "C" ? [ap(EF.cart, nuevo, 0), ap(orig, 0, v), ...(extra ? [ap("769000001", 0, extra)] : [])] : [ap(EF.pagar, v, 0), ...(extra ? [ap("662000001", extra, 0)] : []), ap(EF.pagar, 0, nuevo)] }; }
  if (op === "efcobrar" && e.tipo === "P") return { L: [ap(EF.pagar, v, 0), ap(banco, 0, v), ...gastos()], estado: "Pagado", txt: "Pago de pagaré" };
  if (op === "efcobrar") return { L: [...(e.estado === "Descontado" ? [ap(EF.deuda, v, 0), ap(EF.desc, 0, v)] : [ap(banco, v, 0), ap(orig, 0, v)]), ...gastos()], estado: "Cobrado", txt: "Cobro de efecto" };
  return { L: [...(e.estado === "Descontado" ? [ap(EF.deuda, v, 0), ap(banco, 0, v), ap(EF.imp, v, 0), ap(EF.desc, 0, v)] : [ap(EF.imp, v, 0), ap(orig, 0, v)]), ...gastos()], estado: "Impagado", txt: "Impago de efecto" };
}

/* Diarios de liquidación, impago y renegociación de efectos */
function vistaDJEfectos(d) {
  const D = DJ[d.tipo], reg = !!d.registrado, dis = reg ? "disabled" : "", tab = S.tabs.djl || "Visión general", ren = D.op === "renegociar", cli = D.ter === "C", E = efectos();
  const heads = tab === "General" ? ["Descripción", "Referencia"] : tab === D.efTab ? ["Factura", "Emisión", "Vencimiento", "Estado del efecto"]
    : ren ? ["Importe", "Nuevo vencimiento", "Nuevo n.º", "Gastos repercutidos", "Intereses", "Nuevo importe"] : D.op === "envio" ? ["Importe", "Tipo de envío", "Cuenta bancaria", "Gastos bancarios", "Intereses de descuento"] : ["Importe", D.op === "efimpago" ? "Gastos de devolución" : "Gastos bancarios", "Cuenta de contrapartida (banco)"];
  const filas = d.lineas.map((l, i) => {
    const e = CF("efectos").find(x => x.id === l.efecto_id), t = e ? terPorId(e.tercero_id) || {} : {};
    const libres = E.filter(x => x.tipo === D.ter && (D.estados.includes(x.estado) || x.id === l.efecto_id));
    const inp = (k, size, extra = "") => `<input data-dj="${i}" data-k="${k}" size="${size}" value="${esc(l[k] ?? "")}" ${extra} ${dis}>`;
    const mid = tab === "General" ? `<td>${inp("desc", 40)}</td><td>${inp("referencia", 16)}</td>` : tab === D.efTab ? `<td>${esc(e ? e.factura : "")}</td><td>${e ? e.emision : ""}</td><td>${e ? e.venc : ""}</td><td>${e ? e.estado : ""}</td>`
      : ren ? `<td class="n">${e ? eur(e.importe) : ""}</td><td><input type="date" data-dj="${i}" data-k="venc" value="${l.venc || ""}" ${dis}></td><td>${inp("numero", 14)}</td><td>${inp("gastos", 7)}</td><td>${inp("intereses", 7)}</td><td class="n">${e ? eur(e.importe + (+l.gastos || 0) + (+l.intereses || 0)) : ""}</td>`
        : D.op === "envio" ? `<td class="n">${e ? eur(e.importe) : ""}</td><td><select data-dj="${i}" data-k="envio" ${dis}>${["Cobro", "Descuento"].map(x => `<option ${x === l.envio ? "selected" : ""}>${x}</option>`).join("")}</select></td><td>${inp("banco", 10, 'list="dlbancos"')}</td><td>${inp("gastos", 8)}</td><td>${inp("intereses", 8)}</td>`
        : `<td class="n">${e ? eur(e.importe) : ""}</td><td>${inp("gastos", 8)}</td><td>${inp("banco", 10, 'list="dlbancos"')}</td>`;
    return `<tr><td><input type="date" data-dj="${i}" data-k="fecha" value="${l.fecha || ""}" ${dis}></td><td><select data-dj="${i}" data-k="efecto_id" ${dis}>${optsHtml(libres.map(x => [x.id, x.numero + " · " + x.venc + " · " + eur(x.importe)]), l.efecto_id)}</select></td><td>${esc(t.codigo || "")}</td><td>${esc(t.nombre || "")}</td>${mid}<td>${l.asiento ? asNum(S.d.asientos.find(a => a.id === l.asiento)) : ""}</td><td>${reg ? "" : `<button class="d" data-a="deldjl" data-i="${i}">✕</button>`}</td></tr>`;
  }).join("");
  const tot = r2(d.lineas.reduce((s, l) => s + ((CF("efectos").find(x => x.id === l.efecto_id) || {}).importe || 0), 0));
  return pagina(D.titulo, btn("volverdj", "← Diarios") + (reg ? "" : btn("adddjl", "+ Línea") + btn("propuesta", "Propuesta de efectos") + btn("validardj", "Validar") + `<button class="p" data-a="registrardj">Registrar</button>`),
    `${dlCtas()}<div class="lista"><table class="editable"><tr><th>Fecha</th><th>${cli ? "Letra de cambio" : "Pagaré"}</th><th>Cuenta</th><th>Nombre</th>${heads.map(h => `<th>${h}</th>`).join("")}<th>Asiento</th><th></th></tr>${filas || `<tr><td colspan="${heads.length + 6}" class="vacio">Sin líneas. Use "+ Línea" o la propuesta.</td></tr>`}</table></div><div class="pie"><span>Líneas <b>${d.lineas.length}</b></span><span>Importe de los efectos <b>${eur(tot)}</b></span></div>`,
    { tabs: ["Visión general", "General", D.efTab], tabKey: "djl", vista: d.num + " : " + d.nombre, filtros: reg ? "" : `<label>Propuesta: vencimientos hasta<input type="date" id="dj-hasta" value="${S.djHasta || hoy()}"></label>` });
}
const opLinea = (D, l) => D.op === "envio" ? (l.envio === "Descuento" ? "remdesc" : "remcobro") : D.op;
const bancoNecesario = (op, e, gg) => op === "remdesc" || gg > 0 && op !== "renegociar" || (op === "efcobrar" && e.estado !== "Descontado") || (op === "efimpago" && e.estado === "Descontado");
function validarDJEfectos(d) {
  const D = DJ[d.tipo], err = [], usados = new Set(), E = efectos();
  if (!d.lineas.length) err.push("El diario no tiene líneas.");
  d.lineas.forEach((l, i) => {
    if (l.asiento && hayAsiento(l.asiento)) return;
    const n = "Línea " + (i + 1) + ": ", e = E.find(x => x.id === l.efecto_id), gg = +l.gastos || 0;
    if (!l.fecha) err.push(n + "falta la fecha.");
    if (!e) return err.push(n + "elija el efecto.");
    if (!D.estados.includes(e.estado)) err.push(n + "el efecto " + e.numero + " está «" + e.estado + "» y no admite esta operación.");
    if (usados.has(e.id)) err.push(n + "el efecto " + e.numero + " está repetido."); usados.add(e.id);
    if (gg < 0 || (+l.intereses || 0) < 0) err.push(n + "gastos e intereses no pueden ser negativos.");
    if (D.op === "renegociar") { if (!l.venc) err.push(n + "falta el nuevo vencimiento."); else if (l.venc <= l.fecha) err.push(n + "el nuevo vencimiento debe ser posterior a la fecha."); }
    else if (bancoNecesario(opLinea(D, l), e, gg) && !(esMov(l.banco) && String(l.banco).startsWith("5"))) err.push(n + "indique la cuenta de tesorería (57…).");
  });
  return err;
}
async function registrarDJEfectos(d) {
  const D = DJ[d.tipo], err = validarDJEfectos(d); if (err.length) return alert("No se puede registrar:\n" + err.join("\n"));
  if (!confirm("¿Registrar el diario " + d.num + " (" + d.lineas.length + " líneas)?")) return;
  for (const l of d.lineas) {
    if (l.asiento && hayAsiento(l.asiento)) continue;
    const e = efectos().find(x => x.id === l.efecto_id), R = asientoEfecto(e, opLinea(D, l), l.banco, +l.gastos || 0, +l.intereses || 0);
    for (const x of R.L) await asegurarCta(x.cuenta);
    l.asiento = await db.crearAsiento(S.emp.id, l.fecha, R.txt + " " + e.numero + " " + ((terPorId(e.tercero_id) || {}).nombre || ""), R.L, "efecto", d.num);
    await guardarDJ(d);
    const paso = estado => ({ fecha: l.fecha, estado, asiento: l.asiento, asientos: [l.asiento] });
    let lista = CF("efectos").map(x => x.id === e.id ? { ...e, estado: R.estado, hist: [...e.hist, paso(R.estado)] } : x);
    if (D.op === "renegociar") { const ini = e.tipo === "C" ? "En cartera" : "Pendiente"; lista = [...lista, { ...e, id: uid(), origen: e.id, numero: l.numero || e.numero + "-R", importe: R.nuevo, emision: l.fecha, venc: l.venc, estado: ini, hist: [paso(ini)] }]; }
    await guardarCfg("efectos", lista); S.d = await db.cargar(S.emp.id);
  }
  if (D.op === "envio") { // una remesa por tipo de envío, banco y fecha
    const G = new Map(); d.lineas.forEach(l => { const k = (l.envio || "Cobro") + "|" + (l.banco || "") + "|" + l.fecha; G.set(k, [...(G.get(k) || []), l.efecto_id]); });
    for (const [k, ids] of G) { const [tipo, banco, fecha] = k.split("|"), R = CF("remesas"); await guardarCfg("remesas", [...R, { id: uid(), num: "REM" + String(R.length + 1).padStart(5, "0"), fecha, tipo: tipo === "Cobro" ? "Gestión de cobro" : "Descuento", banco, efectos: ids, importe: r2(ids.reduce((s, i) => s + ((CF("efectos").find(x => x.id === i) || {}).importe || 0), 0)), diario: d.num }]); }
  }
  d.registrado = hoy(); await guardarDJ(d); await recargar();
}

async function operarEfectos(op) {
  const sel = efectos().filter(e => S.efSel.has(e.id)); if (!sel.length) return;
  const fecha = document.getElementById("ef-fecha").value, banco = document.getElementById("ef-banco").value.trim(), g = r2(num((document.getElementById("ef-gastos") || {}).value || 0)) || 0, int = r2(num((document.getElementById("ef-int") || {}).value || 0)) || 0;
  if (!fecha) return alert("Falta la fecha.");
  const usaBanco = g > 0 || op === "remdesc" || (op === "efcobrar" && sel.some(e => e.estado !== "Descontado")) || sel.some(e => op === "efimpago" && e.estado === "Descontado");
  if (usaBanco && !esMov(banco)) return alert("Indique la cuenta bancaria (9 dígitos).");
  if (!confirm("¿Registrar la operación sobre " + sel.length + " efecto(s) por " + eur(sel.reduce((s, e) => s + e.importe, 0)) + "?")) return;
  let primero = true; const total = r2(sel.reduce((s, e) => s + e.importe, 0)), cambios = new Map();
  for (const e of sel) {
    const gg = primero ? g : 0, ii = primero ? int : 0; primero = false;
    const { L, estado, txt } = asientoEfecto(e, op, banco, gg, ii);
    for (const x of L) await asegurarCta(x.cuenta);
    const aid = await db.crearAsiento(S.emp.id, fecha, txt + " " + e.numero + " " + ((terPorId(e.tercero_id) || {}).nombre || ""), L, "efecto", e.numero);
    cambios.set(e.id, { ...e, estado, hist: [...e.hist, { fecha, estado, asientos: [aid] }] });
    await guardarCfg("efectos", CF("efectos").map(x => cambios.get(x.id) || x));
  }
  if (op === "remcobro" || op === "remdesc") await guardarCfg("remesas", [...CF("remesas"), { id: uid(), num: "REM" + String(CF("remesas").length + 1).padStart(5, "0"), fecha, tipo: op === "remcobro" ? "Gestión de cobro" : "Descuento", banco, efectos: sel.map(e => e.id), importe: total }]);
  S.efSel = new Set(); await recargar();
}
async function deshacerEfectos() {
  const sel = efectos().filter(e => S.efSel.has(e.id)); if (!sel.length || !confirm("¿Deshacer la última operación de " + sel.length + " efecto(s)? Se eliminan sus asientos.")) return;
  for (const e of sel) {
    const ult = e.hist[e.hist.length - 1];
    for (const l of S.d.liquidaciones.filter(l => ult.asientos.includes(l.asiento_id))) await db.borrarLiquidacion(l.id);
    const A = ult.asientos;
    if (CF("efectos").some(x => x.id !== e.id && A.includes(x.hist[0].asiento) && x.hist.length > 1)) { alert("El efecto nacido de la renegociación de " + e.numero + " ya tiene operaciones. Deshágalas antes."); continue; }
    for (const a of A) if (hayAsiento(a)) await db.borrarAsiento(a);
    await guardarCfg("efectos", CF("efectos").filter(x => !A.includes(x.hist[0].asiento)).map(x => { const u = x.hist[x.hist.length - 1]; if (x.hist.length < 2 || !u.asientos.some(a => A.includes(a))) return x; const h = x.hist.slice(0, -1); return { ...x, hist: h, estado: h[h.length - 1].estado }; }));
  }
  S.efSel = new Set(); await recargar();
}

/* ---------------- Tesorería: extractos Norma 43, transferencias y previsión ---------------- */
function leerN43(texto) { // cuaderno AEB 43: registros 11 (cabecera), 22 (movimiento), 23 (conceptos) y 33 (final)
  const cuentas = []; let c = null, m = null;
  const f = s => "20" + s.slice(0, 2) + "-" + s.slice(2, 4) + "-" + s.slice(4, 6), imp = (clave, s) => r2((clave === "1" ? -1 : 1) * (+s / 100));
  for (const ln of texto.split(/\r?\n/)) {
    const t = ln.slice(0, 2);
    if (t === "11") { c = { entidad: ln.slice(2, 6), oficina: ln.slice(6, 10), cuenta: ln.slice(10, 20), desde: f(ln.slice(20, 26)), hasta: f(ln.slice(26, 32)), inicial: imp(ln[32], ln.slice(33, 47)), final: null, movs: [] }; cuentas.push(c); }
    else if (t === "22" && c) { m = { id: c.movs.length, fecha: f(ln.slice(10, 16)), importe: imp(ln[27], ln.slice(28, 42)), concepto: ln.slice(52).replace(/^0+/, "").replace(/\s+/g, " ").trim() }; c.movs.push(m); }
    else if (t === "23" && m) m.concepto = (ln.slice(4).replace(/\s+/g, " ").trim() + " " + m.concepto).trim();
    else if (t === "33" && c) c.final = imp(ln[58], ln.slice(59, 73));
  }
  return cuentas.filter(x => x.movs.length || x.final !== null);
}
function casarExtracto() { // empareja cada movimiento del extracto con un apunte sin conciliar del mismo importe y fecha cercana (±5 días)
  const b = bancoSel(), X = S.extracto; if (!b || !X) return [];
  const ya = conciliados(b), libres = movsBanco(b).filter(p => !ya.has(p.id)), usados = new Set(), dist = (a, c) => Math.abs((new Date(a) - new Date(c)) / 864e5);
  return X.movs.map(m => { const p = libres.filter(p => !usados.has(p.id) && r2(+p.debe - +p.haber) === m.importe && dist(p.a.fecha, m.fecha) <= 5).sort((x, y) => dist(x.a.fecha, m.fecha) - dist(y.a.fecha, m.fecha))[0]; if (p) usados.add(p.id); return { m, p }; });
}
V.extractos = () => {
  const b = bancoSel(); if (!b || !b.cuenta) return sinBanco("Extractos bancarios");
  const X = S.extracto, R = casarExtracto(), ok = R.filter(r => r.p);
  const filas = R.map(r => `<tr><td>${r.m.fecha}</td><td>${esc(r.m.concepto)}</td><td class="n">${eur(r.m.importe)}</td><td>${r.p ? "Asiento " + asNum(r.p.a) + " · " + esc(r.p.a.concepto || "") : `<input data-ex="${r.m.id}" list="dl" size="12" placeholder="Cuenta contrapartida"> <button data-a="contabex" data-i="${r.m.id}">Contabilizar</button>`}</td><td>${r.p ? "Sí" : "No"}</td></tr>`).join("");
  return pagina("Extractos bancarios", btn("aplicarex", "Llevar a la conciliación", "", !ok.length), `${dlCtas()}${X ? `<div class="card">Cuenta del fichero <b>${X.entidad}-${X.oficina}-${X.cuenta}</b> · del ${X.desde} al ${X.hasta} · saldo inicial <b>${eur(X.inicial)}</b> · saldo final <b>${X.final === null ? "—" : eur(X.final)}</b> · casados ${ok.length} de ${R.length}</div><div class="lista"><table class="editable"><tr><th>Fecha</th><th>Concepto</th><th class="n">Importe</th><th>Transacción contable</th><th>Casado</th></tr>${filas}</table></div>` : `<p>Cargue un fichero Norma 43 (cuaderno AEB 43) descargado de su banco. Se lee en su ordenador y no se guarda.</p>`}`,
    { tabs: ["Líneas"], filtros: selBanco(b) + `<label>Fichero Norma 43<input type="file" id="n43" accept=".txt,.n43,.q43,.aeb,.csb"></label>` });
};
V.transfer = () => {
  const L = S.d.asientos.filter(a => a.origen === "transferencia").sort((a, b) => b.fecha.localeCompare(a.fecha));
  return pagina("Transferencias bancarias", `<button class="p" data-a="transferir">Registrar transferencia</button>`, `${dlCtas()}<div class="card"><div class="row"><label>Fecha<br><input type="date" id="tr-fecha" value="${hoy()}"></label><label>Desde la cuenta<br><input id="tr-de" list="dlbancos" size="12"></label><label>A la cuenta<br><input id="tr-a" list="dlbancos" size="12"></label><label>Importe<br><input id="tr-imp" size="10"></label><label>Comisión<br><input id="tr-com" size="8"></label><label>Descripción<br><input id="tr-desc" size="30"></label></div></div>
   <div class="lista"><table><tr><th>Fecha</th><th>Asiento</th><th>Descripción</th><th class="n">Importe</th></tr>${L.map(a => `<tr><td>${a.fecha}</td><td>${asNum(a)}</td><td>${esc(a.concepto)}</td><td class="n">${eur(Math.max(...S.d.apuntes.filter(p => p.asiento_id === a.id).map(p => +p.debe)))}</td></tr>`).join("") || `<tr><td colspan="4" class="vacio">Sin transferencias.</td></tr>`}</table></div>`, { tabs: ["Lista"] });
};
V.prevision = () => {
  const cuentas = [...new Set([...CF("bancos").map(b => b.cuenta).filter(Boolean), ...movs().filter(c => c.codigo.startsWith("57")).map(c => c.codigo)])], inicial = r2(cuentas.reduce((s, c) => s + saldoCta(c, hoy()), 0));
  const M = [];
  [["V", 1], ["C", -1]].forEach(([lado, s]) => pendientesDe(lado).forEach(f => M.push({ fecha: f.fecha_vencimiento || hoy(), tipo: s > 0 ? "Cobro factura" : "Pago factura", ref: numExt(f), ter: (terPorId(f.tercero_id) || {}).nombre || "", imp: s * pendienteF(f) })));
  efectos().forEach(e => { if (["En cartera", "En gestión de cobro", "Pendiente"].includes(e.estado)) M.push({ fecha: e.venc, tipo: e.tipo === "C" ? "Letra a cobrar" : "Pagaré a pagar", ref: e.numero, ter: (terPorId(e.tercero_id) || {}).nombre || "", imp: e.tipo === "C" ? e.importe : -e.importe }); });
  M.sort((a, b) => a.fecha.localeCompare(b.fecha));
  let saldo = inicial;
  const filas = M.map(m => { saldo = r2(saldo + m.imp); return `<tr class="${saldo < 0 ? "ko" : ""}"><td>${m.fecha}${m.fecha < hoy() ? " (vencido)" : ""}</td><td>${m.tipo}</td><td>${esc(m.ref)}</td><td>${esc(m.ter)}</td><td class="n">${m.imp > 0 ? eur(m.imp) : ""}</td><td class="n">${m.imp < 0 ? eur(-m.imp) : ""}</td><td class="n">${eur(saldo)}</td></tr>`; }).join("");
  return pagina("Previsión de flujo de efectivo", "", `<div class="card">Saldo actual en caja y bancos: <b>${eur(inicial)}</b> · Saldo previsto al final: <b>${eur(saldo)}</b></div><div class="lista"><table><tr><th>Fecha prevista</th><th>Origen</th><th>Documento</th><th>Tercero</th><th class="n">Entradas</th><th class="n">Salidas</th><th class="n">Saldo previsto</th></tr>${filas || `<tr><td colspan="7" class="vacio">No hay cobros ni pagos pendientes.</td></tr>`}</table></div>`, { tabs: ["Previsión"] });
};

/* ---------------- Clientes y proveedores: antigüedad de saldos y extracto de cuenta ---------------- */
function vistaAntiguedad(tipo) {
  const cli = tipo === "C", lado = cli ? "V" : "C", al = S.antFecha || hoy(), M = new Map();
  pendientesDe(lado).forEach(f => { const d = Math.floor((new Date(al) - new Date(f.fecha_vencimiento || f.fecha_emision || al)) / 864e5), i = d <= 0 ? 0 : d <= 30 ? 1 : d <= 60 ? 2 : d <= 90 ? 3 : 4, r = M.get(f.tercero_id) || [0, 0, 0, 0, 0]; r[i] = r2(r[i] + pendienteF(f)); M.set(f.tercero_id, r); });
  const L = [...M].map(([id, r]) => ({ t: terPorId(id) || {}, r, tot: r2(r.reduce((a, b) => a + b, 0)) })).sort((a, b) => b.tot - a.tot), T = [0, 1, 2, 3, 4].map(i => r2(L.reduce((s, x) => s + x.r[i], 0)));
  return pagina(cli ? "Antigüedad de saldos de clientes" : "Antigüedad de saldos de proveedores", "", `<div class="lista"><table><tr><th>Cuenta</th><th>Nombre</th><th class="n">No vencido</th><th class="n">1 a 30 días</th><th class="n">31 a 60</th><th class="n">61 a 90</th><th class="n">Más de 90</th><th class="n">Total pendiente</th></tr>${L.map(x => `<tr><td>${esc(x.t.codigo || "")}</td><td>${esc(x.t.nombre || "")}</td>${x.r.map(v => `<td class="n">${sal(v)}</td>`).join("")}<td class="n">${eur(x.tot)}</td></tr>`).join("") || `<tr><td colspan="8" class="vacio">No hay saldos pendientes.</td></tr>`}${L.length ? `<tr class="tot"><td colspan="2">Total</td>${T.map(v => `<td class="n">${eur(v)}</td>`).join("")}<td class="n">${eur(T.reduce((a, b) => a + b, 0))}</td></tr>` : ""}</table></div><p style="color:var(--tx2)">Facturas registradas pendientes, por días desde el vencimiento. Las liquidadas con pagaré o letra ya no cuentan aquí: están en la cartera.</p>`,
    { tabs: ["Lista"], filtros: `<label>Antigüedad a fecha<input type="date" id="ant-fecha" value="${al}"></label>` });
}
V.antcli = () => vistaAntiguedad("C"); V.antprov = () => vistaAntiguedad("P");
function datosExtracto(tipo) {
  const cli = tipo === "C", L = S.d.terceros.filter(t => t.tipo === tipo).sort((a, b) => a.codigo.localeCompare(b.codigo)), t = L.find(x => x.id === S.extTer) || L[0];
  const d = S.extDesde || `${S.ej}-01-01`, h = S.extHasta || `${S.ej}-12-31`, sg = cli ? 1 : -1;
  const todos = t ? S.d.apuntes.filter(p => p.tercero_id === t.id).map(p => ({ ...p, a: S.d.asientos.find(x => x.id === p.asiento_id) })).filter(p => p.a).sort((x, y) => x.a.fecha.localeCompare(y.a.fecha) || x.a.numero - y.a.numero) : [];
  const ini = r2(todos.filter(p => p.a.fecha < d).reduce((s, p) => s + sg * (+p.debe - +p.haber), 0));
  return { L, t, d, h, sg, ini, movs: todos.filter(p => p.a.fecha >= d && p.a.fecha <= h) };
}
function vistaExtracto(tipo) {
  const cli = tipo === "C", D = datosExtracto(tipo); let s = D.ini;
  const filas = D.movs.map(p => { s = r2(s + D.sg * (+p.debe - +p.haber)); return `<tr><td>${p.a.fecha}</td><td>${asNum(p.a)}</td><td>${esc(p.a.concepto || "")}</td><td class="n">${sal(+p.debe)}</td><td class="n">${sal(+p.haber)}</td><td class="n">${eur(s)}</td></tr>`; }).join("");
  return pagina(cli ? "Extracto de cuenta de cliente" : "Extracto de cuenta de proveedor", btn("extcsv", "Exportar CSV", `data-t="${tipo}"`, !D.t) + btn("imprimir", "Imprimir"), `${D.t ? `<div class="card"><b>${esc(D.t.codigo)} · ${esc(D.t.nombre)}</b> · NIF ${esc(D.t.cif || "—")} · del ${D.d} al ${D.h}</div>` : ""}<div class="lista"><table><tr><th>Fecha</th><th>Asiento</th><th>Descripción</th><th class="n">Debe</th><th class="n">Haber</th><th class="n">Saldo</th></tr><tr><td colspan="5">Saldo anterior</td><td class="n">${eur(D.ini)}</td></tr>${filas}<tr class="tot"><td colspan="5">Saldo final</td><td class="n">${eur(s)}</td></tr></table></div>`,
    { tabs: ["Extracto"], filtros: `<label>${cli ? "Cliente" : "Proveedor"}<select id="ext-ter">${D.L.map(t => `<option value="${t.id}" ${D.t && D.t.id === t.id ? "selected" : ""}>${esc(t.codigo + " · " + t.nombre)}</option>`).join("")}</select></label><label>Desde<input type="date" id="ext-desde" value="${D.d}"></label><label>Hasta<input type="date" id="ext-hasta" value="${D.h}"></label>` });
}
V.extcli = () => vistaExtracto("C"); V.extprov = () => vistaExtracto("P");

/* ---------------- Contabilidad general: asientos periódicos, libro diario y períodos ---------------- */
SEED.periodicos = () => []; SEED.cerrados = () => [];
const mesAct = () => S.perMes || hoy().slice(0, 7);
V.periodicos = () => {
  const L = CF("periodicos"), mes = mesAct(), sel = L.find(x => x.id === S.selPerio), cand = [...S.d.asientos].filter(a => !["cierre", "apertura", "regularizacion", "periodico"].includes(a.origen)).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.numero - a.numero).slice(0, 200);
  const hecho = x => S.d.asientos.some(a => a.documento === `PER-${x.id}-${mes}`);
  return pagina("Asientos periódicos", `<button class="p" data-a="genper" ${L.some(x => !hecho(x)) ? "" : "disabled"}>Generar los pendientes de ${mes}</button>` + btn("delper", "Eliminar plantilla", "", !sel), `<div class="card"><div class="row"><label>Crear plantilla a partir del asiento<br><select id="per-origen">${cand.map(a => `<option value="${a.id}">${a.fecha} · ${asNum(a)} · ${esc(a.concepto || "")}</option>`).join("")}</select></label><label>Nombre<br><input id="per-nombre" size="30"></label><label>Día del mes<br><input id="per-dia" size="4" value="1"></label><button data-a="addper" ${cand.length ? "" : "disabled"}>+ Crear plantilla</button></div></div>
   <div class="pagina"><div class="lista"><table><tr><th>Plantilla</th><th>Día</th><th class="n">Importe</th><th>${mes}</th></tr>${L.map(x => `<tr data-sel class="${sel && sel.id === x.id ? "sel" : ""}" data-a="selper" data-id="${x.id}"><td>${esc(x.nombre)}</td><td>${x.dia}</td><td class="n">${eur(x.lineas.reduce((s, p) => s + p.debe, 0))}</td><td>${hecho(x) ? "Generado" : "Pendiente"}</td></tr>`).join("") || `<tr><td colspan="4" class="vacio">Sin plantillas.</td></tr>`}</table></div>
   <aside class="factbox"><h3>Líneas</h3>${sel ? `<dl>${sel.lineas.map(p => `<dt>${p.cuenta} ${esc(nombreCuenta(p.cuenta))}</dt><dd>${p.debe ? "D " + eur(p.debe) : "H " + eur(p.haber)}</dd>`).join("")}</dl>` : `<p style="color:var(--tx2)">Seleccione una plantilla.</p>`}</aside></div>`, { tabs: ["Lista"], filtros: `<label>Mes<input type="month" id="per-mes" value="${mes}"></label>` });
};
function datosLD() {
  const d = S.libDesde || `${S.ej}-01-01`, h = S.libHasta || `${S.ej}-12-31`;
  return { d, h, L: S.d.asientos.filter(a => a.fecha >= d && a.fecha <= h).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.numero - b.numero).map(a => ({ a, ap: S.d.apuntes.filter(p => p.asiento_id === a.id) })) };
}
V.librodiario = () => {
  const D = datosLD(), tot = r2(D.L.reduce((s, x) => s + x.ap.reduce((t, p) => t + +p.debe, 0), 0));
  const filas = D.L.slice(0, 500).map(x => x.ap.map((p, i) => `<tr><td>${i ? "" : x.a.fecha}</td><td>${i ? "" : asNum(x.a)}</td><td>${p.cuenta}</td><td>${esc(nombreCuenta(p.cuenta))}</td><td>${esc(p.concepto || x.a.concepto || "")}</td><td class="n">${sal(+p.debe)}</td><td class="n">${sal(+p.haber)}</td></tr>`).join("")).join("");
  return pagina("Libro diario", btn("libcsv", "Exportar CSV") + btn("imprimir", "Imprimir"), `${D.L.length > 500 ? `<p>Se muestran 500 de ${D.L.length} asientos; el CSV los incluye todos.</p>` : ""}<div class="lista"><table><tr><th>Fecha</th><th>Asiento</th><th>Cuenta</th><th>Nombre</th><th>Descripción</th><th class="n">Debe</th><th class="n">Haber</th></tr>${filas || `<tr><td colspan="7" class="vacio">Sin asientos.</td></tr>`}<tr class="tot"><td colspan="5">Totales</td><td class="n">${eur(tot)}</td><td class="n">${eur(tot)}</td></tr></table></div>`, { tabs: ["Informe"], filtros: `<label>Desde<input type="date" id="lib-desde" value="${D.d}"></label><label>Hasta<input type="date" id="lib-hasta" value="${D.h}"></label>` });
};
V.calendario = () => {
  const C = new Set(CF("cerrados")), meses = MESES.map((n, i) => ({ n, k: `${S.ej}-${String(i + 1).padStart(2, "0")}` }));
  return pagina("Calendario del libro mayor", "", `<div class="lista"><table><tr><th>Período</th><th>Desde</th><th class="n">Asientos</th><th>Estado</th><th></th></tr>${meses.map(m => `<tr><td>${m.n} ${S.ej}</td><td>${m.k}-01</td><td class="n">${S.d.asientos.filter(a => a.fecha.startsWith(m.k)).length}</td><td class="${C.has(m.k) ? "ko" : "ok"}">${C.has(m.k) ? "En espera (cerrado)" : "Abierto"}</td><td><button data-a="cambiaper" data-id="${m.k}">${C.has(m.k) ? "Abrir" : "Cerrar"}</button></td></tr>`).join("")}</table></div><p style="color:var(--tx2)">En un período cerrado no se pueden registrar, modificar ni eliminar asientos desde ninguna pantalla.</p>`, { tabs: ["Períodos"], vista: "Ejercicio " + S.ej });
};
const periodoCerrado = fecha => fecha && (CF("cerrados") || []).includes(String(fecha).slice(0, 7));

/* ---------------- Activos fijos: transacciones y cuadro de amortización ---------------- */
V.aftrans = () => {
  const L = [];
  CF("activos").forEach(x => { L.push({ f: x.alta, x, t: "Adquisición", i: +x.coste }); if (+x.acumIni) L.push({ f: x.inicio, x, t: "Amortización acumulada inicial", i: +x.acumIni }); (x.hist || []).filter(h => hayAsiento(h.asiento)).forEach(h => L.push({ f: h.hasta, x, t: "Amortización", i: h.importe, a: h.asiento })); if (estadoAF(x) !== "Abierto") L.push({ f: x.baja.fecha, x, t: x.baja.venta ? "Baja por venta" : "Baja por desecho", i: x.baja.venta || 0, a: x.baja.asiento }); });
  L.sort((a, b) => String(a.f).localeCompare(String(b.f)));
  return pagina("Transacciones de activos fijos", "", `<div class="lista"><table><tr><th>Fecha</th><th>Activo fijo</th><th>Nombre</th><th>Tipo de transacción</th><th class="n">Importe</th><th>Asiento</th></tr>${L.map(r => `<tr><td>${r.f || ""}</td><td>${esc(r.x.id)}</td><td>${esc(r.x.nombre)}</td><td>${r.t}</td><td class="n">${eur(r.i)}</td><td>${r.a ? asNum(S.d.asientos.find(a => a.id === r.a)) : ""}</td></tr>`).join("") || `<tr><td colspan="6" class="vacio">Sin transacciones.</td></tr>`}</table></div>`, { tabs: ["Lista"] });
};
V.afcuadro = () => {
  const anios = [0, 1, 2, 3, 4, 5].map(i => S.ej + i);
  const objetivo = (x, y) => { if (!x.inicio || !(+x.meses)) return 0; const n = Math.max(0, Math.min(+x.meses, (y - +x.inicio.slice(0, 4)) * 12 + 12 - +x.inicio.slice(5, 7) + 1)); return n >= +x.meses ? baseAF(x) : r2(baseAF(x) * n / +x.meses); };
  const L = CF("activos").filter(x => estadoAF(x) === "Abierto"), cuota = (x, y) => r2(objetivo(x, y) - objetivo(x, y - 1));
  return pagina("Cuadro de amortización", "", `<div class="lista"><table><tr><th>Activo fijo</th><th>Nombre</th><th class="n">Base amortizable</th>${anios.map(y => `<th class="n">${y}</th>`).join("")}</tr>${L.map(x => `<tr><td>${esc(x.id)}</td><td>${esc(x.nombre)}</td><td class="n">${eur(baseAF(x))}</td>${anios.map(y => `<td class="n">${sal(cuota(x, y))}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="9" class="vacio">Sin activos abiertos.</td></tr>`}${L.length ? `<tr class="tot"><td colspan="3">Total</td>${anios.map(y => `<td class="n">${eur(L.reduce((s, x) => s + cuota(x, y), 0))}</td>`).join("")}</tr>` : ""}</table></div><p style="color:var(--tx2)">Cuota lineal teórica de cada año desde el inicio de la amortización de cada activo.</p>`, { tabs: ["Informe"] });
};

async function accionTes(a, b) {
  const id = b.dataset.id;
  switch (a) {
    case "seldj": S.djSel = id; if (b.tagName === "TR") render(); return true;
    case "nuevodj": { const tp = b.dataset.t, D = DJ[tp], n = CF("diariosPago").filter(d => d.tipo === tp).reduce((m, d) => Math.max(m, +d.num.slice(2)), 0) + 1, d = { id: uid(), tipo: tp, num: D.pref + String(n).padStart(6, "0"), nombre: D.pref, desc: D.titulo.replace("Diario de ", "").toUpperCase(), registrado: "", lineas: [] }; await guardarCfg("diariosPago", [...CF("diariosPago"), d]); S.djAbierto = d.id; S.djSel = d.id; S.tabs.djl = "Visión general"; render(); return true; }
    case "abrirdj": if (id || S.djSel) { S.djAbierto = id || S.djSel; S.tabs.djl = "Visión general"; render(); } return true;
    case "volverdj": S.djAbierto = null; render(); return true;
    case "deldj": { const d = CF("diariosPago").find(x => x.id === S.djSel); if (d && !d.registrado && !d.lineas.some(l => l.asiento && hayAsiento(l.asiento)) && confirm("¿Eliminar el diario " + d.num + "?")) { await guardarCfg("diariosPago", CF("diariosPago").filter(x => x.id !== d.id)); S.djSel = null; render(); } return true; }
    case "adddjl": { const d = djSel(), u = d.lineas[d.lineas.length - 1] || {}; if (DJ[d.tipo].op) { d.lineas.push({ id: uid(), fecha: u.fecha || hoy(), efecto_id: null, banco: u.banco || bancoDef(d.tipo), gastos: "", intereses: "", venc: "", numero: "", desc: "", envio: "Cobro" }); await guardarDJ(d); render(); return true; } d.lineas.push({ id: uid(), fecha: u.fecha || hoy(), tercero_id: null, factura_id: null, importe: "", desc: "", banco: u.banco || (DJ[d.tipo].efecto ? "" : bancoDef(d.tipo)), forma: u.forma || (DJ[d.tipo].efecto ? "" : DJ[d.tipo].forma), venc: "", numero: "" }); await guardarDJ(d); render(); return true; }
    case "deldjl": { const d = djSel(); d.lineas.splice(+b.dataset.i, 1); await guardarDJ(d); render(); return true; }
    case "propuesta": {
      const d = djSel(), D = DJ[d.tipo], hasta = S.djHasta || hoy(), ya = new Set(d.lineas.map(l => l.factura_id));
      if (D.op) { const usados = new Set(d.lineas.map(l => l.efecto_id)), es = efectos().filter(e => e.tipo === D.ter && D.estados.includes(e.estado) && e.venc <= hasta && !usados.has(e.id)).sort((x, y) => x.venc.localeCompare(y.venc));
        if (!es.length) { alert("No hay efectos disponibles con vencimiento hasta " + hasta + "."); return true; }
        es.forEach(e => d.lineas.push({ id: uid(), fecha: hoy(), efecto_id: e.id, banco: bancoDef(d.tipo), gastos: "", intereses: "", venc: "", numero: "", desc: "", envio: "Cobro" })); await guardarDJ(d); render(); return true; }
      const fs = pendientesDe(D.lado).filter(f => (f.fecha_vencimiento || "") <= hasta && !ya.has(f.id)).sort((x, y) => (x.fecha_vencimiento || "").localeCompare(y.fecha_vencimiento || ""));
      if (!fs.length) { alert("No hay facturas pendientes con vencimiento hasta " + hasta + "."); return true; }
      fs.forEach(f => { const t = terPorId(f.tercero_id) || {}; d.lineas.push({ id: uid(), fecha: hoy(), tercero_id: f.tercero_id, factura_id: f.id, importe: pendienteF(f), desc: numExt(f) + " " + (t.nombre || ""), banco: D.efecto ? "" : bancoDef(d.tipo), forma: D.efecto ? "" : ((t.ficha || {}).pago || {}).forma || D.forma, venc: D.efecto ? (f.fecha_vencimiento >= hoy() ? f.fecha_vencimiento : hoy()) : "", numero: "" }); });
      await guardarDJ(d); render(); return true;
    }
    case "validardj": { const e = validarDJ(djSel()); alert(e.length ? "Errores:\n" + e.join("\n") : "El diario es correcto."); return true; }
    case "registrardj": await registrarDJ(djSel()); return true;
    case "remcobro": case "remdesc": case "efcobrar": case "efimpago": await operarEfectos(a); return true;
    case "efdeshacer": await deshacerEfectos(); return true;
    case "selrem": S.selRem = id; render(); return true;
    case "remcsv": { const r = CF("remesas").find(x => x.id === S.selRem), E = CF("efectos"); if (r) descargarCSV(r.num + ".csv", [["Remesa", "Efecto", "NIF", "Nombre", "Vencimiento", "Importe", "IBAN"], ...r.efectos.map(i => E.find(e => e.id === i)).filter(Boolean).map(e => { const t = terPorId(e.tercero_id) || {}; return [r.num, e.numero, t.cif || "", t.nombre || "", e.venc, nCSV(e.importe), ((t.ficha || {}).pago || {}).banco || ""]; })]); return true; }
    case "aplicarex": { const R = casarExtracto().filter(r => r.p); S.concilMarcas = new Set(R.map(r => r.p.id)); S.concilFecha = S.extracto.hasta; S.concilSaldo = S.extracto.final === null ? "" : String(S.extracto.final).replace(".", ","); S.vista = "conciliar"; render(); return true; }
    case "contabex": {
      const m = S.extracto.movs[+b.dataset.i], cta = (document.querySelector(`[data-ex="${b.dataset.i}"]`) || {}).value.trim(), bk = bancoSel();
      if (!esMov(cta)) { alert("Indique la cuenta de contrapartida (9 dígitos)."); return true; }
      if (S.d.terceros.some(t => t.cuenta === cta)) { alert("Los cobros y pagos de clientes y proveedores se registran en sus diarios, para liquidar la factura."); return true; }
      if (!confirm("¿Contabilizar " + eur(m.importe) + " del " + m.fecha + " contra " + cta + "?")) return true;
      await asegurarCta(cta); const v = Math.abs(m.importe), entra = m.importe > 0;
      await db.crearAsiento(S.emp.id, m.fecha, m.concepto || "Movimiento bancario", [{ cuenta: bk.cuenta, concepto: null, debe: entra ? v : 0, haber: entra ? 0 : v }, { cuenta: cta, concepto: null, debe: entra ? 0 : v, haber: entra ? v : 0 }], "extracto", "N43"); await recargar(); return true;
    }
    case "transferir": {
      const v = i => document.getElementById(i).value.trim(), de = v("tr-de"), al = v("tr-a"), imp = r2(num(v("tr-imp"))), com = r2(num(v("tr-com") || 0)) || 0, fecha = v("tr-fecha");
      if (!fecha || !esMov(de) || !esMov(al) || de === al || !(imp > 0)) { alert("Indique fecha, dos cuentas distintas de 9 dígitos e importe."); return true; }
      if (!confirm("¿Registrar la transferencia de " + eur(imp) + " de " + de + " a " + al + "?")) return true;
      const ap = [{ cuenta: al, concepto: null, debe: imp, haber: 0 }, ...(com ? [{ cuenta: EF.gastos, concepto: null, debe: com, haber: 0 }] : []), { cuenta: de, concepto: null, debe: 0, haber: r2(imp + com) }];
      for (const p of ap) await asegurarCta(p.cuenta);
      await db.crearAsiento(S.emp.id, fecha, v("tr-desc") || "Transferencia bancaria", ap, "transferencia", "TRB"); await recargar(); return true;
    }
    case "extcsv": { const D = datosExtracto(b.dataset.t); let s = D.ini; descargarCSV("extracto_" + D.t.codigo + ".csv", [["Fecha", "Asiento", "Descripción", "Debe", "Haber", "Saldo"], [D.d, "", "Saldo anterior", "", "", nCSV(D.ini)], ...D.movs.map(p => { s = r2(s + D.sg * (+p.debe - +p.haber)); return [p.a.fecha, asNum(p.a), p.a.concepto || "", nCSV(p.debe), nCSV(p.haber), nCSV(s)]; })]); return true; }
    case "imprimir": window.print(); return true;
    case "letcsv": { const D = datosLetras(b.dataset.k); descargarCSV(b.dataset.k + "_" + hoy() + ".csv", [D.h.map(h => h.replace("#", "")), ...D.f.map(f => f.map((v, i) => D.h[i].startsWith("#") ? nCSV(v) : v ?? ""))]); return true; }
    case "libcsv": { const D = datosLD(); descargarCSV("libro_diario_" + D.d + "_" + D.h + ".csv", [["Fecha", "Asiento", "Cuenta", "Nombre", "Descripción", "Debe", "Haber"], ...D.L.flatMap(x => x.ap.map(p => [x.a.fecha, asNum(x.a), p.cuenta, nombreCuenta(p.cuenta), p.concepto || x.a.concepto || "", nCSV(p.debe), nCSV(p.haber)]))]); return true; }
    case "selper": S.selPerio = id; render(); return true;
    case "addper": { const aid = document.getElementById("per-origen").value, as = S.d.asientos.find(x => x.id === aid), nombre = document.getElementById("per-nombre").value.trim() || as.concepto, dia = Math.min(28, Math.max(1, +document.getElementById("per-dia").value || 1)); await guardarCfg("periodicos", [...CF("periodicos"), { id: uid().slice(0, 8), nombre, dia, lineas: S.d.apuntes.filter(p => p.asiento_id === aid).map(p => ({ cuenta: p.cuenta, concepto: p.concepto || null, debe: +p.debe, haber: +p.haber })) }]); render(); return true; }
    case "delper": if (confirm("¿Eliminar la plantilla? Los asientos ya generados se conservan.")) { await guardarCfg("periodicos", CF("periodicos").filter(x => x.id !== S.selPerio)); S.selPerio = null; render(); } return true;
    case "genper": { const mes = mesAct(), P = CF("periodicos").filter(x => !S.d.asientos.some(a => a.documento === `PER-${x.id}-${mes}`)); if (!confirm("¿Generar " + P.length + " asiento(s) periódico(s) de " + mes + "?")) return true; for (const x of P) await db.crearAsiento(S.emp.id, mes + "-" + String(x.dia).padStart(2, "0"), x.nombre + " " + mes, x.lineas, "periodico", `PER-${x.id}-${mes}`); await recargar(); return true; }
    case "cambiaper": { const C = new Set(CF("cerrados")), abre = C.has(id); if (confirm((abre ? "¿Abrir" : "¿Cerrar") + " el período " + id + "?")) { if (abre) C.delete(id); else C.add(id); await guardarCfg("cerrados", [...C].sort()); render(); } return true; }
  }
  return false;
}
async function cambioTes(t) {
  const d = t.dataset;
  if (d.djc !== undefined) { const x = CF("diariosPago").find(y => y.id === d.djc); await guardarDJ({ ...x, desc: t.value }); return true; }
  if (d.dj !== undefined) {
    const x = djSel(), l = x.lineas[+d.dj], k = d.k, D = DJ[x.tipo];
    if (k === "tercero") { const c = t.value.trim() ? terPorCod(t.value) : null; if (t.value.trim() && (!c || c.tipo !== D.ter)) alert("No existe esa cuenta de " + (D.ter === "C" ? "cliente." : "proveedor.")); l.tercero_id = c && c.tipo === D.ter ? c.id : null; l.factura_id = null; l.importe = ""; }
    else if (k === "factura_id") { l.factura_id = t.value || null; const f = S.d.facturas.find(y => y.id === t.value); if (f) { l.importe = pendienteF(f); if (!l.desc) l.desc = numExt(f); if (D.efecto && !l.venc) l.venc = f.fecha_vencimiento || ""; } }
    else l[k] = ["importe", "gastos", "intereses"].includes(k) ? (r2(num(t.value)) || 0) : t.value.trim();
    await guardarDJ(x); if (["tercero", "factura_id", "importe", "efecto_id", "gastos", "intereses"].includes(k)) render(); return true;
  }
  if (d.ef !== undefined) { const s = S.efSel || (S.efSel = new Set()); const v = ["ef-fecha", "ef-banco", "ef-gastos", "ef-int"].map(i => [i, (document.getElementById(i) || {}).value]); if (t.checked) s.add(d.ef); else s.delete(d.ef); render(); v.forEach(([i, x]) => { const e = document.getElementById(i); if (e && x !== undefined) e.value = x; }); return true; }
  if (d.ex !== undefined) return true;
  const simples = { "dj-mostrar": "djMostrar", "dj-hasta": "djHasta", "ant-fecha": "antFecha", "ext-ter": "extTer", "ext-desde": "extDesde", "ext-hasta": "extHasta", "per-mes": "perMes", "lib-desde": "libDesde", "lib-hasta": "libHasta" };
  if (simples[t.id]) { S[simples[t.id]] = t.value; render(); return true; }
  if (t.id === "car-tipo") { S.carteraTipo = t.value; S.carteraEst = ""; S.efSel = new Set(); render(); return true; }
  if (t.id === "car-est") { S.carteraEst = t.value; S.efSel = new Set(); render(); return true; }
  if (["per-origen", "per-nombre", "per-dia"].includes(t.id) || /^(tr|ef)-/.test(t.id || "")) return true;
  if (t.id === "n43") {
    const file = t.files[0]; if (!file) return true;
    const X = leerN43(new TextDecoder("windows-1252").decode(await file.arrayBuffer()));
    if (!X.length) { alert("El fichero no parece un cuaderno Norma 43."); return true; }
    if (X.length > 1) alert("El fichero tiene " + X.length + " cuentas; se carga la primera con movimientos.");
    S.extracto = X.find(x => x.movs.length) || X[0]; render(); return true;
  }
  return false;
}

/* ---------------- Rectificativas, liquidación de transacciones, impresión, presupuestos y cobros ---------------- */
const esRect = f => /^R[VC]\d+$/.test(f.numero);
function siguienteRect(tipo) { let m = 0; for (const f of S.d.facturas) { const k = new RegExp("^R" + tipo + "(\\d+)$").exec(f.numero); if (k) m = Math.max(m, +k[1]); } return "R" + tipo + String(m + 1).padStart(6, "0"); }
const opcTer = (L, v) => L.map(t => `<option value="${t.id}" ${t.id === v ? "selected" : ""}>${esc(t.codigo + " · " + t.nombre)}</option>`).join("");
V.rectif = () => {
  const tp = S.rectTipo || "V", reg = S.d.facturas.filter(f => f.tipo === tp && estadoF(f) === "Registrado" && !esRect(f)).sort((a, b) => b.numero.localeCompare(a.numero)), L = S.d.facturas.filter(f => f.tipo === tp && esRect(f)).sort((a, b) => b.numero.localeCompare(a.numero));
  return pagina("Facturas rectificativas", "", `<div class="card"><div class="row"><label>Factura que se rectifica<br><select id="rec-orig">${reg.map(f => { const t = terPorId(f.tercero_id) || {}; return `<option value="${f.id}">${esc(numExt(f))} · ${esc(t.nombre || "")} · ${eur(totalesF(lineasF(f)).total)}</option>`; }).join("")}</select></label><label>Motivo<br><input id="rec-motivo" size="36" placeholder="Devolución, error de precio…"></label><button class="p" data-a="crearrect" ${reg.length ? "" : "disabled"}>Crear rectificativa</button></div></div>
   <div class="lista"><table><tr><th>Rectificativa</th><th>Cuenta</th><th>Nombre</th><th>Fecha</th><th>Motivo</th><th class="n">Importe</th><th>Estado</th></tr>${L.map(f => { const t = terPorId(f.tercero_id) || {}; return `<tr><td><a data-a="factdeped" data-id="${f.id}" data-t="${f.tipo}">${esc(f.numero)}</a></td><td>${esc(t.codigo || "")}</td><td>${esc(t.nombre || "")}</td><td>${f.fecha_emision || ""}</td><td>${esc(f.notas || "")}</td><td class="n">${eur(totalesF(lineasF(f)).total)}</td><td>${estadoF(f)}</td></tr>`; }).join("") || `<tr><td colspan="7" class="vacio">Sin facturas rectificativas.</td></tr>`}</table></div>
   <p style="color:var(--tx2)">Se crea con todas las líneas en negativo; ajuste las cantidades si es parcial y regístrela. Después compénsela en "Liquidar transacciones". No mueve existencias: si hay devolución de mercancía, haga el ajuste de inventario.</p>`,
    { tabs: ["Lista"], filtros: `<label>Tipo<select id="rect-tipo"><option value="V" ${tp === "V" ? "selected" : ""}>De cliente</option><option value="C" ${tp === "C" ? "selected" : ""}>De proveedor</option></select></label>` });
};
V.liquidar = () => {
  const ters = S.d.terceros.filter(t => S.d.facturas.some(f => f.tercero_id === t.id && estadoF(f) === "Registrado" && pendienteF(f) < 0)).sort((a, b) => a.codigo.localeCompare(b.codigo)), t = ters.find(x => x.id === S.liqTer) || ters[0], M = S.liqMarcas || (S.liqMarcas = new Set());
  const fs = t ? S.d.facturas.filter(f => f.tercero_id === t.id && estadoF(f) === "Registrado" && pendienteF(f) !== 0) : [], sel = fs.filter(f => M.has(f.id)), pos = r2(sel.reduce((s, f) => s + Math.max(0, pendienteF(f)), 0)), neg = r2(sel.reduce((s, f) => s + Math.min(0, pendienteF(f)), 0)), imp = r2(Math.min(pos, -neg));
  return pagina("Liquidar transacciones", `<button class="p" data-a="compensar" data-id="${t ? t.id : ""}" ${imp > 0 ? "" : "disabled"}>Liquidar ${imp > 0 ? eur(imp) : ""}</button>`, `${t ? `<div class="lista"><table><tr><th></th><th>Factura</th><th>Fecha</th><th>Vencimiento</th><th class="n">Pendiente</th></tr>${fs.map(f => `<tr><td><input type="checkbox" data-lq="${f.id}" ${M.has(f.id) ? "checked" : ""}></td><td>${esc(numExt(f))}</td><td>${f.fecha_emision || ""}</td><td>${f.fecha_vencimiento || ""}</td><td class="n">${eur(pendienteF(f))}</td></tr>`).join("")}</table></div><div class="pie"><span>Facturas marcadas <b>${eur(pos)}</b></span><span>Rectificativas marcadas <b>${eur(neg)}</b></span><span>Se compensa <b>${eur(imp)}</b></span></div>` : `<p>No hay rectificativas pendientes de compensar.</p>`}`,
    { tabs: ["Transacciones abiertas"], filtros: t ? `<label>Cliente o proveedor<select id="liq-ter">${opcTer(ters, t.id)}</select></label><label>Fecha<input type="date" id="liq-fec" value="${hoy()}"></label>` : "" });
};
async function compensar(terId, fechaDada) {
  const t = terPorId(terId), fecha = fechaDada || document.getElementById("liq-fec").value, sel = S.d.facturas.filter(f => S.liqMarcas.has(f.id) && f.tercero_id === terId); if (!t || !fecha) return;
  const P = sel.filter(f => pendienteF(f) > 0), N = sel.filter(f => pendienteF(f) < 0), imp = r2(Math.min(P.reduce((s, f) => s + pendienteF(f), 0), -N.reduce((s, f) => s + pendienteF(f), 0)));
  if (!(imp > 0) || !confirm("¿Liquidar " + eur(imp) + " entre facturas y rectificativas de " + t.nombre + "?")) return;
  const reparto = L => { let r = imp; return L.map(f => { const v = r2(Math.min(r, Math.abs(pendienteF(f)))); r = r2(r - v); return { f, v }; }).filter(x => x.v > 0); }, a = reparto(P), b = reparto(N);
  const aid = await db.crearAsiento(S.emp.id, fecha, "Liquidación de transacciones " + t.nombre, [{ cuenta: t.cuenta, concepto: null, debe: imp, haber: 0, tercero_id: t.id }, { cuenta: t.cuenta, concepto: null, debe: 0, haber: imp, tercero_id: t.id }], "compensacion", "LQT");
  for (const x of [...a, ...b]) await db.guardarLiquidacion({ id: uid(), empresa_id: S.emp.id, factura_id: x.f.id, asiento_id: aid, fecha, importe: x.v });
  S.liqMarcas = new Set(); await recargar();
}

/* Datos de la empresa e impresión de documentos */
SEED.empresa = () => ({});
V.empresa = () => {
  const E = CF("empresa");
  const c = (et, k) => `<label class="fld">${et}<input data-em="${k}" value="${esc(E[k] || "")}"></label>`;
  return pagina("Datos de la empresa", "", `<div class="fgrid"><div class="fcol"><h4>ENTIDAD JURÍDICA</h4><label class="fld">Nombre<input disabled value="${esc(S.emp.nombre)}"></label><label class="fld">NIF<input disabled value="${esc(S.emp.cif || "")}"></label>${c("Dirección", "dir")}${c("Código postal", "cp")}${c("Población", "pob")}${c("Provincia", "prov")}</div>
    <div class="fcol"><h4>CONTACTO Y COBRO</h4>${c("Teléfono", "tel")}${c("Correo electrónico", "email")}${c("Sitio web", "web")}${c("IBAN para cobros", "iban")}${c("Datos registrales (pie de factura)", "registro")}${c("Texto adicional en facturas", "pie")}</div></div><p style="color:var(--tx2)">Se guardan al momento y salen en las facturas, presupuestos y cartas impresas.</p>`, { tabs: ["General"], vista: S.emp.nombre });
};
const cabEmpresa = () => { const E = CF("empresa"); return `<div><b style="font-size:18px">${esc(S.emp.nombre)}</b><br>NIF ${esc(S.emp.cif || "")}<br>${esc(E.dir || "")}<br>${esc([E.cp, E.pob, E.prov ? "(" + E.prov + ")" : ""].filter(Boolean).join(" "))}<br>${esc([E.tel, E.email, E.web].filter(Boolean).join(" · "))}</div>`; };
const cajaTer = t => { const d = ((t.direcciones || []).find(x => x.principal) || (t.direcciones || [])[0]) || {}; return `<div class="doc-ter"><b>${esc(t.nombre || "")}</b><br>NIF ${esc(t.cif || "—")}<br>${esc(d.dir || "")}<br>${esc([d.cp, d.poblacion, d.provincia].filter(Boolean).join(" "))}</div>`; };
function documento({ titulo, numero, fecha, venc, ter, lineas, tot, ret, forma, notas, cliente }) {
  const E = CF("empresa"), porIva = new Map();
  lineas.forEach(l => { if (!l.auto) porIva.set(l.pct, r2((porIva.get(l.pct) || 0) + l.base)); });
  return `<div class="doc"><div class="doc-cab">${cabEmpresa()}<div style="text-align:right"><h2>${titulo}</h2>Número <b>${esc(numero)}</b><br>Fecha ${fecha || ""}${venc ? "<br>Vencimiento " + venc : ""}</div></div>${cajaTer(ter)}
   <table><tr><th>Descripción</th><th class="n">Cantidad</th><th class="n">Precio</th><th class="n">IVA</th><th class="n">Importe</th></tr>${lineas.map(l => `<tr><td>${esc(l.desc)}</td><td class="n">${q3(l.cant)}</td><td class="n">${eur(l.precio)}</td><td class="n">${String(l.pct).replace(".", ",")} %</td><td class="n">${eur(l.base)}</td></tr>`).join("")}</table>
   <div class="doc-tot"><table>${[...porIva].map(([p, b]) => `<tr><td>Base ${String(p).replace(".", ",")} %</td><td class="n">${eur(b)}</td><td>IVA</td><td class="n">${eur(b * p / 100)}</td></tr>`).join("")}${tot.rec ? `<tr><td colspan="3">Recargo de equivalencia</td><td class="n">${eur(tot.rec)}</td></tr>` : ""}${ret ? `<tr><td colspan="3">Retención IRPF</td><td class="n">−${eur(ret)}</td></tr>` : ""}<tr class="tot"><td colspan="3">TOTAL ${ret ? "A PERCIBIR" : ""}</td><td class="n">${eur(r2(tot.total - (ret || 0)))} €</td></tr></table></div>
   ${lineas.some(l => l.auto) ? "<p>Operación con inversión del sujeto pasivo.</p>" : ""}${notas ? `<p>${esc(notas)}</p>` : ""}${cliente && forma ? `<p>Forma de pago: ${esc(forma)}${E.iban ? " · IBAN " + esc(E.iban) : ""}</p>` : cliente && E.iban ? `<p>IBAN ${esc(E.iban)}</p>` : ""}${E.pie ? `<p>${esc(E.pie)}</p>` : ""}<p class="doc-pie">${esc(E.registro || "")}</p></div>`;
}
function datosDocFactura(f) {
  const t = terPorId(f.tercero_id) || {}, ls = lineasF(f);
  return { titulo: esRect(f) ? "FACTURA RECTIFICATIVA" : "FACTURA", numero: f.numero, fecha: f.fecha_emision, venc: f.fecha_vencimiento, ter: t, cliente: true, forma: ((t.ficha || {}).pago || {}).forma, notas: esRect(f) ? f.notas : "", tot: totalesF(ls), ret: retF(f),
    lineas: ls.map(l => ({ desc: l.descripcion || "", cant: +l.cantidad, precio: +l.precio, pct: +(codLinea(f, l).pct || 0), base: r2(l.cantidad * l.precio), auto: l.auto })) };
}
const docFactura = f => documento(datosDocFactura(f));
V.imprfact = () => {
  const L = S.d.facturas.filter(f => f.tipo === "V" && estadoF(f) === "Registrado").sort((a, b) => b.numero.localeCompare(a.numero)), f = L.find(x => x.id === S.imprFact) || L[0];
  return pagina("Imprimir facturas", `<button class="p" data-a="pdffact" ${f ? "" : "disabled"}>Descargar PDF</button>` + btn("pdffacttodas", "PDF de todas las del ejercicio", "", !f) + btn("imprimir", "Imprimir", "", !f),f ? docFactura(f) : `<p>No hay facturas de cliente registradas.</p>`, { tabs: ["Vista previa"], filtros: f ? `<label>Factura<select id="impr-fact">${L.map(x => `<option value="${x.id}" ${x.id === f.id ? "selected" : ""}>${esc(x.numero)} · ${esc((terPorId(x.tercero_id) || {}).nombre || "")}</option>`).join("")}</select></label>` : "" });
};

/* Presupuestos de venta y solicitudes de cotización: pedidos en estado "presupuesto" */
function vistaPresup(tipo) {
  if (S.ped && S.ped.p.tipo === tipo) return vistaPedidoEdit();
  const cli = tipo === "V", L = S.d.pedidos.filter(p => p.tipo === tipo && p.estado === "presupuesto").sort((a, b) => b.numero.localeCompare(a.numero)), sel = L.find(p => p.id === S.selPed);
  return pagina(cli ? "Presupuestos de ventas" : "Solicitudes de cotización", btn("nuevopres", "+ Nuevo", `data-t="${tipo}"`) + btn("abrirped", "Editar", `data-id="${sel ? sel.id : ""}"`, !sel) + btn("delped", "Eliminar", "", !sel), `<div class="lista"><table><tr><th>${cli ? "Presupuesto" : "Cotización"}</th><th>Cuenta</th><th>Nombre</th><th>Fecha</th><th>Válido hasta / respuesta</th><th class="n">Importe</th></tr>${L.map(p => { const t = terPorId(p.tercero_id) || {}; return `<tr data-sel class="${p.id === S.selPed ? "sel" : ""}" data-a="selped" data-id="${p.id}"><td><a data-a="abrirped" data-id="${p.id}">${esc(p.numero)}</a></td><td>${esc(t.codigo || "")}</td><td>${esc(t.nombre || "")}</td><td>${p.fecha || ""}</td><td>${p.fecha_entrega || ""}</td><td class="n">${eur(totalesPed(p, plineasDe(p)).total)}</td></tr>`; }).join("") || `<tr><td colspan="6" class="vacio">No se encontró ningún elemento que mostrar aquí.</td></tr>`}</table></div>`, { tabs: ["Lista"] });
}
V.presupv = () => vistaPresup("V"); V.cotiz = () => vistaPresup("C");
V.imprpres = () => {
  const p = S.d.pedidos.find(x => x.id === S.selPed); if (!p) return pagina("Vista de impresión", "", "<p>Elija un presupuesto.</p>");
  const cli = p.tipo === "V";
  return pagina("Vista de impresión", `<button class="p" data-a="pdfpres">Descargar PDF</button>` + btn("imprimir", "Imprimir") + btn("vista", "Volver", `data-v="${cli ? "presupv" : "cotiz"}"`), documento(datosDocPres(p)), { tabs: ["Vista previa"] });
};
function datosDocPres(p) {
  const ls = plineasDe(p), cli = p.tipo === "V";
  return { titulo: cli ? "PRESUPUESTO" : "SOLICITUD DE COTIZACIÓN", numero: p.numero, fecha: p.fecha, venc: p.fecha_entrega, ter: terPorId(p.tercero_id) || {}, tot: totalesPed(p, ls), notas: (p.ficha || {}).notas, cliente: false,
    lineas: ls.map(l => { const c = CODIGO[l.cod_iva] || {}; return { desc: l.descripcion || "", cant: +l.cantidad, precio: r2(netoPed(p, l)), pct: +(c.pct || 0), base: importeL(p, l), auto: c.tipo === "ue" || c.tipo === "isp" }; }) };
}

/* Presupuesto contable (control presupuestario) */
SEED.presupuestos = () => [];
V.presupuesto = () => {
  const L = CF("presupuestos").filter(x => x.ej === S.ej).sort((a, b) => a.cuenta.localeCompare(b.cuenta));
  const filas = L.map(x => { const s = saldoPref(x.cuenta, true), real = x.cuenta.startsWith("7") ? -s : s, dif = r2(x.importe - real), pct = x.importe ? Math.round(real / x.importe * 100) : 0, mal = x.cuenta.startsWith("7") ? false : real > x.importe;
    return `<tr class="${mal ? "ko" : ""}"><td>${x.cuenta}</td><td>${esc(nombreCuenta(x.cuenta) || nombreMaestro(x.cuenta))}</td><td class="n">${eur(x.importe)}</td><td class="n">${eur(real)}</td><td class="n">${eur(dif)}</td><td class="n">${pct} %</td><td><button class="d" data-a="delpres" data-id="${x.cuenta}">✕</button></td></tr>`; }).join("");
  return pagina("Control presupuestario", `<button class="p" data-a="addpres">Guardar partida</button>`, `<div class="card"><div class="row"><label>Cuenta o título (p. ej. 62 o 628)<br><input id="pr-cta" list="dlpr" size="12"></label><label>Importe anual ${S.ej}<br><input id="pr-imp" size="12"></label></div></div><datalist id="dlpr">${S.d.cuentas.map(c => `<option value="${c.codigo}">${esc(c.nombre)}</option>`).join("")}</datalist>
   <div class="lista"><table><tr><th>Cuenta</th><th>Nombre</th><th class="n">Presupuesto</th><th class="n">Real</th><th class="n">Disponible</th><th class="n">Consumido</th><th></th></tr>${filas || `<tr><td colspan="7" class="vacio">Sin partidas para ${S.ej}.</td></tr>`}</table></div>`, { tabs: ["Presupuesto"], vista: "Ejercicio " + S.ej });
};

/* Crédito y cobros: riesgo por cliente, límite y cartas de reclamación */
SEED.creditos = () => ({});
const vencidasDe = t => pendientesDe("V", t.id).filter(f => (f.fecha_vencimiento || "") < hoy());
V.credito = () => {
  const lim = CF("creditos"), L = S.d.terceros.filter(t => t.tipo === "C").map(t => { const v = vencidasDe(t), pend = r2(pendientesDe("V", t.id).reduce((s, f) => s + pendienteF(f), 0)), ef = r2(efectos().filter(e => e.tercero_id === t.id && !["Cobrado", "Pagado", "Renegociado"].includes(e.estado)).reduce((s, e) => s + e.importe, 0)); return { t, v, vencido: r2(v.reduce((s, f) => s + pendienteF(f), 0)), dias: v.length ? Math.max(...v.map(f => Math.floor((new Date(hoy()) - new Date(f.fecha_vencimiento)) / 864e5))) : 0, pend, ef, riesgo: r2(pend + ef) }; }).sort((a, b) => b.vencido - a.vencido || b.riesgo - a.riesgo), sel = L.find(x => x.t.id === S.selCred);
  return pagina("Crédito y cobros", btn("carta", "Carta de reclamación", "", !sel || !sel.v.length), `<div class="lista"><table class="editable"><tr><th>Cliente</th><th>Nombre</th><th class="n">Facturas pendientes</th><th class="n">Efectos pendientes</th><th class="n">Riesgo total</th><th class="n">Límite de crédito</th><th class="n">Disponible</th><th class="n">Vencido</th><th class="n">Días</th></tr>${L.map(x => { const l = +lim[x.t.id] || 0; return `<tr data-sel class="${sel && sel.t.id === x.t.id ? "sel" : ""} ${l && x.riesgo > l ? "ko" : ""}"><td><a data-a="selcred" data-id="${x.t.id}">${esc(x.t.codigo)}</a></td><td>${esc(x.t.nombre)}</td><td class="n">${sal(x.pend)}</td><td class="n">${sal(x.ef)}</td><td class="n">${sal(x.riesgo)}</td><td><input class="n" data-lim="${x.t.id}" size="10" value="${l || ""}"></td><td class="n">${l ? eur(l - x.riesgo) : ""}</td><td class="n">${sal(x.vencido)}</td><td class="n">${x.dias || ""}</td></tr>`; }).join("") || `<tr><td colspan="9" class="vacio">Sin clientes.</td></tr>`}</table></div><p style="color:var(--tx2)">En rojo, clientes por encima de su límite. Es informativo: no bloquea pedidos ni facturas. Seleccione un cliente con vencidos para preparar la carta.</p>`, { tabs: ["Lista"] });
};
V.carta = () => {
  const t = terPorId(S.selCred); if (!t) return pagina("Carta de reclamación", "", "<p>Elija un cliente en Crédito y cobros.</p>");
  const v = vencidasDe(t), tot = r2(v.reduce((s, f) => s + pendienteF(f), 0)), E = CF("empresa");
  return pagina("Carta de reclamación", `<button class="p" data-a="imprimir">Imprimir / guardar PDF</button>` + btn("vista", "Volver", 'data-v="credito"'), `<div class="doc"><div class="doc-cab">${cabEmpresa()}<div style="text-align:right">${esc(E.pob || "")}${E.pob ? ", " : ""}${hoy()}</div></div>${cajaTer(t)}<p>Estimado cliente:</p><p>Según nuestra contabilidad, a la fecha de esta carta figuran vencidas y pendientes de pago las siguientes facturas:</p>
   <table><tr><th>Factura</th><th>Fecha</th><th>Vencimiento</th><th class="n">Pendiente</th></tr>${v.map(f => `<tr><td>${esc(f.numero)}</td><td>${f.fecha_emision || ""}</td><td>${f.fecha_vencimiento || ""}</td><td class="n">${eur(pendienteF(f))}</td></tr>`).join("")}<tr class="tot"><td colspan="3">Total vencido</td><td class="n">${eur(tot)} €</td></tr></table>
   <p>Le rogamos que proceda a su pago${E.iban ? " en la cuenta " + esc(E.iban) : ""}. Si ya lo ha realizado, disculpe las molestias y envíenos el justificante.</p><p>Atentamente,<br><br><br>${esc(S.emp.nombre)}</p></div>`, { tabs: ["Vista previa"] });
};

async function accionDoc(a, b) {
  const id = b.dataset.id;
  switch (a) {
    case "crearrect": {
      const o = S.d.facturas.find(f => f.id === document.getElementById("rec-orig").value), motivo = document.getElementById("rec-motivo").value.trim(); if (!o) return true;
      if (!motivo) { alert("Indique el motivo de la rectificación."); return true; }
      const ya = S.d.facturas.find(f => esRect(f) && (f.notas || "").startsWith("Rectifica " + o.numero + ":")); if (ya && !confirm("Ya existe la rectificativa " + ya.numero + " de esa factura. ¿Crear otra?")) return true;
      const f = { ...o, id: uid(), numero: siguienteRect(o.tipo), num_externo: "", fecha_emision: hoy(), fecha_registro: hoy(), fecha_iva: hoy(), fecha_vencimiento: hoy(), estado: "abierto", asiento_id: null, pedido_id: null, notas: "Rectifica " + o.numero + ": " + motivo };
      S.fact = { f, ls: lineasF(o).map(l => ({ ...l, id: null, cantidad: -l.cantidad, pedido_linea_id: null, tocado: true })) }; await guardarFactura();
      S.vista = o.tipo === "V" ? "fventa" : "fcompra"; S.selFact = f.id; await recargar(); return true;
    }
    case "compensar": await compensar(id); return true;
    case "nuevopres": { const tp = b.dataset.t, al = await asegurarAlmacen(), pf = tp === "V" ? "OV" : "SC", n = S.d.pedidos.reduce((m, p) => { const k = new RegExp("^" + pf + "(\\d+)$").exec(p.numero); return k ? Math.max(m, +k[1]) : m; }, 0) + 1, p = { id: uid(), empresa_id: S.emp.id, tipo: tp, numero: pf + String(n).padStart(6, "0"), tercero_id: null, fecha: hoy(), fecha_entrega: "", almacen_id: al.id, estado: "presupuesto", dto_pct: 0, ficha: fichaPedBase() }; S.ped = { p, ls: [nuevaLineaPed(p)], fechaMov: hoy() }; S.tabs.ped = "Líneas"; render(); return true; }
    case "convertirpres": {
      const { p } = S.ped, orig = p.numero; if (!confirm("¿Convertir " + orig + " en " + (p.tipo === "V" ? "pedido de ventas" : "pedido de compra") + "?")) return true;
      p.estado = "abierto"; p.numero = siguientePed(p.tipo); p.fecha = hoy(); p.ficha = { ...p.ficha, presupuesto: orig, notas: [p.ficha.notas, "Origen: " + orig].filter(Boolean).join(" · ") };
      if (await guardarPed(true)) { S.vista = p.tipo === "V" ? "pventa" : "pcompra"; render(); } return true;
    }
    case "imprimirpres": if (await guardarPed(true)) { S.selPed = S.ped.p.id; S.ped = null; S.vista = "imprpres"; render(); } return true;
    case "addpres": { const cta = document.getElementById("pr-cta").value.trim(), imp = r2(num(document.getElementById("pr-imp").value)); if (!/^\d{1,9}$/.test(cta) || !(imp > 0)) { alert("Indique la cuenta (solo números) y un importe mayor que cero."); return true; } await guardarCfg("presupuestos", [...CF("presupuestos").filter(x => !(x.ej === S.ej && x.cuenta === cta)), { ej: S.ej, cuenta: cta, importe: imp }]); render(); return true; }
    case "delpres": if (confirm("¿Quitar la partida " + id + "?")) { await guardarCfg("presupuestos", CF("presupuestos").filter(x => !(x.ej === S.ej && x.cuenta === id))); render(); } return true;
    case "selcred": S.selCred = id; render(); return true;
    case "carta": S.vista = "carta"; render(); return true;
  }
  return false;
}
async function cambioDoc(t) {
  const d = t.dataset;
  if (d.lq !== undefined) { const M = S.liqMarcas || (S.liqMarcas = new Set()); if (t.checked) M.add(d.lq); else M.delete(d.lq); render(); return true; }
  if (d.em !== undefined) { await guardarCfg("empresa", { ...CF("empresa"), [d.em]: t.value.trim() }); return true; }
  if (d.lim !== undefined) { await guardarCfg("creditos", { ...CF("creditos"), [d.lim]: r2(num(t.value)) || 0 }); render(); return true; }
  if (t.id === "rect-tipo") { S.rectTipo = t.value; render(); return true; }
  if (t.id === "liq-ter") { S.liqTer = t.value; S.liqMarcas = new Set(); render(); return true; }
  if (t.id === "impr-fact") { S.imprFact = t.value; render(); return true; }
  return ["liq-fec", "rec-orig", "rec-motivo", "pr-cta", "pr-imp"].includes(t.id);
}

/* ---------------- Consultas de letras de cambio de clientes ---------------- */
const letras = () => efectos().filter(e => e.tipo === "C");
const cli_ = e => terPorId(e.tercero_id) || {};
const diasVenc = e => Math.max(0, Math.floor((new Date(hoy()) - new Date(e.venc)) / 864e5));
const nDiario = a => (S.d.asientos.find(x => x.id === a) || {}).documento || "";
function datosLetras(k) { // cabeceras y filas de cada consulta; las columnas numéricas empiezan por "#"
  const E = letras();
  if (k === "letdiario") return { t: "Diario de letras de cambio", h: ["Fecha", "N.º de letra", "Cuenta", "Nombre", "Operación", "#Importe", "Asiento", "Diario"], f: E.flatMap(e => e.hist.filter(h => hayAsiento(h.asiento)).map((h, i) => [h.fecha, e.numero, cli_(e).codigo, cli_(e).nombre, i === 0 ? (e.origen ? "Alta por renegociación" : "Creación") : h.estado, e.importe, asNum(S.d.asientos.find(a => a.id === h.asiento)), nDiario(h.asiento)])).sort((a, b) => a[0].localeCompare(b[0])) };
  if (k === "letabiertas") return { t: "Informe de letras abiertas", h: ["N.º de letra", "Cuenta", "Nombre", "Factura", "Emisión", "Vencimiento", "Estado", "#Importe", "Días vencida"], f: E.filter(e => [...VIVOS, "Impagado"].includes(e.estado)).sort((a, b) => a.venc.localeCompare(b.venc)).map(e => [e.numero, cli_(e).codigo, cli_(e).nombre, e.factura, e.emision, e.venc, e.estado, e.importe, diasVenc(e) || ""]) };
  if (k === "letimpagadas") return { t: "Letras impagadas", h: ["Fecha de impago", "N.º de letra", "Cuenta", "Nombre", "Factura", "Vencimiento", "#Importe", "Situación actual", "Letra que la sustituye"], f: E.flatMap(e => { const h = e.hist.find(x => x.estado === "Impagado"); if (!h) return []; const n = E.find(x => x.origen === e.id); return [[h.fecha, e.numero, cli_(e).codigo, cli_(e).nombre, e.factura, e.venc, e.importe, e.estado, n ? n.numero : ""]]; }).sort((a, b) => b[0].localeCompare(a[0])) };
  if (k === "letfactura") return { t: "Relación letra-factura", h: ["Factura", "N.º de letra", "Cuenta", "Nombre", "Emisión", "Vencimiento", "#Importe", "Estado", "Procede de"], f: E.map(e => [e.factura, e.numero, cli_(e).codigo, cli_(e).nombre, e.emision, e.venc, e.importe, e.estado, (E.find(x => x.id === e.origen) || {}).numero || ""]).sort((a, b) => a[0].localeCompare(b[0]) || a[4].localeCompare(b[4])) };
  const M = new Map(); E.forEach(e => { const r = M.get(e.tercero_id) || { t: cli_(e), n: 0, emit: 0, cob: 0, ab: 0, imp: 0, nimp: 0 }; r.n++; if (!e.origen) r.emit = r2(r.emit + e.importe); if (e.estado === "Cobrado") r.cob = r2(r.cob + e.importe); if (VIVOS.includes(e.estado)) r.ab = r2(r.ab + e.importe); if (e.hist.some(h => h.estado === "Impagado")) { r.nimp++; r.imp = r2(r.imp + e.importe); } M.set(e.tercero_id, r); });
  return { t: "Estadísticas de letra de cambio", h: ["Cuenta", "Nombre", "Letras", "#Emitido", "#Cobrado", "#Pendiente", "Impagos", "#Importe impagado", "% de letras impagadas"], f: [...M.values()].sort((a, b) => b.emit - a.emit).map(r => [r.t.codigo, r.t.nombre, r.n, r.emit, r.cob, r.ab, r.nimp, r.imp, Math.round(r.nimp / r.n * 100) + " %"]) };
}
function vistaLetras(k) {
  const D = datosLetras(k), num_ = D.h.map(x => x.startsWith("#")), tot = num_.map((n, i) => n ? r2(D.f.reduce((s, f) => s + f[i], 0)) : null);
  const filas = D.f.map(f => `<tr>${f.map((v, i) => `<td class="${num_[i] ? "n" : ""}">${num_[i] ? eur(v) : esc(v ?? "")}</td>`).join("")}</tr>`).join("");
  return pagina(D.t, btn("letcsv", "Exportar CSV", `data-k="${k}"`, !D.f.length) + btn("imprimir", "Imprimir"), `<div class="lista"><table><tr>${D.h.map((h, i) => `<th class="${num_[i] ? "n" : ""}">${h.replace("#", "")}</th>`).join("")}</tr>${filas || `<tr><td colspan="${D.h.length}" class="vacio">No se encontró ningún elemento que mostrar aquí.</td></tr>`}${D.f.length && k !== "letdiario" ? `<tr class="tot">${tot.map((v, i) => `<td class="${num_[i] ? "n" : ""}">${v === null ? (i ? "" : "Total") : eur(v)}</td>`).join("")}</tr>` : ""}</table></div>`, { tabs: ["Informe"] });
}
["letdiario", "letabiertas", "letimpagadas", "letfactura", "letestad"].forEach(k => { V[k] = () => vistaLetras(k); });

/* ---------------- Facturas de servicios (como en D365), plantillas y facturación periódica ---------------- */
SEED.plantillasFS = () => []; SEED.periodicasFS = () => [];
const esFS = f => f.tipo === "V" && /^FS\d+$/.test(f.numero);
function siguienteFS() { let m = 0; for (const f of S.d.facturas) { const k = /^FS(\d+)$/.exec(f.numero); if (k) m = Math.max(m, +k[1]); } return "FS" + String(m + 1).padStart(6, "0"); }
const ctaServicios = () => primeraCuenta("705") || primeraCuenta("700");
const mesesMas = (fecha, n) => { const [y, m, d] = fecha.split("-").map(Number), t = new Date(y, m - 1 + n, 1), ult = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate(); return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(Math.min(d, ult)).padStart(2, "0"); };
function facturaNuevaFS(ter, fecha) {
  return { id: uid(), empresa_id: S.emp.id, tipo: "V", numero: siguienteFS(), tercero_id: ter ? ter.id : null, num_externo: "", fecha_emision: fecha, fecha_registro: fecha, fecha_iva: fecha, fecha_vencimiento: calcVenc(ter, fecha), vencAuto: true, estado: "abierto", asiento_id: null, notas: "", retencion_tipo: "", retencion_pct: 0 };
}
const lineasDePlantilla = (P, t, sufijo = "") => P.lineas.map(l => { const cod = !t || t.grupo_iva === "NAC" ? l.cod : codDefecto(t, "V"), k = CODIGO[cod]; return { id: null, descripcion: (l.descripcion || "") + sufijo, cuenta: l.cuenta, cantidad: l.cantidad, precio: l.precio, cod, iva: k ? k.pct : 0, rec: t && aplicaRec(t) ? recDeCodigo(cod) : "", auto: !!k && (k.tipo === "ue" || k.tipo === "isp"), tocado: true }; });
async function crearFSdesde(P, t, fecha, sufijo) {
  const f = facturaNuevaFS(t, fecha), rc = P.ret || (t && t.ficha && t.ficha.cod_ret); if (rc) aplicarRet(f, rc);
  S.fact = { f, ls: lineasDePlantilla(P, t, sufijo) }; await guardarFactura(); S.fact = null; return f.id;
}
V.fservicios = () => {
  const est = S.fsEstado || "Todo", dias = S.fsDias || "Todo", q = (S.fsFiltro || "").toLowerCase(), M = S.fsMarcas || (S.fsMarcas = new Set()), desde = dias === "Todo" ? "" : new Date(Date.now() - dias * 864e5).toISOString().slice(0, 10);
  const L = S.d.facturas.filter(f => esFS(f) && (est === "Todo" || (est === "Registrado") === (estadoF(f) === "Registrado")) && (!desde || f.fecha_emision >= desde) && (!q || (f.numero + " " + ((terPorId(f.tercero_id) || {}).codigo || "") + " " + ((terPorId(f.tercero_id) || {}).nombre || "")).toLowerCase().includes(q))).sort((a, b) => b.numero.localeCompare(a.numero));
  const sel = L.find(f => f.id === S.selFS), marcadas = L.filter(f => M.has(f.id) && estadoF(f) === "Abierto"), reg = sel && estadoF(sel) === "Registrado", P = CF("plantillasFS");
  const filas = L.map(f => { const t = terPorId(f.tercero_id) || {}, cf = terPorId((((t.ficha || {}).fact) || {}).cuenta_fact) || t, d = (t.direcciones || [])[0] || {}, r = estadoF(f) === "Registrado";
    return `<tr data-sel class="${sel && sel.id === f.id ? "sel" : ""}" data-a="selfs" data-id="${f.id}"><td>${r ? "" : `<input type="checkbox" data-fs="${f.id}" ${M.has(f.id) ? "checked" : ""}>`}</td><td><a data-a="factdeped" data-id="${f.id}" data-t="V">${f.numero}</a></td><td>${esc(t.codigo || "")}</td><td>${esc(cf.codigo || "")}</td><td>${esc(t.nombre || "")}</td><td>${esc([d.dir, d.poblacion].filter(Boolean).join(", "))}</td><td>${f.fecha_emision || ""}</td><td>${f.fecha_registro || ""}</td><td>EUR</td><td>${estadoF(f)}</td><td>${r ? "✓" : ""}</td><td class="n">${eur(totalesF(lineasF(f)).total)}</td></tr>`; }).join("");
  const acc = btn("nuevafs", "+ Nuevo") + btn("factdeped", "Editar", `data-id="${sel ? sel.id : ""}" data-t="V"`, !sel) + btn("delfs", "Eliminar", "", !sel || reg) + SEP + `<button class="p" data-a="registrarfs" ${marcadas.length ? "" : "disabled"}>Registrar${marcadas.length ? " (" + marcadas.length + ")" : ""}</button>` + SEP + btn("plantdesde", "Guardar como plantilla", "", !sel) + btn("fsimprimir", "Imprimir", "", !reg) + btn("vista", "Diario de pagos", 'data-v="dcobro"') + btn("vista", "Liquidar transacciones abiertas", 'data-v="liquidar"') + btn("vista", "Factura rectificativa", 'data-v="rectif"');
  return pagina("Factura de servicios", acc, `${P.length ? `<div class="card"><div class="row"><label>Nueva a partir de plantilla<br><select id="fs-plant">${P.map(p => `<option value="${p.id}">${esc(p.nombre)}</option>`).join("")}</select></label><label>Cliente<br><select id="fs-cli">${opcTer(S.d.terceros.filter(t => t.tipo === "C"), "")}</select></label><button data-a="fsdeplant">Crear factura</button></div></div>` : ""}
   <div class="lista"><table><tr><th></th><th>Factura</th><th>Cuenta de cliente</th><th>Cuenta de facturación</th><th>Nombre</th><th>Dirección</th><th>Fecha</th><th>Fecha de registro</th><th>Divisa</th><th>Estado de contabilización</th><th>Contabilizado</th><th class="n">Importe</th></tr>${filas || `<tr><td colspan="12" class="vacio">No se encontró ningún elemento que mostrar aquí.</td></tr>`}</table></div>`,
    { tabs: ["Factura"], filtros: `<label>Filtro<input id="fs-filtro" value="${esc(S.fsFiltro || "")}"></label><label>Estado<select id="fs-estado">${["Todo", "No registrado", "Registrado"].map(x => `<option ${x === est ? "selected" : ""}>${x}</option>`).join("")}</select></label><label>Fecha de la factura<select id="fs-dias">${[["Todo", "Todo"], ["30", "30 días"], ["60", "60 días"], ["90", "90 días"]].map(([v, n]) => `<option value="${v}" ${v === String(dias) ? "selected" : ""}>${n}</option>`).join("")}</select></label>` });
};
V.plantfs = () => {
  const P = CF("plantillasFS"), sel = P.find(p => p.id === S.selPlant);
  return pagina("Plantillas de factura de servicios", btn("delplant", "Eliminar", "", !sel) + btn("vista", "Facturas de servicios", 'data-v="fservicios"'), `<div class="pagina"><div class="lista"><table><tr><th>Plantilla</th><th class="n">Líneas</th><th class="n">Base imponible</th></tr>${P.map(p => `<tr data-sel class="${sel && sel.id === p.id ? "sel" : ""}" data-a="selplant" data-id="${p.id}"><td>${esc(p.nombre)}</td><td class="n">${p.lineas.length}</td><td class="n">${eur(p.lineas.reduce((s, l) => s + l.cantidad * l.precio, 0))}</td></tr>`).join("") || `<tr><td colspan="3" class="vacio">Sin plantillas. Selecciónela en Facturas de servicios y pulse "Guardar como plantilla".</td></tr>`}</table></div><aside class="factbox"><h3>Líneas</h3>${sel ? `<dl>${sel.lineas.map(l => `<dt>${esc(l.descripcion)} · ${l.cuenta} · ${esc(l.cod)}</dt><dd>${q3(l.cantidad)} × ${eur(l.precio)}</dd>`).join("")}</dl>` : `<p style="color:var(--tx2)">Seleccione una plantilla.</p>`}</aside></div>`, { tabs: ["Lista"] });
};
const CADA = { 1: "Mensual", 2: "Bimestral", 3: "Trimestral", 6: "Semestral", 12: "Anual" };
const vencidas = (x, hasta) => { const out = []; for (let f = x.proxima, i = 0; f && f <= hasta && (!x.hasta || f <= x.hasta) && i < 60; i++, f = mesesMas(x.inicio || x.proxima, ((x.hechas || 0) + i) * x.cada)) out.push(f); return out; };
V.fsperiod = () => {
  const P = CF("plantillasFS"), L = CF("periodicasFS"), hasta = S.fsHasta || hoy(), sel = L.find(x => x.id === S.selPeriodica), total = L.reduce((s, x) => s + vencidas(x, hasta).length, 0);
  return pagina("Facturas periódicas", `<button class="p" data-a="genfs" ${total ? "" : "disabled"}>Generar facturas periódicas${total ? " (" + total + ")" : ""}</button>` + btn("delperiodica", "Eliminar", "", !sel) + btn("vista", "Plantillas", 'data-v="plantfs"') + btn("vista", "Registrar facturas periódicas", 'data-v="fservicios"'), `${P.length ? `<div class="card"><div class="row"><label>Cliente<br><select id="fp-cli">${opcTer(S.d.terceros.filter(t => t.tipo === "C"), "")}</select></label><label>Plantilla<br><select id="fp-plant">${P.map(p => `<option value="${p.id}">${esc(p.nombre)}</option>`).join("")}</select></label><label>Periodicidad<br><select id="fp-cada">${Object.entries(CADA).map(([v, n]) => `<option value="${v}">${n}</option>`).join("")}</select></label><label>Primera factura<br><input type="date" id="fp-ini" value="${hoy()}"></label><label>Hasta (opcional)<br><input type="date" id="fp-fin"></label><button data-a="addperiodica">+ Agregar</button></div></div>` : `<p>Cree antes una plantilla desde una factura de servicios.</p>`}
   <div class="lista"><table><tr><th>Cliente</th><th>Nombre</th><th>Plantilla</th><th>Periodicidad</th><th>Próxima factura</th><th>Hasta</th><th class="n">Generadas</th><th class="n">Pendientes</th></tr>${L.map(x => { const t = terPorId(x.tercero_id) || {}, p = P.find(y => y.id === x.plantilla); return `<tr data-sel class="${sel && sel.id === x.id ? "sel" : ""}" data-a="selperiodica" data-id="${x.id}"><td>${esc(t.codigo || "")}</td><td>${esc(t.nombre || "")}</td><td>${esc(p ? p.nombre : "(plantilla eliminada)")}</td><td>${CADA[x.cada]}</td><td>${x.proxima}</td><td>${x.hasta || ""}</td><td class="n">${x.hechas || 0}</td><td class="n">${vencidas(x, hasta).length || ""}</td></tr>`; }).join("") || `<tr><td colspan="8" class="vacio">Sin facturas periódicas.</td></tr>`}</table></div><p style="color:var(--tx2)">Las facturas se generan sin registrar, con la fecha de cada período. Regístrelas desde Facturas de servicios marcando las que quiera.</p>`, { tabs: ["Lista"], filtros: `<label>Generar hasta<input type="date" id="fs-hasta" value="${hasta}"></label>` });
};
async function accionFS(a, b) {
  const id = b.dataset.id;
  switch (a) {
    case "selfs": S.selFS = id; render(); return true;
    case "nuevafs": { const f = facturaNuevaFS(null, hoy()), l = nuevaLineaF(f); l.cuenta = ctaServicios(); S.vista = "fventa"; S.fact = { f, ls: [l] }; render(); return true; }
    case "delfs": { const f = S.d.facturas.find(x => x.id === S.selFS); if (f && estadoF(f) === "Abierto" && confirm("¿Eliminar la factura " + f.numero + "?")) { await db.borrarFactura(f.id); S.selFS = null; await recargar(); } return true; }
    case "registrarfs": {
      const ids = S.d.facturas.filter(f => esFS(f) && S.fsMarcas.has(f.id) && estadoF(f) === "Abierto").sort((x, y) => x.numero.localeCompare(y.numero)).map(f => f.id); if (!ids.length || !confirm("¿Registrar " + ids.length + " factura(s)?")) return true;
      let ok = 0; for (const i of ids) { const f = S.d.facturas.find(x => x.id === i); S.fact = { f: { ...f }, ls: lineasF(f).map(l => ({ ...l })) }; await registrarFactura(); if (estadoF(S.d.facturas.find(x => x.id === i)) === "Registrado") ok++; }
      S.fact = null; S.fsMarcas = new Set(); S.vista = "fservicios"; render(); alert(ok + " de " + ids.length + " factura(s) registradas."); return true;
    }
    case "plantdesde": { const f = S.d.facturas.find(x => x.id === S.selFS); if (!f) return true; const nombre = (prompt("Nombre de la plantilla", ((terPorId(f.tercero_id) || {}).nombre || "") + " · " + f.numero) || "").trim(); if (!nombre) return true;
      await guardarCfg("plantillasFS", [...CF("plantillasFS"), { id: uid(), nombre, ret: f.cod_ret || "", lineas: lineasF(f).map(l => ({ descripcion: l.descripcion || "", cuenta: l.cuenta, cantidad: +l.cantidad, precio: +l.precio, cod: l.cod })) }]); render(); alert("Plantilla guardada."); return true; }
    case "fsdeplant": { const P = CF("plantillasFS").find(p => p.id === document.getElementById("fs-plant").value), t = terPorId(document.getElementById("fs-cli").value); if (!P || !t) { alert("Elija plantilla y cliente."); return true; } const nid = await crearFSdesde(P, t, hoy(), ""); S.vista = "fventa"; abrirFactura(nid); return true; }
    case "fsimprimir": S.imprFact = S.selFS; S.vista = "imprfact"; render(); return true;
    case "selplant": S.selPlant = id; render(); return true;
    case "delplant": if (confirm("¿Eliminar la plantilla?")) { await guardarCfg("plantillasFS", CF("plantillasFS").filter(p => p.id !== S.selPlant)); S.selPlant = null; render(); } return true;
    case "selperiodica": S.selPeriodica = id; render(); return true;
    case "addperiodica": { const v = i => document.getElementById(i).value; if (!v("fp-cli") || !v("fp-ini")) { alert("Elija cliente y fecha de la primera factura."); return true; } await guardarCfg("periodicasFS", [...CF("periodicasFS"), { id: uid(), tercero_id: v("fp-cli"), plantilla: v("fp-plant"), cada: +v("fp-cada"), inicio: v("fp-ini"), proxima: v("fp-ini"), hasta: v("fp-fin"), hechas: 0 }]); render(); return true; }
    case "delperiodica": if (confirm("¿Eliminar la facturación periódica? Las facturas ya generadas se conservan.")) { await guardarCfg("periodicasFS", CF("periodicasFS").filter(x => x.id !== S.selPeriodica)); S.selPeriodica = null; render(); } return true;
    case "genfs": {
      const hasta = S.fsHasta || hoy(), P = CF("plantillasFS"), tareas = CF("periodicasFS").map(x => ({ x, f: vencidas(x, hasta), p: P.find(y => y.id === x.plantilla), t: terPorId(x.tercero_id) })).filter(o => o.f.length && o.p && o.t), n = tareas.reduce((s, o) => s + o.f.length, 0);
      if (!n || !confirm("¿Generar " + n + " factura(s) hasta " + hasta + "?")) return true;
      for (const o of tareas) for (const fecha of o.f) { await crearFSdesde(o.p, o.t, fecha, " (" + fecha.slice(5, 7) + "/" + fecha.slice(0, 4) + ")");
        await guardarCfg("periodicasFS", CF("periodicasFS").map(y => y.id === o.x.id ? { ...y, hechas: (y.hechas || 0) + 1, proxima: mesesMas(y.inicio, ((y.hechas || 0) + 1) * y.cada) } : y)); }
      S.vista = "fservicios"; await recargar(); return true;
    }
  }
  return false;
}
function cambioFS(t) {
  if (t.dataset.fs !== undefined) { const M = S.fsMarcas || (S.fsMarcas = new Set()); if (t.checked) M.add(t.dataset.fs); else M.delete(t.dataset.fs); render(); return true; }
  const s = { "fs-filtro": "fsFiltro", "fs-estado": "fsEstado", "fs-dias": "fsDias", "fs-hasta": "fsHasta" }[t.id];
  if (s) { S[s] = t.value; render(); return true; }
  return ["fs-plant", "fs-cli", "fp-cli", "fp-plant", "fp-cada", "fp-ini", "fp-fin"].includes(t.id);
}

/* ---------------- Contabilidad general (como en D365): informes, consultas, dimensiones, asignaciones, periodificaciones, consolidación ---------------- */
const TECNICOS = ["regularizacion", "cierre"];
const rangoGL = () => ({ d: S.glDesde || `${S.ej}-01-01`, h: S.glHasta || `${S.ej}-12-31` });
const filtrosGL = (extra = "") => { const r = rangoGL(); return `<label>Desde<input type="date" id="gl-desde" value="${r.d}"></label><label>Hasta<input type="date" id="gl-hasta" value="${r.h}"></label>${extra}`; };
const tablaGL = (cab, filas, vacio = "No se encontró ningún elemento que mostrar aquí.") => `<div class="lista"><table><tr>${cab.map(c => `<th class="${c.startsWith("#") ? "n" : ""}">${c.replace("#", "")}</th>`).join("")}</tr>${filas || `<tr><td colspan="${cab.length}" class="vacio">${vacio}</td></tr>`}</table></div>`;
// apuntes que forman los saldos a una fecha: si el ejercicio tiene asiento de apertura solo cuentan los suyos; si no, se acumula todo lo anterior
function apuntesHasta(datos, hasta) {
  const ej = +hasta.slice(0, 4), abre = datos.asientos.some(a => a.ejercicio === ej && a.origen === "apertura");
  const M = new Map(datos.asientos.filter(a => a.fecha <= hasta && !TECNICOS.includes(a.origen) && (abre ? a.ejercicio === ej : a.origen !== "apertura")).map(a => [a.id, a]));
  return datos.apuntes.filter(p => M.has(p.asiento_id)).map(p => ({ ...p, a: M.get(p.asiento_id) }));
}
// [epígrafe, prefijos de cuenta]; manda el prefijo más largo. Lo que no encaja va a "Otras partidas" según su signo
const BAL = [
  ["A", "A) Activo no corriente", [["I. Inmovilizado intangible", "20 280 290"], ["II. Inmovilizado material", "21 23 281 291"], ["III. Inversiones inmobiliarias", "22 282 292"], ["IV. Inversiones en empresas del grupo a largo plazo", "24 293 294"], ["V. Inversiones financieras a largo plazo", "25 26 297 298"], ["VI. Activos por impuesto diferido", "474"]]],
  ["A", "B) Activo corriente", [["II. Existencias", "30 31 32 33 34 35 36 39 407"], ["III. Deudores comerciales y otras cuentas a cobrar", "43 44 460 470 471 472 473 490 493 544"], ["V. Inversiones financieras a corto plazo", "53 540 541 542 543 545 546 547 548 565 566 59"], ["VI. Periodificaciones a corto plazo", "480 567"], ["VII. Efectivo y otros activos líquidos", "57"], ["Otras partidas deudoras", "*D"]]],
  ["P", "A) Patrimonio neto", [["I. Capital", "10"], ["III. Reservas", "11"], ["V. Resultados de ejercicios anteriores", "12"], ["VII. Resultado del ejercicio", "129"], ["Subvenciones, donaciones y ajustes", "13"]]],
  ["P", "B) Pasivo no corriente", [["I. Provisiones a largo plazo", "14"], ["II. Deudas a largo plazo", "15 16 17 18"], ["IV. Pasivos por impuesto diferido", "479"]]],
  ["P", "C) Pasivo corriente", [["II. Provisiones a corto plazo", "499 529"], ["III. Deudas a corto plazo", "50 51 520 521 522 523 524 525 526 527 528 560 561"], ["V. Acreedores comerciales y otras cuentas a pagar", "40 41 438 465 466 475 476 477"], ["VI. Periodificaciones a corto plazo", "485 568"], ["Otras partidas acreedoras", "*H"]]]
];
const PYG = [
  ["1. Importe neto de la cifra de negocios", "70", "E"], ["2. Variación de existencias de productos terminados", "71", "E"], ["3. Trabajos realizados por la empresa para su activo", "73", "E"], ["4. Aprovisionamientos", "60 61", "E"], ["5. Otros ingresos de explotación", "74 75", "E"], ["6. Gastos de personal", "64", "E"], ["7. Otros gastos de explotación", "62 631 634 636 639 65 694 695 794", "E"], ["8. Amortización del inmovilizado", "68", "E"], ["9. Imputación de subvenciones de inmovilizado", "746", "E"], ["10. Deterioro y resultado por enajenaciones del inmovilizado", "670 671 672 690 691 692 770 771 772 790 791 792", "E"], ["11. Otros resultados", "678 778", "E"],
  ["12. Ingresos financieros", "76", "F"], ["13. Gastos financieros", "66", "F"], ["14. Deterioro y resultado de instrumentos financieros", "696 697 698 699 796 797 798 799 673 675 773 775", "F"], ["15. Impuesto sobre beneficios", "630 633 638", "I"]
];
function epigrafe(cta, reglas) { let best = null, n = 0; reglas.forEach(([k, pref]) => pref.split(" ").forEach(p => { if (!p.startsWith("*") && cta.startsWith(p) && p.length > n) { best = k; n = p.length; } })); return best; }
function calcBalance(datos, hasta) {
  const s = new Map(); apuntesHasta(datos, hasta).forEach(p => { const resAnt = /^[67]/.test(p.cuenta) && p.a.ejercicio < +hasta.slice(0, 4), c = resAnt ? "120000000" : p.cuenta; s.set(c, r2((s.get(c) || 0) + +p.debe - +p.haber)); });
  const reglas = BAL.flatMap(([lado, g, L]) => L.map(([n, pref]) => [lado + "|" + g + "|" + n, pref])), V_ = new Map();
  s.forEach((v, c) => { let k = /^[67]/.test(c) ? "P|A) Patrimonio neto|VII. Resultado del ejercicio" : epigrafe(c, reglas); if (!k) k = v > 0 ? "A|B) Activo corriente|Otras partidas deudoras" : "P|C) Pasivo corriente|Otras partidas acreedoras"; V_.set(k, r2((V_.get(k) || 0) + (k[0] === "A" ? v : -v))); });
  return V_;
}
function calcPyG(datos, hasta) {
  const ej = +hasta.slice(0, 4), V_ = new Map(PYG.map(x => [x[0], 0]));
  apuntesHasta(datos, hasta).filter(p => /^[67]/.test(p.cuenta) && p.a.ejercicio === ej).forEach(p => { const k = epigrafe(p.cuenta, PYG) || "11. Otros resultados"; V_.set(k, r2(V_.get(k) - (+p.debe - +p.haber))); });
  const g = t => r2(PYG.filter(x => x[2] === t).reduce((a, x) => a + V_.get(x[0]), 0)), E = g("E"), F = g("F"), I = g("I");
  return { V: V_, E, F, antes: r2(E + F), res: r2(E + F + I) };
}
function filasFinancieros() { // [texto, año actual, año anterior, tipo]
  const h = rangoGL().h, ha = (+h.slice(0, 4) - 1) + h.slice(4);
  if ((S.finTipo || "bal") === "bal") {
    const A = calcBalance(S.d, h), B = calcBalance(S.d, ha), out = [];
    [["A", "ACTIVO"], ["P", "PATRIMONIO NETO Y PASIVO"]].forEach(([lado, tit]) => { out.push([tit, null, null, "t"]); let ta = 0, tb = 0;
      BAL.filter(x => x[0] === lado).forEach(([, g, L]) => { const ls = L.map(([n]) => { const k = lado + "|" + g + "|" + n; return [n, A.get(k) || 0, B.get(k) || 0, "l"]; }).filter(x => x[1] || x[2]), sa = r2(ls.reduce((s, x) => s + x[1], 0)), sb = r2(ls.reduce((s, x) => s + x[2], 0)); ta = r2(ta + sa); tb = r2(tb + sb); out.push([g, sa, sb, "g"], ...ls); });
      out.push(["TOTAL " + tit, ta, tb, "t"]); });
    return out;
  }
  const A = calcPyG(S.d, h), B = calcPyG(S.d, ha), lin = t => PYG.filter(x => x[2] === t).map(([n]) => [n, A.V.get(n), B.V.get(n), "l"]).filter(x => x[1] || x[2]);
  return [...lin("E"), ["A) RESULTADO DE EXPLOTACIÓN", A.E, B.E, "g"], ...lin("F"), ["B) RESULTADO FINANCIERO", A.F, B.F, "g"], ["C) RESULTADO ANTES DE IMPUESTOS", A.antes, B.antes, "g"], ...lin("I"), ["D) RESULTADO DEL EJERCICIO", A.res, B.res, "t"]];
}
V.financieros = () => {
  const t = S.finTipo || "bal", h = rangoGL().h, y = +h.slice(0, 4), F = filasFinancieros();
  const filas = F.map(([n, a, b, k]) => `<tr class="${k === "l" ? "" : "tot"}"><td style="${k === "l" ? "padding-left:2rem" : ""}">${n}</td><td class="n">${a === null ? "" : eur(a)}</td><td class="n">${b === null ? "" : eur(b)}</td></tr>`).join("");
  return pagina("Informes financieros", btn("fincsv", "Exportar CSV") + btn("imprimir", "Imprimir"), `<div class="card"><b>${esc(S.emp.nombre)}</b> · ${t === "bal" ? "Balance de situación a " + h : "Cuenta de pérdidas y ganancias hasta " + h}</div>${tablaGL(["Epígrafe", "#" + y, "#" + (y - 1)], filas)}<p style="color:var(--tx2)">Modelo abreviado según los prefijos del PGC. Es un informe de gestión: revise la clasificación antes de usarlo en cuentas anuales.</p>`,
    { tabs: ["Informe"], filtros: `<label>Informe<select id="fin-tipo"><option value="bal" ${t === "bal" ? "selected" : ""}>Balance de situación</option><option value="pyg" ${t === "pyg" ? "selected" : ""}>Pérdidas y ganancias</option></select></label><label>A fecha<input type="date" id="gl-hasta" value="${h}"></label>` });
};
function datosSaldos() {
  const { d, h } = rangoGL(), nivel = +(S.glNivel || 9), M = new Map();
  apuntesHasta(S.d, h).forEach(p => { const c = p.cuenta.slice(0, nivel), r = M.get(c) || [0, 0, 0]; if (p.a.fecha < d || p.a.origen === "apertura") r[0] = r2(r[0] + +p.debe - +p.haber); else { r[1] = r2(r[1] + +p.debe); r[2] = r2(r[2] + +p.haber); } M.set(c, r); });
  return [...M].sort((a, b) => a[0].localeCompare(b[0])).map(([c, [i, de, ha]]) => [c, nombreCuenta(c) || nombreMaestro(c), i, de, ha, r2(i + de - ha)]);
}
V.saldosfecha = () => {
  const L = datosSaldos(), t = [2, 3, 4, 5].map(i => r2(L.reduce((s, r) => s + r[i], 0))), nv = String(S.glNivel || 9);
  return pagina("Saldo de comprobación", btn("saldoscsv", "Exportar CSV") + btn("imprimir", "Imprimir"), tablaGL(["Cuenta principal", "Nombre", "#Saldo inicial", "#Débito", "#Crédito", "#Saldo final"], L.map(r => `<tr><td><a data-a="vercuenta" data-id="${r[0]}">${r[0]}</a></td><td>${esc(r[1])}</td>${r.slice(2).map(v => `<td class="n">${sal(v)}</td>`).join("")}</tr>`).join("") + (L.length ? `<tr class="tot"><td colspan="2">Totales</td>${t.map(v => `<td class="n">${eur(v)}</td>`).join("")}</tr>` : "")),
    { tabs: ["Visión general"], filtros: filtrosGL(`<label>Nivel<select id="gl-nivel">${[["9", "Cuenta (9 dígitos)"], ["4", "4 dígitos"], ["3", "3 dígitos"]].map(([v, n]) => `<option value="${v}" ${v === nv ? "selected" : ""}>${n}</option>`).join("")}</select></label>`) });
};
function datosExtractoCta() {
  const { d, h } = rangoGL(), q = (S.glCta || "").trim(), todos = apuntesHasta(S.d, h).filter(p => !q || p.cuenta.startsWith(q)).sort((x, y) => x.cuenta.localeCompare(y.cuenta) || x.a.fecha.localeCompare(y.a.fecha) || x.a.numero - y.a.numero), M = new Map();
  todos.forEach(p => { const r = M.get(p.cuenta) || { ini: 0, L: [] }; if (p.a.fecha < d || p.a.origen === "apertura") r.ini = r2(r.ini + +p.debe - +p.haber); else r.L.push(p); M.set(p.cuenta, r); });
  return M;
}
V.extctas = () => {
  const M = datosExtractoCta(); let n = 0, filas = "";
  for (const [c, r] of M) { if (n > 800) break; let s = r.ini; filas += `<tr class="tot"><td colspan="5">${c} · ${esc(nombreCuenta(c))}</td><td class="n">${eur(r.ini)}</td></tr>`; r.L.forEach(p => { s = r2(s + +p.debe - +p.haber); n++; filas += `<tr><td>${p.a.fecha}</td><td>${asNum(p.a)}</td><td>${esc(p.concepto || p.a.concepto || "")}</td><td class="n">${sal(+p.debe)}</td><td class="n">${sal(+p.haber)}</td><td class="n">${eur(s)}</td></tr>`; }); }
  return pagina("Extracto de contabilidad general por cuenta principal", btn("extctacsv", "Exportar CSV") + btn("imprimir", "Imprimir"), `${n > 800 ? "<p>Se muestran las primeras líneas; filtre por cuenta o exporte el CSV.</p>" : ""}${tablaGL(["Fecha", "Asiento", "Descripción", "#Débito", "#Crédito", "#Saldo"], filas)}`, { tabs: ["Visión general"], filtros: filtrosGL(`<label>Cuenta (empieza por)<input id="gl-cta" size="10" value="${esc(S.glCta || "")}"></label>`) });
};
const REVERSIBLE = a => ["manual", "diario", "general", "periodico", "asignacion", "periodificacion", "extracto", "transferencia", undefined, null, ""].includes(a.origen);
const reversionDe = a => S.d.asientos.find(x => x.documento === "REV-" + a.id);
V.transasiento = () => {
  const { d, h } = rangoGL(), or = S.glOrigen || "", orig = [...new Set(S.d.asientos.map(a => a.origen || "manual"))].sort();
  const L = S.d.asientos.filter(a => a.fecha >= d && a.fecha <= h && (!or || (a.origen || "manual") === or)).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.numero - a.numero), sel = L.find(a => a.id === S.selTA), ap = sel ? S.d.apuntes.filter(p => p.asiento_id === sel.id) : [];
  const filas = L.slice(0, 500).map(a => `<tr data-sel class="${sel && sel.id === a.id ? "sel" : ""}" data-a="selta" data-id="${a.id}"><td>${asNum(a)}</td><td>${a.fecha}</td><td>${esc(a.origen || "manual")}</td><td>${esc(a.documento && !a.documento.startsWith("REV-") ? a.documento : "")}</td><td>${esc(a.concepto || "")}</td><td class="n">${eur(S.d.apuntes.filter(p => p.asiento_id === a.id).reduce((s, p) => s + +p.debe, 0))}</td><td>${reversionDe(a) ? "Revertido" : ""}</td></tr>`).join("");
  return pagina("Transacciones de asiento", `<label style="margin-right:.5rem">Fecha de reversión <input type="date" id="rev-fecha" value="${hoy()}"></label>` + btn("revertir", "Revertir asiento", "", !sel || !REVERSIBLE(sel) || !!reversionDe(sel)), `<div class="pagina">${tablaGL(["Asiento", "Fecha", "Origen", "Documento", "Descripción", "#Importe", "Reversión"], filas)}<aside class="factbox"><h3>Líneas del asiento</h3>${sel ? `<dl>${ap.map(p => `<dt>${p.cuenta} ${esc(nombreCuenta(p.cuenta))}</dt><dd>${+p.debe ? "D " + eur(p.debe) : "H " + eur(p.haber)}</dd>`).join("")}</dl>${REVERSIBLE(sel) ? "" : `<p style="color:var(--tx2)">Los asientos de facturas, cobros, efectos o procesos se deshacen desde su propia pantalla.</p>`}` : `<p style="color:var(--tx2)">Seleccione un asiento.</p>`}</aside></div>`,
    { tabs: ["Visión general"], filtros: filtrosGL(`<label>Origen<select id="gl-origen"><option value="">Todos</option>${orig.map(o => `<option ${o === or ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></label>`) });
};
V.comprobarserie = () => {
  const L = S.d.asientos.filter(a => a.ejercicio === S.ej).sort((a, b) => a.numero - b.numero), P = [], codigos = new Set(S.d.cuentas.map(c => c.codigo));
  L.forEach((a, i) => { const prev = L[i - 1];
    if (prev && a.numero === prev.numero) P.push(["Número repetido", asNum(a), a.fecha]);
    if (a.numero > (prev ? prev.numero : 0) + 1) P.push(["Salto de numeración: faltan del " + ((prev ? prev.numero : 0) + 1) + " al " + (a.numero - 1), asNum(a), a.fecha]);
    if (prev && a.fecha < prev.fecha) P.push(["Fecha anterior a la del asiento precedente", asNum(a), a.fecha]);
    if (+a.fecha.slice(0, 4) !== a.ejercicio) P.push(["La fecha no es del ejercicio", asNum(a), a.fecha]);
    const ap = S.d.apuntes.filter(p => p.asiento_id === a.id), dif = r2(ap.reduce((s, p) => s + +p.debe - +p.haber, 0));
    if (dif) P.push(["Descuadrado en " + eur(dif), asNum(a), a.fecha]); if (!ap.length) P.push(["Sin líneas", asNum(a), a.fecha]);
    ap.filter(p => !codigos.has(p.cuenta)).forEach(p => P.push(["Cuenta " + p.cuenta + " fuera del plan", asNum(a), a.fecha])); });
  return pagina("Comprobar serie de asientos", "", `<div class="card">${L.length} asientos revisados del ejercicio ${S.ej} · <b class="${P.length ? "ko" : "ok"}">${P.length ? P.length + " incidencia(s)" : "Sin incidencias"}</b></div>${tablaGL(["Incidencia", "Asiento", "Fecha"], P.slice(0, 500).map(r => `<tr><td>${esc(r[0])}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join(""), "Todo correcto.")}<p style="color:var(--tx2)">Un salto puede deberse a asientos eliminados; las fechas desordenadas son habituales si se registra con retraso.</p>`, { tabs: ["Informe"], vista: "Ejercicio " + S.ej });
};

/* Dimensiones financieras: valor por defecto según la cuenta y cambios apunte a apunte */
SEED.dimensiones = () => [{ id: "CC", nombre: "Centro de coste", valores: [] }, { id: "DEP", nombre: "Departamento", valores: [] }]; SEED.dimCuenta = () => []; SEED.dimApunte = () => ({});
const dimSel = () => { const D = CF("dimensiones"); return D.find(x => x.id === S.dimId) || D[0]; };
const dimDefecto = (cta, dim) => { const r = CF("dimCuenta").filter(x => x.dim === dim && cta.startsWith(x.cuenta)).sort((a, b) => b.cuenta.length - a.cuenta.length)[0]; return r ? r.valor : ""; };
const dimDe = (p, dim) => (CF("dimApunte")[p.id] || {})[dim] || dimDefecto(p.cuenta, dim);
const selDim = D => `<label>Dimensión<select id="dim-id">${CF("dimensiones").map(x => `<option value="${esc(x.id)}" ${x.id === D.id ? "selected" : ""}>${esc(x.nombre)}</option>`).join("")}</select></label>`;
V.dimensiones = () => {
  const D = dimSel(), R = D ? CF("dimCuenta").filter(x => x.dim === D.id) : [];
  return pagina("Dimensiones financieras", btn("nuevadim", "+ Nueva dimensión") + btn("deldim", "Eliminar dimensión", "", !D), D ? `<div class="card"><div class="row"><label>Nuevo valor<br><input id="dim-valor" size="24" placeholder="p. ej. Fábrica"></label><button data-a="addvalor">+ Agregar valor</button></div></div>
    ${tablaGL(["Valores de " + esc(D.nombre), ""], D.valores.map(v => `<tr><td>${esc(v)}</td><td><button class="d" data-a="delvalor" data-id="${esc(v)}">✕</button></td></tr>`).join(""), "Sin valores.")}
    <h3 style="margin-top:1rem">Valor por defecto según la cuenta</h3><div class="card"><div class="row"><label>Cuenta (empieza por)<br><input id="dim-cta" size="12"></label><label>Valor<br><select id="dim-def">${D.valores.map(v => `<option>${esc(v)}</option>`).join("")}</select></label><button data-a="adddimcta" ${D.valores.length ? "" : "disabled"}>+ Agregar regla</button></div></div>
    ${tablaGL(["Cuenta", "Valor", ""], R.map(x => `<tr><td>${x.cuenta}</td><td>${esc(x.valor)}</td><td><button class="d" data-a="deldimcta" data-id="${x.cuenta}">✕</button></td></tr>`).join(""), "Sin reglas.")}` : "<p>Cree una dimensión.</p>", { tabs: ["Configurar"], filtros: D ? selDim(D) : "" });
};
const apuntesRes = () => { const { d, h } = rangoGL(); return apuntesHasta(S.d, h).filter(p => /^[67]/.test(p.cuenta) && p.a.fecha >= d); };
V.asigdim = () => {
  const D = dimSel(); if (!D) return pagina("Asignar dimensiones", "", "<p>Cree antes una dimensión.</p>");
  const solo = S.dimSolo === "1", L = apuntesRes().filter(p => !solo || !dimDe(p, D.id)).sort((x, y) => x.a.fecha.localeCompare(y.a.fecha) || x.a.numero - y.a.numero), M = CF("dimApunte");
  return pagina("Asignar dimensiones", "", tablaGL(["Fecha", "Asiento", "Cuenta", "Descripción", "#Importe", esc(D.nombre), "Origen"], L.slice(0, 400).map(p => { const o = (M[p.id] || {})[D.id] || "", def = dimDefecto(p.cuenta, D.id); return `<tr><td>${p.a.fecha}</td><td>${asNum(p.a)}</td><td>${p.cuenta}</td><td>${esc(p.concepto || p.a.concepto || "")}</td><td class="n">${eur(+p.debe - +p.haber)}</td><td><select data-dim="${p.id}"><option value="">${def ? "(por defecto) " + esc(def) : ""}</option>${D.valores.map(v => `<option ${v === o ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></td><td>${o ? "Manual" : def ? "Regla" : "Sin asignar"}</td></tr>`; }).join("")) + `<p style="color:var(--tx2)">Solo cuentas de gastos e ingresos. Se muestran hasta 400 líneas. Si un asiento se modifica, sus asignaciones manuales se pierden y vuelve a aplicarse la regla.</p>`,
    { tabs: ["Líneas"], filtros: selDim(D) + filtrosGL(`<label>Mostrar<select id="dim-solo"><option value="">Todas</option><option value="1" ${solo ? "selected" : ""}>Sin asignar</option></select></label>`) });
};
function datosDim(D) { const M = new Map(); apuntesRes().forEach(p => { const v = dimDe(p, D.id) || "(sin asignar)", r = M.get(v) || [0, 0], s = +p.debe - +p.haber; if (p.cuenta[0] === "7") r[0] = r2(r[0] - s); else r[1] = r2(r[1] + s); M.set(v, r); }); return [...M].sort((a, b) => a[0].localeCompare(b[0])).map(([v, [i, g]]) => [v, i, g, r2(i - g)]); }
V.extdim = () => {
  const D = dimSel(); if (!D) return pagina("Extracto de dimensión", "", "<p>Cree antes una dimensión.</p>");
  const L = datosDim(D), t = [1, 2, 3].map(i => r2(L.reduce((s, r) => s + r[i], 0)));
  return pagina("Extracto de dimensión", btn("dimcsv", "Exportar CSV") + btn("imprimir", "Imprimir"), tablaGL([esc(D.nombre), "#Ingresos", "#Gastos", "#Resultado"], L.map(r => `<tr><td>${esc(r[0])}</td>${r.slice(1).map(v => `<td class="n">${eur(v)}</td>`).join("")}</tr>`).join("") + (L.length ? `<tr class="tot"><td>Total</td>${t.map(v => `<td class="n">${eur(v)}</td>`).join("")}</tr>` : "")), { tabs: ["Informe"], filtros: selDim(D) + filtrosGL() });
};

/* Asignaciones (reparto) y esquemas de acumulación (periodificaciones) */
SEED.asignaciones = () => []; SEED.periodif = () => [];
const saldoPeriodo = (cta, d, h) => r2(apuntesHasta(S.d, h).filter(p => p.cuenta === cta && p.a.fecha >= d && !["apertura", "asignacion"].includes(p.a.origen)).reduce((s, p) => s + +p.debe - +p.haber, 0));
const yaAsignado = (r, d, h) => S.d.asientos.find(a => a.documento === `ASG-${r.id}-${d}-${h}`);
V.asignaciones = () => {
  const L = CF("asignaciones"), { d, h } = rangoGL(), sel = L.find(r => r.id === S.selAsg), B = S.asgDest || (S.asgDest = [{ cuenta: "", pct: "" }, { cuenta: "", pct: "" }]), F = S.asgForm || (S.asgForm = { nombre: "", origen: "" });
  return pagina("Diarios de asignaciones", `<button class="p" data-a="procesarasg" ${sel && !yaAsignado(sel, d, h) && saldoPeriodo(sel.origen, d, h) ? "" : "disabled"}>Procesar asignación</button>` + btn("delasg", "Eliminar regla", "", !sel), `${dlCtas()}<div class="card"><b>Nueva regla de asignación</b><div class="row" style="margin-top:.5rem"><label>Nombre<br><input id="asg-nombre" size="26" value="${esc(F.nombre)}"></label><label>Cuenta de origen<br><input id="asg-origen" list="dl" size="12" value="${esc(F.origen)}"></label></div>${B.map((x, i) => `<div class="row"><label>Cuenta de destino ${i + 1}<br><input data-asg="${i}" data-k="cuenta" list="dl" size="12" value="${esc(x.cuenta)}"></label><label>Porcentaje<br><input data-asg="${i}" data-k="pct" size="6" value="${esc(x.pct)}"></label></div>`).join("")}<div class="row"><button data-a="addasgdest">+ Destino</button><button data-a="guardarasg">Guardar regla</button></div></div>
   <div class="pagina">${tablaGL(["Regla", "Cuenta de origen", "#Saldo del período", "Estado"], L.map(r => `<tr data-sel class="${sel && sel.id === r.id ? "sel" : ""}" data-a="selasg" data-id="${r.id}"><td>${esc(r.nombre)}</td><td>${r.origen}</td><td class="n">${eur(saldoPeriodo(r.origen, d, h))}</td><td>${yaAsignado(r, d, h) ? "Procesada " + asNum(yaAsignado(r, d, h)) : "Pendiente"}</td></tr>`).join(""), "Sin reglas.")}<aside class="factbox"><h3>Destinos</h3>${sel ? `<dl>${sel.destinos.map(x => `<dt>${x.cuenta} ${esc(nombreCuenta(x.cuenta))}</dt><dd>${x.pct} %</dd>`).join("")}</dl>` : `<p style="color:var(--tx2)">Seleccione una regla.</p>`}</aside></div><p style="color:var(--tx2)">Traspasa el saldo del período de la cuenta de origen a las de destino, con fecha "Hasta".</p>`, { tabs: ["Reglas"], filtros: filtrosGL() });
};
const cuotasPer = x => Array.from({ length: x.meses }, (_, i) => ({ mes: mesesMas(x.inicio + "-01", i).slice(0, 7), importe: i < x.meses - 1 ? r2(x.total / x.meses) : r2(x.total - r2(x.total / x.meses) * (x.meses - 1)) }));
const asientoCuota = (x, mes) => S.d.asientos.find(a => a.documento === `PDF-${x.id}-${mes}`);
V.periodif = () => {
  const L = CF("periodif"), hasta = S.pdfMes || hoy().slice(0, 7), sel = L.find(x => x.id === S.selPdf), n = L.reduce((s, x) => s + cuotasPer(x).filter(c => c.mes <= hasta && !asientoCuota(x, c.mes)).length, 0);
  return pagina("Esquemas de acumulación", `<button class="p" data-a="genpdf" ${n ? "" : "disabled"}>Generar asientos pendientes${n ? " (" + n + ")" : ""}</button>` + btn("delpdf", "Eliminar", "", !sel), `${dlCtas()}<div class="card"><b>Nueva periodificación</b><div class="row" style="margin-top:.5rem"><label>Descripción<br><input id="pdf-nombre" size="24"></label><label>Cuenta de balance (480, 485…)<br><input id="pdf-bal" list="dl" size="12"></label><label>Cuenta de gasto o ingreso<br><input id="pdf-res" list="dl" size="12"></label><label>Importe total<br><input id="pdf-total" size="10"></label><label>Mes inicial<br><input type="month" id="pdf-ini" value="${S.ej}-01"></label><label>Meses<br><input id="pdf-meses" size="4" value="12"></label><button data-a="addpdf">Guardar</button></div></div>
   <div class="pagina">${tablaGL(["Descripción", "Balance", "Resultado", "#Total", "Desde", "Meses", "#Generado", "#Pendiente"], L.map(x => { const g = r2(cuotasPer(x).filter(c => asientoCuota(x, c.mes)).reduce((s, c) => s + c.importe, 0)); return `<tr data-sel class="${sel && sel.id === x.id ? "sel" : ""}" data-a="selpdf" data-id="${x.id}"><td>${esc(x.nombre)}</td><td>${x.bal}</td><td>${x.res}</td><td class="n">${eur(x.total)}</td><td>${x.inicio}</td><td>${x.meses}</td><td class="n">${eur(g)}</td><td class="n">${eur(x.total - g)}</td></tr>`; }).join(""), "Sin periodificaciones.")}<aside class="factbox"><h3>Cuotas</h3>${sel ? `<dl>${cuotasPer(sel).map(c => `<dt>${c.mes}${asientoCuota(sel, c.mes) ? " ✓" : ""}</dt><dd>${eur(c.importe)}</dd>`).join("")}</dl>` : `<p style="color:var(--tx2)">Seleccione una fila.</p>`}</aside></div><p style="color:var(--tx2)">El importe total ya debe estar en la cuenta de balance (por su factura o asiento). Cada mes se lleva una cuota a gasto (D 6xx / H 480) o a ingreso (D 485 / H 7xx), con fecha del último día del mes.</p>`, { tabs: ["Esquemas"], filtros: `<label>Generar hasta<input type="month" id="pdf-mes" value="${hasta}"></label>` });
};

/* Consolidación de varias empresas y período medio de pago */
V.consolid = () => {
  const E = S.empresas.filter(e => e.almacen !== "drive"), M = S.conEmps || (S.conEmps = new Set(E.map(e => e.id))), R = S.consol;
  let tabla = "<p>Marque las empresas y pulse Consolidar.</p>";
  if (R) { const cols = R.emps, ctas = [...new Set(cols.flatMap(c => [...c.s.keys()]))].sort(), tot = c => r2(cols.reduce((s, e) => s + (e.s.get(c) || 0), 0));
    tabla = `<div class="card">Saldos a ${R.h}${R.excl ? " · excluidas las cuentas " + esc(R.excl) : ""}</div>${tablaGL(["Cuenta", "Nombre", ...cols.map(c => "#" + esc(c.nombre)), "#Consolidado"], ctas.map(c => `<tr><td>${c}</td><td>${esc(nombreMaestro(c) || nombreCuenta(c))}</td>${cols.map(e => `<td class="n">${sal(e.s.get(c) || 0)}</td>`).join("")}<td class="n">${sal(tot(c))}</td></tr>`).join("") + `<tr class="tot"><td colspan="2">Suma (0 si no hay exclusiones)</td>${cols.map(e => `<td class="n">${eur([...e.s.values()].reduce((a, b) => a + b, 0))}</td>`).join("")}<td class="n">${eur(ctas.reduce((s, c) => s + tot(c), 0))}</td></tr>`)}`; }
  return pagina("Consolidación", `<button class="p" data-a="consolidar" ${M.size ? "" : "disabled"}>Consolidar</button>` + btn("consolcsv", "Exportar CSV", "", !R), `<div class="card"><div class="row">${E.map(e => `<label class="chk"><input type="checkbox" data-con2="${e.id}" ${M.has(e.id) ? "checked" : ""}> ${esc(e.nombre)}</label>`).join("")}</div><div class="row"><label>Cuentas intragrupo a excluir (separadas por espacio)<br><input id="con-excl" size="40" value="${esc(S.conExcl || "")}"></label></div></div>${tabla}<p style="color:var(--tx2)">Suma por cuenta de tres dígitos. No hace eliminaciones de operaciones entre empresas salvo excluir las cuentas indicadas. Las empresas guardadas en Drive no se incluyen.</p>`, { tabs: ["Consolidar"], filtros: `<label>A fecha<input type="date" id="gl-hasta" value="${rangoGL().h}"></label>` });
};
function datosPMP() {
  const fin = `${S.ej}-12-31`, corte = hoy() < fin ? hoy() : fin, dias = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 864e5)); let pag = 0, pagD = 0, pen = 0, penD = 0; const filas = [];
  S.d.facturas.filter(f => f.tipo === "C" && estadoF(f) === "Registrado" && netoF(f) > 0).forEach(f => {
    const ini = f.fecha_emision || f.fecha_registro; let pagadoReal = 0;
    liqsF(f).forEach(l => { const a = S.d.asientos.find(x => x.id === l.asiento_id) || {}; if (a.origen === "compensacion") { pagadoReal = r2(pagadoReal + +l.importe); return; }
      let fp = l.fecha; if (a.origen === "pagare") { let e = efectos().find(x => x.hist[0].asiento === l.asiento_id), g = 0; while (e && e.estado === "Renegociado" && g++ < 20) { const idv = e.id; e = efectos().find(x => x.origen === idv); } const h = e && e.hist.find(x => x.estado === "Pagado"); if (!h) return; fp = h.fecha; }
      pagadoReal = r2(pagadoReal + +l.importe); if (fp.startsWith(String(S.ej))) { const n = dias(ini, fp); pag = r2(pag + +l.importe); pagD += +l.importe * n; filas.push([f, "Pagada", fp, +l.importe, n]); } });
    const resto = r2(netoF(f) - pagadoReal); if (resto > 0 && ini <= corte) { const n = dias(ini, corte); pen = r2(pen + resto); penD += resto * n; filas.push([f, "Pendiente", corte, resto, n]); }
  });
  return { filas, pag, pen, rp: pag ? pagD / pag : 0, rn: pen ? penD / pen : 0, pmp: pag + pen ? (pagD + penD) / (pag + pen) : 0 };
}
V.pmp = () => {
  const D = datosPMP(), f1 = n => n.toFixed(1).replace(".", ",");
  return pagina("Período medio de pago a proveedores", btn("pmpcsv", "Exportar CSV"), `<div class="card"><div class="row"><span>Período medio de pago <b>${f1(D.pmp)} días</b></span><span>Ratio de operaciones pagadas <b>${f1(D.rp)} días</b></span><span>Ratio de operaciones pendientes <b>${f1(D.rn)} días</b></span><span>Pagado <b>${eur(D.pag)}</b></span><span>Pendiente <b>${eur(D.pen)}</b></span></div></div>${tablaGL(["Factura", "Proveedor", "Fecha factura", "Situación", "Fecha de pago o corte", "#Importe", "#Días"], D.filas.slice(0, 500).map(([f, s, fp, imp, n]) => `<tr class="${n > 60 ? "ko" : ""}"><td>${esc(numExt(f))}</td><td>${esc((terPorId(f.tercero_id) || {}).nombre || "")}</td><td>${f.fecha_emision || ""}</td><td>${s}</td><td>${fp}</td><td class="n">${eur(imp)}</td><td class="n">${n}</td></tr>`).join(""))}<p style="color:var(--tx2)">Estimación con las facturas de proveedor registradas; los pagos con pagaré cuentan cuando se paga el pagaré. En rojo, más de 60 días. Compruebe el método antes de publicarlo en la memoria.</p>`, { tabs: ["Informe"], vista: "Ejercicio " + S.ej });
};

async function accionGL(a, b) {
  const id = b.dataset.id, val = i => (document.getElementById(i) || {}).value || "";
  switch (a) {
    case "fincsv": descargarCSV((S.finTipo === "pyg" ? "pyg_" : "balance_") + rangoGL().h + ".csv", [["Epígrafe", "Actual", "Anterior"], ...filasFinancieros().map(([n, x, y]) => [n, x === null ? "" : nCSV(x), y === null ? "" : nCSV(y)])]); return true;
    case "saldoscsv": descargarCSV("saldo_comprobacion_" + rangoGL().h + ".csv", [["Cuenta", "Nombre", "Saldo inicial", "Débito", "Crédito", "Saldo final"], ...datosSaldos().map(r => [r[0], r[1], ...r.slice(2).map(nCSV)])]); return true;
    case "vercuenta": S.glCta = id; S.vista = "extctas"; render(); return true;
    case "extctacsv": { const out = [["Cuenta", "Fecha", "Asiento", "Descripción", "Débito", "Crédito", "Saldo"]]; for (const [c, r] of datosExtractoCta()) { let s = r.ini; out.push([c, "", "", "Saldo inicial", "", "", nCSV(s)]); r.L.forEach(p => { s = r2(s + +p.debe - +p.haber); out.push([c, p.a.fecha, asNum(p.a), p.concepto || p.a.concepto || "", nCSV(p.debe), nCSV(p.haber), nCSV(s)]); }); } descargarCSV("extracto_cuentas_" + rangoGL().h + ".csv", out); return true; }
    case "selta": S.selTA = id; render(); return true;
    case "revertir": { const x = S.d.asientos.find(y => y.id === S.selTA), f = val("rev-fecha"); if (!x || !f || !REVERSIBLE(x) || reversionDe(x)) return true; if (!confirm("¿Revertir el asiento " + asNum(x) + " con fecha " + f + "?")) return true;
      await db.crearAsiento(S.emp.id, f, "Reversión de " + asNum(x) + " " + (x.concepto || ""), S.d.apuntes.filter(p => p.asiento_id === x.id).map(p => ({ cuenta: p.cuenta, concepto: p.concepto || null, debe: +p.haber, haber: +p.debe, ...(p.tercero_id ? { tercero_id: p.tercero_id } : {}) })), "reversion", "REV-" + x.id); await recargar(); return true; }
    case "nuevadim": { const n = (prompt("Nombre de la dimensión") || "").trim(); if (!n) return true; const idd = "D" + uid().slice(0, 6); await guardarCfg("dimensiones", [...CF("dimensiones"), { id: idd, nombre: n, valores: [] }]); S.dimId = idd; render(); return true; }
    case "deldim": { const D = dimSel(); if (D && confirm("¿Eliminar la dimensión " + D.nombre + " y sus reglas?")) { await guardarCfg("dimensiones", CF("dimensiones").filter(x => x.id !== D.id)); await guardarCfg("dimCuenta", CF("dimCuenta").filter(x => x.dim !== D.id)); S.dimId = ""; render(); } return true; }
    case "addvalor": { const D = dimSel(), v = val("dim-valor").trim(); if (!v || D.valores.includes(v)) return true; await guardarCfg("dimensiones", CF("dimensiones").map(x => x.id === D.id ? { ...x, valores: [...x.valores, v] } : x)); render(); return true; }
    case "delvalor": { const D = dimSel(); if (confirm("¿Quitar el valor " + id + "?")) { await guardarCfg("dimensiones", CF("dimensiones").map(x => x.id === D.id ? { ...x, valores: x.valores.filter(v => v !== id) } : x)); await guardarCfg("dimCuenta", CF("dimCuenta").filter(x => !(x.dim === D.id && x.valor === id))); render(); } return true; }
    case "adddimcta": { const D = dimSel(), c = val("dim-cta").trim(), v = val("dim-def"); if (!/^\d{1,9}$/.test(c) || !v) { alert("Indique la cuenta (solo números) y el valor."); return true; } await guardarCfg("dimCuenta", [...CF("dimCuenta").filter(x => !(x.dim === D.id && x.cuenta === c)), { dim: D.id, cuenta: c, valor: v }]); render(); return true; }
    case "deldimcta": { const D = dimSel(); await guardarCfg("dimCuenta", CF("dimCuenta").filter(x => !(x.dim === D.id && x.cuenta === id))); render(); return true; }
    case "dimcsv": { const D = dimSel(); descargarCSV("dimension_" + D.id + ".csv", [[D.nombre, "Ingresos", "Gastos", "Resultado"], ...datosDim(D).map(r => [r[0], ...r.slice(1).map(nCSV)])]); return true; }
    case "selasg": S.selAsg = id; render(); return true;
    case "addasgdest": S.asgDest.push({ cuenta: "", pct: "" }); render(); return true;
    case "guardarasg": { const nombre = val("asg-nombre").trim(), origen = val("asg-origen").trim(), dest = S.asgDest.filter(x => x.cuenta || x.pct).map(x => ({ cuenta: String(x.cuenta).trim(), pct: +num(x.pct) || 0 })), suma = r2(dest.reduce((s, x) => s + x.pct, 0));
      if (!nombre || !esMov(origen) || !dest.length || dest.some(x => !esMov(x.cuenta) || !(x.pct > 0) || x.cuenta === origen)) { alert("Indique nombre, cuenta de origen y destinos distintos con su porcentaje (cuentas de 9 dígitos)."); return true; }
      if (suma !== 100) { alert("Los porcentajes suman " + suma + " y deben sumar 100."); return true; }
      await guardarCfg("asignaciones", [...CF("asignaciones"), { id: uid().slice(0, 8), nombre, origen, destinos: dest }]); S.asgDest = null; S.asgForm = null; render(); return true; }
    case "delasg": if (confirm("¿Eliminar la regla?")) { await guardarCfg("asignaciones", CF("asignaciones").filter(r => r.id !== S.selAsg)); S.selAsg = null; render(); } return true;
    case "procesarasg": { const r = CF("asignaciones").find(x => x.id === S.selAsg), { d, h } = rangoGL(); if (!r || yaAsignado(r, d, h)) return true; const s = saldoPeriodo(r.origen, d, h); if (!s || !confirm("¿Repartir " + eur(s) + " de " + r.origen + "?")) return true;
      const v = Math.abs(s), deu = s > 0; let resto = v; const ap = r.destinos.map((x, i) => { const imp = i === r.destinos.length - 1 ? resto : r2(v * x.pct / 100); resto = r2(resto - imp); return { cuenta: x.cuenta, concepto: null, debe: deu ? imp : 0, haber: deu ? 0 : imp }; }).filter(p => p.debe || p.haber);
      ap.push({ cuenta: r.origen, concepto: null, debe: deu ? 0 : v, haber: deu ? v : 0 }); for (const p of ap) await asegurarCta(p.cuenta);
      await db.crearAsiento(S.emp.id, h, "Asignación " + r.nombre, ap, "asignacion", `ASG-${r.id}-${d}-${h}`); await recargar(); return true; }
    case "selpdf": S.selPdf = id; render(); return true;
    case "addpdf": { const x = { id: uid().slice(0, 8), nombre: val("pdf-nombre").trim(), bal: val("pdf-bal").trim(), res: val("pdf-res").trim(), total: r2(num(val("pdf-total"))), inicio: val("pdf-ini"), meses: Math.round(+val("pdf-meses")) };
      if (!x.nombre || !esMov(x.bal) || !esMov(x.res) || !(x.total > 0) || !x.inicio || !(x.meses > 0 && x.meses <= 120)) { alert("Complete descripción, las dos cuentas (9 dígitos), importe, mes inicial y meses."); return true; }
      if (!/^[67]/.test(x.res) || /^[67]/.test(x.bal)) { alert("La cuenta de balance no puede ser del grupo 6 o 7, y la de gasto o ingreso debe serlo."); return true; }
      await guardarCfg("periodif", [...CF("periodif"), x]); render(); return true; }
    case "delpdf": if (confirm("¿Eliminar la periodificación? Los asientos generados se conservan.")) { await guardarCfg("periodif", CF("periodif").filter(x => x.id !== S.selPdf)); S.selPdf = null; render(); } return true;
    case "genpdf": { const hasta = S.pdfMes || hoy().slice(0, 7), T = CF("periodif").flatMap(x => cuotasPer(x).filter(c => c.mes <= hasta && !asientoCuota(x, c.mes)).map(c => ({ x, c }))); if (!T.length || !confirm("¿Generar " + T.length + " asiento(s) hasta " + hasta + "?")) return true;
      for (const { x, c } of T) { await asegurarCta(x.bal); await asegurarCta(x.res); const ing = x.res[0] === "7", [y, m] = c.mes.split("-").map(Number), f = c.mes + "-" + String(new Date(y, m, 0).getDate()).padStart(2, "0");
        await db.crearAsiento(S.emp.id, f, "Periodificación " + x.nombre + " " + c.mes, [{ cuenta: ing ? x.bal : x.res, concepto: null, debe: c.importe, haber: 0 }, { cuenta: ing ? x.res : x.bal, concepto: null, debe: 0, haber: c.importe }], "periodificacion", `PDF-${x.id}-${c.mes}`); }
      await recargar(); return true; }
    case "consolidar": { const h = rangoGL().h, excl = val("con-excl").trim(), ex = excl ? excl.split(/[\s,;]+/) : [], emps = []; S.conExcl = excl;
      for (const e of S.empresas.filter(x => S.conEmps.has(x.id) && x.almacen !== "drive")) { const datos = await baseDb().cargar(e.id), s = new Map(); apuntesHasta(datos, h).filter(p => !ex.some(x => p.cuenta.startsWith(x))).forEach(p => { const c = p.cuenta.slice(0, 3); s.set(c, r2((s.get(c) || 0) + +p.debe - +p.haber)); }); emps.push({ nombre: e.nombre, s }); }
      S.consol = { h, excl, emps }; render(); return true; }
    case "consolcsv": { const R = S.consol, ctas = [...new Set(R.emps.flatMap(c => [...c.s.keys()]))].sort(); descargarCSV("consolidado_" + R.h + ".csv", [["Cuenta", "Nombre", ...R.emps.map(e => e.nombre), "Consolidado"], ...ctas.map(c => [c, nombreMaestro(c), ...R.emps.map(e => nCSV(e.s.get(c) || 0)), nCSV(R.emps.reduce((s, e) => s + (e.s.get(c) || 0), 0))])]); return true; }
    case "pmpcsv": descargarCSV("periodo_medio_pago_" + S.ej + ".csv", [["Factura", "Proveedor", "Fecha factura", "Situación", "Fecha pago o corte", "Importe", "Días"], ...datosPMP().filas.map(([f, s, fp, imp, n]) => [numExt(f), (terPorId(f.tercero_id) || {}).nombre || "", f.fecha_emision || "", s, fp, nCSV(imp), n])]); return true;
  }
  return false;
}
async function cambioGL(t) {
  const d = t.dataset;
  if (d.dim !== undefined) { const D = dimSel(), M = { ...CF("dimApunte") }; M[d.dim] = { ...(M[d.dim] || {}), [D.id]: t.value }; await guardarCfg("dimApunte", M); render(); return true; }
  if (d.asg !== undefined) { S.asgDest[+d.asg][d.k] = t.value; return true; }
  if (t.id === "asg-nombre" || t.id === "asg-origen") { S.asgForm[t.id.slice(4)] = t.value; return true; }
  if (d.con2 !== undefined) { if (t.checked) S.conEmps.add(d.con2); else S.conEmps.delete(d.con2); S.consol = null; render(); return true; }
  const k = { "gl-desde": "glDesde", "gl-hasta": "glHasta", "gl-nivel": "glNivel", "gl-cta": "glCta", "gl-origen": "glOrigen", "fin-tipo": "finTipo", "dim-id": "dimId", "dim-solo": "dimSolo", "pdf-mes": "pdfMes", "con-excl": "conExcl" }[t.id];
  if (k) { S[k] = t.value; if (t.id !== "con-excl") render(); return true; }
  return ["rev-fecha", "dim-valor", "dim-cta", "dim-def", "pdf-nombre", "pdf-bal", "pdf-res", "pdf-total", "pdf-ini", "pdf-meses"].includes(t.id);
}

/* ---------------- Albaranes de entrada y salida (recepciones y entregas) ---------------- */
// Un albarán es el conjunto de movimientos de inventario de un mismo documento; sus datos de cabecera (número, transporte, lote…) van aparte.
SEED.albaranes = () => [];
const TIPO_MOV = { V: "Entrega", C: "Recepción" };
const siguienteAlb = tipo => { const pf = tipo === "V" ? "AV" : "AC"; let m = 0; CF("albaranes").forEach(h => { const k = new RegExp("^" + pf + "(\\d+)$").exec(h.num); if (k) m = Math.max(m, +k[1]); }); return pf + String(m + 1).padStart(6, "0"); };
const cabAlb = (tipo, doc) => CF("albaranes").find(h => h.tipo === tipo && h.doc === doc);
const guardarAlb = h => guardarCfg("albaranes", [...CF("albaranes").filter(x => !(x.tipo === h.tipo && x.doc === h.doc)), h]);
function albaran(tipo, doc) {
  const ms = S.d.movinv.filter(m => m.documento === doc && m.tipo === TIPO_MOV[tipo]); if (!ms.length) return null;
  const h = cabAlb(tipo, doc) || { doc, tipo, num: doc, det: {} }, ped = S.d.pedidos.find(p => p.id === ms[0].pedido_id);
  const lineas = ms.map(m => { const a = artPorId(m.articulo_id) || {}, pl = S.d.plineas.find(x => x.id === m.linea_id), det = (h.det || {})[m.id] || {};
    return { m, a, pl, q: Math.abs(+m.cantidad), desc: det.desc || (pl && pl.descripcion) || a.nombre || "", lote: det.lote || "", precio: pl && ped ? netoPed(ped, pl) : +(det.precio || 0), cod: pl ? pl.cod_iva : det.cod, rec: pl ? pl.cod_rec : det.rec }; });
  const fac = S.d.facturas.find(f => f.id === h.factura), porPedido = !fac && ped && lineas.every(l => l.pl && facturadoL(l.pl) >= recibidoL(l.pl));
  return { doc, tipo, h, num: h.num, fecha: ms[0].fecha, ped, ter: terPorId(h.tercero_id || (ped && ped.tercero_id)) || {}, lineas, fac, estado: fac ? "Facturado " + fac.numero : porPedido ? "Facturado" : "Pendiente de facturar", pendiente: !fac && !porPedido };
}
const albaranes = tipo => [...new Set(S.d.movinv.filter(m => m.tipo === TIPO_MOV[tipo]).map(m => m.documento))].map(d => albaran(tipo, d)).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.num.localeCompare(a.num));
const albNuevo = tipo => ({ tipo, tercero: "", fecha: hoy(), almacen: (S.d.almacenes[0] || {}).id || "", externo: "", transporte: "", matricula: "", bultos: "", notas: "", lineas: [{ art: "", cant: "", precio: "", lote: "" }] });
function vistaAlbaranes(tipo) {
  const cli = tipo === "V", N = S.albForm && S.albForm.tipo === tipo ? S.albForm : null, L = albaranes(tipo), M = S.albMarcas || (S.albMarcas = new Set()), sel = L.find(a => a.doc === S.selAlb), marc = L.filter(a => M.has(a.doc));
  const titulo = cli ? "Albaranes de venta (entregas)" : "Albaranes de compra (recepciones)";
  if (N) {
    const ters = S.d.terceros.filter(t => t.tipo === (cli ? "C" : "P"));
    const c = (et, k, extra = "") => `<label>${et}<br><input data-al="${k}" value="${esc(N[k] || "")}" ${extra}></label>`;
    return pagina(titulo, `<button class="p" data-a="registraralb">Registrar ${cli ? "entrega" : "recepción"}</button>` + btn("cancelaralb", "Cancelar"), `<datalist id="dlter">${ters.map(t => `<option value="${esc(t.codigo)}">${esc(t.nombre)}</option>`).join("")}</datalist><datalist id="dlart">${S.d.articulos.filter(a => a.tipo !== "Servicio" && a.activo !== false).map(a => `<option value="${esc(a.codigo)}">${esc(a.nombre)}</option>`).join("")}</datalist>
      <div class="card"><div class="row">${c(cli ? "Cliente" : "Proveedor", "tercero", 'list="dlter" size="12"')}<label>Fecha<br><input type="date" data-al="fecha" value="${N.fecha}"></label><label>Almacén<br><select data-al="almacen">${optsHtml(S.d.almacenes.map(a => [a.id, a.codigo + " · " + a.nombre]), N.almacen)}</select></label>${cli ? "" : c("N.º albarán del proveedor", "externo", 'size="16"')}${c("Transporte", "transporte", 'size="18"')}${c("Matrícula", "matricula", 'size="10"')}${c("Bultos", "bultos", 'size="5"')}${c("Observaciones", "notas", 'size="34"')}</div></div>
      <div class="lista"><table class="editable"><tr><th>Artículo</th><th>Nombre</th><th class="n">Cantidad</th><th>Unidad</th><th>Lote</th><th class="n">Precio unitario</th><th class="n">Existencias</th><th></th></tr>${N.lineas.map((l, i) => { const a = artPorCod(l.art) || null; const inp = (k, s) => `<input data-all="${i}" data-k="${k}" size="${s}" value="${esc(l[k] ?? "")}" ${k === "art" ? 'list="dlart"' : ""}>`; return `<tr><td>${inp("art", 10)}</td><td>${esc(a ? a.nombre : "")}</td><td>${inp("cant", 8)}</td><td>${esc(a ? a.unidad : "")}</td><td>${inp("lote", 14)}</td><td>${inp("precio", 9)}</td><td class="n">${a ? q3(stockArt(a.id, N.almacen)) : ""}</td><td><button class="d" data-a="delalbl" data-i="${i}">✕</button></td></tr>`; }).join("")}</table><div class="row" style="margin-top:.5rem"><button data-a="addalbl">+ Línea</button></div></div>`, { tabs: ["Líneas"], vista: "Nuevo albarán" });
  }
  const pendientes = S.d.pedidos.filter(p => p.tipo === tipo && !["cancelado", "presupuesto"].includes(p.estado)).map(p => ({ p, q: plineasDe(p).filter(l => !esServ(l)).reduce((s, l) => s + Math.max(0, (+l.cantidad || 0) - recibidoL(l)), 0) })).filter(x => x.q > 0);
  const filas = L.map(a => `<tr data-sel class="${sel && sel.doc === a.doc ? "sel" : ""}" data-a="selalb" data-id="${esc(a.doc)}"><td><input type="checkbox" data-alm="${esc(a.doc)}" ${M.has(a.doc) ? "checked" : ""}></td><td>${esc(a.num)}</td><td>${a.fecha}</td><td>${esc(a.ter.codigo || "")}</td><td>${esc(a.ter.nombre || "")}</td><td>${esc(a.ped ? a.ped.numero : "")}</td>${cli ? "" : `<td>${esc(a.h.externo || "")}</td>`}<td class="n">${q3(a.lineas.reduce((s, l) => s + l.q, 0))}</td><td>${a.estado}</td></tr>`).join("");
  const det = sel ? `<h3>${esc(sel.num)}</h3><dl>${sel.lineas.map(l => `<dt>${esc(l.a.codigo || "")} ${esc(l.desc)}${l.lote ? " · lote " + esc(l.lote) : ""}</dt><dd>${q3(l.q)} ${esc(l.a.unidad || "")}</dd>`).join("")}</dl><h3 style="margin-top:1rem">Datos del albarán</h3>${[...(cli ? [] : [["externo", "N.º albarán del proveedor"]]), ["transporte", "Transporte"], ["matricula", "Matrícula"], ["bultos", "Bultos"], ["notas", "Observaciones"]].map(([k, et]) => `<label class="fld">${et}<input data-alh="${k}" value="${esc(sel.h[k] || "")}"></label>`).join("")}${sel.lineas.map(l => `<label class="fld">Lote · ${esc(l.a.codigo || "")}<input data-allote="${l.m.id}" value="${esc(l.lote)}"></label>`).join("")}` : `<p style="color:var(--tx2)">Seleccione un albarán.</p>`;
  const acc = btn("nuevoalb", "+ Nuevo albarán", `data-t="${tipo}"`) + SEP + `<button class="p" data-a="pdfalb" data-t="${tipo}" ${marc.length || sel ? "" : "disabled"}>Descargar PDF${marc.length > 1 ? " (" + marc.length + ")" : ""}</button>` + btn("facturaralb", "Facturar" + (marc.length ? " (" + marc.length + ")" : ""), `data-t="${tipo}"`, !marc.length || marc.some(a => !a.pendiente)) + SEP + btn("anularalb", "Anular albarán", `data-t="${tipo}"`, !sel || !sel.pendiente);
  return pagina(titulo, acc, `<div class="pagina"><div class="lista"><table><tr><th></th><th>Albarán</th><th>Fecha</th><th>Cuenta</th><th>Nombre</th><th>Pedido</th>${cli ? "" : "<th>Albarán del proveedor</th>"}<th class="n">Cantidad</th><th>Estado</th></tr>${filas || `<tr><td colspan="9" class="vacio">No hay albaranes todavía.</td></tr>`}</table>
    <h3 style="margin-top:1rem">Pedidos pendientes de ${cli ? "entregar" : "recibir"}</h3>${tablaGL(["Pedido", "Cuenta", "Nombre", "Fecha prevista", "#Cantidad pendiente", ""], pendientes.map(({ p, q }) => { const t = terPorId(p.tercero_id) || {}; return `<tr><td>${esc(p.numero)}</td><td>${esc(t.codigo || "")}</td><td>${esc(t.nombre || "")}</td><td>${p.fecha_entrega || ""}</td><td class="n">${q3(q)}</td><td><button data-a="recepcionar" data-id="${p.id}">${cli ? "Entregar" : "Recepcionar"}</button></td></tr>`; }).join(""), "No hay pedidos pendientes.")}</div><aside class="factbox">${det}</aside></div>`,
    { tabs: ["Albaranes"], filtros: `<label class="chk"><input type="checkbox" id="alb-valorado" ${S.albValorado ? "checked" : ""}> PDF valorado (con precios)</label>` });
}
V.albv = () => vistaAlbaranes("V"); V.albc = () => vistaAlbaranes("C");
async function registrarAlbDirecto() {
  const N = S.albForm, cli = N.tipo === "V", t = terPorCod(N.tercero || "");
  if (!t || t.tipo !== (cli ? "C" : "P")) return alert("Indique " + (cli ? "el cliente." : "el proveedor."));
  if (!N.fecha || !N.almacen) return alert("Indique la fecha y el almacén.");
  const L = N.lineas.filter(l => l.art || l.cant); if (!L.length) return alert("El albarán no tiene líneas.");
  const sale = new Map();
  for (const l of L) { const a = artPorCod(l.art || ""), q = r3(+num(l.cant)); if (!a || a.tipo === "Servicio") return alert("Artículo no válido: " + (l.art || "(vacío)")); if (!(q > 0)) return alert("La cantidad de " + a.codigo + " debe ser mayor que cero."); if (cli) sale.set(a.id, (sale.get(a.id) || 0) + q); }
  for (const [aid, q] of sale) if (stockArt(aid, N.almacen) < q && !confirm("Las existencias de " + artPorId(aid).codigo + " en ese almacén quedarán en negativo. ¿Continuar?")) return;
  const numAlb = siguienteAlb(N.tipo), det = {}, ms = L.map(l => { const a = artPorCod(l.art), q = r3(+num(l.cant)), precio = String(l.precio ?? "") === "" ? +(cli ? a.precio_venta : a.precio_compra) || 0 : +num(l.precio) || 0, cod = codArtPed(a, t, N.tipo), id = uid();
    det[id] = { desc: a.nombre, lote: (l.lote || "").trim(), precio, cod, rec: cli && aplicaRec(t) ? recDeCodigo(cod) : "" };
    return { id, empresa_id: S.emp.id, fecha: N.fecha, articulo_id: a.id, almacen_id: N.almacen, tipo: TIPO_MOV[N.tipo], cantidad: cli ? -q : q, coste: Math.round((cli ? costeMedio(a) : precio) * 10000) / 10000, pedido_id: null, linea_id: null, documento: numAlb, notas: null, creado: new Date().toISOString() }; });
  await db.guardarMovs(ms); await guardarAlb({ doc: numAlb, tipo: N.tipo, num: numAlb, tercero_id: t.id, externo: N.externo, transporte: N.transporte, matricula: N.matricula, bultos: N.bultos, notas: N.notas, det });
  S.albForm = null; S.selAlb = numAlb; await recargar();
}
async function facturarAlbaranes(tipo) {
  const L = albaranes(tipo).filter(a => S.albMarcas.has(a.doc) && a.pendiente).reverse(); if (!L.length) return;
  if (new Set(L.map(a => a.ter.id)).size !== 1) return alert("Marque albaranes de un mismo " + (tipo === "V" ? "cliente." : "proveedor."));
  const cli = tipo === "V", t = L[0].ter, usado = new Map(), fl = [];
  for (const a of L) for (const l of a.lineas) {
    let q = l.q; if (l.pl) { const disp = r3(recibidoL(l.pl) - facturadoL(l.pl) - (usado.get(l.pl.id) || 0)); q = r3(Math.min(q, disp)); if (q <= 0) continue; usado.set(l.pl.id, r3((usado.get(l.pl.id) || 0) + q)); }
    const c = CODIGO[l.cod] || CODIGO[codDefecto(t, tipo)];
    fl.push({ id: null, descripcion: l.desc + " (albarán " + a.num + (l.lote ? ", lote " + l.lote : "") + ")", cuenta: (cli ? l.a.cuenta_venta : l.a.cuenta_compra) || primeraCuenta(cli ? "700" : "600"), cantidad: q, precio: Math.round(l.precio * 10000) / 10000, iva: c.pct, cod: c.cod, rec: l.rec || "", auto: c.tipo === "ue" || c.tipo === "isp", pedido_linea_id: l.pl ? l.pl.id : null, tocado: true });
  }
  if (!fl.length) return alert("No queda nada pendiente de facturar en esos albaranes.");
  if (!confirm("¿Crear una factura de " + t.nombre + " con " + L.length + " albarán(es)?")) return;
  const peds = new Set(L.map(a => (a.ped || {}).id || "")), p = L[0].ped;
  const f = { id: uid(), empresa_id: S.emp.id, tipo, numero: siguienteFact(tipo), tercero_id: t.id, num_externo: "", fecha_emision: hoy(), fecha_registro: hoy(), fecha_iva: hoy(), fecha_vencimiento: calcVenc(t, hoy()), vencAuto: true, estado: "abierto", asiento_id: null, notas: "Albaranes " + L.map(a => a.num).join(", "), retencion_tipo: "", retencion_pct: 0, pedido_id: peds.size === 1 && p ? p.id : null };
  const rc = (p && (p.ficha || {}).cod_ret) || (t.ficha || {}).cod_ret; if (rc) aplicarRet(f, rc);
  S.fact = { f, ls: fl }; await guardarFactura();
  for (const a of L) await guardarAlb({ ...a.h, num: a.num, tercero_id: t.id, factura: f.id });
  S.albMarcas = new Set(); S.vista = cli ? "fventa" : "fcompra"; S.selFact = f.id; await recargar();
}
async function anularAlbaran(tipo) {
  const a = albaran(tipo, S.selAlb); if (!a || !a.pendiente) return;
  for (const l of a.lineas) if (l.pl) { const q = a.lineas.filter(x => x.pl && x.pl.id === l.pl.id).reduce((s, x) => s + x.q, 0); if (r3(recibidoL(l.pl) - q) < facturadoL(l.pl)) return alert("Parte de este albarán ya está facturada en su pedido. Elimine antes la factura."); }
  if (!confirm("¿Anular el albarán " + a.num + "? Se eliminan sus movimientos de inventario.")) return;
  await db.borrarMovs(a.lineas.map(l => l.m.id)); await guardarCfg("albaranes", CF("albaranes").filter(h => !(h.tipo === tipo && h.doc === a.doc))); S.selAlb = null; S.albMarcas = new Set(); await recargar();
}

/* ---------------- PDF (jsPDF, cargado solo cuando se pide un documento) ---------------- */
let libPDF = null;
async function cargarPDF() {
  if (!libPDF) { const [a, b] = await Promise.all([import("https://esm.sh/jspdf@2.5.1"), import("https://esm.sh/jspdf-autotable@3.8.2?deps=jspdf@2.5.1")]); libPDF = { jsPDF: a.jsPDF || a.default, tabla: b.default || b.autoTable }; }
  return libPDF;
}
function pdfCabecera(doc, titulo, datos, ter) { // empresa a la izquierda, título y datos a la derecha, caja del tercero; devuelve la altura donde seguir
  const E = CF("empresa"), nom = doc.setFont("helvetica", "bold").setFontSize(14).splitTextToSize(S.emp.nombre, 105);
  doc.text(nom, 14, 18); const y0 = 18 + nom.length * 6;
  doc.setFont("helvetica", "normal").setFontSize(9);
  const emp = ["NIF " + (S.emp.cif || ""), E.dir, [E.cp, E.pob, E.prov ? "(" + E.prov + ")" : ""].filter(Boolean).join(" "), [E.tel, E.email, E.web].filter(Boolean).join(" · ")].filter(Boolean).flatMap(x => doc.splitTextToSize(x, 105));
  doc.text(emp, 14, y0);
  doc.setFont("helvetica", "bold").setFontSize(14).text(titulo, 196, 18, { align: "right" });
  const D = datos.filter(d => d[1]); doc.setFont("helvetica", "normal").setFontSize(10); D.forEach((d, i) => doc.text(d[0] + ": " + d[1], 196, 25 + i * 5, { align: "right" }));
  const dir = ((ter.direcciones || []).find(x => x.principal) || (ter.direcciones || [])[0]) || {};
  const caja = [ter.nombre || "", "NIF " + (ter.cif || "—"), dir.dir, [dir.cp, dir.poblacion, dir.provincia].filter(Boolean).join(" ")].filter(Boolean).flatMap(x => doc.splitTextToSize(x, 80));
  const y = Math.max(y0 + emp.length * 4.2, 25 + D.length * 5) + 4, alto = caja.length * 4.5 + 6;
  doc.setDrawColor(180).rect(110, y, 86, alto); doc.setFontSize(10).text(caja, 113, y + 6);
  return y + alto + 7;
}
function pdfPie(doc) {
  const E = CF("empresa"), n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFont("helvetica", "normal").setFontSize(7).setTextColor(100); if (E.registro) doc.text(doc.splitTextToSize(E.registro, 160), 14, 287); doc.text("Página " + i + " de " + n, 196, 291, { align: "right" }); doc.setTextColor(0); }
}
const pdfNotas = (doc, y, textos) => { doc.setFont("helvetica", "normal").setFontSize(9); for (const t of textos.filter(Boolean)) { const l = doc.splitTextToSize(t, 182); if (y + l.length * 4.5 > 280) { doc.addPage(); y = 20; } doc.text(l, 14, y); y += l.length * 4.5 + 2; } return y; };
const ESTILO_TABLA = { styles: { fontSize: 9, cellPadding: 1.6 }, headStyles: { fillColor: [0, 98, 191], textColor: 255 }, margin: { left: 14, right: 14, bottom: 18 } };
function pdfFactura(doc, tabla, d) { // factura, rectificativa, presupuesto o cotización
  const E = CF("empresa"), y = pdfCabecera(doc, d.titulo, [["Número", d.numero], ["Fecha", d.fecha], [d.cliente ? "Vencimiento" : "Válido hasta", d.venc]], d.ter);
  tabla(doc, { ...ESTILO_TABLA, startY: y, head: [["Descripción", "Cantidad", "Precio", "IVA", "Importe"]], body: d.lineas.map(l => [l.desc, q3(l.cant), eur(l.precio), String(l.pct).replace(".", ",") + " %", eur(l.base)]), columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } }, didParseCell: c => { if (c.section === "head" && c.column.index > 0) c.cell.styles.halign = "right"; } });
  const porIva = new Map(); d.lineas.forEach(l => { if (!l.auto) porIva.set(l.pct, r2((porIva.get(l.pct) || 0) + l.base)); });
  const T = [...porIva].flatMap(([p, b]) => [["Base imponible " + String(p).replace(".", ",") + " %", eur(b)], ["IVA " + String(p).replace(".", ",") + " %", eur(b * p / 100)]]);
  if (d.tot.rec) T.push(["Recargo de equivalencia", eur(d.tot.rec)]); if (d.ret) T.push(["Retención IRPF", "-" + eur(d.ret)]);
  T.push([d.ret ? "TOTAL A PERCIBIR" : "TOTAL", eur(r2(d.tot.total - (d.ret || 0))) + " €"]);
  tabla(doc, { startY: doc.lastAutoTable.finalY + 5, body: T, theme: "plain", styles: { fontSize: 10, cellPadding: 1 }, margin: { left: 116, right: 14, bottom: 18 }, columnStyles: { 1: { halign: "right" } }, didParseCell: c => { if (c.row.index === T.length - 1) { c.cell.styles.fontStyle = "bold"; c.cell.styles.fontSize = 12; } } });
  pdfNotas(doc, doc.lastAutoTable.finalY + 10, [d.lineas.some(l => l.auto) ? "Operación con inversión del sujeto pasivo." : "", d.notas, d.cliente && (d.forma || E.iban) ? [d.forma ? "Forma de pago: " + d.forma : "", E.iban ? "IBAN " + E.iban : ""].filter(Boolean).join(" · ") : "", E.pie]);
}
function pdfAlbaran(doc, tabla, a, valorado) {
  const cli = a.tipo === "V", y0 = pdfCabecera(doc, cli ? "ALBARÁN DE ENTREGA" : "ALBARÁN DE RECEPCIÓN", [["Número", a.num], ["Fecha", a.fecha], ["Pedido", a.ped ? a.ped.numero : ""], ["Albarán proveedor", cli ? "" : a.h.externo]], a.ter);
  const y = pdfNotas(doc, y0, [[a.h.transporte ? "Transporte: " + a.h.transporte : "", a.h.matricula ? "Matrícula: " + a.h.matricula : "", a.h.bultos ? "Bultos: " + a.h.bultos : ""].filter(Boolean).join("    ")]);
  const head = ["Artículo", "Descripción", "Lote", "Almacén", "Cantidad", "Unidad", ...(valorado ? ["Precio", "Importe"] : [])];
  tabla(doc, { ...ESTILO_TABLA, startY: y, head: [head], body: a.lineas.map(l => [l.a.codigo || "", l.desc, l.lote, almNombre(l.m.almacen_id), q3(l.q), l.a.unidad || "", ...(valorado ? [eur(l.precio), eur(l.q * l.precio)] : [])]), columnStyles: { 4: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" } }, didParseCell: c => { if (c.section === "head" && [4, 6, 7].includes(c.column.index)) c.cell.styles.halign = "right"; } });
  let yy = doc.lastAutoTable.finalY + 6;
  if (valorado) { doc.setFont("helvetica", "bold").setFontSize(10).text("Importe sin impuestos: " + eur(a.lineas.reduce((s, l) => s + r2(l.q * l.precio), 0)) + " €", 196, yy, { align: "right" }); yy += 7; }
  yy = pdfNotas(doc, yy, [a.h.notas ? "Observaciones: " + a.h.notas : ""]) + 4;
  if (yy > 245) { doc.addPage(); yy = 20; }
  doc.setDrawColor(180).rect(14, yy, 86, 30).rect(110, yy, 86, 30); doc.setFont("helvetica", "normal").setFontSize(8).text(cli ? "Entregado por" : "Recibido en almacén por", 17, yy + 5).text(cli ? "Recibí conforme (firma, nombre, DNI y fecha)" : "Transportista (firma, nombre y DNI)", 113, yy + 5);
}
async function bajarPDF(nombre, pintar) {
  let L; try { L = await cargarPDF(); } catch { return alert("No se pudo cargar el generador de PDF (necesita conexión). Puede usar Imprimir y elegir «Guardar como PDF»."); }
  const doc = new L.jsPDF({ unit: "mm", format: "a4" }); pintar(doc, L.tabla); pdfPie(doc);
  const url = URL.createObjectURL(doc.output("blob")), x = document.createElement("a"); x.href = url; x.download = nombre.replace(/[^\w.-]+/g, "_") + ".pdf"; document.body.appendChild(x); x.click(); x.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
}
const variasPaginas = (lista, pintar) => (doc, tabla) => lista.forEach((x, i) => { if (i) doc.addPage(); pintar(doc, tabla, x); });

async function accionAlb(a, b) {
  const id = b.dataset.id, tp = b.dataset.t;
  switch (a) {
    case "nuevoalb": if (!S.d.articulos.some(x => x.tipo !== "Servicio")) { alert("Cree antes un artículo de inventario."); return true; } await asegurarAlmacen(); S.albForm = albNuevo(tp); render(); return true;
    case "cancelaralb": S.albForm = null; render(); return true;
    case "addalbl": S.albForm.lineas.push({ art: "", cant: "", precio: "", lote: "" }); render(); return true;
    case "delalbl": S.albForm.lineas.splice(+b.dataset.i, 1); if (!S.albForm.lineas.length) S.albForm.lineas.push({ art: "", cant: "", precio: "", lote: "" }); render(); return true;
    case "registraralb": await registrarAlbDirecto(); return true;
    case "selalb": S.selAlb = id; render(); return true;
    case "recepcionar": { const p = S.d.pedidos.find(x => x.id === id); if (!p) return true; S.vista = p.tipo === "V" ? "pventa" : "pcompra"; abrirPedido(id); return true; }
    case "facturaralb": await facturarAlbaranes(tp); return true;
    case "anularalb": await anularAlbaran(tp); return true;
    case "pdfalb": { const M = S.albMarcas || new Set(); let L = albaranes(tp).filter(x => M.has(x.doc)).reverse(); if (!L.length) L = [albaran(tp, S.selAlb)].filter(Boolean); if (!L.length) return true; await bajarPDF(L.length === 1 ? "albaran_" + L[0].num : "albaranes_" + hoy(), variasPaginas(L, (doc, t, x) => pdfAlbaran(doc, t, x, S.albValorado))); return true; }
    case "pdffact": case "pdffacttodas": {
      const T = S.d.facturas.filter(f => f.tipo === "V" && estadoF(f) === "Registrado").sort((x, y) => y.numero.localeCompare(x.numero));
      const L = a === "pdffact" ? [T.find(f => f.id === S.imprFact) || T[0]].filter(Boolean) : T.filter(f => (f.fecha_emision || "").startsWith(String(S.ej))).reverse(); if (!L.length) { alert("No hay facturas registradas en " + S.ej + "."); return true; }
      await bajarPDF(L.length === 1 ? "factura_" + L[0].numero : "facturas_" + S.ej, variasPaginas(L, (doc, t, f) => pdfFactura(doc, t, datosDocFactura(f)))); return true;
    }
    case "pdfpres": { const p = S.d.pedidos.find(x => x.id === S.selPed); if (p) await bajarPDF(p.numero, (doc, t) => pdfFactura(doc, t, datosDocPres(p))); return true; }
  }
  return false;
}
async function cambioAlb(t) {
  const d = t.dataset;
  if (d.al !== undefined) { S.albForm[d.al] = t.value.trim(); if (d.al === "almacen") render(); return true; }
  if (d.all !== undefined) { const l = S.albForm.lineas[+d.all]; l[d.k] = t.value.trim(); if (d.k === "art") { const a = l.art ? artPorCod(l.art) : null; if (l.art && !a) alert("No existe ese artículo."); else if (a) { l.art = a.codigo; l.precio = String(+(S.albForm.tipo === "V" ? a.precio_venta : a.precio_compra) || 0); } render(); } return true; }
  if (d.alm !== undefined) { const M = S.albMarcas || (S.albMarcas = new Set()); if (t.checked) M.add(d.alm); else M.delete(d.alm); render(); return true; }
  if (d.alh !== undefined || d.allote !== undefined) {
    const tipo = S.vista === "albv" ? "V" : "C", a = albaran(tipo, S.selAlb); if (!a) return true; const h = { ...a.h, num: a.num, tercero_id: a.ter.id, det: { ...(a.h.det || {}) } };
    if (d.alh !== undefined) h[d.alh] = t.value.trim(); else h.det[d.allote] = { ...(h.det[d.allote] || {}), lote: t.value.trim() };
    await guardarAlb(h); render(); return true;
  }
  if (t.id === "alb-valorado") { S.albValorado = t.checked; return true; }
  return false;
}

/* ---------------- Transacciones abiertas de clientes (como "Liquidar transacciones" de D365) ---------------- */
const diasEntre = (a, b) => Math.floor((new Date(b) - new Date(a)) / 864e5);
const sumaDias = (f, n) => { const d = new Date(f + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
function abiertasDe(t) { // facturas y rectificativas pendientes de un cliente, con su descuento por pronto pago
  const pg = (t.ficha || {}).pago || {}, pct = +pg.dto_pct || 0, dias = +pg.dto_dias || 0;
  return S.d.facturas.filter(f => f.tipo === "V" && f.tercero_id === t.id && estadoF(f) === "Registrado" && pendienteF(f) !== 0).map(f => {
    const pend = pendienteF(f), as = S.d.asientos.find(a => a.id === f.asiento_id) || {}, fdto = pct && pend > 0 && f.fecha_emision ? sumaDias(f.fecha_emision, dias) : "";
    return { f, pend, as, fdto, dto: fdto && fdto >= hoy() ? r2(pend * pct / 100) : 0, importe: netoF(f), cobrado: pagadoF(f), ult: (liqsF(f).slice(-1)[0] || {}).fecha || "", dias: f.fecha_vencimiento && f.fecha_vencimiento < hoy() && pend > 0 ? diasEntre(f.fecha_vencimiento, hoy()) : 0 };
  }).sort((a, b) => (a.f.fecha_vencimiento || "").localeCompare(b.f.fecha_vencimiento || "") || a.f.numero.localeCompare(b.f.numero));
}
const importeLiq = r => { const v = (S.taImp || {})[r.f.id]; return v === undefined ? r.pend : v; };
const FECHAS_LIQ = ["Fecha de hoy", "Última fecha", "Fecha seleccionada"];
V.abiertas = () => {
  const clientes = S.d.terceros.filter(t => t.tipo === "C").sort((a, b) => a.codigo.localeCompare(b.codigo));
  const conSaldo = clientes.filter(t => abiertasDe(t).length || saldoTer(t));
  const t = clientes.find(x => x.id === S.taTer) || conSaldo[0] || clientes[0];
  if (!t) return pagina("Transacciones abiertas de clientes", "", "<p>No hay clientes.</p>");
  const L = abiertasDe(t), M = S.taMarcas || (S.taMarcas = new Set()), marc = L.filter(r => M.has(r.f.id)), sel = L.find(r => r.f.id === S.taSel), tab = S.tabs.ta || "Visión general", modo = S.taModo || "Fecha de hoy";
  const letrasT = efectos().filter(e => e.tercero_id === t.id && ["En cartera", "En gestión de cobro", "Descontado", "Impagado"].includes(e.estado));
  const saldo = saldoTer(t), pendF = r2(L.reduce((s, r) => s + r.pend, 0)), otros = r2(saldo - pendF);
  const saldoLiq = r2(marc.reduce((s, r) => s + importeLiq(r), 0)), dtoEst = r2(marc.reduce((s, r) => s + r.dto, 0));
  const pg = (t.ficha || {}).pago || {}, cond = (CONDICIONES.find(c => c[0] === pg.cond) || [])[1] || "";
  const cols = {
    "Visión general": [["Factura", r => `<a data-a="factdeped" data-id="${r.f.id}" data-t="V">${esc(r.f.numero)}</a>`], ["Fecha", r => r.f.fecha_emision || ""], ["Fecha de vencimiento", r => r.f.fecha_vencimiento || ""], ["Fecha del descuento", r => r.fdto], ["#Importe en divisa de la transacción", r => eur(r.importe)], ["Divisa", () => "EUR"], ["#Pendiente", r => eur(r.pend)], ["#Importe para liquidar", r => M.has(r.f.id) ? `<input class="n" data-taimp="${r.f.id}" size="10" value="${importeLiq(r)}">` : ""], ["#Días vencida", r => r.dias || ""]],
    "General": [["Factura", r => esc(r.f.numero)], ["Asiento", r => r.as.numero ? asNum(r.as) : ""], ["Tipo", r => esRect(r.f) ? "Rectificativa" : esFS(r.f) ? "Factura de servicios" : "Factura"], ["Descripción", r => esc(r.as.concepto || "")], ["Pedido", r => esc((S.d.pedidos.find(p => p.id === r.f.pedido_id) || {}).numero || "")], ["Notas", r => esc(r.f.notas || "")]],
    "Pago": [["Factura", r => esc(r.f.numero)], ["Forma de pago", () => esc(pg.forma || "")], ["Condiciones de pago", () => esc(cond)], ["Cuenta bancaria (IBAN)", () => esc(pg.banco || "")], ["Fecha de vencimiento", r => r.f.fecha_vencimiento || ""]],
    "Liquidación": [["Factura", r => esc(r.f.numero)], ["#Importe original", r => eur(r.importe)], ["#Liquidado", r => eur(r.cobrado)], ["#Pendiente", r => eur(r.pend)], ["Última liquidación", r => r.ult]],
    "Descuento por pronto pago": [["Factura", r => esc(r.f.numero)], ["Fecha del descuento", r => r.fdto], ["Porcentaje", () => pg.dto_pct ? esc(pg.dto_pct) + " %" : ""], ["#Descuento disponible", r => sal(r.dto)], ["#Importe con descuento", r => r.dto ? eur(r.pend - r.dto) : ""]]
  }[tab];
  const filas = L.map(r => `<tr data-sel class="${sel === r ? "sel" : ""} ${r.dias ? "ko" : ""}" data-a="selta2" data-id="${r.f.id}"><td><input type="checkbox" data-tam="${r.f.id}" ${M.has(r.f.id) ? "checked" : ""}></td>${cols.map(c => `<td class="${c[0].startsWith("#") ? "n" : ""}">${c[1](r)}</td>`).join("")}</tr>`).join("");
  const posit = marc.filter(r => r.pend > 0), negat = marc.filter(r => r.pend < 0);
  const acc = btn("tatodo", "Marcar todo", "", !L.length) + btn("tanada", "Desmarcar todo", "", !marc.length) + SEP + `<button class="p" data-a="tacobrar" ${posit.length && !negat.length ? "" : "disabled"}>Crear diario de cobro</button>` + btn("taletra", "Crear letra de cambio", "", !posit.length || !!negat.length) + btn("taliquidar", "Liquidar entre sí", "", !posit.length || !negat.length) + SEP + btn("taextracto", "Extracto de cuenta") + btn("tacsv", "Exportar CSV", "", !L.length);
  const detalle = `<div class="pagina" style="margin-top:.8rem"><div class="card" style="flex:1"><b>Detalles de línea</b>${sel ? `<dl><dt>Factura</dt><dd>${esc(sel.f.numero)}</dd><dt>Fecha</dt><dd>${sel.f.fecha_emision || ""}</dd><dt>Asiento</dt><dd>${sel.as.numero ? asNum(sel.as) : ""}</dd><dt>Descripción</dt><dd>${esc(sel.as.concepto || "")}</dd><dt>Importe</dt><dd>${eur(sel.importe)}</dd><dt>Usado</dt><dd>${eur(sel.cobrado)}</dd><dt>Pendiente</dt><dd>${eur(sel.pend)}</dd></dl>` : `<p style="color:var(--tx2)">Seleccione una transacción.</p>`}</div>
    <div class="card" style="flex:1"><b>Totales</b><dl><dt>Saldo de liquidación</dt><dd>${eur(saldoLiq)}</dd><dt>Descuento estimado por pronto pago</dt><dd>${eur(dtoEst)}</dd><dt>Facturas abiertas</dt><dd>${eur(pendF)}</dd>${otros ? `<dt>Otros movimientos sin factura</dt><dd>${eur(otros)}</dd>` : ""}<dt>Saldo del cliente</dt><dd><b>${eur(saldo)}</b></dd><dt>Letras pendientes (fuera del saldo)</dt><dd>${eur(letrasT.reduce((s, e) => s + e.importe, 0))}</dd></dl></div></div>`;
  return pagina("Transacciones abiertas de clientes", acc, `${tablaGL(["", ...cols.map(c => c[0])], filas, "El cliente no tiene transacciones abiertas.")}
    ${letrasT.length ? `<h3 style="margin-top:1rem">Letras pendientes</h3>${tablaGL(["N.º de letra", "Factura", "Vencimiento", "Estado", "#Importe"], letrasT.map(e => `<tr><td>${esc(e.numero)}</td><td>${esc(e.factura)}</td><td>${e.venc}</td><td>${e.estado}</td><td class="n">${eur(e.importe)}</td></tr>`).join(""))}` : ""}${detalle}`,
    { tabs: ["Visión general", "General", "Pago", "Liquidación", "Descuento por pronto pago"], tabKey: "ta", vista: `${t.codigo} · ${t.nombre}`,
      filtros: `<label>Cliente<select id="ta-ter">${clientes.map(c => `<option value="${c.id}" ${c.id === t.id ? "selected" : ""}>${esc(c.codigo + " · " + c.nombre)}${conSaldo.includes(c) ? "" : " (sin saldo)"}</option>`).join("")}</select></label><label>Fecha de registro de liquidación<select id="ta-modo">${FECHAS_LIQ.map(x => `<option ${x === modo ? "selected" : ""}>${x}</option>`).join("")}</select></label>${modo === "Fecha seleccionada" ? `<label>Fecha<input type="date" id="ta-fecha" value="${S.taFecha || hoy()}"></label>` : ""}` });
};
async function accionTA(a, b) {
  if (!/^(selta2|ta(todo|nada|cobrar|letra|liquidar|extracto|csv))$/.test(a)) return false;
  const clientes = S.d.terceros.filter(t => t.tipo === "C").sort((x, y) => x.codigo.localeCompare(y.codigo));
  const t = clientes.find(x => x.id === S.taTer) || clientes.find(x => abiertasDe(x).length || saldoTer(x)) || clientes[0]; if (!t) return true;
  S.taTer = t.id;
  const L = abiertasDe(t), M = S.taMarcas || (S.taMarcas = new Set()), marc = L.filter(r => M.has(r.f.id));
  const fecha = () => S.taModo === "Fecha seleccionada" ? (S.taFecha || hoy()) : S.taModo === "Última fecha" ? marc.map(r => r.f.fecha_registro || "").sort().pop() || hoy() : hoy();
  if (a === "selta2") { S.taSel = b.dataset.id; render(); }
  else if (a === "tatodo") { L.forEach(r => M.add(r.f.id)); render(); }
  else if (a === "tanada") { S.taMarcas = new Set(); S.taImp = {}; render(); }
  else if (a === "tacobrar" || a === "taletra") { // prepara un diario con las facturas marcadas; se revisa y se registra allí
    const tipo = a === "tacobrar" ? "cobro" : "letra", D = DJ[tipo], P = marc.filter(r => r.pend > 0);
    const mal = P.find(r => !(importeLiq(r) > 0) || importeLiq(r) > r.pend); if (mal) { alert("El importe para liquidar de " + mal.f.numero + " debe estar entre 0 y " + eur(mal.pend) + "."); return true; }
    const n = CF("diariosPago").filter(d => d.tipo === tipo).reduce((m, d) => Math.max(m, +d.num.slice(2)), 0) + 1, f0 = fecha();
    const d = { id: uid(), tipo, num: D.pref + String(n).padStart(6, "0"), nombre: D.pref, desc: (tipo === "cobro" ? "COBRO " : "LETRA ") + t.nombre, registrado: "", lineas: P.map(r => ({ id: uid(), fecha: f0, tercero_id: t.id, factura_id: r.f.id, importe: importeLiq(r), desc: r.f.numero + " " + t.nombre, banco: tipo === "cobro" ? bancoDef(tipo) : "", forma: tipo === "cobro" ? ((t.ficha || {}).pago || {}).forma || D.forma : "", venc: tipo === "letra" ? (r.f.fecha_vencimiento >= f0 ? r.f.fecha_vencimiento : f0) : "", numero: "" })) };
    await guardarCfg("diariosPago", [...CF("diariosPago"), d]); S.taMarcas = new Set(); S.taImp = {}; S.djAbierto = d.id; S.djSel = d.id; S.tabs.djl = "Visión general"; S.vista = tipo === "cobro" ? "dcobro" : "dletra"; render();
  }
  else if (a === "taliquidar") { S.liqMarcas = new Set(marc.map(r => r.f.id)); await compensar(t.id, fecha()); S.taMarcas = new Set(); S.taImp = {}; render(); }
  else if (a === "taextracto") { S.extTer = t.id; S.vista = "extcli"; render(); }
  else if (a === "tacsv") descargarCSV("transacciones_abiertas_" + t.codigo + ".csv", [["Factura", "Fecha", "Vencimiento", "Importe", "Liquidado", "Pendiente", "Días vencida"], ...L.map(r => [r.f.numero, r.f.fecha_emision || "", r.f.fecha_vencimiento || "", nCSV(r.importe), nCSV(r.cobrado), nCSV(r.pend), r.dias || ""])]);
  return true;
}
function cambioTA(t) {
  const d = t.dataset;
  if (d.tam !== undefined) { const M = S.taMarcas || (S.taMarcas = new Set()); if (t.checked) M.add(d.tam); else { M.delete(d.tam); delete (S.taImp || {})[d.tam]; } S.taSel = d.tam; render(); return true; }
  if (d.taimp !== undefined) { (S.taImp || (S.taImp = {}))[d.taimp] = r2(num(t.value)) || 0; render(); return true; }
  if (t.id === "ta-ter") { S.taTer = t.value; S.taMarcas = new Set(); S.taImp = {}; S.taSel = null; render(); return true; }
  if (t.id === "ta-modo") { S.taModo = t.value; render(); return true; }
  if (t.id === "ta-fecha") { S.taFecha = t.value; return true; }
  return false;
}

/* ---------------- Contabilidad general II: divisas, liquidaciones, control de cuentas, cierre del periodo, registro en diario, importación ---------------- */
SEED.divisas = () => [{ id: "USD", nombre: "Dólar estadounidense" }, { id: "GBP", nombre: "Libra esterlina" }, { id: "MAD", nombre: "Dírham marroquí" }];
SEED.tiposCambio = () => []; SEED.cuentasDiv = () => []; SEED.liqContables = () => []; SEED.ctaCtrl = () => ({}); SEED.tareasCierre = () => []; SEED.tareasHechas = () => ({}); SEED.registroDiario = () => [];
const finMes = m => m + "-" + String(new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate()).padStart(2, "0");

/* Divisas, tipos de cambio y revalorización */
const tipoVigente = (div, fecha) => (CF("tiposCambio").filter(x => x.div === div && x.fecha <= fecha).sort((a, b) => b.fecha.localeCompare(a.fecha))[0] || {}).tipo || 0;
V.divisas = () => {
  const D = CF("divisas"), T = [...CF("tiposCambio")].sort((a, b) => b.fecha.localeCompare(a.fecha) || a.div.localeCompare(b.div)), C = CF("cuentasDiv");
  const opD = D.map(d => `<option value="${esc(d.id)}">${esc(d.id + " · " + d.nombre)}</option>`).join("");
  return pagina("Divisas y tipos de cambio", "", `${dlCtas()}<div class="card"><b>Divisas</b><div class="row" style="margin-top:.5rem"><label>Código<br><input id="div-id" size="5" maxlength="3"></label><label>Nombre<br><input id="div-nombre" size="24"></label><button data-a="adddivisa">+ Agregar divisa</button></div></div>
    ${tablaGL(["Divisa", "Nombre", ""], D.map(d => `<tr><td>${esc(d.id)}</td><td>${esc(d.nombre)}</td><td><button class="d" data-a="deldivisa" data-id="${esc(d.id)}">✕</button></td></tr>`).join(""))}
    <div class="card" style="margin-top:1rem"><b>Tipo de cambio</b><div class="row" style="margin-top:.5rem"><label>Divisa<br><select id="tc-div">${opD}</select></label><label>Fecha<br><input type="date" id="tc-fecha" value="${hoy()}"></label><label>1 EUR equivale a<br><input id="tc-tipo" size="10"></label><button data-a="addtc">+ Agregar tipo</button></div></div>
    ${tablaGL(["Divisa", "Fecha inicial", "#1 EUR equivale a", ""], T.map((x, i) => `<tr><td>${esc(x.div)}</td><td>${x.fecha}</td><td class="n">${String(x.tipo).replace(".", ",")}</td><td><button class="d" data-a="deltc" data-id="${esc(x.div + "|" + x.fecha)}">✕</button></td></tr>`).join(""), "Sin tipos de cambio.")}
    <div class="card" style="margin-top:1rem"><b>Cuentas en divisa</b> (para revalorizarlas)<div class="row" style="margin-top:.5rem"><label>Cuenta<br><input id="cd-cta" list="dl" size="12"></label><label>Divisa<br><select id="cd-div">${opD}</select></label><button data-a="addctadiv">+ Agregar cuenta</button></div></div>
    ${tablaGL(["Cuenta", "Nombre", "Divisa", ""], C.map(x => `<tr><td>${x.cuenta}</td><td>${esc(nombreCuenta(x.cuenta))}</td><td>${esc(x.div)}</td><td><button class="d" data-a="delctadiv" data-id="${x.cuenta}">✕</button></td></tr>`).join(""), "Sin cuentas en divisa.")}`, { tabs: ["Configurar"] });
};
function datosReval() {
  const f = S.revFecha || hoy(), I = S.revSaldos || (S.revSaldos = {});
  return { f, L: CF("cuentasDiv").map(x => { const tipo = tipoVigente(x.div, f), ent = I[x.cuenta], hay = ent !== undefined && ent !== "", sd = hay ? r2(num(ent)) : 0, libro = saldoCta(x.cuenta, f), valor = tipo && hay ? r2(sd / tipo) : null, hecho = S.d.asientos.find(a => a.documento === `REVAL-${f}-${x.cuenta}`); return { ...x, tipo, ent: ent || "", libro, valor, dif: valor === null ? null : r2(valor - libro), hecho }; }) };
}
V.revaluacion = () => {
  const D = datosReval(), pend = D.L.filter(r => r.dif && !r.hecho);
  return pagina("Revalorización de divisa extranjera", `<button class="p" data-a="revaluar" ${pend.length ? "" : "disabled"}>Registrar revalorización</button>` + btn("vista", "Divisas y tipos de cambio", 'data-v="divisas"'), tablaGL(["Cuenta", "Divisa", "#Saldo en divisa (+ deudor, − acreedor)", "#Tipo de cambio", "#Valor en EUR", "#Saldo contable", "#Diferencia", "Asiento"], D.L.map(r => `<tr><td>${r.cuenta} ${esc(nombreCuenta(r.cuenta))}</td><td>${esc(r.div)}</td><td class="n"><input class="n" data-rev="${r.cuenta}" size="12" value="${esc(r.ent)}"></td><td class="n">${r.tipo ? String(r.tipo).replace(".", ",") : "falta"}</td><td class="n">${r.valor === null ? "" : eur(r.valor)}</td><td class="n">${eur(r.libro)}</td><td class="n">${r.dif === null ? "" : eur(r.dif)}</td><td>${r.hecho ? asNum(r.hecho) : ""}</td></tr>`).join(""), "Marque antes las cuentas en divisa en Divisas y tipos de cambio.") + `<p style="color:var(--tx2)">Indique el saldo real de cada cuenta en su divisa a la fecha. La diferencia positiva se lleva a 768000001 y la negativa a 668000001. Para deshacerla, elimine el asiento.</p>`, { tabs: ["Revalorización"], filtros: `<label>Fecha<input type="date" id="rev-f" value="${D.f}"></label>` });
};

/* Liquidaciones de contabilidad: casar apuntes de una misma cuenta */
const idsLiq = () => new Set(CF("liqContables").flatMap(x => x.apuntes));
function datosLiqC() {
  const cta = (S.lcCta || "").trim(), ya = idsLiq();
  const todos = S.d.apuntes.filter(p => p.cuenta === cta).map(p => ({ ...p, a: S.d.asientos.find(a => a.id === p.asiento_id) })).filter(p => p.a && !["cierre", "apertura", "regularizacion"].includes(p.a.origen)).sort((x, y) => x.a.fecha.localeCompare(y.a.fecha) || x.a.numero - y.a.numero);
  return { cta, pend: todos.filter(p => !ya.has(p.id)) };
}
V.liqcont = () => {
  const D = datosLiqC(), M = S.lcMarcas || (S.lcMarcas = new Set()), marc = D.pend.filter(p => M.has(p.id)), dif = r2(marc.reduce((s, p) => s + +p.debe - +p.haber, 0)), hist = CF("liqContables").filter(x => x.cuenta === D.cta);
  const ya = idsLiq(), conPend = new Map(); S.d.apuntes.forEach(p => { if (!ya.has(p.id)) conPend.set(p.cuenta, r2((conPend.get(p.cuenta) || 0) + +p.debe - +p.haber)); });
  return pagina("Liquidaciones de contabilidad", `<button class="p" data-a="liqcontable" ${marc.length > 1 && dif === 0 ? "" : "disabled"}>Liquidar marcadas</button>` + btn("deshacerliqc", "Deshacer última liquidación", "", !hist.length), `<datalist id="dllc">${[...conPend.keys()].sort().map(c => `<option value="${c}">${esc(nombreCuenta(c))}</option>`).join("")}</datalist>
    ${D.cta ? tablaGL(["", "Fecha", "Asiento", "Descripción", "#Débito", "#Crédito"], D.pend.slice(0, 500).map(p => `<tr><td><input type="checkbox" data-lc="${p.id}" ${M.has(p.id) ? "checked" : ""}></td><td>${p.a.fecha}</td><td>${asNum(p.a)}</td><td>${esc(p.concepto || p.a.concepto || "")}</td><td class="n">${sal(+p.debe)}</td><td class="n">${sal(+p.haber)}</td></tr>`).join(""), "No hay transacciones sin liquidar en esta cuenta.") + `<div class="pie"><span>Sin liquidar <b>${eur(D.pend.reduce((s, p) => s + +p.debe - +p.haber, 0))}</b></span><span>Marcadas <b>${marc.length}</b></span><span>Diferencia de las marcadas <b class="${dif ? "ko" : ""}">${eur(dif)}</b></span><span>Liquidaciones hechas <b>${hist.length}</b></span></div>` : `<p>Elija una cuenta para casar sus débitos con sus créditos (partidas pendientes, anticipos, remuneraciones…).</p>`}`, { tabs: ["Transacciones no liquidadas"], filtros: `<label>Cuenta<input id="lc-cta" list="dllc" size="14" value="${esc(D.cta)}"></label>` });
};

/* Control de cuentas principales: categoría, alias, saldo esperado y bloqueo */
function cuentaBloqueada(apuntes) { const C = CF("ctaCtrl"); return (apuntes || []).map(p => p.cuenta).find(c => (C[c] || {}).bloqueada); }
V.ctacontrol = () => {
  const C = CF("ctaCtrl"), q = (S.ccFiltro || "").toLowerCase(), L = movs().filter(c => !q || (c.codigo + " " + c.nombre + " " + ((C[c.codigo] || {}).alias || "") + " " + ((C[c.codigo] || {}).categoria || "")).toLowerCase().includes(q)), cats = new Map();
  movs().forEach(c => { const k = (C[c.codigo] || {}).categoria; if (k) cats.set(k, r2((cats.get(k) || 0) + saldoCta(c.codigo))); });
  return pagina("Control de cuentas principales", "", `${tablaGL(["Cuenta", "Nombre", "Alias", "Categoría", "Saldo esperado", "Bloqueada", "#Saldo"], L.slice(0, 300).map(c => { const x = C[c.codigo] || {}, s = saldoCta(c.codigo), raro = (x.saldo === "D" && s < 0) || (x.saldo === "H" && s > 0); return `<tr class="${raro ? "ko" : ""}"><td>${c.codigo}</td><td>${esc(c.nombre)}</td><td><input data-cc="${c.codigo}" data-k="alias" size="14" value="${esc(x.alias || "")}"></td><td><input data-cc="${c.codigo}" data-k="categoria" size="18" value="${esc(x.categoria || "")}"></td><td><select data-cc="${c.codigo}" data-k="saldo">${[["", ""], ["D", "Deudor"], ["H", "Acreedor"]].map(([v, n]) => `<option value="${v}" ${v === (x.saldo || "") ? "selected" : ""}>${n}</option>`).join("")}</select></td><td><input type="checkbox" data-cc="${c.codigo}" data-k="bloqueada" ${x.bloqueada ? "checked" : ""}></td><td class="n">${sal(s)}</td></tr>`; }).join(""))}
    ${cats.size ? `<h3 style="margin-top:1rem">Saldos por categoría</h3>${tablaGL(["Categoría", "#Saldo"], [...cats].sort().map(([k, v]) => `<tr><td>${esc(k)}</td><td class="n">${eur(v)}</td></tr>`).join(""))}` : ""}<p style="color:var(--tx2)">En una cuenta bloqueada no se puede registrar ni modificar ningún asiento. En rojo, las cuentas con el saldo contrario al esperado.</p>`, { tabs: ["Lista"], filtros: `<label>Filtro<input id="cc-filtro" value="${esc(S.ccFiltro || "")}"></label>` });
};

/* Espacio de trabajo de cierre del periodo */
function comprobacionesCierre(mes) {
  const d = mes + "-01", h = finMes(mes), en = f => f && f >= d && f <= h, hasta = f => f && f <= h, T = [];
  const add = (txt, n, v) => T.push({ txt, n, v });
  add("Facturas de cliente sin registrar", S.d.facturas.filter(f => f.tipo === "V" && estadoF(f) !== "Registrado" && hasta(f.fecha_registro || f.fecha_emision)).length, "fventa");
  add("Facturas de proveedor sin registrar", S.d.facturas.filter(f => f.tipo === "C" && estadoF(f) !== "Registrado" && hasta(f.fecha_registro || f.fecha_emision)).length, "fcompra");
  add("Líneas de diario sin registrar", S.d.lineas.filter(l => hasta(l.fecha)).length, "diario");
  add("Diarios de cobros, pagos y efectos sin registrar", CF("diariosPago").filter(x => !x.registrado && x.lineas.some(l => hasta(l.fecha))).length, "dcobro");
  add("Albaranes del periodo pendientes de facturar", [...albaranes("V"), ...albaranes("C")].filter(a => a.pendiente && hasta(a.fecha)).length, "albv");
  add("Asientos periódicos del mes sin generar", CF("periodicos").filter(x => !S.d.asientos.some(a => a.documento === `PER-${x.id}-${mes}`)).length, "periodicos");
  add("Cuotas de periodificación pendientes", CF("periodif").reduce((s, x) => s + cuotasPer(x).filter(c => c.mes <= mes && !asientoCuota(x, c.mes)).length, 0), "periodif");
  add("Activos con amortización pendiente", CF("activos").filter(x => pendienteAF(x, h) > 0).length, "amort");
  add("Movimientos bancarios sin conciliar", CF("bancos").filter(b => b.cuenta).reduce((s, b) => { const c = conciliados(b); return s + movsBanco(b).filter(p => hasta(p.a.fecha) && !c.has(p.id)).length; }, 0), "conciliar");
  add("Asientos descuadrados o sin líneas", S.d.asientos.filter(a => en(a.fecha)).filter(a => { const ap = S.d.apuntes.filter(p => p.asiento_id === a.id); return !ap.length || r2(ap.reduce((s, p) => s + +p.debe - +p.haber, 0)) !== 0; }).length, "comprobarserie");
  if (["03", "06", "09", "12"].includes(mes.slice(5))) { const cod = (+mes.slice(5) / 3) + "T", ej = +mes.slice(0, 4);
    add("Liquidación de IVA del trimestre (303)", liqDe("303", ej, cod) ? 0 : (impuestosReg().some(r => r.fecha >= ej + "-" + String(+mes.slice(5) - 2).padStart(2, "0") + "-01" && r.fecha <= h) ? 1 : 0), "m303"); }
  return T;
}
V.espaciocierre = () => {
  const mes = S.ecMes || hoy().slice(0, 7), C = comprobacionesCierre(mes), M = CF("tareasCierre"), H = new Set(CF("tareasHechas")[mes] || []), cerrado = (CF("cerrados") || []).includes(mes), pend = C.filter(c => c.n).length + M.filter(t => !H.has(t.id)).length;
  return pagina("Espacio de trabajo de cierre del periodo", btn("vista", "Calendario del libro mayor", 'data-v="calendario"'), `<div class="card"><b class="${pend ? "ko" : "ok"}">${pend ? pend + " tarea(s) pendiente(s)" : "Todo listo para cerrar"}</b> · periodo ${mes} · ${cerrado ? "cerrado" : "abierto"}</div>
    ${tablaGL(["Comprobación automática", "#Pendientes", "Estado", ""], C.map(c => `<tr><td>${c.txt}</td><td class="n">${c.n || ""}</td><td class="${c.n ? "ko" : "ok"}">${c.n ? "Pendiente" : "Correcto"}</td><td><button data-a="vista" data-v="${c.v}">Ir</button></td></tr>`).join(""))}
    <h3 style="margin-top:1rem">Tareas propias</h3><div class="card"><div class="row"><label>Nueva tarea<br><input id="tc-nombre" size="40" placeholder="p. ej. Conciliar cuentas de personal"></label><button data-a="addtarea">+ Agregar</button></div></div>
    ${tablaGL(["Hecha", "Tarea", ""], M.map(t => `<tr><td><input type="checkbox" data-tarea="${t.id}" ${H.has(t.id) ? "checked" : ""}></td><td>${esc(t.nombre)}</td><td><button class="d" data-a="deltarea" data-id="${t.id}">✕</button></td></tr>`).join(""), "Sin tareas propias.")}`, { tabs: ["Tareas"], filtros: `<label>Periodo<input type="month" id="ec-mes" value="${mes}"></label>` });
};

/* Explorador de origen contable: de qué documento sale cada asiento */
function origenDe(a) {
  const out = [], add = (tipo, ref, v, id) => out.push({ tipo, ref, v, id });
  S.d.facturas.filter(f => f.asiento_id === a.id).forEach(f => add(f.tipo === "V" ? "Factura de cliente" : "Factura de proveedor", f.numero, "fact", f.id));
  S.d.liquidaciones.filter(l => l.asiento_id === a.id).forEach(l => { const f = S.d.facturas.find(x => x.id === l.factura_id); if (f) add("Liquida la factura · " + eur(l.importe), f.numero, "fact", f.id); });
  CF("diariosPago").filter(d => d.lineas.some(l => l.asiento === a.id)).forEach(d => add(DJ[d.tipo].titulo, d.num, "d" + d.tipo));
  CF("efectos").filter(e => e.hist.some(h => (h.asientos || []).includes(a.id))).forEach(e => add("Efecto", e.numero, "cartera"));
  CF("activos").filter(x => (x.baja && x.baja.asiento === a.id) || (x.hist || []).some(h => h.asiento === a.id)).forEach(x => add("Activo fijo", x.id + " " + x.nombre, "activos"));
  return out;
}
V.origencont = () => {
  const q = (S.ocBuscar || "").toLowerCase(), L = S.d.asientos.filter(a => !q || (asNum(a) + " " + (a.concepto || "") + " " + (a.documento || "")).toLowerCase().includes(q)).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.numero - a.numero).slice(0, 200), sel = L.find(a => a.id === S.ocSel), O = sel ? origenDe(sel) : [];
  return pagina("Explorador de origen contable", "", `<div class="pagina">${tablaGL(["Asiento", "Fecha", "Origen", "Descripción"], L.map(a => `<tr data-sel class="${sel === a ? "sel" : ""}" data-a="selorigen" data-id="${a.id}"><td>${asNum(a)}</td><td>${a.fecha}</td><td>${esc(a.origen || "manual")}</td><td>${esc(a.concepto || "")}</td></tr>`).join(""))}
    <aside class="factbox"><h3>Documentos de origen</h3>${sel ? (O.length ? `<dl>${O.map(o => `<dt>${esc(o.tipo)}</dt><dd>${o.v === "fact" ? `<a data-a="factdeped" data-id="${o.id}" data-t="${(S.d.facturas.find(f => f.id === o.id) || {}).tipo}">${esc(o.ref)}</a>` : `<a data-a="vista" data-v="${o.v}">${esc(o.ref)}</a>`}</dd>`).join("")}</dl>` : `<p style="color:var(--tx2)">Asiento sin documento asociado (${esc(sel.documento || "manual")}).</p>`) : `<p style="color:var(--tx2)">Seleccione un asiento.</p>`}</aside></div>`, { tabs: ["Visión general"], filtros: `<label>Buscar (número, descripción o documento)<input id="oc-buscar" size="30" value="${esc(S.ocBuscar || "")}"></label>` });
};

/* Registro en diario (España): numeración correlativa y definitiva del libro diario */
function datosRegDiario() {
  const R = CF("registroDiario").filter(x => x.ej === S.ej), reg = new Map(R.flatMap(l => l.asientos.map(x => [x.id, x.n])));
  const L = S.d.asientos.filter(a => a.ejercicio === S.ej);
  return { R, reg, hechos: L.filter(a => reg.has(a.id)).sort((a, b) => reg.get(a.id) - reg.get(b.id)), pend: L.filter(a => !reg.has(a.id)).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.numero - b.numero), ultimo: R.reduce((m, l) => Math.max(m, ...l.asientos.map(x => x.n)), 0), hastaReg: R.map(l => l.hasta).sort().pop() || "" };
}
V.regdiario = () => {
  const D = datosRegDiario(), h = S.rdHasta || finMes(hoy().slice(0, 7)), sel = D.pend.filter(a => a.fecha <= h), atras = D.pend.filter(a => D.hastaReg && a.fecha <= D.hastaReg), borrados = D.R.flatMap(l => l.asientos).filter(x => !hayAsiento(x.id)).length;
  return pagina("Registro en diario (España)", `<button class="p" data-a="regendiario" ${sel.length ? "" : "disabled"}>Registrar en diario (${sel.length})</button>` + btn("deshacerregd", "Deshacer último registro", "", !D.R.length) + btn("regdcsv", "Exportar libro diario", "", !D.hechos.length), `${atras.length ? `<p class="ko">Hay ${atras.length} asiento(s) con fecha anterior al último registro (${D.hastaReg}) sin numerar: se numerarían fuera de orden.</p>` : ""}${borrados ? `<p class="ko">Se han eliminado ${borrados} asiento(s) ya registrados en diario: la numeración tiene huecos.</p>` : ""}<div class="card">Ejercicio ${S.ej} · registrados <b>${D.hechos.length}</b> · último número <b>${D.ultimo}</b> · pendientes <b>${D.pend.length}</b></div>
    ${tablaGL(["N.º en diario", "Asiento", "Fecha", "Descripción", "#Importe"], [...D.hechos.slice(-200).map(a => [D.reg.get(a.id), a]), ...sel.slice(0, 200).map(a => ["(pendiente)", a])].map(([n, a]) => `<tr><td>${n}</td><td>${asNum(a)}</td><td>${a.fecha}</td><td>${esc(a.concepto || "")}</td><td class="n">${eur(S.d.apuntes.filter(p => p.asiento_id === a.id).reduce((s, p) => s + +p.debe, 0))}</td></tr>`).join(""))}`, { tabs: ["Registro"], vista: "Ejercicio " + S.ej, filtros: `<label>Registrar hasta<input type="date" id="rd-hasta" value="${h}"></label>` });
};

/* Saldos por conjunto de dimensiones */
V.conjdim = () => {
  const D = CF("dimensiones"); if (D.length < 2) return pagina("Saldos por conjunto de dimensiones", "", "<p>Se necesitan al menos dos dimensiones.</p>");
  const A = D.find(x => x.id === S.cdA) || D[0], B = D.find(x => x.id === S.cdB && x.id !== A.id) || D.find(x => x.id !== A.id), M = new Map();
  apuntesRes().forEach(p => { const k = (dimDe(p, A.id) || "(sin asignar)") + "\u0001" + (dimDe(p, B.id) || "(sin asignar)"), r = M.get(k) || [0, 0], s = +p.debe - +p.haber; if (p.cuenta[0] === "7") r[0] = r2(r[0] - s); else r[1] = r2(r[1] + s); M.set(k, r); });
  const op = (v, no) => D.filter(x => x.id !== no).map(x => `<option value="${esc(x.id)}" ${x.id === v ? "selected" : ""}>${esc(x.nombre)}</option>`).join("");
  return pagina("Saldos por conjunto de dimensiones", btn("imprimir", "Imprimir"), tablaGL([esc(A.nombre), esc(B.nombre), "#Ingresos", "#Gastos", "#Resultado"], [...M].sort((x, y) => x[0].localeCompare(y[0])).map(([k, [i, g]]) => { const [a, b] = k.split("\u0001"); return `<tr><td>${esc(a)}</td><td>${esc(b)}</td><td class="n">${eur(i)}</td><td class="n">${eur(g)}</td><td class="n">${eur(i - g)}</td></tr>`; }).join("")), { tabs: ["Informe"], filtros: `<label>Primera dimensión<select id="cd-a">${op(A.id)}</select></label><label>Segunda dimensión<select id="cd-b">${op(B.id, A.id)}</select></label>` + filtrosGL() });
};

/* Importar asientos pegados desde Excel o CSV */
function leerImport(texto) {
  const filas = texto.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => l.split(l.includes("\t") ? "\t" : ";").map(c => c.trim())), G = new Map(), err = [];
  const imp = s => { s = String(s || "").replace(/\s|€/g, ""); if (!s) return 0; if (s.includes(",")) s = s.replace(/\./g, "").replace(",", "."); return Number(s); };
  filas.forEach((c, i) => {
    if (i === 0 && /fecha/i.test(c[0])) return; const n = "Fila " + (i + 1) + ": ";
    let [f, grupo, cta, concepto, debe, haber] = c; const m = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.exec(f || ""); if (m) f = m[3] + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0");
    const D = r2(imp(debe)), H = r2(imp(haber));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f || "")) return err.push(n + "fecha no válida.");
    if (!esMov(cta)) return err.push(n + "la cuenta debe tener 9 dígitos.");
    if (!maestroDe(cta) && !nombreMaestro(cta.slice(0, 3))) err.push(n + "no existe el título de la cuenta " + cta + ".");
    if (!isFinite(D) || !isFinite(H) || (!D && !H) || (D && H)) return err.push(n + "indique solo debe o solo haber.");
    const k = f + "|" + (grupo || ""), g = G.get(k) || { fecha: f, grupo: grupo || "", lineas: [] }; g.lineas.push({ cuenta: cta, concepto: concepto || null, debe: D, haber: H }); G.set(k, g);
  });
  const L = [...G.values()]; L.forEach(g => { const d = r2(g.lineas.reduce((s, p) => s + p.debe - p.haber, 0)); if (d) err.push("Asiento " + (g.grupo || "sin número") + " del " + g.fecha + ": descuadrado en " + eur(d) + "."); });
  return { L, err };
}
V.importar = () => {
  const R = S.impTexto ? leerImport(S.impTexto) : null;
  return pagina("Importar asientos", `<button class="p" data-a="importarasientos" ${R && R.L.length && !R.err.length ? "" : "disabled"}>Importar ${R ? R.L.length + " asiento(s)" : ""}</button>` + btn("limpiarimp", "Limpiar", "", !R), `<div class="card">Pegue las filas desde Excel (o un CSV con punto y coma) en este orden: <b>Fecha · Asiento · Cuenta · Descripción · Debe · Haber</b>. Las filas con la misma fecha y número de asiento forman un asiento.<br><textarea id="imp-texto" rows="10" style="width:100%;margin-top:.5rem;font-family:Consolas,monospace">${esc(S.impTexto || "")}</textarea></div>
    ${R ? `${R.err.slice(0, 30).map(e => `<p class="ko">${esc(e)}</p>`).join("")}${tablaGL(["Fecha", "Asiento", "Cuenta", "Descripción", "#Debe", "#Haber"], R.L.flatMap(g => g.lineas.map(p => `<tr><td>${g.fecha}</td><td>${esc(g.grupo)}</td><td>${p.cuenta}</td><td>${esc(p.concepto || "")}</td><td class="n">${sal(p.debe)}</td><td class="n">${sal(p.haber)}</td></tr>`)).slice(0, 400).join(""))}` : ""}`, { tabs: ["Importar"] });
};

async function accionG2(a, b) {
  const id = b.dataset.id, val = i => (document.getElementById(i) || {}).value || "";
  switch (a) {
    case "adddivisa": { const c = val("div-id").trim().toUpperCase(), n = val("div-nombre").trim(); if (!/^[A-Z]{3}$/.test(c) || c === "EUR" || !n) { alert("Indique un código de tres letras distinto de EUR y el nombre."); return true; } await guardarCfg("divisas", [...CF("divisas").filter(x => x.id !== c), { id: c, nombre: n }]); render(); return true; }
    case "deldivisa": if (CF("cuentasDiv").some(x => x.div === id)) { alert("Hay cuentas en esa divisa."); return true; } if (confirm("¿Eliminar la divisa " + id + "?")) { await guardarCfg("divisas", CF("divisas").filter(x => x.id !== id)); render(); } return true;
    case "addtc": { const x = { div: val("tc-div"), fecha: val("tc-fecha"), tipo: +num(val("tc-tipo")) }; if (!x.div || !x.fecha || !(x.tipo > 0)) { alert("Indique divisa, fecha y un tipo mayor que cero."); return true; } await guardarCfg("tiposCambio", [...CF("tiposCambio").filter(y => !(y.div === x.div && y.fecha === x.fecha)), x]); render(); return true; }
    case "deltc": if (confirm("¿Eliminar ese tipo de cambio?")) { await guardarCfg("tiposCambio", CF("tiposCambio").filter(y => y.div + "|" + y.fecha !== id)); render(); } return true;
    case "addctadiv": { const c = val("cd-cta").trim(); if (!cuentaValida(c)) { alert("Elija una cuenta de movimiento existente."); return true; } await guardarCfg("cuentasDiv", [...CF("cuentasDiv").filter(x => x.cuenta !== c), { cuenta: c, div: val("cd-div") }]); render(); return true; }
    case "delctadiv": if (confirm("¿Quitar la cuenta " + id + "?")) { await guardarCfg("cuentasDiv", CF("cuentasDiv").filter(x => x.cuenta !== id)); render(); } return true;
    case "revaluar": { const D = datosReval(), P = D.L.filter(r => r.dif && !r.hecho); if (!P.length || !confirm("¿Registrar la revalorización de " + P.length + " cuenta(s) a " + D.f + "?")) return true;
      for (const r of P) { const v = Math.abs(r.dif), sube = r.dif > 0, contra = sube ? "768000001" : "668000001"; await asegurarCta(contra);
        await db.crearAsiento(S.emp.id, D.f, "Revalorización " + r.div + " " + r.cuenta, [{ cuenta: r.cuenta, concepto: null, debe: sube ? v : 0, haber: sube ? 0 : v }, { cuenta: contra, concepto: null, debe: sube ? 0 : v, haber: sube ? v : 0 }], "revaluacion", `REVAL-${D.f}-${r.cuenta}`); }
      await recargar(); return true; }
    case "liqcontable": { const D = datosLiqC(), ids = D.pend.filter(p => S.lcMarcas.has(p.id)).map(p => p.id), dif = r2(D.pend.filter(p => S.lcMarcas.has(p.id)).reduce((s, p) => s + +p.debe - +p.haber, 0)); if (ids.length < 2 || dif) return true; await guardarCfg("liqContables", [...CF("liqContables"), { id: uid(), cuenta: D.cta, fecha: hoy(), apuntes: ids }]); S.lcMarcas = new Set(); render(); return true; }
    case "deshacerliqc": { const ult = CF("liqContables").filter(x => x.cuenta === datosLiqC().cta).slice(-1)[0]; if (ult && confirm("¿Deshacer la liquidación del " + ult.fecha + " (" + ult.apuntes.length + " transacciones)?")) { await guardarCfg("liqContables", CF("liqContables").filter(x => x.id !== ult.id)); render(); } return true; }
    case "addtarea": { const n = val("tc-nombre").trim(); if (n) { await guardarCfg("tareasCierre", [...CF("tareasCierre"), { id: uid().slice(0, 8), nombre: n }]); render(); } return true; }
    case "deltarea": if (confirm("¿Quitar la tarea de todos los periodos?")) { await guardarCfg("tareasCierre", CF("tareasCierre").filter(t => t.id !== id)); render(); } return true;
    case "selorigen": S.ocSel = id; render(); return true;
    case "regendiario": { const D = datosRegDiario(), h = S.rdHasta || finMes(hoy().slice(0, 7)), P = D.pend.filter(x => x.fecha <= h); if (!P.length || !confirm("¿Numerar " + P.length + " asiento(s) en el diario hasta " + h + "?")) return true; await guardarCfg("registroDiario", [...CF("registroDiario"), { id: uid(), ej: S.ej, hasta: h, fecha: hoy(), asientos: P.map((x, i) => ({ id: x.id, n: D.ultimo + i + 1 })) }]); render(); return true; }
    case "deshacerregd": { const R = CF("registroDiario").filter(x => x.ej === S.ej), u = R[R.length - 1]; if (u && confirm("¿Deshacer el último registro en diario (" + u.asientos.length + " asientos)?")) { await guardarCfg("registroDiario", CF("registroDiario").filter(x => x.id !== u.id)); render(); } return true; }
    case "regdcsv": { const D = datosRegDiario(); descargarCSV("registro_diario_" + S.ej + ".csv", [["N.º diario", "Asiento", "Fecha", "Cuenta", "Nombre", "Descripción", "Debe", "Haber"], ...D.hechos.flatMap(x => S.d.apuntes.filter(p => p.asiento_id === x.id).map(p => [D.reg.get(x.id), asNum(x), x.fecha, p.cuenta, nombreCuenta(p.cuenta), p.concepto || x.concepto || "", nCSV(p.debe), nCSV(p.haber)]))]); return true; }
    case "limpiarimp": S.impTexto = ""; render(); return true;
    case "importarasientos": { const R = leerImport(S.impTexto || ""); if (R.err.length || !R.L.length || !confirm("¿Crear " + R.L.length + " asiento(s)?")) return true;
      for (const g of R.L) { const cerr = periodoCerrado(g.fecha); if (cerr) { alert("El periodo " + g.fecha.slice(0, 7) + " está cerrado. No se ha importado nada."); return true; } const bl = cuentaBloqueada(g.lineas); if (bl) { alert("La cuenta " + bl + " está bloqueada. No se ha importado nada."); return true; } }
      let n = 0; try { for (const g of R.L) { for (const p of g.lineas) await asegurarCta(p.cuenta); await db.crearAsiento(S.emp.id, g.fecha, g.lineas[0].concepto || "Asiento importado", g.lineas, "manual", g.grupo || null); n++; } } finally { if (n) { S.impTexto = R.L.slice(n).flatMap(g => g.lineas.map(p => [g.fecha, g.grupo, p.cuenta, p.concepto || "", nCSV(p.debe || 0).replace(/^0$/, ""), nCSV(p.haber || 0).replace(/^0$/, "")].join(";"))).join("\n"); await recargar(); alert(n + " asiento(s) importados."); } }
      return true; }
  }
  return false;
}
async function cambioG2(t) {
  const d = t.dataset;
  if (d.rev !== undefined) { (S.revSaldos || (S.revSaldos = {}))[d.rev] = t.value.trim(); render(); return true; }
  if (d.lc !== undefined) { const M = S.lcMarcas || (S.lcMarcas = new Set()); if (t.checked) M.add(d.lc); else M.delete(d.lc); render(); return true; }
  if (d.cc !== undefined) { const C = { ...CF("ctaCtrl") }; C[d.cc] = { ...(C[d.cc] || {}), [d.k]: t.type === "checkbox" ? t.checked : t.value.trim() }; await guardarCfg("ctaCtrl", C); render(); return true; }
  if (d.tarea !== undefined) { const mes = S.ecMes || hoy().slice(0, 7), H = { ...CF("tareasHechas") }, s = new Set(H[mes] || []); if (t.checked) s.add(d.tarea); else s.delete(d.tarea); H[mes] = [...s]; await guardarCfg("tareasHechas", H); render(); return true; }
  if (t.id === "imp-texto") { S.impTexto = t.value; render(); return true; }
  const k = { "rev-f": "revFecha", "lc-cta": "lcCta", "cc-filtro": "ccFiltro", "ec-mes": "ecMes", "oc-buscar": "ocBuscar", "rd-hasta": "rdHasta", "cd-a": "cdA", "cd-b": "cdB" }[t.id];
  if (k) { S[k] = t.value; if (t.id === "lc-cta") S.lcMarcas = new Set(); render(); return true; }
  return ["div-id", "div-nombre", "tc-div", "tc-fecha", "tc-tipo", "cd-cta", "cd-div", "tc-nombre"].includes(t.id);
}

/* ---------------- Render y eventos ---------------- */
function render() {
  if (!S.empresas.length && !S.emp) return renderEmpresaNueva();
  const years = [...new Set([new Date().getFullYear(), S.ej, ...S.d.asientos.map(a => a.ejercicio)])].sort();
  const navHtml = () => { // panel de navegación como D365: lista de módulos y, al elegir uno, su árbol de secciones y carpetas
    const m = NAV.find(x => x.g === S.navMod);
    const link = ([k, n]) => `<a class="lnk ${S.vista === k ? "on" : ""}" data-a="vista" data-v="${k}">${esc(n)}</a>`;
    const sec = s => { const key = m.g + "|" + s.n, cerr = S.navCerr[key];
      return `<div class="sec-n"><a class="sec-h" data-a="navsec" data-id="${esc(key)}">${cerr ? "▸" : "▾"} ${esc(s.n)}</a>${cerr ? "" : (s.it || []).map(link).join("") + (s.sub || []).map(b => `<div class="sub-n"><div class="sub-h">${esc(b.n)}</div>${b.it.map(link).join("")}</div>`).join("")}</div>`; };
    return `<div class="nav-fondo" data-a="nav"></div><div class="nav-over"><nav class="nav-mod"><a data-a="vista" data-v="inicio" class="${S.vista === "inicio" ? "on" : ""}">Inicio</a><div class="g">Módulos</div>${NAV.map(x => `<a data-a="navmod" data-id="${esc(x.g)}" class="${S.navMod === x.g ? "on" : ""}">${esc(x.g)} <span>›</span></a>`).join("")}</nav>
     ${m ? `<div class="nav-panel"><div class="nav-bar"><button data-a="navexp">⊞ Expandir</button><button data-a="navcon">⊟ Contraer</button></div><div class="nav-cols">${m.sec.map(sec).join("")}</div></div>` : `<div class="nav-panel"><p style="color:var(--tx2)">Elija un módulo.</p></div>`}</div>`;
  };
  $app.innerHTML = `<div class="fo-top"><button data-a="nav" title="Menú">☰</button><b>Contabilidad</b><span class="ver" title="Versión del programa">v${esc(VERSION)}</span>
   <div class="busca"><input id="busca" list="paginas" placeholder="Buscar una página"><datalist id="paginas">${Object.values(NOMBRES).map(n => `<option value="${n}">`).join("")}</datalist></div>
   <select id="emp">${S.empresas.map(e => `<option value="${e.id}" ${e.id === S.emp.id ? "selected" : ""}>${esc(e.nombre)}${e.almacen === "drive" ? "  ·  Drive" : ""}</option>`).join("")}</select>
   <button data-a="nuevaemp" title="Nueva empresa">+</button>
   <span class="ej">Ejercicio <select id="ej">${years.map(y => `<option ${y === S.ej ? "selected" : ""}>${y}</option>`).join("")}</select></span>
   ${sb ? `<button data-a="salir">Salir</button>` : ""}<span class="av">PO</span></div>
   <div class="fo-body"><div class="fo-rail"><button data-a="nav" title="Menú">☰</button><button data-a="vista" data-v="inicio" title="Inicio">⌂</button></div>
   <div class="fo-page ${(S.terEdit || S.fact || S.ped || S.artEdit || S.afEdit || S.libro || S.edit || S.vista === "inicio") ? "form" : ""}">${LOCAL ? `<p class="aviso">Modo local de pruebas: los datos están solo en este navegador.</p>` : ""}${V[S.vista]()}</div></div>${S.nav ? navHtml() : ""}`;
}
const leerFormEmp = () => {
  const f = S.formEmp || (S.formEmp = { nombre: "", cif: "", alm: LOCAL ? "local" : "nube", handle: null }), n = document.getElementById("en");
  if (n) { f.nombre = n.value; f.cif = document.getElementById("ecif").value; const r = document.querySelector("input[name=alm]:checked"); if (r) f.alm = r.value; }
  return f;
};
function renderEmpresaNueva() {
  const f = leerFormEmp();
  const opc = (v, t, d, dis) => `<label class="opcalm ${dis ? "dis" : ""}"><input type="radio" name="alm" value="${v}" ${f.alm === v ? "checked" : ""} ${dis ? "disabled" : ""}><span><b>${t}</b><br><small>${d}</small></span></label>`;
  $app.innerHTML = `<div class="login card" style="max-width:30rem"><h2>Nueva empresa</h2><input id="en" placeholder="Nombre" value="${esc(f.nombre)}"><input id="ecif" placeholder="CIF" value="${esc(f.cif)}">
   <div class="sec" style="margin:.8rem 0 .3rem">¿Dónde se guardan los datos?</div>
   ${LOCAL ? opc("local", "Este navegador (pruebas)", "Los datos quedan solo en este navegador.") : opc("nube", "Nube (Supabase)", "Los datos se guardan en tu base de datos en la nube, con usuarios y copia de seguridad.")}
   ${opc("drive", "Mi Google Drive (carpeta del ordenador)", SOPORTA_DRIVE ? "Los datos se guardan en un archivo dentro de la carpeta de Drive que elijas." : "Solo disponible en Chrome o Edge en un ordenador.", !SOPORTA_DRIVE)}
   ${f.alm === "drive" ? `<div class="row" style="margin-top:.5rem"><button data-a="elegirdrive">Elegir carpeta de Drive…</button><span>${f.handle ? "📁 " + esc(f.handle.name) : "Ninguna carpeta elegida"}</span></div>` : ""}
   <div class="row" style="margin-top:.8rem"><button class="p" data-a="crearemp">Crear</button>${S.empPrev ? `<button data-a="cancelaremp">Cancelar</button>` : ""}</div></div>`;
}
function renderAbrirDrive() {
  $app.innerHTML = `<div class="login card" style="max-width:30rem"><h2>Abrir empresa de Drive</h2><p>La empresa <b>${esc(S.emp.nombre)}</b> guarda sus datos en una carpeta de tu Google Drive. Por seguridad, el navegador pide permiso cada vez que abres el programa.</p><button class="p" data-a="abrirdrive">Abrir la carpeta de Drive</button></div>`;
}
function renderLogin(msg = "") {
  $app.innerHTML = `<div class="login card"><h2>Contabilidad <small class="ver" style="color:var(--tx2)">v${esc(VERSION)}</small></h2><input id="lu" type="email" placeholder="Email"><input id="lp" type="password" placeholder="Contraseña"><button class="p" data-a="login">Entrar</button><p class="ko">${esc(msg)}</p></div>`;
}

const leerForm = () => { const f = document.getElementById("af"); if (f) { S.fechaAs = f.value; S.conceptoAs = document.getElementById("ac").value; S.docAs = document.getElementById("ad").value; } };
const num = v => String(v ?? "").replace(",", ".");
const apuntesDeLineas = ls => ls.filter(x => x.cuenta && (+x.debe || +x.haber)).map(x => ({ cuenta: x.cuenta.trim(), concepto: x.concepto || null, debe: r2(x.debe), haber: r2(x.haber), ...(x.tercero_id ? { tercero_id: x.tercero_id } : {}) }));

document.addEventListener("input", e => {
  const t = e.target;
  if (t.dataset.l !== undefined) { const k = t.dataset.k; S.lineas[+t.dataset.l][k] = (k === "debe" || k === "haber") ? num(t.value) : t.value; }
});
document.addEventListener("keydown", e => {
  const t = e.target;
  if (e.key === "Enter" && t.dataset.j !== undefined) {
    e.preventDefault();
    const cj = camposJ(), i = cj.indexOf(t.dataset.k); const sig = i < cj.length - 1 ? [t.dataset.j, cj[i + 1]] : [String(+t.dataset.j + 1), "fecha"];
    const el = document.querySelector(`[data-j="${sig[0]}"][data-k="${sig[1]}"]`); if (el) el.focus(); else t.blur();
  }
});
document.addEventListener("focusin", e => { // al entrar en una línea del diario se selecciona (barra inferior y totales del asiento)
  const t = e.target; if (!t.dataset || t.dataset.j === undefined || !S.libro) return;
  const l = lineasLibro()[+t.dataset.j]; if (l && l.id !== S.selLinea) { S.selLinea = l.id; refrescaJ(); }
});
document.addEventListener("change", async e => {
  const t = e.target;
  try {
    if (cambioInv(t)) return;
    if (await cambioImp(t)) return;
    if (cambioFin(t)) return;
    if (await cambioTes(t)) return;
    if (await cambioDoc(t)) return;
    if (cambioFS(t)) return;
    if (await cambioGL(t)) return;
    if (await cambioAlb(t)) return;
    if (cambioTA(t)) return;
    if (await cambioG2(t)) return;
    if (t.name === "alm") { leerFormEmp(); renderEmpresaNueva(); }
    else if (t.dataset.tf !== undefined) {
      setPath(S.terEdit, t.dataset.tf, t.type === "checkbox" ? t.checked : t.value);
      if (t.dataset.tf === "ficha.comb") { const c = comboDe(t.value); if (c) { S.terEdit.ficha.cod_iva = c.iva; S.terEdit.ficha.cod_ret = c.ret || ""; S.terEdit.ficha.recargo = !!c.rec; } render(); } // la combinación rellena el código de impuestos, el de retención y el recargo
    }
    else if (t.dataset.cf !== undefined) { S.comboForm[t.dataset.cf] = t.value; if (t.dataset.cf === "lado") { S.comboForm.iva = codsLinea(t.value)[0].cod; S.comboForm.ret = ""; S.comboForm.rec = ""; } if (S.comboForm.rec && S.comboForm.rec !== recDeCodigo(S.comboForm.iva)) S.comboForm.rec = ""; render(); }
    else if (t.dataset.tl !== undefined) {
      const L = S.terEdit[t.dataset.tl], r = L[+t.dataset.i], k = t.dataset.k;
      r[k] = t.type === "checkbox" ? t.checked : t.value;
      if (k === "principal" && t.checked) { L.forEach((x, j) => { if (j !== +t.dataset.i) x.principal = false; }); render(); }
    }
    else if (t.id === "emp") {
      const e2 = S.empresas.find(x => x.id === t.value);
      try { if (e2.almacen === "drive") await abrirDrive(e2.reg); } catch (err) { render(); throw err; }
      S.emp = e2; S.libro = null; S.djAbierto = null; S.efSel = null; S.extracto = null; S.concilMarcas = null; S.bancoSel = ""; S.revSaldos = null; S.lcCta = ""; S.lcMarcas = null; S.ocSel = null; S.impTexto = ""; S.taTer = ""; S.taMarcas = null; S.taImp = {}; S.albForm = null; S.albMarcas = null; S.selAlb = null; S.glCta = ""; S.asgDest = null; S.asgForm = null; S.selTA = null; S.consol = null; S.dimId = ""; S.fsMarcas = null; S.selFS = null; S.ped = null; S.liqMarcas = null; S.selCred = null; S.selPed = null; await recargar();
    }
    else if (t.id === "ej") { S.ej = +t.value; S.glDesde = ""; S.glHasta = ""; render(); }
    else if (t.id === "cm") { S.filtroCta = t.value; render(); }
    else if (t.id === "fp") { S.filtroPend = t.value; render(); }
    else if (t.id === "fc") { S.filtroCuentas = t.value; render(); }
    else if (t.id === "fcod") { S.filtroCod = t.value; render(); }
    else if (t.id === "liq-acre") { S.liqAcre = t.value.trim(); render(); }
    else if (t.id === "liq-deud") { S.liqDeud = t.value.trim(); render(); }
    else if (t.id === "liq-banco") { S.liqBanco = t.value.trim(); render(); }
    else if (t.id === "per") { S.periodo = t.value; render(); }
    else if (t.id === "tl") { S.libroIva = t.value; render(); }
    else if (t.dataset.man !== undefined) {
      const v = id => document.getElementById(id).value.trim(), ex = S.d.manual.find(m => m.modelo === "111" && m.ejercicio === S.ej && m.periodo === S.periodo);
      await db.guardarManual({ id: ex ? ex.id : uid(), empresa_id: S.emp.id, modelo: "111", ejercicio: S.ej, periodo: S.periodo, datos: { n: +v("man-n") || 0, imp: r2(num(v("man-imp"))), ret: r2(num(v("man-ret"))) } });
      await recargar();
    }
    else if (t.id === "busca") { const k = Object.keys(NOMBRES).find(x => NOMBRES[x].toLowerCase() === t.value.trim().toLowerCase()); if (k) { S.vista = k; render(); } }
    else if (t.dataset.l !== undefined) { leerForm(); render(); }
    else if (t.dataset.f !== undefined) {
      const k = t.dataset.f, F = S.fact.f;
      if (k === "tercero") {
        const x = t.value.trim() ? terPorCod(t.value) : null, tp = F.tipo === "V" ? "C" : "P";
        if (t.value.trim() && (!x || x.tipo !== tp)) { alert("No existe esa cuenta de " + (tp === "C" ? "cliente." : "proveedor.")); F.tercero_id = null; }
        else {
          F.tercero_id = x ? x.id : null;
          if (x) { // IVA y retención por defecto del tercero: su combinación de impuestos o, si no, su código de impuestos y de retención
            const fi = x.ficha || {}, cb = fi.comb && comboDe(fi.comb);
            if (cb && cb.lado === F.tipo && S.fact.ls.every(l => !l.tocado && !(+l.precio))) aplicarCombo(F, S.fact.ls, cb);
            else {
              S.fact.ls.forEach(l => { if (!l.tocado && !(+l.precio)) { const cd = codDefecto(x, F.tipo), k = CODIGO[cd]; l.cod = cd; l.iva = k ? k.pct : 0; l.auto = !!k && (k.tipo === "ue" || k.tipo === "isp"); l.rec = F.tipo === "V" && aplicaRec(x) ? recDeCodigo(cd) : ""; } });
              if (fi.cod_ret && !F.cod_ret) aplicarRet(F, fi.cod_ret);
            }
          }
          if (x && (!F.fecha_vencimiento || F.vencAuto)) { const vv = calcVenc(x, F.fecha_emision); if (vv) { F.fecha_vencimiento = vv; F.vencAuto = true; } } // vencimiento según las condiciones de pago del tercero
        }
        render();
      } else if (k === "combo") { const c = comboDe(t.value); if (c) aplicarCombo(F, S.fact.ls, c); else F.comb = ""; render(); }
      else if (k === "retencion_tipo") { aplicarRet(F, t.value); F.comb = ""; render(); }
      else if (k === "retencion_pct") { F.retencion_pct = +num(t.value) || 0; refrescaF(); }
      else {
        F[k] = t.value; if (k === "fecha_registro") F.fecha_iva = t.value; if (k === "fecha_vencimiento") F.vencAuto = false;
        if (k === "fecha_emision" && (!F.fecha_vencimiento || F.vencAuto)) { const vv = calcVenc(terPorId(F.tercero_id), t.value); if (vv) { F.fecha_vencimiento = vv; F.vencAuto = true; render(); } }
      }
    }
    else if (t.dataset.fl !== undefined) {
      const l = S.fact.ls[+t.dataset.fl], k = t.dataset.k;
      if (k === "cod") { const c = CODIGO[t.value]; l.cod = t.value; l.iva = c ? c.pct : 0; l.auto = !!c && (c.tipo === "ue" || c.tipo === "isp"); l.tocado = true; S.fact.f.comb = ""; if (l.rec) l.rec = recDeCodigo(t.value); render(); }
      else l[k] = (k === "cantidad" || k === "precio") ? (+num(t.value) || 0) : t.value;
      refrescaF();
    }
    else if (t.dataset.jx !== undefined) { const l = S.d.lineas.find(x => x.id === S.selLinea); if (l) { sJ(l, t.dataset.jx, t.value); await db.guardarLinea(l); } }
    else if (t.dataset.lt !== undefined) {
      const x = lotes().find(y => y.numero === S.selLote);
      if (x) { let rec = S.d.libros.find(y => y.numero === x.numero); if (!rec) { rec = { id: uid(), empresa_id: S.emp.id, numero: x.numero, nombre: x.nombre, descripcion: x.descripcion || "", tipo: "general", ficha: {}, creado: new Date().toISOString() }; S.d.libros.push(rec); } rec[t.dataset.lt] = t.dataset.lt === "nombre" ? t.value.toUpperCase() : t.value; await db.guardarLibro(rec); render(); }
    }
    else if (t.dataset.j !== undefined) {
      const ls = lineasLibro(), i = +t.dataset.j, k = t.dataset.k; let l = ls[i], nueva = false;
      const tl = tipoDeLibro(S.libro), fj = tl !== "general", esImp = k === "debe" || k === "haber" || k === "total", v = esImp ? num(t.value) : t.value;
      if (!l) { // línea en blanco: se crea al escribir
        const u = ls[ls.length - 1] || {}; nueva = true;
        l = { id: uid(), empresa_id: S.emp.id, libro: S.libro, fecha: u.fecha || hoy(), documento: fj ? siguienteDoc() : (u.documento || siguienteDoc()), descripcion: fj ? "" : (u.descripcion || ""), tipo_cuenta: fj ? (tl === "fprov" ? "Proveedor" : "Cliente") : (u.tipo_cuenta || "Contabilidad"), cuenta: "", debe: 0, haber: 0, contra_tipo: fj ? "Contabilidad" : "", contra_cuenta: "", extra: {}, orden: Date.now() };
        S.d.lineas.push(l);
      }
      sJ(l, k, esImp ? (v === "" ? 0 : r2(v)) : v);
      if (fj) { // al elegir el proveedor o cliente se proponen su IVA, su retención, la cuenta de gasto o ingreso y el vencimiento
        const ex = l.extra = l.extra || {}, tt = terPorCod(l.cuenta), lado = tl === "fprov" ? "C" : "V";
        if (k === "vencimiento") ex.vencAuto = false;
        if (k === "cod_iva" && lado === "V") ex.cod_rec = ex.cod_rec ? recDeCodigo(ex.cod_iva) : ""; // si el cliente lleva recargo, se ajusta al nuevo tipo de IVA
        if (tt && (k === "cuenta" || k === "fecha_factura" || k === "fecha")) {
          const fi = tt.ficha || {}, cb = fi.comb && comboDe(fi.comb);
          if (k === "cuenta") { if (!ex.cod_iva) ex.cod_iva = (cb && cb.lado === lado ? cb.iva : "") || codDefecto(tt, lado); if (lado === "V") ex.cod_rec = aplicaRec(tt) ? recDeCodigo(ex.cod_iva) : ""; if (!ex.cod_ret) ex.cod_ret = (cb && cb.lado === lado ? cb.ret : "") || fi.cod_ret || ""; if (!l.contra_cuenta) l.contra_cuenta = primeraCuenta(lado === "C" ? "600" : "700"); }
          if (!ex.vencimiento || ex.vencAuto) { const vv = calcVenc(tt, ex.fecha_factura || l.fecha); if (vv) { ex.vencimiento = vv; ex.vencAuto = true; } }
        }
      }
      if ((k === "cuenta" || k === "tipo_cuenta" || k === "contra_cuenta" || k === "contra_tipo") && ((l.tipo_cuenta === "Cliente" || l.tipo_cuenta === "Proveedor") && l.cuenta)) { const x = terPorCod(l.cuenta); l.tercero_id = x ? x.id : null; } else if (k === "cuenta" || k === "tipo_cuenta") l.tercero_id = null;
      if (k === "debe" && +l.debe) l.haber = 0; if (k === "haber" && +l.haber) l.debe = 0;
      S.selLinea = l.id;
      await db.guardarLinea(l);
      if (nueva || esImp || (fj && (k === "cuenta" || k === "fecha_factura"))) { const cj2 = camposJ(), sig = cj2[cj2.indexOf(k) + 1] || "fecha"; const j = i; render(); setTimeout(() => { const el = document.querySelector(`[data-j="${j}"][data-k="${sig}"]`); if (el && document.activeElement === document.body) el.focus(); }, 0); }
      else refrescaJ();
    }
  } catch (err) { alert(err.message); }
});
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-a]"); if (!b || b.disabled) return;
  if (b !== e.target && e.target.matches('input[type="checkbox"]')) return; // marcar una casilla dentro de una fila no selecciona la fila
  const a = b.dataset.a;
  try {
    if (await accionInv(a, b)) return;
    if (await accionImp(a, b)) return;
    if (await accionFin(a, b)) return;
    if (await accionTes(a, b)) return;
    if (await accionDoc(a, b)) return;
    if (await accionFS(a, b)) return;
    if (await accionGL(a, b)) return;
    if (await accionAlb(a, b)) return;
    if (await accionTA(a, b)) return;
    if (await accionG2(a, b)) return;
    if (a === "vista") { S.nav = false; S.vista = b.dataset.v; if (!S.vista.startsWith("diario")) S.libro = null; S.fact = null; S.terEdit = null; S.ped = null; S.artEdit = null; S.almEdit = null; S.ajuste = null; S.cfgEdit = null; S.afEdit = null; S.bajaAF = false; S.djAbierto = null; S.efSel = null; S.albForm = null; S.albMarcas = null; if (S.vista !== "mayor") S.filtroTer = ""; render(); }
    else if (a === "nav") { S.nav = !S.nav; if (S.nav) S.navMod = moduloDe(S.vista) || S.navMod; render(); }
    else if (a === "navmod") { S.navMod = b.dataset.id; render(); }
    else if (a === "navsec") { S.navCerr[b.dataset.id] = !S.navCerr[b.dataset.id]; render(); }
    else if (a === "navexp") { S.navCerr = {}; render(); }
    else if (a === "navcon") { const m = NAV.find(x => x.g === S.navMod); if (m) m.sec.forEach(s => { S.navCerr[m.g + "|" + s.n] = true; }); render(); }
    else if (a === "nuevaemp") { S.empPrev = S.emp; S.emp = null; S.formEmp = null; $app.innerHTML = ""; renderEmpresaNueva(); }
    else if (a === "elegirdrive") {
      const f = leerFormEmp();
      try { f.handle = await window.showDirectoryPicker({ mode: "readwrite" }); } catch (e2) { if (e2.name !== "AbortError") throw e2; }
      renderEmpresaNueva();
    }
    else if (a === "cancelaremp") { S.emp = S.empPrev; S.empPrev = null; S.formEmp = null; render(); }
    else if (a === "abrirdrive") { await abrirDrive(S.emp.reg); await recargar(); }
    else if (a === "crearemp") {
      const f = leerFormEmp(), nombre = f.nombre.trim(), cif = f.cif.trim();
      if (!nombre) return alert("Falta el nombre de la empresa.");
      let e2;
      if (f.alm === "drive") { if (!f.handle) return alert("Elija primero la carpeta de Drive."); e2 = await crearEnDrive(nombre, cif, f.handle); }
      else e2 = await db.crearEmpresa(nombre, cif);
      S.empresas = await db.empresas(); S.emp = S.empresas.find(x => x.id === e2.id); S.formEmp = null; S.empPrev = null;
      await db.crearCuentas(S.emp.id, [...PGC, ...PLAN_BASE]); await recargar();
    }
    else if (a === "selcuenta") { S.sel = b.dataset.id; render(); }
    else if (a === "togglenueva") { S.nueva = !S.nueva; if (S.nueva) { const c = S.d.cuentas.find(x => x.id === S.sel), m = c ? (c.codigo.length < 9 ? c.codigo : maestroDe(c.codigo)) : ""; S.nuevaCod = m ? siguienteCuenta(m) : ""; } render(); }
    else if (a === "delcuentasel") {
      const c = S.d.cuentas.find(x => x.id === S.sel); if (!c) return;
      if (S.d.apuntes.some(p => p.cuenta === c.codigo)) alert("La cuenta tiene transacciones y no se puede eliminar.");
      else if (S.d.cuentas.some(x => x.codigo !== c.codigo && x.codigo.startsWith(c.codigo))) alert("El título tiene cuentas debajo. Elimine antes esas cuentas.");
      else if (S.d.terceros.some(t => t.cuenta === c.codigo) || S.d.lineas.some(l => l.cuenta === c.codigo)) alert("La cuenta la usa un cliente, un proveedor o una línea de diario.");
      else if (confirm("¿Eliminar la cuenta " + c.codigo + "?")) { await db.borrarCuenta(c.id); S.sel = null; await recargar(); }
    }
    else if (a === "vermayor") { const c = S.d.cuentas.find(x => x.id === S.sel); if (c) { S.filtroCta = c.codigo; S.vista = "mayor"; render(); } }
    else if (a === "addcuenta") {
      const c = document.getElementById("cc").value.trim(), n = document.getElementById("cn").value.trim();
      if (!c || !n) return alert("Faltan el código y el nombre.");
      if (!/^\d{1,9}$/.test(c)) return alert("El código debe ser numérico: 9 dígitos para cuentas de movimiento (los títulos tienen menos).");
      if (S.d.cuentas.some(x => x.codigo === c)) return alert("Ya existe la cuenta " + c + ".");
      if (c.length === 9 && !maestroDe(c)) return alert("La cuenta de movimiento debe colgar de un título existente (p. ej. 572 para 572000001). Cargue los títulos del PGC o cree antes el título.");
      await db.crearCuentas(S.emp.id, [[c, n]]); S.nueva = false; await recargar();
    }
    else if (a === "pgc") { await db.crearCuentas(S.emp.id, [...PGC, ...PLAN_BASE]); await recargar(); }
    else if (a === "renombrar") {
      const c = S.d.cuentas.find(x => x.id === S.sel); if (!c) return;
      const n = (prompt("Nuevo nombre de la cuenta " + c.codigo + ":", c.nombre) || "").trim(); if (!n || n === c.nombre) return;
      await db.renombrarCuenta(c.id, n); await recargar();
    }
    /* lotes de diario */
    else if (a === "tab") { S.tabs[b.dataset.k] = b.dataset.t; render(); }
    else if (a === "nuevolote") { const tp = ({ diariofprov: "fprov", diariofcli: "fcli" })[S.vista] || "general"; const nombre = (prompt("Nombre del diario:", tp === "general" ? "GENERAL" : "FACTURAS") || "").trim().toUpperCase(); if (!nombre) return; const desc = (prompt("Descripción:") || "").trim(); const l = { id: uid(), empresa_id: S.emp.id, numero: siguienteLote(), nombre, descripcion: desc, tipo: tp, ficha: {}, creado: new Date().toISOString() }; await db.guardarLibro(l); S.selLote = l.numero; await recargar(); }
    else if (a === "sellote") { S.selLote = b.dataset.id; render(); }
    else if (a === "abrirlote") { e.stopPropagation(); const n = b.dataset.id || S.selLote; if (n) { S.libro = n; S.selLote = n; render(); } }
    else if (a === "volverlotes") { S.libro = null; render(); }
    else if (a === "dellote") {
      const x = lotes().find(y => y.numero === S.selLote); if (!x) return;
      if (!confirm("¿Eliminar el lote " + x.numero + " y todas sus líneas sin registrar?")) return;
      await db.borrarLineas(S.emp.id, x.numero); if (x.id) await db.borrarLibro(x.id); S.selLote = null; await recargar();
    }
    else if (a === "nuevodoc") { const ls = lineasLibro(), tl = tipoDeLibro(S.libro), fj = tl !== "general", l = { id: uid(), empresa_id: S.emp.id, libro: S.libro, fecha: ls[ls.length - 1]?.fecha || hoy(), documento: siguienteDoc(), descripcion: "", tipo_cuenta: fj ? (tl === "fprov" ? "Proveedor" : "Cliente") : "Contabilidad", cuenta: "", debe: 0, haber: 0, contra_tipo: fj ? "Contabilidad" : "", contra_cuenta: "", extra: {}, orden: Date.now() }; S.d.lineas.push(l); S.selLinea = l.id; await db.guardarLinea(l); render(); }
    else if (a === "dellineaj") { const id = b.dataset.id || S.selLinea; if (!id) return; await db.borrarLinea(id); S.d.lineas = S.d.lineas.filter(l => l.id !== id); if (S.selLinea === id) S.selLinea = null; render(); }
    else if (a === "copiarj") { const l = S.d.lineas.find(x => x.id === S.selLinea); if (!l) return; const c = JSON.parse(JSON.stringify(l)); c.id = uid(); c.orden = Date.now(); S.d.lineas.push(c); S.selLinea = c.id; await db.guardarLinea(c); render(); }
    else if (a === "invertirj") { const l = S.d.lineas.find(x => x.id === S.selLinea); if (!l) return; const d = l.debe; l.debe = l.haber; l.haber = d; await db.guardarLinea(l); render(); }
    else if (a === "saldocta") { const l = S.d.lineas.find(x => x.id === S.selLinea), m = l ? resolverCuenta(l.tipo_cuenta, l.cuenta) : {}; if (m.error) return alert("Seleccione una línea con una cuenta válida."); alert("Saldo de " + m.cuenta + " " + nombreCuenta(m.cuenta) + ":\nEjercicio " + S.ej + ": " + eur(saldoPref(m.cuenta, true)) + "\nTotal: " + eur(saldoPref(m.cuenta, false)) + " (deudor positivo, acreedor negativo)"); }
    else if (a === "validar") { const p = comprobar(lineasLibro()); alert(p.length ? "Se encontraron " + p.length + " línea(s) con errores:\n" + p.slice(0, 8).map(x => "Línea " + (x.i + 1) + ": " + x.texto).join("\n") : "La validación del diario terminó sin errores."); }
    else if (a === "registrar") {
      const ls = lineasLibro(); if (!ls.length) return alert("No hay líneas que registrar.");
      const prob = comprobar(ls); if (prob.length) return alert("No se puede registrar. Hay " + prob.length + " línea(s) con errores:\n" + prob.slice(0, 6).map(p => "Línea " + (p.i + 1) + ": " + p.texto).join("\n"));
      if (!confirm("¿Registrar " + ls.length + " líneas del lote " + S.libro + "?")) return;
      const grupos = new Map(); ls.forEach(l => { (grupos.get(l.documento) || grupos.set(l.documento, []).get(l.documento)).push(l); });
      for (const [doc, g] of grupos) {
        const fecha = g.map(x => x.fecha).sort()[0];
        const ap = g.flatMap(x => expandirLinea(x).ap); // cada línea con su contrapartida, IVA y retención
        for (const a2 of ap) if (!S.d.cuentas.some(c => c.codigo === a2.cuenta)) await asegurarCuenta(a2.cuenta, nombreBase(a2.cuenta));
        const aid = await db.crearAsiento(S.emp.id, fecha, g.find(x => x.descripcion)?.descripcion || doc, ap, "diario:" + S.libro, doc);
        for (const x of g) if (esFactJ(x)) await facturaDeLinea(x, aid); // cada línea de un diario de facturas crea también su factura (pagos pendientes, libros de IVA y modelos)
      }
      const lote = S.d.libros.find(x => x.numero === S.libro);
      await db.borrarLineas(S.emp.id, S.libro); if (lote) await db.borrarLibro(lote.id);
      S.libro = null; S.selLote = null; S.vista = "mayor"; await recargar();
    }
    /* transacciones del libro mayor */
    else if (a === "selas") { S.selAs = b.dataset.id; render(); }
    else if (a === "modasiento") {
      const as = S.d.asientos.find(x => x.id === S.selAs); if (!as) return;
      S.edit = as; S.fechaAs = as.fecha; S.conceptoAs = as.concepto; S.docAs = as.documento || "";
      S.lineas = S.d.apuntes.filter(p => p.asiento_id === as.id).map(p => ({ cuenta: p.cuenta, concepto: p.concepto || "", debe: +p.debe || "", haber: +p.haber || "", tercero_id: p.tercero_id || null })); render();
    }
    else if (a === "addlinea") { leerForm(); S.lineas.push({ cuenta: "", concepto: "", debe: "", haber: "" }); render(); }
    else if (a === "dellinea") { leerForm(); S.lineas.splice(+b.dataset.i, 1); render(); }
    else if (a === "cancelar") { S.lineas = null; S.edit = null; render(); }
    else if (a === "guardar") {
      leerForm(); const ap = apuntesDeLineas(S.lineas);
      const falta = ap.find(x => !cuentaValida(x.cuenta));
      if (falta) return alert("La cuenta " + falta.cuenta + " no existe o no es una cuenta de movimiento de 9 dígitos.");
      if (!S.conceptoAs.trim()) return alert("Falta la descripción.");
      await db.modificarAsiento(S.edit.id, S.fechaAs, S.conceptoAs.trim(), S.docAs.trim() || null, ap);
      S.lineas = null; S.edit = null; await recargar();
    }
    else if (a === "delasiento") { const as = S.d.asientos.find(x => x.id === S.selAs); if (as && confirm("¿Eliminar el asiento " + as.numero + " (" + as.concepto + ")? No se puede deshacer.")) { await db.borrarAsiento(as.id); S.selAs = null; await recargar(); } }
    /* clientes y proveedores */
    else if (a === "exportar") { exportarActual(); }
    else if (a === "selcod") { S.selCod = b.dataset.id; render(); }
    else if (a === "selcombo") { S.selCombo = b.dataset.id; render(); }
    else if (a === "nuevocombo") { S.comboForm = { nombre: "", lado: "C", iva: "S.NC.NR", ret: "", rec: "" }; render(); }
    else if (a === "cancelarcombo") { S.comboForm = null; render(); }
    else if (a === "guardarcombo") {
      const F = S.comboForm; if (!F.nombre.trim()) return alert("Falta el nombre de la combinación.");
      if (!CODIGO[F.iva]) return alert("Elija el código de impuestos.");
      await guardarCombos([...combosPropias(), { id: "X-" + uid().slice(0, 6).toUpperCase(), nombre: F.nombre.trim(), lado: F.lado, iva: F.iva, ret: F.ret || "", rec: F.lado === "V" ? (F.rec || "") : "" }]);
      S.comboForm = null; await recargar();
    }
    else if (a === "delcombo") { const c = combosPropias().find(x => x.id === S.selCombo); if (c && confirm("¿Eliminar la combinación «" + c.nombre + "»?")) { await guardarCombos(combosPropias().filter(x => x.id !== c.id)); S.selCombo = ""; await recargar(); } }
    else if (a === "generarliq") {
      const k = b.dataset.k, P = liqPropuesta(k), fecha = document.getElementById("liq-fecha").value;
      if (!fecha) return alert("Falta la fecha del asiento.");
      if (!P.cuadra) return alert("La liquidación no cuadra o no tiene importes.");
      if (liqExistente(k)) return alert("Este período ya está liquidado.");
      const mal = P.lineas.find(l => !cuentaValida(l.cuenta)); if (mal) return alert("La cuenta " + mal.cuenta + " no existe o no es de movimiento (9 dígitos).");
      const ap = P.lineas.map(l => ({ cuenta: l.cuenta, concepto: l.nota || null, debe: l.debe, haber: l.haber }));
      await db.crearAsiento(S.emp.id, fecha, "Liquidación " + LIQ[k].nombre + " " + nomPer(), ap, "liquidacion-" + LIQ[k].modelo, liqClave(k));
      await recargar();
    }
    else if (a === "deshacerliq") { const ex = liqExistente(b.dataset.k); if (ex && confirm("¿Deshacer la liquidación? Se eliminará el asiento nº " + ex.numero + ".")) { await db.borrarAsiento(ex.id); await recargar(); } }
    else if (a === "selpend") { S.selPend = b.dataset.id; S.pagoF = null; render(); }
    else if (a === "abrirpago") { S.pagoF = S.selPend; render(); }
    else if (a === "cancelarpago") { S.pagoF = null; render(); }
    else if (a === "guardarpago") {
      const f = S.d.facturas.find(x => x.id === S.pagoF); if (!f) return;
      await registrarPago(f, document.getElementById("pg-fecha").value, r2(num(document.getElementById("pg-importe").value)), document.getElementById("pg-banco").value.trim());
    }
    else if (a === "deshacerpago") {
      const f = S.d.facturas.find(x => x.id === S.selPend); if (!f) return; const l = liqsF(f).slice(-1)[0]; if (!l) return;
      if (!confirm("¿Deshacer el movimiento de " + eur(l.importe) + " del " + l.fecha + "? Se eliminará su asiento contable.")) return;
      if (l.asiento_id) await db.borrarAsiento(l.asiento_id); await db.borrarLiquidacion(l.id); await recargar();
    }
    else if (a === "quitarter") { S.filtroTer = ""; render(); }
    else if (a === "selter") { S.selTer = b.dataset.id; render(); }
    else if (a === "nuevoter") { S.terEdit = terNuevo(b.dataset.t); render(); }
    else if (a === "editter") { const t = terPorId(b.dataset.id || S.selTer); if (t) { S.terEdit = terClon(t); S.selTer = t.id; render(); } }
    else if (a === "cancelter") { S.terEdit = null; render(); }
    else if (a === "fichasec") { S.fichaCerr[b.dataset.id] = !S.fichaCerr[b.dataset.id]; render(); }
    else if (a === "addtl") {
      const L = S.terEdit[b.dataset.l], pr = L.length === 0;
      L.push(b.dataset.l === "contactos" ? { desc: "", tipo: "Correo electrónico", valor: "", ext: "", principal: pr } : { desc: "", dir: "", cp: "", poblacion: "", provincia: "", pais: (S.terEdit.ficha || {}).pais || "ES", proposito: "Negocio", principal: pr });
      render();
    }
    else if (a === "deltl") { S.terEdit[b.dataset.l].splice(+b.dataset.i, 1); render(); }
    else if (a === "guardarter") {
      const e2 = S.terEdit, ct = e2.contactos || [], principal = (f) => (ct.find(c => c.principal && f(c)) || ct.find(f) || {}).valor || null;
      const t = { id: e2.id, empresa_id: S.emp.id, tipo: e2.tipo, codigo: (e2.codigo || "").trim(), nombre: (e2.nombre || "").trim(), cif: (e2.cif || "").trim() || null, grupo_iva: e2.grupo_iva || "NAC",
        telefono: principal(c => c.tipo === "Teléfono" || c.tipo === "Móvil") || e2.telefono || null, email: principal(c => (c.tipo || "").startsWith("Correo")) || e2.email || null, cuenta: (e2.cuenta || "").trim() || null,
        ficha: e2.ficha || {}, contactos: ct, direcciones: e2.direcciones || [] };
      if (!t.codigo || !t.nombre) return alert("Faltan la cuenta y el nombre.");
      if (parm(t.tipo === "C" ? "cli" : "prov", "requisitoNIF", false) && !t.cif) return alert("Falta el NIF (el parámetro «Requisito de NIF» está activado).");
      if (S.d.terceros.some(x => x.id !== t.id && x.codigo.toLowerCase() === t.codigo.toLowerCase())) return alert("Ya existe esa cuenta de cliente/proveedor.");
      // cada cliente/proveedor tiene su propia cuenta de 9 dígitos bajo 430 (clientes) o 400 (proveedores)
      const cli2 = t.tipo === "C", master = cli2 ? "430" : "400";
      if (!S.d.cuentas.some(c => c.codigo === master)) return alert("Falta el título " + master + " en el plan de cuentas. Cargue los títulos del PGC en Cuentas principales.");
      if (!t.cuenta) t.cuenta = siguienteCuenta(master);
      if (!esMov(t.cuenta)) return alert("La cuenta contable debe tener 9 dígitos (por ejemplo " + siguienteCuenta(master) + ").");
      if (!t.cuenta.startsWith(master)) return alert("La cuenta contable de " + (cli2 ? "un cliente" : "un proveedor") + " debe colgar del título " + master + ".");
      if (S.d.terceros.some(x => x.id !== t.id && x.cuenta === t.cuenta)) return alert("Esa cuenta ya la usa otro cliente o proveedor.");
      await asegurarCuenta(t.cuenta, t.nombre);
      await db.guardarTercero(t); S.terEdit = null; S.selTer = t.id; await recargar();
    }
    else if (a === "delter") {
      const t = terPorId(S.selTer); if (!t) return;
      if (S.d.facturas.some(f => f.tercero_id === t.id) || S.d.apuntes.some(p => p.tercero_id === t.id)) return alert("Tiene facturas o transacciones y no se puede eliminar.");
      if (confirm("¿Eliminar " + t.codigo + " " + t.nombre + "?")) { await db.borrarTercero(t.id); S.selTer = null; await recargar(); }
    }
    else if (a === "verter") { S.filtroTer = S.selTer; S.filtroCta = ""; S.vista = "mayor"; render(); }
    /* facturas */
    else if (a === "nuevafact") {
      const tp = b.dataset.t, pre = b.dataset.ter || "";
      const f = { id: uid(), empresa_id: S.emp.id, tipo: tp, numero: siguienteFact(tp), tercero_id: pre || null, num_externo: "", fecha_emision: hoy(), fecha_registro: hoy(), fecha_iva: hoy(), fecha_vencimiento: calcVenc(terPorId(pre), hoy()), vencAuto: true, estado: "abierto", asiento_id: null, notas: "", retencion_tipo: "", retencion_pct: 0 };
      S.vista = tp === "V" ? "fventa" : "fcompra"; S.fact = { f, ls: [nuevaLineaF(f)] };
      { const t0 = terPorId(pre), fi = (t0 && t0.ficha) || {}, cb = fi.comb && comboDe(fi.comb); if (cb && cb.lado === tp) aplicarCombo(f, S.fact.ls, cb); else if (fi.cod_ret) aplicarRet(f, fi.cod_ret); }
      render();
    }
    else if (a === "selfact") { S.selFact = b.dataset.id; render(); }
    else if (a === "abrirfact") { abrirFactura(b.dataset.id || S.selFact); }
    else if (a === "delfact") {
      const f = S.d.facturas.find(x => x.id === S.selFact); if (!f) return;
      if (estadoF(f) === "Registrado") return alert("La factura está registrada. Deshaga el registro antes de eliminarla.");
      if (confirm("¿Eliminar la factura " + f.numero + "?")) { await db.borrarFactura(f.id); S.selFact = null; await recargar(); }
    }
    else if (a === "volverfact") { S.fact = null; await recargar(); }
    else if (a === "guardarfact") { await guardarFactura(); render(); }
    else if (a === "registrarfact") { await registrarFactura(); }
    else if (a === "deshacerfact") {
      if (liqsF(S.fact.f).length) return alert("La factura tiene cobros o pagos registrados. Deshágalos antes de deshacer el registro.");
      if (!confirm("¿Deshacer el registro? Se eliminará el asiento contable de esta factura.")) return;
      if (S.fact.f.asiento_id) await db.borrarAsiento(S.fact.f.asiento_id);
      S.fact.f.estado = "abierto"; S.fact.f.asiento_id = null; await guardarFactura(); render();
    }
    else if (a === "addlineaf") { S.fact.ls.push(nuevaLineaF(S.fact.f)); render(); }
    else if (a === "dellineaf") { S.fact.ls.splice(+b.dataset.i, 1); if (!S.fact.ls.length) S.fact.ls.push(nuevaLineaF(S.fact.f)); render(); }
    else if (a === "login") { const { error } = await sb.auth.signInWithPassword({ email: document.getElementById("lu").value, password: document.getElementById("lp").value }); if (error) renderLogin(error.message); else arrancar(); }
    else if (a === "salir") { await sb.auth.signOut(); renderLogin(); }
  } catch (err) { alert(err.message); }
});

async function arrancar() {
  if (sb) { const { data } = await sb.auth.getSession(); if (!data.session) return renderLogin(); }
  S.empresas = await db.empresas();
  if (!S.empresas.length) return renderEmpresaNueva();
  S.emp = S.empresas.find(e => e.almacen !== "drive") || S.empresas[0];
  if (S.emp.almacen === "drive" && !driveAbiertas.has(S.emp.id)) return renderAbrirDrive();
  await recargar();
}
arrancar();

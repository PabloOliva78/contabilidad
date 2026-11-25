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
  ["555","Partidas pendientes de aplicación"],["602","Compras de otros aprovisionamientos"],["606","Descuentos sobre compras por pronto pago"],["609","Rappels por compras"]
];

/* ---------------- Capa de datos (local o Supabase) ---------------- */
let sb = null, dbNube = null, dbLS = null;
const TABLAS_LOCAL = ["empresas", "cuentas", "asientos", "apuntes", "lineas", "terceros", "facturas", "flineas", "libros", "liquidaciones", "manual"];
const normaliza = d => { for (const k of TABLAS_LOCAL) d[k] ||= []; return d; };
// Backend de datos con persistencia intercambiable: el navegador (localStorage) o un archivo de la carpeta de Drive
const mkLocal = (g, s) => ({
    async empresas() { return g().empresas; },
    async crearEmpresa(nombre, cif) { const d = g(); const e = { id: uid(), nombre, cif }; d.empresas.push(e); s(d); return e; },
    async cargar(eid) { const d = g(), f = x => x.empresa_id === eid; return { cuentas: d.cuentas.filter(f), asientos: d.asientos.filter(f), apuntes: d.apuntes.filter(f), lineas: d.lineas.filter(f), terceros: d.terceros.filter(f), facturas: d.facturas.filter(f), flineas: d.flineas.filter(f), libros: d.libros.filter(f), liquidaciones: d.liquidaciones.filter(f), manual: d.manual.filter(f) }; },
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
    async cargar(eid) { const [cuentas, asientos, apuntes, lineas, terceros, facturas, flineas, libros, liquidaciones, manual] = await Promise.all(["cuentas", "asientos", "apuntes", "diario_lineas", "terceros", "facturas", "factura_lineas", "diario_libros", "liquidaciones", "modelos_manual"].map(t => todo(t, eid))); return { cuentas, asientos, apuntes, lineas, terceros, facturas, flineas, libros, liquidaciones, manual }; },
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
const db = new Proxy({}, { get: (_, m) => (...a) => m === "empresas" ? listarEmpresas() : backendActual()[m](...a) });

/* ---------------- Estado ---------------- */
const S = { empresas: [], emp: null, vista: "inicio", sel: null, nueva: false, selAs: null, filtroCta: "", libro: null, selLote: null, nav: false, edit: null, selTer: null, terEdit: null, selFact: null, fact: null, filtroTer: "",
  d: { cuentas: [], asientos: [], apuntes: [], lineas: [], libros: [], terceros: [], facturas: [], flineas: [], liquidaciones: [], manual: [] }, pagoF: null, selPend: null, periodo: Math.ceil((new Date().getMonth() + 1) / 3) + "T", libroIva: "V", tabs: {}, selLinea: null, navMod: "", navCerr: {}, fichaCerr: {}, selCombo: "", comboForm: null, selCod: "", filtroCod: "todos", liqAcre: "", liqDeud: "", liqBanco: "", ej: new Date().getFullYear(), lineas: null, fechaAs: "", conceptoAs: "", docAs: "" };
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
    { n: "Entradas de diario", it: [["diario", "Diarios generales"]] },
    { n: "Consultas e informes", sub: [{ n: "Consultas", it: [["mayor", "Transacciones del libro mayor"]] }, { n: "Informes", it: [["sumas", "Balance de comprobación"], ["estados", "Estados financieros"]] }] },
    { n: "Configurar", sub: [{ n: "Plan de cuentas", it: [["cuentas", "Cuentas principales"]] }] }] },
  { g: "Cuentas a cobrar", sec: [
    { n: "Clientes", it: [["clientes", "Todos los clientes"]] },
    { n: "Facturas y cobros", sub: [{ n: "Facturas", it: [["fventa", "Facturas de cliente"], ["diariofcli", "Diario de facturas de cliente"]] }, { n: "Cobros", it: [["cobros", "Cobros pendientes"]] }] }] },
  { g: "Cuentas a pagar", sec: [
    { n: "Proveedores", it: [["proveedores", "Todos los proveedores"]] },
    { n: "Facturas y pagos", sub: [{ n: "Facturas", it: [["fcompra", "Facturas de proveedor"], ["diariofprov", "Diario de facturas de proveedor"]] }, { n: "Pagos", it: [["pagos", "Pagos pendientes"]] }] }] },
  { g: "Impuestos", sec: [
    { n: "Impuestos indirectos", sub: [{ n: "Impuestos", it: [["codigos", "Códigos de impuestos"], ["combos", "Combinaciones de impuestos"]] }] },
    { n: "Consultas e informes", sub: [{ n: "Libros de impuestos", it: [["libroiva", "Libros de IVA"]] }] },
    { n: "Declaraciones", sub: [
      { n: "Impuestos", it: [["m303", "Modelo 303 · IVA y liquidación"], ["m390", "Modelo 390 · Resumen anual de IVA"], ["m111", "Modelo 111 · Retenciones trabajo y profesionales"], ["m115", "Modelo 115 · Retenciones de alquileres"], ["m123", "Modelo 123 · Retenciones de capital mobiliario"], ["m347", "Modelo 347 · Operaciones con terceros"]] },
      { n: "Comercio exterior", it: [["m349", "Modelo 349 · Operaciones intracomunitarias"]] }] }] }
];
const moduloDe = v => (NAV.find(m => m.sec.some(s => (s.it || []).some(i => i[0] === v) || (s.sub || []).some(b => b.it.some(i => i[0] === v)))) || {}).g || "";
const NOMBRES = { inicio: "Inicio", cuentas: "Cuentas principales", diario: "Diarios generales", mayor: "Transacciones del libro mayor", sumas: "Balance de comprobación", estados: "Estados financieros",
  clientes: "Todos los clientes", fventa: "Facturas de cliente", proveedores: "Todos los proveedores", fcompra: "Facturas de proveedor", cobros: "Cobros pendientes", pagos: "Pagos pendientes", diariofprov: "Diario de facturas de proveedor", diariofcli: "Diario de facturas de cliente", codigos: "Códigos de impuestos", combos: "Combinaciones de impuestos", libroiva: "Libros de IVA", m303: "Modelo 303", m390: "Modelo 390", m349: "Modelo 349", m347: "Modelo 347", m111: "Modelo 111", m115: "Modelo 115", m123: "Modelo 123" };

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
const terNuevo = tp => ({ id: uid(), tipo: tp, codigo: siguienteTer(tp), nombre: "", cif: "", grupo_iva: "NAC", telefono: "", email: "", cuenta: "", ficha: { tipoPersona: "Organización", pais: "ES", idioma: "es", pago: {}, fact: {}, ent: {} }, contactos: [], direcciones: [] });
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
  const fdb = { id: f.id, empresa_id: S.emp.id, tipo: f.tipo, numero: f.numero, tercero_id: f.tercero_id || null, num_externo: fila(f.num_externo), fecha_emision: fila(f.fecha_emision), fecha_registro: fila(f.fecha_registro), fecha_iva: fila(f.fecha_iva || f.fecha_registro), fecha_vencimiento: fila(f.fecha_vencimiento), estado: f.estado, asiento_id: f.asiento_id || null, notas: fila(f.notas), retencion_tipo: f.tipo === "C" ? fila(f.retencion_tipo) : null, retencion_pct: (f.cod_ret || (f.tipo === "C" && f.retencion_tipo)) ? (+f.retencion_pct || 0) : 0, cod_ret: fila(f.cod_ret) };
  const ldb = ls.filter(l => (l.descripcion || l.cuenta) && (+l.precio || +l.cantidad)).map((l, i) => ({ id: l.id || uid(), factura_id: f.id, empresa_id: S.emp.id, orden: i, descripcion: l.descripcion || null, cuenta: l.cuenta || null, cantidad: +l.cantidad || 0, precio: +l.precio || 0, iva: +l.iva || 0, cod_iva: l.cod || null, cod_rec: l.rec || null }));
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
const pagadoF = f => r2(liqsF(f).reduce((a, l) => a + +l.importe, 0));
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
    <label>Cuenta de tesorería<br><input id="pg-banco" list="dl" size="12" value="${cuentaSis("572")}"></label>
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
   <div class="fo-page ${(S.terEdit || S.fact || S.libro || S.edit || S.vista === "inicio") ? "form" : ""}">${LOCAL ? `<p class="aviso">Modo local de pruebas: los datos están solo en este navegador.</p>` : ""}${V[S.vista]()}</div></div>${S.nav ? navHtml() : ""}`;
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
      S.emp = e2; S.libro = null; await recargar();
    }
    else if (t.id === "ej") { S.ej = +t.value; render(); }
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
  const a = b.dataset.a;
  try {
    if (a === "vista") { S.nav = false; S.vista = b.dataset.v; if (!S.vista.startsWith("diario")) S.libro = null; S.fact = null; S.terEdit = null; if (S.vista !== "mayor") S.filtroTer = ""; render(); }
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

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const $app = document.getElementById("app");
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
  ["700","Ventas de mercaderías"],["705","Prestaciones de servicios"],["759","Ingresos por servicios diversos"]
];

/* ---------------- Capa de datos (local o Supabase) ---------------- */
let sb = null, db;
if (LOCAL) {
  const K = "contab-local-v2";
  const g = () => { const d = JSON.parse(localStorage.getItem(K) || "{}"); for (const k of ["empresas", "cuentas", "asientos", "apuntes", "lineas", "terceros", "facturas", "flineas", "libros", "liquidaciones", "manual"]) d[k] ||= []; return d; };
  const s = d => localStorage.setItem(K, JSON.stringify(d));
  db = {
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
  };
} else {
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const ok = r => { if (r.error) throw new Error(r.error.message); return r.data; };
  const todo = async (tabla, eid) => { // pagina de 1000 en 1000
    let out = [], from = 0;
    for (;;) { const d = ok(await sb.from(tabla).select("*").eq("empresa_id", eid).order("id").range(from, from + 999)); out = out.concat(d); if (d.length < 1000) return out; from += 1000; }
  };
  db = {
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
    async crearAsiento(eid, fecha, concepto, apuntes, origen = "manual", documento = null) { return ok(await sb.rpc("crear_asiento", { p_empresa: eid, p_fecha: fecha, p_concepto: concepto, p_origen: origen, p_apuntes: apuntes, p_documento: documento })); },
    async modificarAsiento(id, fecha, concepto, documento, apuntes) { ok(await sb.rpc("modificar_asiento", { p_asiento: id, p_fecha: fecha, p_concepto: concepto, p_documento: documento, p_apuntes: apuntes })); },
    async borrarAsiento(id) { ok(await sb.from("asientos").delete().eq("id", id)); },
    async guardarLinea(l) { ok(await sb.from("diario_lineas").upsert(l)); },
    async borrarLinea(id) { ok(await sb.from("diario_lineas").delete().eq("id", id)); },
    async borrarLineas(eid, libro) { ok(await sb.from("diario_lineas").delete().eq("empresa_id", eid).eq("libro", libro)); }
  };
}

/* ---------------- Estado ---------------- */
const S = { empresas: [], emp: null, vista: "inicio", sel: null, nueva: false, selAs: null, filtroCta: "", libro: null, selLote: null, nav: false, edit: null, selTer: null, terEdit: null, selFact: null, fact: null, filtroTer: "",
  d: { cuentas: [], asientos: [], apuntes: [], lineas: [], libros: [], terceros: [], facturas: [], flineas: [], liquidaciones: [], manual: [] }, pagoF: null, selPend: null, periodo: Math.ceil((new Date().getMonth() + 1) / 3) + "T", libroIva: "V", ej: new Date().getFullYear(), lineas: null, fechaAs: "", conceptoAs: "", docAs: "" };
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
function lotes() {
  const l = S.d.libros.map(x => ({ ...x }));
  S.d.lineas.forEach(x => { if (!l.some(y => y.numero === x.libro)) l.push({ numero: x.libro, nombre: "GENERAL", descripcion: "", virtual: true }); });
  return l.sort((a, b) => a.numero.localeCompare(b.numero));
}
const lineasLibro = () => S.d.lineas.filter(l => l.libro === S.libro).sort((a, b) => (+a.orden || 0) - (+b.orden || 0));
function comprobar(ls) {
  const porDoc = new Map(); ls.forEach(l => { const o = porDoc.get(l.documento) || 0; porDoc.set(l.documento, r2(o + (+l.debe || 0) - (+l.haber || 0))); });
  const prob = [];
  ls.forEach((l, i) => {
    const p = [];
    if (!l.cuenta || !S.d.cuentas.some(c => c.codigo === l.cuenta)) p.push("cuenta inexistente");
    if (!(+l.debe || +l.haber)) p.push("sin importe");
    if (!l.fecha) p.push("sin fecha");
    if (!l.documento) p.push("sin comprobante");
    else if (porDoc.get(l.documento) !== 0) p.push("el comprobante " + l.documento + " no cuadra (" + eur(porDoc.get(l.documento)) + ")");
    if (p.length) prob.push({ i, id: l.id, texto: p.join(", ") });
  });
  return prob;
}

/* ---------------- Vistas ---------------- */
const V = {};
const CATEG = { 1: "Pasivo / PN", 2: "Activo", 3: "Activo", 4: "Mixta", 5: "Mixta", 6: "Gastos", 7: "Ingresos" };
const NAV = [
  ["Libro mayor", [["cuentas", "Cuentas principales"], ["diario", "Diarios generales"], ["mayor", "Transacciones del libro mayor"], ["sumas", "Balance de comprobación"], ["estados", "Estados financieros"]]],
  ["Cuentas a cobrar", [["clientes", "Todos los clientes"], ["fventa", "Facturas de cliente"], ["cobros", "Cobros pendientes"]]],
  ["Cuentas a pagar", [["proveedores", "Todos los proveedores"], ["fcompra", "Facturas de proveedor"], ["pagos", "Pagos pendientes"]]],
  ["Impuestos", [["libroiva", "Libros de IVA"], ["m303", "Modelo 303"], ["m390", "Modelo 390"], ["m349", "Modelo 349"], ["m347", "Modelo 347"], ["m111", "Modelo 111"], ["m115", "Modelo 115"], ["m123", "Modelo 123"]]]
];
const NOMBRES = { inicio: "Inicio", cuentas: "Cuentas principales", diario: "Diarios generales", mayor: "Transacciones del libro mayor", sumas: "Balance de comprobación", estados: "Estados financieros",
  clientes: "Todos los clientes", fventa: "Facturas de cliente", proveedores: "Todos los proveedores", fcompra: "Facturas de proveedor", cobros: "Cobros pendientes", pagos: "Pagos pendientes", libroiva: "Libros de IVA", m303: "Modelo 303", m390: "Modelo 390", m349: "Modelo 349", m347: "Modelo 347", m111: "Modelo 111", m115: "Modelo 115", m123: "Modelo 123" };

const btn = (a, t, extra = "", dis = false) => `<button data-a="${a}" ${extra} ${dis ? "disabled" : ""}>${t}</button>`;
const SEP = `<span class="sep"></span>`;
// estructura de página D365: panel de acciones, título con vista, filtros, pestañas, cuerpo
const pagina = (titulo, acciones, cuerpo, { tabs = ["Lista", "General"], vista = "Mi vista", filtros = "" } = {}) =>
  `<div class="fo-ap">${acciones}</div><div class="fo-hd"><small>${esc(titulo)}</small><h1>${esc(vista)} <i>⌄</i></h1></div>${filtros ? `<div class="fo-filtros">${filtros}</div>` : ""}
   <div class="fo-tabs">${tabs.map((t, i) => `<a class="${i ? "" : "on"}">${t}</a>`).join("")}</div><div class="fo-cuerpo">${cuerpo}</div>`;

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
  const lista = [...S.d.cuentas].sort((a, b) => a.codigo.localeCompare(b.codigo));
  const sel = S.d.cuentas.find(c => c.id === S.sel);
  const nivel = c => c.length <= 2 ? 0 : c.length === 3 ? 1 : c.length === 4 ? 2 : 3;
  const filas = lista.map(c => `<tr data-sel class="${c.codigo.length <= 4 ? "tit" : ""} ${c.id === S.sel ? "sel" : ""}" data-a="selcuenta" data-id="${c.id}"><td style="padding-left:${.5 + nivel(c.codigo) * 1.1}rem">${esc(c.codigo)}</td><td>${esc(c.nombre)}</td><td>${CATEG[c.codigo[0]] || ""}</td><td class="n">${sal(saldoPref(c.codigo, true))}</td><td class="n">${sal(saldoPref(c.codigo, false))}</td></tr>`).join("");
  const mov = sel ? S.d.apuntes.filter(p => p.cuenta === sel.codigo).length : 0;
  const acc = btn("togglenueva", "+ Nuevo") + btn("delcuentasel", "Eliminar", "", !sel) + SEP + btn("pgc", "Cargar plan básico PGC") + SEP + btn("vermayor", "Transacciones", "", !sel);
  return pagina("Cuentas principales", acc, `
  ${S.nueva ? `<div class="card"><div class="row"><input id="cc" placeholder="Cuenta principal" size="12"><input id="cn" placeholder="Nombre" size="40"><button class="p" data-a="addcuenta">Aceptar</button><button data-a="togglenueva">Cancelar</button></div></div>` : ""}
  <div class="pagina"><div class="lista"><table><tr><th>Cuenta principal</th><th>Nombre de la cuenta principal</th><th>Tipo de cuenta</th><th class="n">Saldo del periodo</th><th class="n">Saldo</th></tr>${filas}</table></div>
  <aside class="factbox"><h3>Detalles</h3>${sel ? `<dl><dt>Cuenta</dt><dd>${esc(sel.codigo)}</dd><dt>Nombre</dt><dd>${esc(sel.nombre)}</dd><dt>Saldo ${S.ej}</dt><dd>${eur(saldoPref(sel.codigo, true))}</dd><dt>Saldo total</dt><dd>${eur(saldoPref(sel.codigo, false))}</dd><dt>Transacciones</dt><dd>${mov}</dd></dl>` : `<p style="color:var(--tx2)">Seleccione una cuenta para ver sus detalles.</p>`}</aside></div>`);
};

/* Diarios generales: lista de lotes y, dentro, las líneas del lote (como en D365) */
const CAMPOS_J = ["fecha", "documento", "cuenta", "tercero", "descripcion", "debe", "haber"];
function filaJ(l, i, prob) {
  const nuevo = !l.id;
  const inp = (k, ex = "") => `<input data-j="${i}" data-k="${k}" ${ex} value="${esc(k === "tercero" ? (terPorId(l.tercero_id) || {}).codigo || "" : l[k] ?? "")}">`;
  return `<tr class="${prob ? "prob" : ""}"><td>${inp("fecha", 'type="date"')}</td><td>${inp("documento", 'size="10"')}</td>
   <td>${inp("cuenta", 'list="dl" size="10"')}</td><td class="nc" data-nc="${i}">${esc(nombreCuenta(l.cuenta))}</td><td>${inp("tercero", 'list="dlter" size="8"')}</td><td>${inp("descripcion", 'size="30"')}</td>
   <td>${inp("debe", 'class="n" size="10"')}</td><td>${inp("haber", 'class="n" size="10"')}</td><td>${nuevo ? "" : `<button class="d" data-a="dellineaj" data-id="${l.id}">✕</button>`}</td></tr>`;
}
function panelJ(ls) {
  const prob = comprobar(ls), D = r2(ls.reduce((a, l) => a + (+l.debe || 0), 0)), H = r2(ls.reduce((a, l) => a + (+l.haber || 0), 0));
  return { prob, html: `<h3>Validación del diario</h3><div class="mosaicos"><div class="mos gris" style="width:6rem;height:5rem"><span>Líneas válidas</span><b>${ls.length - prob.length}</b></div><div class="mos ${prob.length ? "rojo" : "gris"}" style="width:6rem;height:5rem"><span>Con errores</span><b>${prob.length}</b></div></div>
   ${prob.length ? `<ul class="probs">${prob.slice(0, 8).map(p => `<li>Línea ${p.i + 1}: ${esc(p.texto)}</li>`).join("")}</ul>` : `<p class="ok">No se encontraron errores.</p>`}`,
    pie: `<span>Número de líneas <b>${ls.length}</b></span><span>Débito <b>${eur(D)}</b></span><span>Crédito <b>${eur(H)}</b></span><span>Diferencia <b class="${D === H ? "" : "ko"}">${eur(D - H)}</b></span>` };
}
V.diario = () => {
  if (!S.libro) { // lista de lotes
    const L = lotes(), sel = L.find(x => x.numero === S.selLote);
    const filas = L.map(x => { const ls = S.d.lineas.filter(l => l.libro === x.numero), D = r2(ls.reduce((a, l) => a + (+l.debe || 0), 0)), H = r2(ls.reduce((a, l) => a + (+l.haber || 0), 0));
      return `<tr data-sel class="${x.numero === S.selLote ? "sel" : ""}" data-a="sellote" data-id="${esc(x.numero)}"><td><a data-a="abrirlote" data-id="${esc(x.numero)}">${esc(x.numero)}</a></td><td>${esc(x.nombre)}</td><td>${esc(x.descripcion || "")}</td><td class="n">${ls.length}</td><td class="n">${eur(D)}</td><td class="n">${eur(H)}</td></tr>`; }).join("");
    const acc = btn("nuevolote", "+ Nuevo") + btn("dellote", "Eliminar", "", !sel) + SEP + btn("abrirlote", "Líneas", `data-id="${esc(S.selLote || "")}"`, !sel);
    return pagina("Diarios generales", acc, `<div class="lista"><table><tr><th>Número de lote</th><th>Nombre</th><th>Descripción</th><th class="n">Líneas</th><th class="n">Débito</th><th class="n">Crédito</th></tr>${filas || `<tr><td colspan="6" class="vacio">No se encontró ningún elemento que mostrar aquí.</td></tr>`}</table></div>`,
      { filtros: `<label>Mostrar<select><option>No registrado</option></select></label>` });
  }
  const lote = lotes().find(x => x.numero === S.libro) || { numero: S.libro, descripcion: "" };
  const ls = lineasLibro(), p = panelJ(ls);
  const ultima = ls[ls.length - 1];
  const blanca = { fecha: ultima?.fecha || "", documento: ultima?.documento || "", cuenta: "", descripcion: "", debe: "", haber: "" };
  const acc = btn("volverlotes", "← Diarios") + SEP + btn("nuevodoc", "+ Nuevo comprobante") + SEP + btn("validar", "Validar") + `<button class="p" data-a="registrar">Registrar</button>`;
  return pagina("Entradas de diario", acc, `
  <datalist id="dl">${S.d.cuentas.map(c => `<option value="${esc(c.codigo)}">${esc(c.nombre)}</option>`).join("")}</datalist>
  <datalist id="dlter">${S.d.terceros.map(x => `<option value="${esc(x.codigo)}">${esc(x.nombre)}</option>`).join("")}</datalist>
  <div class="pagina"><div class="lista"><table class="editable"><tr><th>Fecha</th><th>Comprobante</th><th>Cuenta</th><th>Nombre de la cuenta</th><th>Cliente / proveedor</th><th>Descripción</th><th class="n">Débito</th><th class="n">Crédito</th><th></th></tr>
  ${ls.map((l, i) => filaJ(l, i, p.prob.some(x => x.id === l.id))).join("")}${filaJ(blanca, ls.length, false)}</table>
  <div class="pie" id="pieJ">${p.pie}</div></div><aside class="factbox" id="boxJ">${p.html}</aside></div>`, { tabs: ["Líneas", "Encabezado"], vista: `${lote.numero}${lote.descripcion ? " · " + lote.descripcion : ""}` });
};
function refrescaJ() {
  const ls = lineasLibro(), p = panelJ(ls);
  document.getElementById("pieJ").innerHTML = p.pie; document.getElementById("boxJ").innerHTML = p.html;
  document.querySelectorAll("[data-nc]").forEach(td => { const l = ls[+td.dataset.nc]; td.textContent = l ? nombreCuenta(l.cuenta) : ""; });
  document.querySelectorAll("table.editable tr").forEach((tr, k) => { if (k > 0) tr.classList.toggle("prob", !!ls[k - 1] && p.prob.some(x => x.id === ls[k - 1].id)); });
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
  <datalist id="dl">${S.d.cuentas.map(c => `<option value="${esc(c.codigo)}">${esc(c.nombre)}</option>`).join("")}</datalist>
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
function totalesF(ls) {
  const porIva = new Map(); let base = 0;
  ls.forEach(l => { const b = r2((+l.cantidad || 0) * (+l.precio || 0)); base = r2(base + b); porIva.set(+l.iva || 0, r2((porIva.get(+l.iva || 0) || 0) + b)); });
  let cuota = 0; porIva.forEach((b, i) => { cuota = r2(cuota + r2(b * i / 100)); });
  return { base, cuota, total: r2(base + cuota) };
}
const estadoF = f => (f.estado === "registrado" && S.d.asientos.some(a => a.id === f.asiento_id)) ? "Registrado" : "Abierto";
const lineasF = f => S.d.flineas.filter(l => l.factura_id === f.id).sort((a, b) => a.orden - b.orden);

function vistaTerceros(tipo) {
  const cli = tipo === "C";
  const L = S.d.terceros.filter(t => t.tipo === tipo).sort((a, b) => a.codigo.localeCompare(b.codigo));
  const sel = L.find(t => t.id === S.selTer);
  const filas = L.map(t => `<tr data-sel class="${t.id === S.selTer ? "sel" : ""}" data-a="selter" data-id="${t.id}"><td><a data-a="editter" data-id="${t.id}">${esc(t.codigo)}</a></td><td>${esc(t.nombre)}</td><td>${esc(t.cif || "")}</td><td>${esc(t.grupo_iva)}</td><td>${esc(t.telefono || "")}</td><td class="n">${sal(saldoTer(t))}</td></tr>`).join("");
  const acc = btn("nuevoter", "+ Nuevo", `data-t="${tipo}"`) + btn("editter", "Editar", `data-id="${sel ? sel.id : ""}"`, !sel) + btn("delter", "Eliminar", "", !sel) + SEP + btn("verter", "Transacciones", "", !sel) + SEP + btn("nuevafact", cli ? "Nueva factura de cliente" : "Nueva factura de proveedor", `data-t="${cli ? "V" : "C"}" data-ter="${sel ? sel.id : ""}"`);
  const e = S.terEdit && S.terEdit.tipo === tipo ? S.terEdit : null;
  const form = e ? `<div class="card"><b>${S.d.terceros.some(t => t.id === e.id) ? "Editar" : "Nuevo"} ${cli ? "cliente" : "proveedor"}</b><div class="row" style="margin-top:.5rem">
    <input id="te-codigo" placeholder="Cuenta" size="10" value="${esc(e.codigo)}"><input id="te-nombre" placeholder="Nombre" size="34" value="${esc(e.nombre)}"><input id="te-cif" placeholder="NIF / CIF" size="12" value="${esc(e.cif || "")}">
    <select id="te-grupo">${["NAC", "UE", "EXT"].map(g => `<option ${g === e.grupo_iva ? "selected" : ""}>${g}</option>`).join("")}</select>
    <input id="te-tel" placeholder="Teléfono" size="12" value="${esc(e.telefono || "")}"><input id="te-email" placeholder="Correo electrónico" size="22" value="${esc(e.email || "")}">
    <input id="te-cuenta" list="dl" placeholder="Cuenta contable (${cli ? "430" : "400"})" size="12" value="${esc(e.cuenta || "")}">
    <button class="p" data-a="guardarter">Guardar</button><button data-a="cancelter">Cancelar</button></div>
    <datalist id="dl">${S.d.cuentas.map(c => `<option value="${esc(c.codigo)}">${esc(c.nombre)}</option>`).join("")}</datalist></div>` : "";
  const fs = sel ? S.d.facturas.filter(f => f.tercero_id === sel.id) : [];
  const fact = fs.filter(f => estadoF(f) === "Registrado" && (f.fecha_registro || "").startsWith(String(S.ej))).reduce((a, f) => a + totalesF(lineasF(f)).total, 0);
  return pagina(cli ? "Todos los clientes" : "Todos los proveedores", acc, `${form}
  <div class="pagina"><div class="lista"><table><tr><th>${cli ? "Cuenta de cliente" : "Cuenta de proveedor"}</th><th>Nombre</th><th>NIF / CIF</th><th>Grupo de impuestos</th><th>Teléfono</th><th class="n">Saldo</th></tr>${filas || `<tr><td colspan="6" class="vacio">No se encontró ningún elemento que mostrar aquí.</td></tr>`}</table></div>
  <aside class="factbox"><h3>Estadísticas ${cli ? "del cliente" : "del proveedor"}</h3>${sel ? `<dl><dt>Cuenta</dt><dd>${esc(sel.codigo)}</dd><dt>Saldo</dt><dd>${eur(saldoTer(sel))}</dd><dt>Facturas abiertas</dt><dd>${fs.filter(f => estadoF(f) === "Abierto").length}</dd><dt>Facturado ${S.ej}</dt><dd>${eur(fact)}</dd><dt>Correo</dt><dd>${esc(sel.email || "")}</dd></dl>` : `<p style="color:var(--tx2)">Seleccione ${cli ? "un cliente" : "un proveedor"}.</p>`}</aside></div>`);
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
   ${cli ? "" : `<label>Retención IRPF<br><select data-f="retencion_tipo" ${dis}><option value="">Ninguna</option><option value="111" ${f.retencion_tipo === "111" ? "selected" : ""}>Profesionales (111)</option><option value="115" ${f.retencion_tipo === "115" ? "selected" : ""}>Alquileres (115)</option><option value="123" ${f.retencion_tipo === "123" ? "selected" : ""}>Capital mobiliario (123)</option></select></label>
   <label>% ret.<br><input data-f="retencion_pct" size="5" ${dis || (f.retencion_tipo ? "" : "disabled")} value="${f.retencion_pct || 0}"></label>`}
   <label>Estado<br><b>${estadoF(f)}</b></label></div></div>
  <datalist id="dlter">${S.d.terceros.filter(x => x.tipo === (cli ? "C" : "P")).map(x => `<option value="${esc(x.codigo)}">${esc(x.nombre)}</option>`).join("")}</datalist>
  <datalist id="dl">${S.d.cuentas.map(c => `<option value="${esc(c.codigo)}">${esc(c.nombre)}</option>`).join("")}</datalist>`;
  const filas = ls.map((l, i) => `<tr><td><input data-fl="${i}" data-k="descripcion" size="34" ${dis} value="${esc(l.descripcion || "")}"></td><td><input data-fl="${i}" data-k="cuenta" list="dl" size="9" ${dis} value="${esc(l.cuenta || "")}"></td>
   <td><input class="n" data-fl="${i}" data-k="cantidad" size="7" ${dis} value="${l.cantidad}"></td><td><input class="n" data-fl="${i}" data-k="precio" size="10" ${dis} value="${l.precio}"></td>
   <td><select data-fl="${i}" data-k="iva" ${dis}>${IVAS.map(v => `<option ${v === +l.iva ? "selected" : ""} value="${v}">${v} %</option>`).join("")}</select></td>
   <td class="n" data-imp="${i}">${eur((+l.cantidad || 0) * (+l.precio || 0))}</td><td>${reg ? "" : `<button class="d" data-a="dellineaf" data-i="${i}">✕</button>`}</td></tr>`).join("");
  return pagina(cli ? "Factura de cliente" : "Factura de proveedor", acc, `${cab}
  <div class="pagina"><div class="lista"><table class="editable"><tr><th>Descripción</th><th>${cli ? "Cuenta de ingresos" : "Cuenta de gastos"}</th><th class="n">Cantidad</th><th class="n">Precio unitario</th><th>IVA</th><th class="n">Importe</th><th></th></tr>${filas}</table>
   ${reg ? "" : `<div class="row" style="margin-top:.5rem"><button data-a="addlineaf">+ Línea</button></div>`}
   <div class="pie" id="pieF"><span>Base imponible <b id="tb">${eur(tot.base)}</b></span><span>IVA <b id="ti">${eur(tot.cuota)}</b></span><span>Total <b id="tt">${eur(tot.total)}</b></span>${cli ? "" : `<span>Retención <b id="tr">${eur(retDe(f, tot.base))}</b></span><span>A pagar <b id="ta">${eur(r2(tot.total - retDe(f, tot.base)))}</b></span>`}${reg ? `<span>${cli ? "Cobrado" : "Pagado"} <b>${eur(pagadoF(f))}</b></span><span>Pendiente <b>${eur(pendienteF(f))}</b></span>` : ""}</div></div>
  <aside class="factbox"><h3>${cli ? "Cliente" : "Proveedor"}</h3>${t ? `<dl><dt>Cuenta</dt><dd>${esc(t.codigo)}</dd><dt>NIF</dt><dd>${esc(t.cif || "")}</dd><dt>Grupo de impuestos</dt><dd>${esc(t.grupo_iva)}</dd><dt>Saldo</dt><dd>${eur(saldoTer(t))}</dd></dl>` : `<p style="color:var(--tx2)">Seleccione ${cli ? "un cliente" : "un proveedor"}.</p>`}
   <h3 style="margin-top:1rem">Factura</h3><dl><dt>Número</dt><dd>${esc(f.numero)}</dd></dl></aside></div>`, { tabs: ["Líneas", "General"], vista: `${f.numero}${t ? " · " + t.nombre : ""}` });
}
V.fventa = () => S.fact && S.fact.f.tipo === "V" ? vistaFacturaEdit() : vistaFacturas("V");
V.fcompra = () => S.fact && S.fact.f.tipo === "C" ? vistaFacturaEdit() : vistaFacturas("C");
function refrescaF() {
  const { f, ls } = S.fact, tot = totalesF(ls);
  document.getElementById("tb").textContent = eur(tot.base); document.getElementById("ti").textContent = eur(tot.cuota); document.getElementById("tt").textContent = eur(tot.total);
  if (document.getElementById("tr")) { const r = retDe(f, tot.base); document.getElementById("tr").textContent = eur(r); document.getElementById("ta").textContent = eur(r2(tot.total - r)); }
  document.querySelectorAll("[data-imp]").forEach(td => { const l = ls[+td.dataset.imp]; td.textContent = l ? eur((+l.cantidad || 0) * (+l.precio || 0)) : ""; });
}
const ivaDefecto = t => (t && t.grupo_iva !== "NAC") ? 0 : 21;
function nuevaLineaF(f) { return { id: null, descripcion: "", cuenta: f.tipo === "V" ? "700" : "600", cantidad: 1, precio: 0, iva: ivaDefecto(terPorId(f.tercero_id)) }; }
function abrirFactura(id) { const f = S.d.facturas.find(x => x.id === id); if (!f) return; S.fact = { f: { ...f }, ls: lineasF(f).map(l => ({ ...l })) }; S.selFact = id; if (!S.fact.ls.length) S.fact.ls.push(nuevaLineaF(S.fact.f)); render(); }
async function guardarFactura() {
  const { f, ls } = S.fact; const fila = x => (x === "" || x === undefined) ? null : x;
  const fdb = { id: f.id, empresa_id: S.emp.id, tipo: f.tipo, numero: f.numero, tercero_id: f.tercero_id || null, num_externo: fila(f.num_externo), fecha_emision: fila(f.fecha_emision), fecha_registro: fila(f.fecha_registro), fecha_iva: fila(f.fecha_iva || f.fecha_registro), fecha_vencimiento: fila(f.fecha_vencimiento), estado: f.estado, asiento_id: f.asiento_id || null, notas: fila(f.notas), retencion_tipo: f.tipo === "C" ? fila(f.retencion_tipo) : null, retencion_pct: f.tipo === "C" && f.retencion_tipo ? (+f.retencion_pct || 0) : 0 };
  const ldb = ls.filter(l => (l.descripcion || l.cuenta) && (+l.precio || +l.cantidad)).map((l, i) => ({ id: l.id || uid(), factura_id: f.id, empresa_id: S.emp.id, orden: i, descripcion: l.descripcion || null, cuenta: l.cuenta || null, cantidad: +l.cantidad || 0, precio: +l.precio || 0, iva: +l.iva || 0 }));
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
  validas.forEach((l, i) => { if (!S.d.cuentas.some(c => c.codigo === l.cuenta)) err.push("Línea " + (i + 1) + ": la cuenta " + (l.cuenta || "(vacía)") + " no existe."); });
  const ctrl = t ? (t.cuenta || (cli ? "430" : "400")) : "", ivaC = cli ? "477" : "472";
  [ctrl, ivaC].forEach(c => { if (t && !S.d.cuentas.some(x => x.codigo === c)) err.push("La cuenta " + c + " no existe en las cuentas principales."); });
  if (!cli && retDe(f, totalesF(validas).base) > 0 && !S.d.cuentas.some(x => x.codigo === "4751")) err.push("La cuenta 4751 (H.P. acreedora por retenciones) no existe en las cuentas principales.");
  if (err.length) return alert("No se puede registrar:\n" + err.join("\n"));
  const tot = totalesF(validas);
  await guardarFactura();
  const ap = []; const add = (cuenta, imp, lado, extra = {}) => { imp = r2(imp); if (!imp) return; const otro = lado === "debe" ? "haber" : "debe"; const l = imp > 0 ? lado : otro; ap.push({ cuenta, concepto: null, debe: 0, haber: 0, ...extra, [l]: Math.abs(imp) }); };
  const porCta = new Map(); validas.forEach(l => porCta.set(l.cuenta, r2((porCta.get(l.cuenta) || 0) + r2(l.cantidad * l.precio))));
  if (cli) { add(ctrl, tot.total, "debe", { tercero_id: t.id }); porCta.forEach((b, c) => add(c, b, "haber")); add(ivaC, tot.cuota, "haber"); }
  else { const ret = retDe(S.fact.f, tot.base); porCta.forEach((b, c) => add(c, b, "debe")); add(ivaC, tot.cuota, "debe"); add(ctrl, r2(tot.total - ret), "haber", { tercero_id: t.id }); add("4751", ret, "haber"); }
  const concepto = (cli ? "Factura de venta " : "Factura de compra ") + (cli ? f.numero : (f.num_externo || f.numero)) + " " + t.nombre;
  const aid = await db.crearAsiento(S.emp.id, f.fecha_registro, concepto, ap, "factura", f.numero);
  S.fact.f.asiento_id = aid; S.fact.f.estado = "registrado"; await guardarFactura();
  S.d = await db.cargar(S.emp.id); abrirFactura(f.id);
}

/* ---------------- Cobros y pagos pendientes (liquidación de facturas) ---------------- */
const liqsF = f => S.d.liquidaciones.filter(l => l.factura_id === f.id).sort((a, b) => a.fecha.localeCompare(b.fecha));
const pagadoF = f => r2(liqsF(f).reduce((a, l) => a + +l.importe, 0));
const retDe = (f, base) => (f.tipo === "C" && f.retencion_tipo) ? r2(base * (+f.retencion_pct || 0) / 100) : 0; // retención IRPF practicada al proveedor
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
    <label>Cuenta de tesorería<br><input id="pg-banco" list="dl" size="12" value="572"></label>
    <button class="p" data-a="guardarpago">Registrar</button><button data-a="cancelarpago">Cancelar</button></div>
    <datalist id="dl">${S.d.cuentas.map(c => `<option value="${esc(c.codigo)}">${esc(c.nombre)}</option>`).join("")}</datalist></div>` : "";
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
  const cli = f.tipo === "V", t = terPorId(f.tercero_id), ctrl = t.cuenta || (cli ? "430" : "400");
  const err = [];
  if (!fecha) err.push("Falta la fecha.");
  if (!(importe > 0)) err.push("El importe debe ser mayor que cero.");
  if (importe > pendienteF(f)) err.push("El importe supera lo pendiente (" + eur(pendienteF(f)) + ").");
  [banco, ctrl].forEach(c => { if (!S.d.cuentas.some(x => x.codigo === c)) err.push("La cuenta " + c + " no existe en las cuentas principales."); });
  if (err.length) return alert(err.join("\n"));
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
function desgloseF(f) { // base y cuota por tipo de IVA de una factura
  const m = new Map([[0, 0], [4, 0], [10, 0], [21, 0]]);
  lineasF(f).forEach(l => { const k = +l.iva || 0; m.set(k, r2((m.get(k) || 0) + r2((+l.cantidad || 0) * (+l.precio || 0)))); });
  const out = {}; let total = 0;
  m.forEach((b, k) => { const c = r2(b * k / 100); out[k] = { base: b, cuota: c }; total = r2(total + b + c); });
  return { ...out, total };
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
  const cab = ["Fecha", "Registro", "Nº factura", "NIF", "Nombre", "Base 0 %", "Base 4 %", "Cuota 4 %", "Base 10 %", "Cuota 10 %", "Base 21 %", "Cuota 21 %", "Total"];
  const tot = [0, 0, 0, 0, 0, 0, 0, 0]; // base0, b4, c4, b10, c10, b21, c21, total
  const filas = L.map(f => { const t = terPorId(f.tercero_id) || {}, d = desgloseF(f);
    const v = [d[0].base, d[4].base, d[4].cuota, d[10].base, d[10].cuota, d[21].base, d[21].cuota, d.total]; v.forEach((x, i) => { tot[i] = r2(tot[i] + x); });
    return [fechaIva(f), f.numero, cli ? f.numero : (f.num_externo || ""), t.cif || "", t.nombre || "", ...v]; });
  return { cab, filas, tot: ["", "", "", "", "Totales", ...tot] };
}
V.libroiva = () => {
  const cli = S.libroIva === "V", D = datosLibro();
  const acc = btn("exportar", "Exportar a Excel (CSV)", "", !D.filas.length);
  const fila = r => `<tr>${r.map((c, i) => i >= 5 ? `<td class="n">${sal(c)}</td>` : `<td>${esc(c)}</td>`).join("")}</tr>`;
  const baseT = r2(D.tot[5] + D.tot[6] + D.tot[8] + D.tot[10]), cuotaT = r2(D.tot[7] + D.tot[9] + D.tot[11]);
  return pagina("Libros de IVA", acc, `<div class="pagina"><div class="lista"><table><tr>${D.cab.map((c, i) => `<th class="${i >= 5 ? "n" : ""}">${c}</th>`).join("")}</tr>${D.filas.map(fila).join("") || `<tr><td colspan="13" class="vacio">No hay facturas registradas en este período.</td></tr>`}${D.filas.length ? `<tr class="tot">${D.tot.map((c, i) => i >= 5 ? `<td class="n">${eur(c)}</td>` : `<td>${esc(c)}</td>`).join("")}</tr>` : ""}</table></div>
   <aside class="factbox"><h3>Resumen ${cli ? "repercutido" : "soportado"}</h3><dl><dt>Período</dt><dd>${esc(nomPer())}</dd><dt>Facturas</dt><dd>${D.filas.length}</dd><dt>Base imponible</dt><dd>${eur(baseT)}</dd><dt>Cuota de IVA</dt><dd>${eur(cuotaT)}</dd><dt>Total</dt><dd>${eur(D.tot[12])}</dd></dl></aside></div>`,
    { tabs: ["Libro registro"], vista: cli ? "IVA repercutido (facturas emitidas)" : "IVA soportado (facturas recibidas)", filtros: `<label>Libro<select id="tl"><option value="V" ${cli ? "selected" : ""}>Repercutido (ventas)</option><option value="C" ${cli ? "" : "selected"}>Soportado (compras)</option></select></label>${selPeriodo()}` });
};

function datos303(per = S.periodo) {
  const V_ = facturasIva("V", per), C_ = facturasIva("C", per);
  const dev = { 0: 0, 4: [0, 0], 10: [0, 0], 21: [0, 0] }; let ex0 = 0;
  V_.forEach(f => { const d = desgloseF(f); ex0 = r2(ex0 + d[0].base); [4, 10, 21].forEach(k => { dev[k][0] = r2(dev[k][0] + d[k].base); dev[k][1] = r2(dev[k][1] + d[k].cuota); }); });
  let sBase = 0, sCuota = 0, c0 = 0;
  C_.forEach(f => { const d = desgloseF(f); c0 = r2(c0 + d[0].base); [4, 10, 21].forEach(k => { sBase = r2(sBase + d[k].base); sCuota = r2(sCuota + d[k].cuota); }); });
  const totDev = r2(dev[4][1] + dev[10][1] + dev[21][1]);
  return { dev, ex0, sBase, sCuota, c0, totDev, resultado: r2(totDev - sCuota), nV: V_.length, nC: C_.length };
}
V.m303 = () => {
  const D = datos303(), c = (cas, txt, v, extra = "") => `<tr><td style="width:4rem"><b>${cas}</b></td><td>${txt}</td><td class="n">${extra}</td><td class="n">${eur(v)}</td></tr>`;
  const acc = btn("exportar", "Exportar a Excel (CSV)");
  return pagina("Modelo 303", acc, `<div class="lista"><p class="aviso">Cálculo orientativo a partir de las facturas registradas (régimen general, por fecha de IVA). No sustituye a la presentación en la AEAT: no incluye inversión del sujeto pasivo, adquisiciones intracomunitarias, importaciones ni prorrata.</p>
  <h3>IVA devengado</h3><table><tr><th>Casilla</th><th>Concepto</th><th class="n">Base / tipo</th><th class="n">Importe</th></tr>
  ${c("01 · 03", "Régimen general 4 %: base imponible y cuota", D.dev[4][1], eur(D.dev[4][0]))}${c("04 · 06", "Régimen general 10 %: base imponible y cuota", D.dev[10][1], eur(D.dev[10][0]))}${c("07 · 09", "Régimen general 21 %: base imponible y cuota", D.dev[21][1], eur(D.dev[21][0]))}
  <tr class="tot"><td>27</td><td>Total cuota devengada</td><td></td><td class="n">${eur(D.totDev)}</td></tr></table>
  <h3 style="margin-top:1.2rem">IVA deducible</h3><table><tr><th>Casilla</th><th>Concepto</th><th class="n">Base</th><th class="n">Cuota</th></tr>
  <tr><td><b>28 · 29</b></td><td>Cuotas soportadas en operaciones interiores corrientes</td><td class="n">${eur(D.sBase)}</td><td class="n">${eur(D.sCuota)}</td></tr>
  <tr class="tot"><td>45</td><td>Total a deducir</td><td></td><td class="n">${eur(D.sCuota)}</td></tr></table>
  <h3 style="margin-top:1.2rem">Resultado</h3><table><tr class="tot"><td style="width:4rem">46</td><td>Diferencia (27 − 45)</td><td class="n">${eur(D.resultado)}</td></tr></table>
  <p class="${D.resultado > 0 ? "ko" : "ok"}">${D.resultado > 0 ? "A ingresar" : D.resultado < 0 ? "A compensar o devolver" : "Sin resultado"}: ${eur(Math.abs(D.resultado))} €</p>
  <p style="color:var(--tx2)">Operaciones a tipo 0 %/exentas: ventas ${eur(D.ex0)} € · compras ${eur(D.c0)} € (informativo). Facturas incluidas: ${D.nV} emitidas y ${D.nC} recibidas.</p></div>`,
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
    ["Total cuota devengada", d => d.totDev], ["Base deducible (operaciones interiores corrientes)", d => d.sBase], ["Cuota deducible", d => d.sCuota], ["Resultado (devengado − deducible)", d => d.resultado]];
  const volumen = suma(d => d.dev[4][0] + d.dev[10][0] + d.dev[21][0] + d.ex0), compras = suma(d => d.sBase + d.c0);
  return { T, filas: filas.map(([n, f]) => [n, ...T.map(f), suma(f)]), volumen, compras };
}
V.m390 = () => {
  const D = datos390(), tot = new Set(["Total cuota devengada", "Resultado (devengado − deducible)"]);
  return pagina("Modelo 390", btn("exportar", "Exportar a Excel (CSV)"), `<div class="lista"><p class="aviso">Resumen anual orientativo calculado con las facturas registradas de cada trimestre. No sustituye a la presentación en la AEAT ni incluye inversión del sujeto pasivo, intracomunitarias, importaciones, prorrata ni regularizaciones.</p>
  <table><tr><th>Concepto</th><th class="n">1T</th><th class="n">2T</th><th class="n">3T</th><th class="n">4T</th><th class="n">Año ${S.ej}</th></tr>
  ${D.filas.map(r => `<tr class="${tot.has(r[0]) ? "tot" : ""}"><td>${r[0]}</td>${r.slice(1).map(x => `<td class="n">${sal(x)}</td>`).join("")}</tr>`).join("")}</table>
  <p style="color:var(--tx2)">Volumen de operaciones (ventas, base): ${eur(D.volumen)} € · Compras y gastos (base): ${eur(D.compras)} €</p></div>`, { tabs: ["Resumen anual"], vista: "Ejercicio " + S.ej });
};

/* Modelo 349: operaciones intracomunitarias (terceros con grupo de impuestos UE) */
function datos349(per = S.periodo) {
  const m = new Map();
  [["V", "E"], ["C", "A"]].forEach(([tp, clave]) => facturasIva(tp, per).filter(f => (terPorId(f.tercero_id) || {}).grupo_iva === "UE").forEach(f => {
    const k = clave + "|" + f.tercero_id, o = m.get(k) || { clave, t: terPorId(f.tercero_id) || {}, base: 0 }; o.base = r2(o.base + totalesF(lineasF(f)).base); m.set(k, o); }));
  const filas = [...m.values()].sort((a, b) => a.clave.localeCompare(b.clave) || (a.t.nombre || "").localeCompare(b.t.nombre || ""));
  return { filas, E: r2(filas.filter(o => o.clave === "E").reduce((a, o) => a + o.base, 0)), A: r2(filas.filter(o => o.clave === "A").reduce((a, o) => a + o.base, 0)) };
}
V.m349 = () => {
  const D = datos349();
  return pagina("Modelo 349", btn("exportar", "Exportar a Excel (CSV)", "", !D.filas.length), `<div class="lista"><p class="aviso">Operaciones con terceros marcados con grupo de impuestos UE: clientes = entregas (clave E) y proveedores = adquisiciones (clave A). No distingue prestaciones de servicios (S/I), triangulares ni rectificaciones, y el NIF-IVA es el NIF del tercero. No sustituye a la presentación en la AEAT.</p>
  <table><tr><th>Clave</th><th>NIF-IVA</th><th>Nombre</th><th class="n">Base imponible</th></tr>
  ${D.filas.map(o => `<tr><td>${o.clave}</td><td>${esc(o.t.cif || "")}</td><td>${esc(o.t.nombre || "")}</td><td class="n">${eur(o.base)}</td></tr>`).join("") || `<tr><td colspan="4" class="vacio">No hay operaciones intracomunitarias en este período.</td></tr>`}
  ${D.filas.length ? `<tr class="tot"><td colspan="3">Total entregas (E)</td><td class="n">${eur(D.E)}</td></tr><tr class="tot"><td colspan="3">Total adquisiciones (A)</td><td class="n">${eur(D.A)}</td></tr>` : ""}</table></div>`, { tabs: ["Declaración recapitulativa"], vista: nomPer(), filtros: selPeriodo() });
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
  <h3 style="margin-top:1.2rem">Liquidación</h3><table>${casilla("28", "Total liquidación (03 + 09)", tot)}<tr class="tot"><td>30</td><td>Resultado a ingresar</td><td class="n">${eur(tot)}</td></tr></table>${detalleRet(D)}</div>`, { tabs: ["Autoliquidación"], vista: nomPer(), filtros: selPeriodo() });
};
V.m115 = () => {
  const D = datosRet("115");
  return pagina("Modelo 115", btn("exportar", "Exportar a Excel (CSV)"), `<div class="lista"><p class="aviso">Retenciones por arrendamiento de inmuebles urbanos: salen de las facturas de proveedor registradas con retención 115 (por fecha de IVA). Orientativo; no sustituye a la presentación en la AEAT.</p>
  <table>${casilla("01", "Nº de perceptores", D.n, true)}${casilla("02", "Base de las retenciones e ingresos a cuenta", D.base)}${casilla("03", "Retenciones e ingresos a cuenta", D.ret)}${casilla("04", "A deducir (declaraciones anteriores)", 0)}<tr class="tot"><td>05</td><td>Resultado a ingresar</td><td class="n">${eur(D.ret)}</td></tr></table>${detalleRet(D)}</div>`, { tabs: ["Autoliquidación"], vista: nomPer(), filtros: selPeriodo() });
};
V.m123 = () => {
  const D = datosRet("123");
  return pagina("Modelo 123", btn("exportar", "Exportar a Excel (CSV)"), `<div class="lista"><p class="aviso">Retenciones sobre rendimientos del capital mobiliario (dividendos, intereses…): salen de las facturas de proveedor registradas con retención 123 (por fecha de IVA). Orientativo; no sustituye a la presentación en la AEAT.</p>
  <table>${casilla("01", "Nº de perceptores", D.n, true)}${casilla("02", "Importe de las percepciones", D.base)}${casilla("03", "Importe de las retenciones e ingresos a cuenta", D.ret)}<tr class="tot"><td>10</td><td>Resultado a ingresar</td><td class="n">${eur(D.ret)}</td></tr></table>${detalleRet(D)}</div>`, { tabs: ["Autoliquidación"], vista: nomPer(), filtros: selPeriodo() });
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
  else if (S.vista === "m303") { const D = datos303(); descargarCSV(base + "modelo303_" + S.periodo + "_" + S.ej + ".csv", [["Casilla", "Concepto", "Base", "Importe"], ["01/03", "Devengado 4 %", nCSV(D.dev[4][0]), nCSV(D.dev[4][1])], ["04/06", "Devengado 10 %", nCSV(D.dev[10][0]), nCSV(D.dev[10][1])], ["07/09", "Devengado 21 %", nCSV(D.dev[21][0]), nCSV(D.dev[21][1])], ["27", "Total cuota devengada", "", nCSV(D.totDev)], ["28/29", "Deducible operaciones interiores corrientes", nCSV(D.sBase), nCSV(D.sCuota)], ["45", "Total a deducir", "", nCSV(D.sCuota)], ["46", "Diferencia", "", nCSV(D.resultado)]]); }
  else if (S.vista === "m347") { const D = datos347(), f = (t, L) => L.map(o => [t, o.t.cif || "", o.t.nombre || "", ...o.q.map(nCSV), nCSV(o.total)]); descargarCSV(base + "modelo347_" + S.ej + ".csv", [["Tipo", "NIF", "Nombre", "1T", "2T", "3T", "4T", "Total"], ...f("Cliente", D.cli), ...f("Proveedor", D.pro)]); }
}

/* ---------------- Render y eventos ---------------- */
function render() {
  if (!S.empresas.length && !S.emp) return renderEmpresaNueva();
  const years = [...new Set([new Date().getFullYear(), S.ej, ...S.d.asientos.map(a => a.ejercicio)])].sort();
  const nav = `<nav class="fo-nav"><a data-a="vista" data-v="inicio" class="${S.vista === "inicio" ? "on" : ""}">Inicio</a>${NAV.map(([g, it]) => `<div class="g">${g}</div>${it.map(([k, n]) => `<a data-a="vista" data-v="${k}" class="${S.vista === k ? "on" : ""}">${n}</a>`).join("")}`).join("")}</nav>`;
  $app.innerHTML = `<div class="fo-top"><button data-a="nav" title="Menú">☰</button><b>Contabilidad</b>
   <div class="busca"><input id="busca" list="paginas" placeholder="Buscar una página"><datalist id="paginas">${Object.values(NOMBRES).map(n => `<option value="${n}">`).join("")}</datalist></div>
   <select id="emp">${S.empresas.map(e => `<option value="${e.id}" ${e.id === S.emp.id ? "selected" : ""}>${esc(e.nombre)}</option>`).join("")}</select>
   <button data-a="nuevaemp" title="Nueva empresa">+</button>
   <span class="ej">Ejercicio <select id="ej">${years.map(y => `<option ${y === S.ej ? "selected" : ""}>${y}</option>`).join("")}</select></span>
   ${sb ? `<button data-a="salir">Salir</button>` : ""}<span class="av">PO</span></div>
   <div class="fo-body">${S.nav ? nav : `<div class="fo-rail"><button data-a="nav" title="Menú">☰</button><button data-a="vista" data-v="inicio" title="Inicio">⌂</button></div>`}
   <div class="fo-page">${LOCAL ? `<p class="aviso">Modo local de pruebas: los datos están solo en este navegador.</p>` : ""}${V[S.vista]()}</div></div>`;
}
function renderEmpresaNueva() {
  $app.innerHTML = `<div class="login card"><h2>Nueva empresa</h2><input id="en" placeholder="Nombre"><input id="ecif" placeholder="CIF"><button class="p" data-a="crearemp">Crear</button></div>`;
}
function renderLogin(msg = "") {
  $app.innerHTML = `<div class="login card"><h2>Contabilidad</h2><input id="lu" type="email" placeholder="Email"><input id="lp" type="password" placeholder="Contraseña"><button class="p" data-a="login">Entrar</button><p class="ko">${esc(msg)}</p></div>`;
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
    const i = CAMPOS_J.indexOf(t.dataset.k); const sig = i < CAMPOS_J.length - 1 ? [t.dataset.j, CAMPOS_J[i + 1]] : [String(+t.dataset.j + 1), "fecha"];
    const el = document.querySelector(`[data-j="${sig[0]}"][data-k="${sig[1]}"]`); if (el) el.focus(); else t.blur();
  }
});
document.addEventListener("change", async e => {
  const t = e.target;
  try {
    if (t.id === "emp") { S.emp = S.empresas.find(x => x.id === t.value); S.libro = null; await recargar(); }
    else if (t.id === "ej") { S.ej = +t.value; render(); }
    else if (t.id === "cm") { S.filtroCta = t.value; render(); }
    else if (t.id === "fp") { S.filtroPend = t.value; render(); }
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
        else { F.tercero_id = x ? x.id : null; if (x) S.fact.ls.forEach(l => { if (!l.tocado && !(+l.precio)) l.iva = ivaDefecto(x); }); }
        render();
      } else if (k === "retencion_tipo") { F.retencion_tipo = t.value; F.retencion_pct = t.value === "111" ? 15 : t.value ? 19 : 0; render(); }
      else if (k === "retencion_pct") { F.retencion_pct = +num(t.value) || 0; refrescaF(); }
      else { F[k] = t.value; if (k === "fecha_registro") F.fecha_iva = t.value; }
    }
    else if (t.dataset.fl !== undefined) {
      const l = S.fact.ls[+t.dataset.fl], k = t.dataset.k;
      l[k] = (k === "cantidad" || k === "precio") ? (+num(t.value) || 0) : k === "iva" ? +t.value : t.value; if (k === "iva") l.tocado = true; refrescaF();
    }
    else if (t.dataset.j !== undefined) {
      const ls = lineasLibro(), i = +t.dataset.j, k = t.dataset.k; let l = ls[i], nueva = false;
      const v = (k === "debe" || k === "haber") ? num(t.value) : t.value;
      if (!l) { // línea en blanco: se crea al escribir
        nueva = true; l = { id: uid(), empresa_id: S.emp.id, libro: S.libro, fecha: ls[ls.length - 1]?.fecha || hoy(), documento: ls[ls.length - 1]?.documento || siguienteDoc(), descripcion: ls[ls.length - 1]?.descripcion || "", cuenta: "", debe: 0, haber: 0, orden: Date.now() };
        S.d.lineas.push(l);
      }
      if (k === "tercero") { const x = v.trim() ? terPorCod(v) : null; if (v.trim() && !x) { alert("No existe la cuenta de cliente/proveedor " + v); t.value = ""; } l.tercero_id = x ? x.id : null; }
      else l[k] = (k === "debe" || k === "haber") ? (v === "" ? 0 : r2(v)) : v;
      if (k === "debe" && +l.debe) l.haber = 0; if (k === "haber" && +l.haber) l.debe = 0;
      await db.guardarLinea(l);
      if (nueva || k === "debe" || k === "haber") { const sig = CAMPOS_J[CAMPOS_J.indexOf(k) + 1] || "fecha"; const j = i; render(); setTimeout(() => { const el = document.querySelector(`[data-j="${j}"][data-k="${sig}"]`); if (el && document.activeElement === document.body) el.focus(); }, 0); }
      else refrescaJ();
    }
  } catch (err) { alert(err.message); }
});
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-a]"); if (!b || b.disabled) return;
  const a = b.dataset.a;
  try {
    if (a === "vista") { S.vista = b.dataset.v; if (S.vista !== "diario") S.libro = null; S.fact = null; S.terEdit = null; if (S.vista !== "mayor") S.filtroTer = ""; render(); }
    else if (a === "nav") { S.nav = !S.nav; render(); }
    else if (a === "nuevaemp") { S.emp = null; $app.innerHTML = ""; renderEmpresaNueva(); }
    else if (a === "crearemp") { const e2 = await db.crearEmpresa(document.getElementById("en").value.trim(), document.getElementById("ecif").value.trim()); S.empresas = await db.empresas(); S.emp = S.empresas.find(x => x.id === e2.id); await db.crearCuentas(S.emp.id, PGC); await recargar(); }
    else if (a === "selcuenta") { S.sel = b.dataset.id; render(); }
    else if (a === "togglenueva") { S.nueva = !S.nueva; render(); }
    else if (a === "delcuentasel") { const c = S.d.cuentas.find(x => x.id === S.sel); if (!c) return; if (S.d.apuntes.some(p => p.cuenta === c.codigo)) alert("La cuenta tiene transacciones y no se puede eliminar."); else if (confirm("¿Eliminar la cuenta " + c.codigo + "?")) { await db.borrarCuenta(c.id); S.sel = null; await recargar(); } }
    else if (a === "vermayor") { const c = S.d.cuentas.find(x => x.id === S.sel); if (c) { S.filtroCta = c.codigo; S.vista = "mayor"; render(); } }
    else if (a === "addcuenta") { const c = document.getElementById("cc").value.trim(), n = document.getElementById("cn").value.trim(); if (c && n) { await db.crearCuentas(S.emp.id, [[c, n]]); S.nueva = false; await recargar(); } }
    else if (a === "pgc") { await db.crearCuentas(S.emp.id, PGC); await recargar(); }
    /* lotes de diario */
    else if (a === "nuevolote") { const nombre = (prompt("Nombre del diario:", "GENERAL") || "").trim().toUpperCase(); if (!nombre) return; const desc = (prompt("Descripción:") || "").trim(); const l = { id: uid(), empresa_id: S.emp.id, numero: siguienteLote(), nombre, descripcion: desc }; await db.guardarLibro(l); S.selLote = l.numero; await recargar(); }
    else if (a === "sellote") { S.selLote = b.dataset.id; render(); }
    else if (a === "abrirlote") { e.stopPropagation(); const n = b.dataset.id || S.selLote; if (n) { S.libro = n; S.selLote = n; render(); } }
    else if (a === "volverlotes") { S.libro = null; render(); }
    else if (a === "dellote") {
      const x = lotes().find(y => y.numero === S.selLote); if (!x) return;
      if (!confirm("¿Eliminar el lote " + x.numero + " y todas sus líneas sin registrar?")) return;
      await db.borrarLineas(S.emp.id, x.numero); if (x.id) await db.borrarLibro(x.id); S.selLote = null; await recargar();
    }
    else if (a === "nuevodoc") { const ls = lineasLibro(), l = { id: uid(), empresa_id: S.emp.id, libro: S.libro, fecha: ls[ls.length - 1]?.fecha || hoy(), documento: siguienteDoc(), descripcion: "", cuenta: "", debe: 0, haber: 0, orden: Date.now() }; S.d.lineas.push(l); await db.guardarLinea(l); render(); }
    else if (a === "dellineaj") { await db.borrarLinea(b.dataset.id); S.d.lineas = S.d.lineas.filter(l => l.id !== b.dataset.id); render(); }
    else if (a === "validar") { const p = comprobar(lineasLibro()); alert(p.length ? "Se encontraron " + p.length + " línea(s) con errores:\n" + p.slice(0, 8).map(x => "Línea " + (x.i + 1) + ": " + x.texto).join("\n") : "La validación del diario terminó sin errores."); }
    else if (a === "registrar") {
      const ls = lineasLibro(); if (!ls.length) return alert("No hay líneas que registrar.");
      const prob = comprobar(ls); if (prob.length) return alert("No se puede registrar. Hay " + prob.length + " línea(s) con errores:\n" + prob.slice(0, 6).map(p => "Línea " + (p.i + 1) + ": " + p.texto).join("\n"));
      if (!confirm("¿Registrar " + ls.length + " líneas del lote " + S.libro + "?")) return;
      const grupos = new Map(); ls.forEach(l => { (grupos.get(l.documento) || grupos.set(l.documento, []).get(l.documento)).push(l); });
      for (const [doc, g] of grupos) {
        const fecha = g.map(x => x.fecha).sort()[0];
        await db.crearAsiento(S.emp.id, fecha, g.find(x => x.descripcion)?.descripcion || doc, g.map(x => ({ cuenta: x.cuenta.trim(), concepto: x.descripcion || null, debe: r2(x.debe), haber: r2(x.haber), ...(x.tercero_id ? { tercero_id: x.tercero_id } : {}) })), "diario:" + S.libro, doc);
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
      const falta = ap.find(x => !S.d.cuentas.some(c => c.codigo === x.cuenta));
      if (falta) return alert("La cuenta " + falta.cuenta + " no existe en las cuentas principales.");
      if (!S.conceptoAs.trim()) return alert("Falta la descripción.");
      await db.modificarAsiento(S.edit.id, S.fechaAs, S.conceptoAs.trim(), S.docAs.trim() || null, ap);
      S.lineas = null; S.edit = null; await recargar();
    }
    else if (a === "delasiento") { const as = S.d.asientos.find(x => x.id === S.selAs); if (as && confirm("¿Eliminar el asiento " + as.numero + " (" + as.concepto + ")? No se puede deshacer.")) { await db.borrarAsiento(as.id); S.selAs = null; await recargar(); } }
    /* clientes y proveedores */
    else if (a === "exportar") { exportarActual(); }
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
    else if (a === "nuevoter") { const tp = b.dataset.t; S.terEdit = { id: uid(), tipo: tp, codigo: siguienteTer(tp), nombre: "", cif: "", grupo_iva: "NAC", telefono: "", email: "", cuenta: "" }; render(); }
    else if (a === "editter") { const t = terPorId(b.dataset.id || S.selTer); if (t) { S.terEdit = { ...t }; S.selTer = t.id; render(); } }
    else if (a === "cancelter") { S.terEdit = null; render(); }
    else if (a === "guardarter") {
      const e2 = S.terEdit, v = id => document.getElementById(id).value.trim();
      const t = { id: e2.id, empresa_id: S.emp.id, tipo: e2.tipo, codigo: v("te-codigo"), nombre: v("te-nombre"), cif: v("te-cif") || null, grupo_iva: v("te-grupo"), telefono: v("te-tel") || null, email: v("te-email") || null, cuenta: v("te-cuenta") || null };
      if (!t.codigo || !t.nombre) return alert("Faltan la cuenta y el nombre.");
      if (t.cuenta && !S.d.cuentas.some(c => c.codigo === t.cuenta)) return alert("La cuenta contable " + t.cuenta + " no existe.");
      if (S.d.terceros.some(x => x.id !== t.id && x.codigo.toLowerCase() === t.codigo.toLowerCase())) return alert("Ya existe esa cuenta de cliente/proveedor.");
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
      const f = { id: uid(), empresa_id: S.emp.id, tipo: tp, numero: siguienteFact(tp), tercero_id: pre || null, num_externo: "", fecha_emision: hoy(), fecha_registro: hoy(), fecha_iva: hoy(), fecha_vencimiento: "", estado: "abierto", asiento_id: null, notas: "", retencion_tipo: "", retencion_pct: 0 };
      S.vista = tp === "V" ? "fventa" : "fcompra"; S.fact = { f, ls: [nuevaLineaF(f)] }; render();
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
  S.emp = S.empresas[0]; await recargar();
}
arrancar();

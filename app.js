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
  const g = () => { const d = JSON.parse(localStorage.getItem(K) || "{}"); for (const k of ["empresas", "cuentas", "asientos", "apuntes", "lineas", "terceros", "facturas", "flineas", "libros"]) d[k] ||= []; return d; };
  const s = d => localStorage.setItem(K, JSON.stringify(d));
  db = {
    async empresas() { return g().empresas; },
    async crearEmpresa(nombre, cif) { const d = g(); const e = { id: uid(), nombre, cif }; d.empresas.push(e); s(d); return e; },
    async cargar(eid) { const d = g(), f = x => x.empresa_id === eid; return { cuentas: d.cuentas.filter(f), asientos: d.asientos.filter(f), apuntes: d.apuntes.filter(f), lineas: d.lineas.filter(f), terceros: d.terceros.filter(f), facturas: d.facturas.filter(f), flineas: d.flineas.filter(f), libros: d.libros.filter(f) }; },
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
    async borrarAsiento(id) { const d = g(); d.asientos = d.asientos.filter(a => a.id !== id); d.apuntes = d.apuntes.filter(a => a.asiento_id !== id); s(d); },
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
    async cargar(eid) { const [cuentas, asientos, apuntes, lineas, terceros, facturas, flineas, libros] = await Promise.all(["cuentas", "asientos", "apuntes", "diario_lineas", "terceros", "facturas", "factura_lineas", "diario_libros"].map(t => todo(t, eid))); return { cuentas, asientos, apuntes, lineas, terceros, facturas, flineas, libros }; },
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
const S = { empresas: [], emp: null, vista: "inicio", sel: null, nueva: false, selAs: null, filtroCta: "", libro: null, selLote: null, nav: false, edit: null,
  d: { cuentas: [], asientos: [], apuntes: [], lineas: [], libros: [], terceros: [], facturas: [], flineas: [] }, ej: new Date().getFullYear(), lineas: null, fechaAs: "", conceptoAs: "", docAs: "" };
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
  ["Libro mayor", [["cuentas", "Cuentas principales"], ["diario", "Diarios generales"], ["mayor", "Transacciones del libro mayor"], ["sumas", "Balance de comprobación"], ["estados", "Estados financieros"]]]
];
const NOMBRES = { inicio: "Inicio", cuentas: "Cuentas principales", diario: "Diarios generales", mayor: "Transacciones del libro mayor", sumas: "Balance de comprobación", estados: "Estados financieros" };

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
   ${mos("Descuadre global", eur(desc), desc ? "rojo" : "gris", "sumas")}</div>
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
const CAMPOS_J = ["fecha", "documento", "cuenta", "descripcion", "debe", "haber"];
function filaJ(l, i, prob) {
  const nuevo = !l.id;
  const inp = (k, ex = "") => `<input data-j="${i}" data-k="${k}" ${ex} value="${esc(l[k] ?? "")}">`;
  return `<tr class="${prob ? "prob" : ""}"><td>${inp("fecha", 'type="date"')}</td><td>${inp("documento", 'size="10"')}</td>
   <td>${inp("cuenta", 'list="dl" size="10"')}</td><td class="nc" data-nc="${i}">${esc(nombreCuenta(l.cuenta))}</td><td>${inp("descripcion", 'size="30"')}</td>
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
  <div class="pagina"><div class="lista"><table class="editable"><tr><th>Fecha</th><th>Comprobante</th><th>Cuenta</th><th>Nombre de la cuenta</th><th>Descripción</th><th class="n">Débito</th><th class="n">Crédito</th><th></th></tr>
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
  const rows = apuntesEj().filter(p => !f || p.cuenta === f).sort((a, b) => a.a.fecha.localeCompare(b.a.fecha) || a.a.numero - b.a.numero);
  const sel = S.d.asientos.find(a => a.id === S.selAs);
  const lsel = sel ? S.d.apuntes.filter(p => p.asiento_id === sel.id) : [];
  const filas = rows.map(p => { if (f) acc = r2(acc + +p.debe - +p.haber);
    return `<tr data-sel data-a="selas" data-id="${p.a.id}" class="${p.a.id === S.selAs ? "sel" : ""}"><td>${p.a.fecha}</td><td>${esc(p.a.documento || "")}</td><td>${p.a.numero}</td><td>${esc(p.cuenta)}</td><td>${esc(nombreCuenta(p.cuenta))}</td><td>${esc(p.concepto || p.a.concepto)}</td><td class="n">${+p.debe ? eur(p.debe) : ""}</td><td class="n">${+p.haber ? eur(p.haber) : ""}</td><td class="n">${f ? eur(acc) : ""}</td></tr>`; }).join("");
  const acciones = btn("modasiento", "Modificar asiento", "", !sel) + btn("delasiento", "Eliminar asiento", "", !sel);
  return pagina("Transacciones del libro mayor", acciones, `
  ${S.edit ? `<div class="card"><b>Modificar asiento ${S.edit.numero}</b>${formAsiento()}</div>` : ""}
  <div class="pagina"><div class="lista"><table><tr><th>Fecha</th><th>Comprobante</th><th>Asiento</th><th>Cuenta</th><th>Nombre de la cuenta</th><th>Descripción</th><th class="n">Débito</th><th class="n">Crédito</th><th class="n">Saldo</th></tr>${filas || `<tr><td colspan="9" class="vacio">No se encontró ningún elemento que mostrar aquí.</td></tr>`}</table></div>
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
    else if (t.id === "busca") { const k = Object.keys(NOMBRES).find(x => NOMBRES[x].toLowerCase() === t.value.trim().toLowerCase()); if (k) { S.vista = k; render(); } }
    else if (t.dataset.l !== undefined) { leerForm(); render(); }
    else if (t.dataset.j !== undefined) {
      const ls = lineasLibro(), i = +t.dataset.j, k = t.dataset.k; let l = ls[i], nueva = false;
      const v = (k === "debe" || k === "haber") ? num(t.value) : t.value;
      if (!l) { // línea en blanco: se crea al escribir
        nueva = true; l = { id: uid(), empresa_id: S.emp.id, libro: S.libro, fecha: ls[ls.length - 1]?.fecha || hoy(), documento: ls[ls.length - 1]?.documento || siguienteDoc(), descripcion: ls[ls.length - 1]?.descripcion || "", cuenta: "", debe: 0, haber: 0, orden: Date.now() };
        S.d.lineas.push(l);
      }
      l[k] = (k === "debe" || k === "haber") ? (v === "" ? 0 : r2(v)) : v;
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
    if (a === "vista") { S.vista = b.dataset.v; if (S.vista !== "diario") S.libro = null; render(); }
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

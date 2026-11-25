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
  const g = () => JSON.parse(localStorage.getItem(K) || '{"empresas":[],"cuentas":[],"asientos":[],"apuntes":[],"lineas":[]}');
  const s = d => localStorage.setItem(K, JSON.stringify(d));
  db = {
    async empresas() { return g().empresas; },
    async crearEmpresa(nombre, cif) { const d = g(); const e = { id: uid(), nombre, cif }; d.empresas.push(e); s(d); return e; },
    async cargar(eid) { const d = g(), f = x => x.empresa_id === eid; return { cuentas: d.cuentas.filter(f), asientos: d.asientos.filter(f), apuntes: d.apuntes.filter(f), lineas: d.lineas.filter(f) }; },
    async crearCuentas(eid, lista) { const d = g(); for (const [codigo, nombre] of lista) if (!d.cuentas.some(c => c.empresa_id === eid && c.codigo === codigo)) d.cuentas.push({ id: uid(), empresa_id: eid, codigo, nombre }); s(d); },
    async borrarCuenta(id) { const d = g(); d.cuentas = d.cuentas.filter(c => c.id !== id); s(d); },
    async crearAsiento(eid, fecha, concepto, apuntes, origen = "manual", documento = null) {
      const d = g(); const ej = +fecha.slice(0, 4);
      const num = Math.max(0, ...d.asientos.filter(a => a.empresa_id === eid && a.ejercicio === ej).map(a => a.numero)) + 1;
      const id = uid(); d.asientos.push({ id, empresa_id: eid, ejercicio: ej, numero: num, fecha, concepto, origen, documento });
      apuntes.forEach(a => d.apuntes.push({ id: uid(), asiento_id: id, empresa_id: eid, ...a })); s(d);
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
    async cargar(eid) { const [cuentas, asientos, apuntes, lineas] = await Promise.all([todo("cuentas", eid), todo("asientos", eid), todo("apuntes", eid), todo("diario_lineas", eid)]); return { cuentas, asientos, apuntes, lineas }; },
    async crearCuentas(eid, lista) { ok(await sb.from("cuentas").upsert(lista.map(([codigo, nombre]) => ({ empresa_id: eid, codigo, nombre })), { onConflict: "empresa_id,codigo", ignoreDuplicates: true })); },
    async borrarCuenta(id) { ok(await sb.from("cuentas").delete().eq("id", id)); },
    async crearAsiento(eid, fecha, concepto, apuntes, origen = "manual", documento = null) { ok(await sb.rpc("crear_asiento", { p_empresa: eid, p_fecha: fecha, p_concepto: concepto, p_origen: origen, p_apuntes: apuntes, p_documento: documento })); },
    async modificarAsiento(id, fecha, concepto, documento, apuntes) { ok(await sb.rpc("modificar_asiento", { p_asiento: id, p_fecha: fecha, p_concepto: concepto, p_documento: documento, p_apuntes: apuntes })); },
    async borrarAsiento(id) { ok(await sb.from("asientos").delete().eq("id", id)); },
    async guardarLinea(l) { ok(await sb.from("diario_lineas").upsert(l)); },
    async borrarLinea(id) { ok(await sb.from("diario_lineas").delete().eq("id", id)); },
    async borrarLineas(eid, libro) { ok(await sb.from("diario_lineas").delete().eq("empresa_id", eid).eq("libro", libro)); }
  };
}

/* ---------------- Estado ---------------- */
const S = { empresas: [], emp: null, vista: "inicio", sel: null, nueva: false, selAs: null, filtroCta: "", libro: "GENERAL", edit: null,
  d: { cuentas: [], asientos: [], apuntes: [], lineas: [] }, ej: new Date().getFullYear(), lineas: null, fechaAs: "", conceptoAs: "", docAs: "" };
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
const libros = () => [...new Set(["GENERAL", S.libro, ...S.d.lineas.map(l => l.libro)])].sort();
const lineasLibro = () => S.d.lineas.filter(l => l.libro === S.libro).sort((a, b) => (+a.orden || 0) - (+b.orden || 0));
function comprobar(ls) {
  const porDoc = new Map(); ls.forEach(l => { const o = porDoc.get(l.documento) || 0; porDoc.set(l.documento, r2(o + (+l.debe || 0) - (+l.haber || 0))); });
  const prob = [];
  ls.forEach((l, i) => {
    const p = [];
    if (!l.cuenta || !S.d.cuentas.some(c => c.codigo === l.cuenta)) p.push("cuenta inexistente");
    if (!(+l.debe || +l.haber)) p.push("sin importe");
    if (!l.fecha) p.push("sin fecha");
    if (!l.documento) p.push("sin nº de documento");
    else if (porDoc.get(l.documento) !== 0) p.push("el documento " + l.documento + " no cuadra (" + eur(porDoc.get(l.documento)) + ")");
    if (p.length) prob.push({ i, id: l.id, texto: p.join(", ") });
  });
  return prob;
}

/* ---------------- Vistas ---------------- */
const V = {};
const CATEG = { 1: "Pasivo / PN", 2: "Activo", 3: "Activo", 4: "Mixta", 5: "Mixta", 6: "Gastos", 7: "Ingresos" };

V.inicio = () => {
  const tot = pref => saldoPref(pref, true);
  const bancos = tot("57"), desc = r2(S.d.apuntes.reduce((a, p) => a + +p.debe - +p.haber, 0));
  const res = r2(-(tot("6") + tot("7")));
  const mos = (t, v, k = "", vista = "") => `<button class="mos ${k}" data-a="vista" data-v="${vista}"><span>${t}</span><b>${v}</b></button>`;
  return `<h2>Inicio</h2>
  <div class="kpi"><div><small>Resultado del ejercicio ${S.ej}</small><b>${eur(res)} €</b></div><div><small>Caja y bancos</small><b>${eur(bancos)} €</b></div><div><small>Ingresos del ejercicio</small><b>${eur(-tot("7"))} €</b></div></div>
  <div class="sec">Actividades</div>
  <div class="mosaicos">${mos("Líneas de diario sin registrar", S.d.lineas.length, S.d.lineas.length ? "rojo" : "", "diario")}${mos("Asientos del ejercicio", S.d.asientos.filter(a => a.ejercicio === S.ej).length, "", "mayor")}${mos("Cuentas en el plan", S.d.cuentas.length, "", "cuentas")}
   ${mos("Descuadre global", eur(desc), desc ? "rojo" : "gris", "sumas")}</div>
  <div class="sec">Acciones</div>
  <div class="atajos"><a data-a="vista" data-v="diario">+ Diario general</a><a data-a="vista" data-v="cuentas">+ Nueva cuenta</a><a data-a="vista" data-v="mayor">Buscar movimientos</a><a data-a="vista" data-v="estados">Informes</a></div>`;
};

V.cuentas = () => {
  const lista = [...S.d.cuentas].sort((a, b) => a.codigo.localeCompare(b.codigo));
  const sel = S.d.cuentas.find(c => c.id === S.sel);
  const nivel = c => c.length <= 2 ? 0 : c.length === 3 ? 1 : c.length === 4 ? 2 : 3;
  const filas = lista.map(c => `<tr data-sel class="${c.codigo.length <= 4 ? "tit" : ""} ${c.id === S.sel ? "sel" : ""}" data-a="selcuenta" data-id="${c.id}"><td style="padding-left:${.5 + nivel(c.codigo) * 1.1}rem">${esc(c.codigo)}</td><td>${esc(c.nombre)}</td><td class="n">${sal(saldoPref(c.codigo, true))}</td><td class="n">${sal(saldoPref(c.codigo, false))}</td><td>${CATEG[c.codigo[0]] || ""}</td></tr>`).join("");
  const mov = sel ? S.d.apuntes.filter(p => p.cuenta === sel.codigo).length : 0;
  return `<div class="cmd"><span class="t">Plan de cuentas</span>
    <button class="p" data-a="togglenueva">+ Nuevo</button><button data-a="delcuentasel" ${sel ? "" : "disabled"}>Eliminar</button><button data-a="pgc">Cargar plan básico PGC</button>
    ${sel ? `<button data-a="vermayor">Movimientos</button>` : ""}</div>
  ${S.nueva ? `<div class="card"><div class="row"><input id="cc" placeholder="Nº" size="9"><input id="cn" placeholder="Nombre" size="40"><button class="p" data-a="addcuenta">Aceptar</button><button data-a="togglenueva">Cancelar</button></div></div>` : ""}
  <div class="pagina"><div class="lista"><table><tr><th>Nº</th><th>Nombre</th><th class="n">Saldo periodo</th><th class="n">Saldo</th><th>Categoría de cuenta</th></tr>${filas}</table></div>
  <aside class="factbox"><h3>Detalles</h3>${sel ? `<dl><dt>Cuenta</dt><dd>${esc(sel.codigo)}</dd><dt>Nombre</dt><dd>${esc(sel.nombre)}</dd><dt>Saldo ${S.ej}</dt><dd>${eur(saldoPref(sel.codigo, true))}</dd><dt>Saldo total</dt><dd>${eur(saldoPref(sel.codigo, false))}</dd><dt>Movimientos</dt><dd>${mov}</dd></dl>` : `<p style="color:var(--tx2)">Selecciona una cuenta para ver sus detalles.</p>`}</aside></div>`;
};

/* Diario general (líneas sin registrar, como los libros de diario de BC) */
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
  return { prob, html: `<h3>Comprobación del diario</h3><div class="mosaicos"><div class="mos gris" style="width:6rem;height:5rem"><span>Líneas comprobadas</span><b>${ls.length - prob.length}</b></div><div class="mos ${prob.length ? "rojo" : "gris"}" style="width:6rem;height:5rem"><span>Líneas con problemas</span><b>${prob.length}</b></div></div>
   ${prob.length ? `<ul class="probs">${prob.slice(0, 8).map(p => `<li>Línea ${p.i + 1}: ${esc(p.texto)}</li>`).join("")}</ul>` : `<p class="ok">No se encontraron problemas.</p>`}`,
    pie: `<span>Número de líneas <b>${ls.length}</b></span><span>Saldo <b class="${D === H ? "" : "ko"}">${eur(D - H)}</b></span><span>Saldo total <b>${eur(D - H)}</b></span>` };
}
V.diario = () => {
  const ls = lineasLibro(), p = panelJ(ls);
  const ultima = ls[ls.length - 1];
  const blanca = { fecha: ultima?.fecha || "", documento: ultima?.documento || "", cuenta: "", descripcion: "", debe: "", haber: "" };
  return `<div class="cmd"><span class="t">Diarios generales</span><select id="libro">${libros().map(x => `<option ${x === S.libro ? "selected" : ""}>${esc(x)}</option>`).join("")}</select>
    <button data-a="nuevolibro">+ Libro</button><button class="p" data-a="registrar">Registrar</button><button data-a="nuevodoc">Nuevo nº de documento</button></div>
  <datalist id="dl">${S.d.cuentas.map(c => `<option value="${esc(c.codigo)}">${esc(c.nombre)}</option>`).join("")}</datalist>
  <div class="pagina"><div class="lista"><table class="editable"><tr><th>Fecha registro</th><th>Nº documento</th><th>Nº cuenta</th><th>Nombre de cuenta</th><th>Descripción</th><th class="n">Importe debe</th><th class="n">Importe haber</th><th></th></tr>
  ${ls.map((l, i) => filaJ(l, i, p.prob.some(x => x.id === l.id))).join("")}${filaJ(blanca, ls.length, false)}</table>
  <div class="pie" id="pieJ">${p.pie}</div></div><aside class="factbox" id="boxJ">${p.html}</aside></div>`;
};
function refrescaJ() {
  const ls = lineasLibro(), p = panelJ(ls);
  document.getElementById("pieJ").innerHTML = p.pie; document.getElementById("boxJ").innerHTML = p.html;
  document.querySelectorAll("[data-nc]").forEach(td => { const l = ls[+td.dataset.nc]; td.textContent = l ? nombreCuenta(l.cuenta) : ""; });
  document.querySelectorAll("table.editable tr").forEach((tr, k) => { if (k > 0) tr.classList.toggle("prob", !!ls[k - 1] && p.prob.some(x => x.id === ls[k - 1].id)); });
}

/* Movimientos contables (lista plana; los asientos registrados se pueden modificar y eliminar) */
V.mayor = () => {
  const cs = [...new Set(apuntesEj().map(p => p.cuenta))].sort();
  const f = S.filtroCta;
  let acc = 0;
  const rows = apuntesEj().filter(p => !f || p.cuenta === f).sort((a, b) => a.a.fecha.localeCompare(b.a.fecha) || a.a.numero - b.a.numero);
  const sel = S.d.asientos.find(a => a.id === S.selAs);
  const lsel = sel ? S.d.apuntes.filter(p => p.asiento_id === sel.id) : [];
  const filas = rows.map(p => { if (f) acc = r2(acc + +p.debe - +p.haber);
    return `<tr data-sel data-a="selas" data-id="${p.a.id}" class="${p.a.id === S.selAs ? "sel" : ""}"><td>${p.a.fecha}</td><td>${esc(p.a.documento || "")}</td><td>${p.a.numero}</td><td>${esc(p.cuenta)}</td><td>${esc(p.concepto || p.a.concepto)}</td><td class="n">${+p.debe ? eur(p.debe) : ""}</td><td class="n">${+p.haber ? eur(p.haber) : ""}</td><td class="n">${f ? eur(acc) : ""}</td></tr>`; }).join("");
  return `<div class="cmd"><span class="t">Movimientos contables</span><select id="cm"><option value="">Todas las cuentas</option>${cs.map(x => `<option ${x === f ? "selected" : ""} value="${esc(x)}">${esc(x)} ${esc(nombreCuenta(x))}</option>`).join("")}</select>
    <button data-a="modasiento" ${sel ? "" : "disabled"}>Modificar asiento</button><button data-a="delasiento" ${sel ? "" : "disabled"}>Eliminar asiento</button></div>
  ${S.edit ? `<div class="card"><b>Modificar asiento ${S.edit.numero}</b>${formAsiento()}</div>` : ""}
  <div class="pagina"><div class="lista"><table><tr><th>Fecha registro</th><th>Nº documento</th><th>Nº asiento</th><th>Nº cuenta</th><th>Descripción</th><th class="n">Importe debe</th><th class="n">Importe haber</th><th class="n">Saldo</th></tr>${filas}</table></div>
  <aside class="factbox"><h3>Asiento</h3>${sel ? `<dl><dt>Nº asiento</dt><dd>${sel.numero}</dd><dt>Fecha</dt><dd>${sel.fecha}</dd><dt>Documento</dt><dd>${esc(sel.documento || "")}</dd><dt>Origen</dt><dd>${esc(sel.origen)}</dd></dl><p>${esc(sel.concepto)}</p><dl>${lsel.map(p => `<dt>${esc(p.cuenta)} ${esc(nombreCuenta(p.cuenta))}</dt><dd>${+p.debe ? eur(p.debe) : "-" + eur(p.haber)}</dd>`).join("")}</dl>` : `<p style="color:var(--tx2)">Selecciona un movimiento.</p>`}</aside></div>`;
};
function formAsiento() {
  const l = S.lineas, d = r2(l.reduce((s, x) => s + (+x.debe || 0), 0)), h = r2(l.reduce((s, x) => s + (+x.haber || 0), 0));
  return `<div class="row"><input type="date" id="af" value="${S.fechaAs}"><input id="ad" placeholder="Nº documento" size="12" value="${esc(S.docAs)}"><input id="ac" placeholder="Concepto" size="40" value="${esc(S.conceptoAs)}"></div>
  <datalist id="dl">${S.d.cuentas.map(c => `<option value="${esc(c.codigo)}">${esc(c.nombre)}</option>`).join("")}</datalist>
  <table><tr><th>Cuenta</th><th>Concepto</th><th class="n">Debe</th><th class="n">Haber</th><th></th></tr>
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
  return `<div class="cmd"><span class="t">Sumas y saldos ${S.ej}</span></div><table><tr><th>Cuenta</th><th>Nombre</th><th class="n">Debe</th><th class="n">Haber</th><th class="n">Saldo deudor</th><th class="n">Saldo acreedor</th></tr>
  ${s.map(x => `<tr><td>${esc(x.cuenta)}</td><td>${esc(nombreCuenta(x.cuenta))}</td><td class="n">${eur(x.debe)}</td><td class="n">${eur(x.haber)}</td><td class="n">${x.saldo > 0 ? eur(x.saldo) : ""}</td><td class="n">${x.saldo < 0 ? eur(-x.saldo) : ""}</td></tr>`).join("")}
  <tr class="tot"><td colspan="2">Totales</td><td class="n">${eur(D)}</td><td class="n">${eur(H)}</td><td></td><td></td></tr></table>
  <p class="${D === H ? "ok" : "ko"}">${D === H ? "Debe = Haber: contabilidad cuadrada" : "DESCUADRE " + eur(D - H)}</p>`;
};

V.estados = () => {
  const s = saldos(), suma = f => r2(s.filter(x => f(x.cuenta)).reduce((a, x) => a + x.saldo, 0));
  const ing = -suma(c => c[0] === "7"), gas = suma(c => c[0] === "6"), res = r2(ing - gas);
  const fila = (n, v) => `<tr><td>${n}</td><td class="n">${eur(v)}</td></tr>`;
  const grupo = (n, f) => fila(n, suma(f));
  return `<div class="cmd"><span class="t">Informes ${S.ej}</span></div><h2>Pérdidas y ganancias</h2><table>${fila("Ingresos (grupo 7)", ing)}${fila("Gastos (grupo 6)", gas)}<tr class="tot"><td>Resultado</td><td class="n">${eur(res)}</td></tr></table>
  <h2 style="margin-top:1.2rem">Balance por grupos</h2><table>
  ${grupo("1 Financiación básica", c => c[0] === "1")}${grupo("2 Activo no corriente", c => c[0] === "2")}${grupo("3 Existencias", c => c[0] === "3")}
  ${grupo("4 Acreedores y deudores", c => c[0] === "4")}${grupo("5 Cuentas financieras", c => c[0] === "5")}${fila("Resultado del ejercicio (6 y 7)", r2(gas - ing))}
  <tr class="tot"><td>Suma (debe ser 0)</td><td class="n">${eur(suma(c => "12345".includes(c[0])) + r2(gas - ing))}</td></tr></table>
  <p><small>Saldos con signo: deudor positivo, acreedor negativo. El balance formal (activo/pasivo/PN) vendrá en la siguiente fase.</small></p>`;
};

/* ---------------- Render y eventos ---------------- */
const MENU = [["inicio", "Inicio"], ["cuentas", "Plan de cuentas"], ["diario", "Diarios generales"], ["mayor", "Movimientos"], ["sumas", "Sumas y saldos"], ["estados", "Informes"]];
function render() {
  if (!S.empresas.length && !S.emp) return renderEmpresaNueva();
  const years = [...new Set([new Date().getFullYear(), S.ej, ...S.d.asientos.map(a => a.ejercicio)])].sort();
  $app.innerHTML = `<div class="topbar"><b>Contabilidad</b>
   <select id="emp">${S.empresas.map(e => `<option value="${e.id}" ${e.id === S.emp.id ? "selected" : ""}>${esc(e.nombre)}</option>`).join("")}</select>
   <button data-a="nuevaemp">+ Empresa</button><span class="sp"></span>
   <span>Ejercicio</span><select id="ej">${years.map(y => `<option ${y === S.ej ? "selected" : ""}>${y}</option>`).join("")}</select>
   ${sb ? `<button data-a="salir">Salir</button>` : ""}</div>
   <div class="shell"><div class="empnav"><h1>${esc(S.emp.nombre)}</h1>
   ${MENU.map(([k, n]) => `<button data-a="vista" data-v="${k}" class="${S.vista === k ? "on" : ""}">${n}</button>`).join("")}</div></div>
   <main>${LOCAL ? `<p class="aviso">Modo local de pruebas: los datos están solo en este navegador.</p>` : ""}${V[S.vista]()}</main>`;
}
function renderEmpresaNueva() {
  $app.innerHTML = `<div class="login card"><h2>Nueva empresa</h2><input id="en" placeholder="Nombre"><input id="ecif" placeholder="CIF"><button class="p" data-a="crearemp">Crear</button></div>`;
}
function renderLogin(msg = "") {
  $app.innerHTML = `<div class="login card"><h2>Contabilidad</h2><input id="lu" type="email" placeholder="Email"><input id="lp" type="password" placeholder="Contraseña"><button class="p" data-a="login">Entrar</button><p class="ko">${esc(msg)}</p></div>`;
}

const leerForm = () => { const f = document.getElementById("af"); if (f) { S.fechaAs = f.value; S.conceptoAs = document.getElementById("ac").value; S.docAs = document.getElementById("ad").value; } };
const num = v => String(v ?? "").replace(",", ".");
const apuntesDeLineas = ls => ls.filter(x => x.cuenta && (+x.debe || +x.haber)).map(x => ({ cuenta: x.cuenta.trim(), concepto: x.concepto || null, debe: r2(x.debe), haber: r2(x.haber) }));

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
    if (t.id === "emp") { S.emp = S.empresas.find(x => x.id === t.value); await recargar(); }
    else if (t.id === "ej") { S.ej = +t.value; render(); }
    else if (t.id === "cm") { S.filtroCta = t.value; render(); }
    else if (t.id === "libro") { S.libro = t.value; render(); }
    else if (t.dataset.l !== undefined) { leerForm(); render(); }
    else if (t.dataset.j !== undefined) {
      const ls = lineasLibro(), i = +t.dataset.j, k = t.dataset.k; let l = ls[i], nueva = false;
      let v = (k === "debe" || k === "haber") ? num(t.value) : t.value;
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
  const b = e.target.closest("[data-a]"); if (!b) return;
  const a = b.dataset.a;
  try {
    if (a === "vista") { S.vista = b.dataset.v; render(); }
    else if (a === "nuevaemp") { S.emp = null; $app.innerHTML = ""; renderEmpresaNueva(); }
    else if (a === "crearemp") { const e2 = await db.crearEmpresa(document.getElementById("en").value.trim(), document.getElementById("ecif").value.trim()); S.empresas = await db.empresas(); S.emp = S.empresas.find(x => x.id === e2.id); await db.crearCuentas(S.emp.id, PGC); await recargar(); }
    else if (a === "selcuenta") { S.sel = b.dataset.id; render(); }
    else if (a === "togglenueva") { S.nueva = !S.nueva; render(); }
    else if (a === "delcuentasel") { const c = S.d.cuentas.find(x => x.id === S.sel); if (!c) return; if (S.d.apuntes.some(p => p.cuenta === c.codigo)) alert("La cuenta tiene movimientos y no se puede eliminar."); else if (confirm("¿Eliminar la cuenta " + c.codigo + "?")) { await db.borrarCuenta(c.id); S.sel = null; await recargar(); } }
    else if (a === "vermayor") { const c = S.d.cuentas.find(x => x.id === S.sel); if (c) { S.filtroCta = c.codigo; S.vista = "mayor"; render(); } }
    else if (a === "addcuenta") { const c = document.getElementById("cc").value.trim(), n = document.getElementById("cn").value.trim(); if (c && n) { await db.crearCuentas(S.emp.id, [[c, n]]); S.nueva = false; await recargar(); } }
    else if (a === "pgc") { await db.crearCuentas(S.emp.id, PGC); await recargar(); }
    /* diario */
    else if (a === "nuevolibro") { const n = (prompt("Nombre del nuevo libro de diario:") || "").trim().toUpperCase(); if (n) { S.libro = n; if (!S.d.lineas.some(l => l.libro === n)) S.extraLibros = n; render(); } }
    else if (a === "nuevodoc") { const ls = lineasLibro(), l = { id: uid(), empresa_id: S.emp.id, libro: S.libro, fecha: ls[ls.length - 1]?.fecha || hoy(), documento: siguienteDoc(), descripcion: "", cuenta: "", debe: 0, haber: 0, orden: Date.now() }; S.d.lineas.push(l); await db.guardarLinea(l); render(); }
    else if (a === "dellineaj") { await db.borrarLinea(b.dataset.id); S.d.lineas = S.d.lineas.filter(l => l.id !== b.dataset.id); render(); }
    else if (a === "registrar") {
      const ls = lineasLibro(); if (!ls.length) return alert("No hay líneas que registrar.");
      const prob = comprobar(ls); if (prob.length) return alert("No se puede registrar. Hay " + prob.length + " línea(s) con problemas:\n" + prob.slice(0, 6).map(p => "Línea " + (p.i + 1) + ": " + p.texto).join("\n"));
      if (!confirm("¿Registrar " + ls.length + " líneas del libro " + S.libro + "?")) return;
      const grupos = new Map(); ls.forEach(l => { (grupos.get(l.documento) || grupos.set(l.documento, []).get(l.documento)).push(l); });
      for (const [doc, g] of grupos) {
        const fecha = g.map(x => x.fecha).sort()[0];
        await db.crearAsiento(S.emp.id, fecha, g.find(x => x.descripcion)?.descripcion || doc, g.map(x => ({ cuenta: x.cuenta.trim(), concepto: x.descripcion || null, debe: r2(x.debe), haber: r2(x.haber) })), "diario:" + S.libro, doc);
      }
      await db.borrarLineas(S.emp.id, S.libro); S.vista = "mayor"; await recargar();
    }
    /* movimientos */
    else if (a === "selas") { S.selAs = b.dataset.id; render(); }
    else if (a === "modasiento") {
      const as = S.d.asientos.find(x => x.id === S.selAs); if (!as) return;
      S.edit = as; S.fechaAs = as.fecha; S.conceptoAs = as.concepto; S.docAs = as.documento || "";
      S.lineas = S.d.apuntes.filter(p => p.asiento_id === as.id).map(p => ({ cuenta: p.cuenta, concepto: p.concepto || "", debe: +p.debe || "", haber: +p.haber || "" })); render();
    }
    else if (a === "addlinea") { leerForm(); S.lineas.push({ cuenta: "", concepto: "", debe: "", haber: "" }); render(); }
    else if (a === "dellinea") { leerForm(); S.lineas.splice(+b.dataset.i, 1); render(); }
    else if (a === "cancelar") { S.lineas = null; S.edit = null; render(); }
    else if (a === "guardar") {
      leerForm(); const ap = apuntesDeLineas(S.lineas);
      const falta = ap.find(x => !S.d.cuentas.some(c => c.codigo === x.cuenta));
      if (falta) return alert("La cuenta " + falta.cuenta + " no existe en el plan de cuentas.");
      if (!S.conceptoAs.trim()) return alert("Falta el concepto.");
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

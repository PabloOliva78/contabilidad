import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const $app = document.getElementById("app");
const LOCAL = !SUPABASE_URL || !SUPABASE_ANON_KEY;
const r2 = n => Math.round((+n || 0) * 100) / 100;
const eur = n => r2(n).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const uid = () => crypto.randomUUID();

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
  const K = "contab-local-v1";
  const g = () => JSON.parse(localStorage.getItem(K) || '{"empresas":[],"cuentas":[],"asientos":[],"apuntes":[]}');
  const s = d => localStorage.setItem(K, JSON.stringify(d));
  db = {
    async empresas() { return g().empresas; },
    async crearEmpresa(nombre, cif) { const d = g(); const e = { id: uid(), nombre, cif }; d.empresas.push(e); s(d); return e; },
    async cargar(eid) { const d = g(); return { cuentas: d.cuentas.filter(x => x.empresa_id === eid), asientos: d.asientos.filter(x => x.empresa_id === eid), apuntes: d.apuntes.filter(x => x.empresa_id === eid) }; },
    async crearCuentas(eid, lista) { const d = g(); for (const [codigo, nombre] of lista) if (!d.cuentas.some(c => c.empresa_id === eid && c.codigo === codigo)) d.cuentas.push({ id: uid(), empresa_id: eid, codigo, nombre }); s(d); },
    async borrarCuenta(id) { const d = g(); d.cuentas = d.cuentas.filter(c => c.id !== id); s(d); },
    async crearAsiento(eid, fecha, concepto, apuntes, origen = "manual") {
      const d = g(); const ej = +fecha.slice(0, 4);
      const num = Math.max(0, ...d.asientos.filter(a => a.empresa_id === eid && a.ejercicio === ej).map(a => a.numero)) + 1;
      const id = uid(); d.asientos.push({ id, empresa_id: eid, ejercicio: ej, numero: num, fecha, concepto, origen });
      apuntes.forEach(a => d.apuntes.push({ id: uid(), asiento_id: id, empresa_id: eid, ...a })); s(d);
    },
    async borrarAsiento(id) { const d = g(); d.asientos = d.asientos.filter(a => a.id !== id); d.apuntes = d.apuntes.filter(a => a.asiento_id !== id); s(d); }
  };
} else {
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
  sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const ok = r => { if (r.error) throw new Error(r.error.message); return r.data; };
  const todo = async (tabla, eid) => { // pagina de 1000 en 1000
    let out = [], from = 0;
    for (;;) { const d = ok(await sb.from(tabla).select("*").eq("empresa_id", eid).range(from, from + 999)); out = out.concat(d); if (d.length < 1000) return out; from += 1000; }
  };
  db = {
    async empresas() { return ok(await sb.from("empresas").select("*").order("nombre")); },
    async crearEmpresa(nombre, cif) { return ok(await sb.from("empresas").insert({ nombre, cif }).select().single()); },
    async cargar(eid) { const [cuentas, asientos, apuntes] = await Promise.all([todo("cuentas", eid), todo("asientos", eid), todo("apuntes", eid)]); return { cuentas, asientos, apuntes }; },
    async crearCuentas(eid, lista) { ok(await sb.from("cuentas").upsert(lista.map(([codigo, nombre]) => ({ empresa_id: eid, codigo, nombre })), { onConflict: "empresa_id,codigo", ignoreDuplicates: true })); },
    async borrarCuenta(id) { ok(await sb.from("cuentas").delete().eq("id", id)); },
    async crearAsiento(eid, fecha, concepto, apuntes, origen = "manual") { ok(await sb.rpc("crear_asiento", { p_empresa: eid, p_fecha: fecha, p_concepto: concepto, p_origen: origen, p_apuntes: apuntes })); },
    async borrarAsiento(id) { ok(await sb.from("asientos").delete().eq("id", id)); }
  };
}

/* ---------------- Estado ---------------- */
const S = { empresas: [], emp: null, vista: "asientos", d: { cuentas: [], asientos: [], apuntes: [] }, ej: new Date().getFullYear(), cuentaMayor: "", lineas: null };
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

/* ---------------- Vistas ---------------- */
const V = {};
V.cuentas = () => `
  <h2>Plan de cuentas</h2>
  <div class="card"><div class="row">
    <input id="cc" placeholder="Código" size="8"><input id="cn" placeholder="Nombre" size="40">
    <button class="p" data-a="addcuenta">Añadir</button>
    <button data-a="pgc">Cargar plan básico PGC</button></div>
  <table><tr><th>Código</th><th>Nombre</th><th></th></tr>
  ${[...S.d.cuentas].sort((a, b) => a.codigo.localeCompare(b.codigo)).map(c => `<tr><td>${esc(c.codigo)}</td><td>${esc(c.nombre)}</td><td><button class="d" data-a="delcuenta" data-id="${c.id}">Borrar</button></td></tr>`).join("")}</table></div>`;

V.asientos = () => {
  const l = S.lineas;
  const lista = S.d.asientos.filter(a => a.ejercicio === S.ej).sort((a, b) => b.numero - a.numero);
  const ap = new Map(); S.d.apuntes.forEach(p => { (ap.get(p.asiento_id) || ap.set(p.asiento_id, []).get(p.asiento_id)).push(p); });
  return `<h2>Libro diario</h2>
  <div class="card">${l ? formAsiento() : `<button class="p" data-a="nuevo">Nuevo asiento</button>`}</div>
  <table><tr><th>Nº</th><th>Fecha</th><th>Concepto / cuentas</th><th class="n">Debe</th><th class="n">Haber</th><th></th></tr>
  ${lista.map(a => { const ps = ap.get(a.id) || [];
    return `<tr class="tot"><td>${a.numero}</td><td>${a.fecha}</td><td>${esc(a.concepto)}</td><td class="n">${eur(ps.reduce((s, p) => s + +p.debe, 0))}</td><td class="n">${eur(ps.reduce((s, p) => s + +p.haber, 0))}</td><td><button class="d" data-a="delasiento" data-id="${a.id}">Borrar</button></td></tr>` +
      ps.map(p => `<tr><td></td><td></td><td>${esc(p.cuenta)} ${esc(nombreCuenta(p.cuenta))} ${p.concepto ? "· " + esc(p.concepto) : ""}</td><td class="n">${+p.debe ? eur(p.debe) : ""}</td><td class="n">${+p.haber ? eur(p.haber) : ""}</td><td></td></tr>`).join(""); }).join("")}</table>`;
};
function formAsiento() {
  const l = S.lineas, d = r2(l.reduce((s, x) => s + (+x.debe || 0), 0)), h = r2(l.reduce((s, x) => s + (+x.haber || 0), 0));
  return `<div class="row"><input type="date" id="af" value="${S.fechaAs || new Date().toISOString().slice(0, 10)}"><input id="ac" placeholder="Concepto" size="40" value="${esc(S.conceptoAs || "")}"></div>
  <datalist id="dl">${S.d.cuentas.map(c => `<option value="${esc(c.codigo)}">${esc(c.nombre)}</option>`).join("")}</datalist>
  <table><tr><th>Cuenta</th><th>Concepto</th><th class="n">Debe</th><th class="n">Haber</th><th></th></tr>
  ${l.map((x, i) => `<tr><td><input list="dl" data-l="${i}" data-k="cuenta" value="${esc(x.cuenta)}" size="9"> <small>${esc(nombreCuenta(x.cuenta))}</small></td>
   <td><input data-l="${i}" data-k="concepto" value="${esc(x.concepto)}"></td>
   <td><input data-l="${i}" data-k="debe" value="${x.debe}" size="10" class="n"></td><td><input data-l="${i}" data-k="haber" value="${x.haber}" size="10" class="n"></td>
   <td><button class="d" data-a="dellinea" data-i="${i}">✕</button></td></tr>`).join("")}
  <tr class="tot"><td colspan="2">Totales</td><td class="n">${eur(d)}</td><td class="n">${eur(h)}</td><td></td></tr></table>
  <div class="row" style="margin-top:.6rem"><button data-a="addlinea">+ Línea</button>
   <span class="${d === h && d > 0 ? "ok" : "ko"}">${d === h && d > 0 ? "Cuadra" : "Descuadre: " + eur(d - h)}</span>
   <button class="p" data-a="guardar" ${d === h && d > 0 ? "" : "disabled"}>Guardar asiento</button><button data-a="cancelar">Cancelar</button></div>`;
}

V.mayor = () => {
  const cs = [...new Set(apuntesEj().map(p => p.cuenta))].sort();
  const c = S.cuentaMayor || cs[0] || "";
  let acc = 0;
  const rows = apuntesEj().filter(p => p.cuenta === c).sort((a, b) => a.a.fecha.localeCompare(b.a.fecha) || a.a.numero - b.a.numero);
  return `<h2>Mayor</h2><div class="row"><select id="cm">${cs.map(x => `<option ${x === c ? "selected" : ""} value="${esc(x)}">${esc(x)} ${esc(nombreCuenta(x))}</option>`).join("")}</select></div>
  <table><tr><th>Fecha</th><th>Asiento</th><th>Concepto</th><th class="n">Debe</th><th class="n">Haber</th><th class="n">Saldo</th></tr>
  ${rows.map(p => { acc = r2(acc + +p.debe - +p.haber); return `<tr><td>${p.a.fecha}</td><td>${p.a.numero}</td><td>${esc(p.concepto || p.a.concepto)}</td><td class="n">${eur(p.debe)}</td><td class="n">${eur(p.haber)}</td><td class="n">${eur(acc)}</td></tr>`; }).join("")}</table>`;
};

V.sumas = () => {
  const s = saldos(), D = r2(s.reduce((a, x) => a + x.debe, 0)), H = r2(s.reduce((a, x) => a + x.haber, 0));
  return `<h2>Sumas y saldos ${S.ej}</h2><table><tr><th>Cuenta</th><th>Nombre</th><th class="n">Debe</th><th class="n">Haber</th><th class="n">Saldo deudor</th><th class="n">Saldo acreedor</th></tr>
  ${s.map(x => `<tr><td>${esc(x.cuenta)}</td><td>${esc(nombreCuenta(x.cuenta))}</td><td class="n">${eur(x.debe)}</td><td class="n">${eur(x.haber)}</td><td class="n">${x.saldo > 0 ? eur(x.saldo) : ""}</td><td class="n">${x.saldo < 0 ? eur(-x.saldo) : ""}</td></tr>`).join("")}
  <tr class="tot"><td colspan="2">Totales</td><td class="n">${eur(D)}</td><td class="n">${eur(H)}</td><td></td><td></td></tr></table>
  <p class="${D === H ? "ok" : "ko"}">${D === H ? "Debe = Haber: contabilidad cuadrada" : "DESCUADRE " + eur(D - H)}</p>`;
};

V.estados = () => {
  const s = saldos(), suma = f => r2(s.filter(x => f(x.cuenta)).reduce((a, x) => a + x.saldo, 0));
  const ing = -suma(c => c[0] === "7"), gas = suma(c => c[0] === "6"), res = r2(ing - gas);
  const fila = (n, v) => `<tr><td>${n}</td><td class="n">${eur(v)}</td></tr>`;
  const grupo = (n, f) => fila(n, suma(f));
  return `<h2>Pérdidas y ganancias ${S.ej}</h2><table>${fila("Ingresos (grupo 7)", ing)}${fila("Gastos (grupo 6)", gas)}<tr class="tot"><td>Resultado</td><td class="n">${eur(res)}</td></tr></table>
  <h2 style="margin-top:1.2rem">Balance por grupos ${S.ej}</h2><table>
  ${grupo("1 Financiación básica", c => c[0] === "1")}${grupo("2 Activo no corriente", c => c[0] === "2")}${grupo("3 Existencias", c => c[0] === "3")}
  ${grupo("4 Acreedores y deudores", c => c[0] === "4")}${grupo("5 Cuentas financieras", c => c[0] === "5")}${fila("Resultado del ejercicio (6 y 7)", r2(gas - ing))}
  <tr class="tot"><td>Suma (debe ser 0)</td><td class="n">${eur(suma(c => "12345".includes(c[0])) + r2(gas - ing))}</td></tr></table>
  <p><small>Saldos con signo: deudor positivo, acreedor negativo. El balance formal (activo/pasivo/PN) vendrá en la siguiente fase.</small></p>`;
};

/* ---------------- Render y eventos ---------------- */
const MENU = [["asientos", "Diario"], ["mayor", "Mayor"], ["sumas", "Sumas y saldos"], ["estados", "PyG y Balance"], ["cuentas", "Plan de cuentas"]];
function render() {
  if (!S.empresas.length && !S.emp) return renderEmpresaNueva();
  const years = [...new Set([new Date().getFullYear(), S.ej, ...S.d.asientos.map(a => a.ejercicio)])].sort();
  $app.innerHTML = `<header><h1>Contabilidad</h1>
   <select id="emp">${S.empresas.map(e => `<option value="${e.id}" ${e.id === S.emp.id ? "selected" : ""}>${esc(e.nombre)}</option>`).join("")}</select>
   <button data-a="nuevaemp">+ Empresa</button>
   <select id="ej">${years.map(y => `<option ${y === S.ej ? "selected" : ""}>${y}</option>`).join("")}</select>
   <nav>${MENU.map(([k, n]) => `<button data-a="vista" data-v="${k}" class="${S.vista === k ? "on" : ""}">${n}</button>`).join("")}</nav>
   ${sb ? `<button data-a="salir">Salir</button>` : ""}</header>
   <main>${LOCAL ? `<p class="aviso">Modo local de pruebas: los datos están solo en este navegador. Configura config.js con tu Supabase para guardarlos en la nube.</p>` : ""}${V[S.vista]()}</main>`;
}
function renderEmpresaNueva() {
  $app.innerHTML = `<div class="login card"><h2>Nueva empresa</h2><input id="en" placeholder="Nombre"><input id="ecif" placeholder="CIF"><button class="p" data-a="crearemp">Crear</button></div>`;
}
function renderLogin(msg = "") {
  $app.innerHTML = `<div class="login card"><h2>Contabilidad</h2><input id="lu" type="email" placeholder="Email"><input id="lp" type="password" placeholder="Contraseña"><button class="p" data-a="login">Entrar</button><p class="ko">${esc(msg)}</p></div>`;
}

const leerForm = () => { const f = document.getElementById("af"); if (f) { S.fechaAs = f.value; S.conceptoAs = document.getElementById("ac").value; } };
document.addEventListener("input", e => {
  const t = e.target;
  if (t.dataset.l !== undefined) { const k = t.dataset.k; S.lineas[+t.dataset.l][k] = (k === "debe" || k === "haber") ? t.value.replace(",", ".") : t.value; }
});
document.addEventListener("change", async e => {
  const t = e.target;
  try {
    if (t.id === "emp") { S.emp = S.empresas.find(x => x.id === t.value); await recargar(); }
    else if (t.id === "ej") { S.ej = +t.value; render(); }
    else if (t.id === "cm") { S.cuentaMayor = t.value; render(); }
    else if (t.dataset.l !== undefined) { leerForm(); render(); }
  } catch (err) { alert(err.message); }
});
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-a]"); if (!b) return;
  const a = b.dataset.a;
  try {
    if (a === "vista") { S.vista = b.dataset.v; render(); }
    else if (a === "nuevaemp") { S.emp = null; $app.innerHTML = ""; renderEmpresaNueva(); }
    else if (a === "crearemp") { const e2 = await db.crearEmpresa(document.getElementById("en").value.trim(), document.getElementById("ecif").value.trim()); S.empresas = await db.empresas(); S.emp = S.empresas.find(x => x.id === e2.id); await db.crearCuentas(S.emp.id, PGC); await recargar(); }
    else if (a === "addcuenta") { const c = document.getElementById("cc").value.trim(), n = document.getElementById("cn").value.trim(); if (c && n) { await db.crearCuentas(S.emp.id, [[c, n]]); await recargar(); } }
    else if (a === "pgc") { await db.crearCuentas(S.emp.id, PGC); await recargar(); }
    else if (a === "delcuenta") { if (confirm("¿Borrar cuenta?")) { await db.borrarCuenta(b.dataset.id); await recargar(); } }
    else if (a === "nuevo") { S.lineas = [{ cuenta: "", concepto: "", debe: "", haber: "" }, { cuenta: "", concepto: "", debe: "", haber: "" }]; S.fechaAs = ""; S.conceptoAs = ""; render(); }
    else if (a === "addlinea") { leerForm(); S.lineas.push({ cuenta: "", concepto: "", debe: "", haber: "" }); render(); }
    else if (a === "dellinea") { leerForm(); S.lineas.splice(+b.dataset.i, 1); render(); }
    else if (a === "cancelar") { S.lineas = null; render(); }
    else if (a === "guardar") {
      leerForm();
      const ap = S.lineas.filter(x => x.cuenta && (+x.debe || +x.haber)).map(x => ({ cuenta: x.cuenta.trim(), concepto: x.concepto || null, debe: r2(x.debe), haber: r2(x.haber) }));
      const falta = ap.find(x => !S.d.cuentas.some(c => c.codigo === x.cuenta));
      if (falta) return alert("La cuenta " + falta.cuenta + " no existe en el plan de cuentas.");
      if (!S.conceptoAs.trim()) return alert("Falta el concepto.");
      await db.crearAsiento(S.emp.id, S.fechaAs, S.conceptoAs.trim(), ap);
      S.lineas = null; S.ej = +S.fechaAs.slice(0, 4); await recargar();
    }
    else if (a === "delasiento") { if (confirm("¿Borrar asiento?")) { await db.borrarAsiento(b.dataset.id); await recargar(); } }
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

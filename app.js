// Capo Invoice — static front end on Supabase (tables: invoices, payments).
const $ = s => document.querySelector(s);
const fmt = n => "Rp " + Math.round(n).toLocaleString("id-ID");
const short = n => {
  const a = Math.abs(n);
  if (a >= 1e9) return "Rp " + (n / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 2 }) + " M";
  if (a >= 1e6) return "Rp " + (n / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " jt";
  return fmt(n);
};
const parseRp = s => { const d = String(s || "").replace(/,\d{1,2}$/, "").replace(/[^\d]/g, ""); return d ? parseInt(d, 10) : 0; };
const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const monthName = m => { const [y, mm] = m.split("-"); return MONTHS[+mm - 1] + " " + y; };
const today = () => new Date().toISOString().slice(0, 10);
const INV_RE = /^INV\/\d{4}\/\d{4}\/BNSM\/\d{4}$/;
const OPEN = "__open"; // "Semua piutang" view
const STATUS = { bad: "Belum bayar", warn: "Baru DP / sebagian", good: "Lunas" };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

const cfg = window.CAPO_CONFIG || {};
if (!cfg.SUPABASE_URL || cfg.SUPABASE_URL.startsWith("ISI_") || !window.supabase) {
  $("#setupBanner").hidden = false;
  throw new Error("Capo Invoice: config.js belum diisi");
}
const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

let rows = [], loaded = false, lane = "bad", month = lsGet("capo.month") || "", current = null;

function calc(r) {
  const pays = r.payments || [];
  const paid = pays.reduce((a, p) => a + (+p.nominal || 0), 0);
  const total = +r.total || 0, po = +r.po || 0, sisa = Math.max(total - paid, 0);
  const status = paid <= 0 ? "bad" : sisa <= 0 ? "good" : "warn";
  return { ...r, paid, total, po, sisa, margin: total - po, status };
}

/* ---------- data ---------- */
async function load() {
  const { data, error } = await sb
    .from("invoices")
    .select("*, payments(*)")
    .order("tanggal", { ascending: true });
  if (error) {
    $("#loadErr").textContent = "Gagal memuat data: " + error.message;
    $("#loadErr").hidden = false;
    return;
  }
  $("#loadErr").hidden = true;
  rows = data.map(r => ({ ...r, payments: (r.payments || []).sort((a, b) => (a.created_at > b.created_at ? 1 : -1)) }));
  loaded = true;
  if (current) current = rows.find(r => r.id === current.id) || null;
  render();
}

/* ---------- render ---------- */
function months() {
  const set = new Set(rows.map(r => r.bulan).filter(Boolean));
  set.add(new Date().toISOString().slice(0, 7));
  return [...set].sort().reverse();
}
function renderMonths() {
  const ms = months();
  if (month !== OPEN && (!month || !ms.includes(month))) {
    month = ms.find(m => rows.some(r => r.bulan === m)) || ms[0];
  }
  $("#month").innerHTML =
    `<option value="${OPEN}" ${month === OPEN ? "selected" : ""}>Semua piutang (semua bulan)</option>` +
    ms.map(m => `<option value="${m}" ${m === month ? "selected" : ""}>${monthName(m)}</option>`).join("");
}
function visible() {
  const all = rows.map(calc);
  return month === OPEN ? all.filter(r => r.sisa > 0) : all.filter(r => r.bulan === month);
}

function render() {
  renderMonths();
  const isOpen = month === OPEN;
  if (isOpen && lane === "good") lane = "bad";
  const list = visible();
  const T = list.reduce((a, r) => (a.total += r.total, a.paid += r.paid, a.sisa += r.sisa, a.po += r.po, a), { total: 0, paid: 0, sisa: 0, po: 0 });
  const margin = T.total - T.po, pct = T.total ? margin / T.total * 100 : 0;
  $("#sub").textContent = isOpen
    ? `Semua invoice yang belum lunas · ${list.length} invoice`
    : `${monthName(month)} · ${list.length} invoice`;

  $("#strip").innerHTML = [
    ["Total tagihan", short(T.total), fmt(T.total)],
    ["Sudah masuk", short(T.paid), T.total ? Math.round(T.paid / T.total * 100) + "% dari tagihan" : "–"],
    ["Sisa piutang", short(T.sisa), fmt(T.sisa)],
    ["Total PO (modal)", short(T.po), fmt(T.po)],
    ["Margin (tagihan − PO)", short(margin), pct.toLocaleString("id-ID", { maximumFractionDigits: 1 }) + "% dari tagihan", true]
  ].map(([l, v, s, hl]) => `<div class="${hl ? "hl" : ""}"><span class="lbl">${l}</span><span class="v">${v}</span><span class="s num">${s}</span></div>`).join("");

  const g = { bad: [], warn: [], good: [] };
  list.forEach(r => g[r.status].push(r));
  const laneKeys = isOpen ? ["bad", "warn"] : ["bad", "warn", "good"];
  $("#lanes").className = "lanes" + (isOpen ? " two-only" : "");
  $("#lanes").innerHTML = laneKeys.map(k => {
    const sum = k === "good" ? g[k].reduce((a, r) => a + r.total, 0) : g[k].reduce((a, r) => a + r.sisa, 0);
    return `<button type="button" class="lane ${k}" data-lane="${k}" aria-pressed="${lane === k}">
      <span class="lbl">${STATUS[k]} · ${g[k].length} invoice</span>
      <span class="v">${fmt(sum)}</span>
      <span class="muted" style="font-size:13px">${k === "good" ? "nilai invoice lunas" : "sisa yang harus ditagih"}</span></button>`;
  }).join("");

  const items = g[lane].slice().sort((a, b) => lane === "good" ? b.total - a.total : b.sisa - a.sisa);
  $("#tbl thead").innerHTML = `<tr><th>Customer</th>${isOpen ? "<th>Bulan</th>" : ""}<th class="r">Total tagihan</th><th class="r">Sudah bayar</th><th class="r">Sisa</th><th class="r">Margin</th><th>Status</th></tr>`;
  const cols = isOpen ? 7 : 6;
  if (!items.length) {
    $("#tbl tbody").innerHTML = `<tr><td colspan="${cols}" class="empty">${!loaded ? "Memuat data…" : rows.length ? "Tidak ada invoice di status ini." : "Belum ada invoice. Klik <b>+ Invoice baru</b> untuk mulai."}</td></tr>`;
    $("#tbl tfoot").innerHTML = "";
  } else {
    $("#tbl tbody").innerHTML = items.map(r => {
      const p = r.total ? Math.round(r.paid / r.total * 100) : 0;
      const flags = issues(r).map(x => `<div class="flag">⚠ ${x}</div>`).join("");
      return `<tr class="click" data-id="${r.id}" tabindex="0">
        <td><div>${esc(r.customer)}</div><div class="inv">${esc(r.inv)}</div>${flags}</td>
        ${isOpen ? `<td>${esc(monthName(r.bulan))}</td>` : ""}
        <td class="r num">${fmt(r.total)}</td><td class="r num">${fmt(r.paid)}</td><td class="r num">${fmt(r.sisa)}</td>
        <td class="r num">${r.po ? fmt(r.margin) : "<span class='muted'>PO kosong</span>"}</td>
        <td><span class="pill ${r.status}">${r.status === "warn" ? "DP " + p + "%" : STATUS[r.status]}</span>${r.status === "warn" ? `<div class="bar"><i style="width:${p}%"></i></div>` : ""}</td></tr>`;
    }).join("");
    const s = items.reduce((a, r) => (a.t += r.total, a.p += r.paid, a.s += r.sisa, a.m += r.margin, a), { t: 0, p: 0, s: 0, m: 0 });
    $("#tbl tfoot").innerHTML = `<tr><td>${items.length} invoice</td>${isOpen ? "<td></td>" : ""}<td class="r num">${fmt(s.t)}</td><td class="r num">${fmt(s.p)}</td><td class="r num">${fmt(s.s)}</td><td class="r num">${fmt(s.m)}</td><td></td></tr>`;
  }

  const byC = {};
  list.filter(r => r.sisa > 0).forEach(r => {
    const k = r.customer.trim().toUpperCase();
    (byC[k] = byC[k] || { n: r.customer, s: 0, c: 0 });
    byC[k].s += r.sisa; byC[k].c++;
  });
  const top = Object.values(byC).sort((a, b) => b.s - a.s).slice(0, 8);
  $("#cust").innerHTML = top.length
    ? top.map(c => `<div class="custrow"><span>${esc(c.n)} <span class="muted">· ${c.c} invoice</span></span><span class="num">${fmt(c.s)}</span></div>`).join("")
    : `<p class="muted" style="margin:0">Tidak ada piutang.</p>`;

  const ch = list.flatMap(r => issues(r).map(x => `<li><b>${esc(r.customer)}</b> <span class="inv">${esc(r.inv)}</span> — ${x}</li>`));
  $("#checks").innerHTML = ch.length ? `<ul>${ch.join("")}</ul>` : `<p class="muted" style="margin:0">Semua data rapi.</p>`;

  $("#custList").innerHTML = [...new Set(rows.map(r => r.customer))].sort().map(c => `<option value="${esc(c)}">`).join("");
}

function issues(r) {
  const out = [];
  if (!r.po) out.push("total PO belum diisi");
  if (!INV_RE.test(r.inv || "")) out.push("format nomor invoice tidak standar");
  if (r.po > r.total) out.push("PO lebih besar dari tagihan (rugi)");
  if (r.catatan) out.push(esc(r.catatan));
  return out;
}

/* ---------- invoice form ---------- */
const dInv = $("#dlgInv");
function openInv(r) {
  current = r || null;
  $("#invTitle").textContent = r ? "Edit invoice" : "Invoice baru";
  $("#fNo").value = r ? r.inv : "";
  $("#fDate").value = r?.tanggal || today();
  $("#fMonth").value = r?.bulan || (month !== OPEN && month) || today().slice(0, 7);
  $("#fCust").value = r?.customer || "";
  $("#fTotal").value = r ? (+r.total).toLocaleString("id-ID") : "";
  $("#fPo").value = r && r.po ? (+r.po).toLocaleString("id-ID") : "";
  $("#fNote").value = r?.catatan || "";
  const del = $("#btnDel");
  del.hidden = !r; del.textContent = "Hapus invoice"; del.dataset.armed = "";
  $("#invErr").textContent = "";
  invCalc();
  dInv.showModal();
}
function invCalc() {
  const t = parseRp($("#fTotal").value), p = parseRp($("#fPo").value);
  $("#invCalc").innerHTML = `Margin: <b class="num">${fmt(t - p)}</b> ${t ? `<span class="muted">(${((t - p) / t * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%)</span>` : ""}`;
}
["#fTotal", "#fPo"].forEach(s => $(s).addEventListener("input", invCalc));
$("#fDate").addEventListener("change", () => { if (!current) $("#fMonth").value = $("#fDate").value.slice(0, 7); });

$("#fInv").addEventListener("submit", async e => {
  e.preventDefault();
  const no = $("#fNo").value.trim().toUpperCase(), total = parseRp($("#fTotal").value);
  if (!no || !$("#fCust").value.trim() || !total) { $("#invErr").textContent = "Nomor invoice, customer, dan total tagihan wajib diisi."; return; }
  const body = {
    inv: no, tanggal: $("#fDate").value || null, bulan: $("#fMonth").value,
    customer: $("#fCust").value.trim(), total, po: parseRp($("#fPo").value), catatan: $("#fNote").value.trim()
  };
  const btn = $("#btnSaveInv"); btn.disabled = true;
  const { error } = current
    ? await sb.from("invoices").update(body).eq("id", current.id)
    : await sb.from("invoices").insert(body);
  btn.disabled = false;
  if (error) {
    $("#invErr").textContent = error.code === "23505" ? "Nomor invoice ini sudah ada. Buka invoice lama untuk edit." : "Gagal menyimpan: " + error.message;
    return;
  }
  if (month !== OPEN) { month = body.bulan; lsSet("capo.month", month); }
  dInv.close();
  await load();
});

$("#btnDel").addEventListener("click", async () => {
  const b = $("#btnDel");
  if (!b.dataset.armed) { b.dataset.armed = "1"; b.textContent = "Klik lagi untuk hapus"; return; }
  const { error } = await sb.from("invoices").delete().eq("id", current.id);
  if (error) { $("#invErr").textContent = "Gagal menghapus: " + error.message; return; }
  current = null; dInv.close(); await load();
});

/* ---------- detail + payments ---------- */
const dDet = $("#dlgDet");
function openDet(id) {
  const r = rows.find(x => x.id === id); if (!r) return;
  current = r;
  const c = calc(r);
  $("#dInv").textContent = r.inv + (r.tanggal ? " · " + r.tanggal : "");
  $("#dCust").textContent = r.customer;
  $("#dCalc").innerHTML = `
    <div class="line"><span>Total tagihan</span><b class="num">${fmt(c.total)}</b></div>
    <div class="line"><span>Sudah bayar</span><b class="num">${fmt(c.paid)}</b></div>
    <div class="line"><span>Sisa</span><b class="num" style="color:var(--${c.sisa > 0 ? "bad" : "good"})">${fmt(c.sisa)}</b></div>
    <div class="muted">PO ${fmt(c.po)} · Margin ${fmt(c.margin)}</div>`;
  $("#dPays").innerHTML = r.payments.length
    ? r.payments.map(p => `<div><span>${esc(p.tanggal || "")} ${esc(p.ket || "")}</span><span><span class="num">${fmt(p.nominal)}</span> <button type="button" class="btn small danger" data-delpay="${p.id}" aria-label="Hapus pembayaran">×</button></span></div>`).join("")
    : `<span class="muted">Belum ada pembayaran.</span>`;
  $("#pAmt").value = ""; $("#pDate").value = today(); $("#pNote").value = ""; $("#payErr").textContent = "";
  if (!dDet.open) dDet.showModal();
}
$("#btnFull").addEventListener("click", () => {
  $("#pAmt").value = calc(current).sisa.toLocaleString("id-ID");
  if (!$("#pNote").value) $("#pNote").value = "Pelunasan";
});
$("#btnEdit").addEventListener("click", () => { const r = current; dDet.close(); openInv(r); });

$("#fPay").addEventListener("submit", async e => {
  e.preventDefault();
  const amt = parseRp($("#pAmt").value);
  if (!amt) { $("#payErr").textContent = "Isi nominal pembayaran."; return; }
  const c = calc(current);
  if (amt > c.sisa) { $("#payErr").textContent = `Nominal melebihi sisa tagihan (${fmt(c.sisa)}).`; return; }
  const btn = $("#btnSavePay"); btn.disabled = true;
  const { error } = await sb.from("payments").insert({ invoice_id: current.id, nominal: amt, tanggal: $("#pDate").value || null, ket: $("#pNote").value.trim() });
  btn.disabled = false;
  if (error) { $("#payErr").textContent = "Gagal menyimpan pembayaran: " + error.message; return; }
  await load();
  openDet(current.id);
});

$("#dPays").addEventListener("click", async e => {
  const b = e.target.closest("[data-delpay]"); if (!b) return;
  if (!b.dataset.armed) { b.dataset.armed = "1"; b.textContent = "Hapus?"; return; }
  const { error } = await sb.from("payments").delete().eq("id", b.dataset.delpay);
  if (error) { $("#payErr").textContent = "Gagal menghapus: " + error.message; return; }
  await load();
  openDet(current.id);
});

/* ---------- CSV export ---------- */
$("#btnCsv").addEventListener("click", () => {
  const list = visible();
  const head = ["No Invoice", "Tanggal", "Bulan", "Customer", "Total Tagihan", "Sudah Bayar", "Sisa", "Total PO", "Margin", "Status", "Catatan"];
  const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [head.map(q).join(",")].concat(list.map(r =>
    [r.inv, r.tanggal, r.bulan, r.customer, r.total, r.paid, r.sisa, r.po, r.margin, STATUS[r.status], r.catatan].map(q).join(",")));
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `capo-invoice-${month === OPEN ? "semua-piutang" : month}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

/* ---------- wiring ---------- */
document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => b.closest("dialog").close()));
$("#lanes").addEventListener("click", e => { const b = e.target.closest("[data-lane]"); if (b) { lane = b.dataset.lane; render(); } });
$("#tbl").addEventListener("click", e => { const t = e.target.closest("tr[data-id]"); if (t) openDet(t.dataset.id); });
$("#tbl").addEventListener("keydown", e => {
  const t = e.target.closest("tr[data-id]");
  if (t && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openDet(t.dataset.id); }
});
$("#month").addEventListener("change", e => { month = e.target.value; lsSet("capo.month", month); render(); });
$("#btnNew").addEventListener("click", () => openInv(null));
window.addEventListener("focus", () => { if (loaded && !dInv.open && !dDet.open) load(); });

/* ---------- auth ---------- */
$("#loginView").addEventListener("submit", async e => {
  e.preventDefault();
  $("#lBtn").disabled = true; $("#lErr").textContent = "";
  const { error } = await sb.auth.signInWithPassword({ email: $("#lEmail").value.trim(), password: $("#lPass").value });
  $("#lBtn").disabled = false;
  if (error) $("#lErr").textContent = "Email atau password salah.";
});
$("#btnLogout").addEventListener("click", () => sb.auth.signOut());

function showSession(session) {
  const inApp = !!session;
  $("#loginView").hidden = inApp;
  $("#appView").hidden = !inApp;
  if (inApp) {
    $("#who").textContent = session.user.email;
    render();
    load();
  } else {
    rows = []; loaded = false;
  }
}
sb.auth.getSession().then(({ data }) => showSession(data.session));
sb.auth.onAuthStateChange((evt, session) => { if (evt === "SIGNED_IN" || evt === "SIGNED_OUT") showSession(session); });

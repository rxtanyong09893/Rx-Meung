/* ระบบคลังยา เครือข่าย รพ.สต. — Frontend (GitHub Pages) + Supabase */
'use strict';

const cfg = window.APP_CONFIG;
const sb = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);

const S = { user: null, profile: null, facilities: [], drugs: [], drugById: new Map(), drugByLabel: new Map(), fid: null, tab: 'dashboard', mode: 'drug' };
const TX = { opening: 'ยอดยกมา', receive: 'รับเข้า', dispense: 'จ่ายออก', adjust: 'ปรับยอด', expire: 'ตัดหมดอายุ/เสื่อม' };
const NEAR_DAYS = 90;
const NOEXP = '9999-12-31';                       // วัสดุที่ไม่มีวันหมดอายุ
const ITEM_TYPES = { drug: 'ยา', supply: 'วัสดุ' };
const SUPPLY_CATS = ['วัสดุการแพทย์', 'วัสดุวิทยาศาสตร์', 'วัสดุสำนักงาน', 'วัสดุงานบ้านงานครัว', 'วัสดุคอมพิวเตอร์', 'วัสดุเชื้อเพลิง', 'วัสดุอื่น ๆ'];
const L = () => ITEM_TYPES[S.mode];               // คำว่า "ยา" หรือ "วัสดุ" ตามโหมดปัจจุบัน
const isSupply = () => S.mode === 'supply';
const inMode = id => S.drugById.get(id)?.item_type === S.mode;

/* ---------- utilities ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (v, d = 2) => Number(v || 0).toLocaleString('th-TH', { maximumFractionDigits: d });
const today = () => new Date().toLocaleDateString('sv-SE');
const addDays = (n, base = today()) => { const d = new Date(base + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv-SE'); };
const daysTo = d => Math.round((new Date(d + 'T00:00:00') - new Date(today() + 'T00:00:00')) / 864e5);
const thDate = d => d === NOEXP ? 'ไม่มี' : d ? new Date(d + 'T00:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '-';
const isAdmin = () => S.profile?.role === 'admin';
const facName = id => S.facilities.find(f => f.id === id)?.name || '-';
const drugLabel = d => `${d.code ? d.code + ' · ' : ''}${d.name}${d.strength ? ' ' + d.strength : ''} (${d.unit})`;
const drugName = id => { const d = S.drugById.get(id); return d ? `${d.name}${d.strength ? ' ' + d.strength : ''}` : `#${id}`; };
const main = () => $('#main');

function toast(msg, isErr = false) {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (isErr ? ' err' : '');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.add('hidden'), isErr ? 6000 : 3000);
}
function errMsg(e) { return e?.message || e?.error_description || String(e); }
function openModal(html) { $('#modalBox').innerHTML = html; $('#modal').classList.remove('hidden'); }
function closeModal() { $('#modal').classList.add('hidden'); }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal' || e.target.dataset.close !== undefined) closeModal(); });

async function fetchAll(build) {
  let all = [], from = 0;
  for (;;) {
    const { data, error } = await build().range(from, from + 999);
    if (error) throw error;
    all = all.concat(data); if (data.length < 1000) break; from += 1000;
  }
  return all;
}

function downloadCSV(name, rows) {
  const csv = rows.map(r => r.map(v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  const clean = rows.filter(r => r.some(v => v.trim() !== ''));
  const head = (clean.shift() || []).map(h => h.trim().toLowerCase());
  return clean.map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}

// รับวันที่ได้ทั้ง 2026-12-31, 31/12/2026, 31/12/2569 (พ.ศ.)
function normDate(s) {
  if (!s) return null; s = s.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/), y, mo, d;
  if (m) [, y, mo, d] = m; else if ((m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/))) [, d, mo, y] = m; else return null;
  y = +y; if (y > 2400) y -= 543;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/* ---------- auth ---------- */
let signupMode = false;
function showOnly(id) { ['loginView', 'pendingView', 'appView'].forEach(v => $('#' + v).classList.toggle('hidden', v !== id)); }
function showLogin() { showOnly('loginView'); }

$('#loginTitle').textContent = cfg.APP_NAME; $('#loginSub').textContent = cfg.APP_SUBTITLE || '';
$('#appTitle').textContent = cfg.APP_NAME; $('#appSub').textContent = cfg.APP_SUBTITLE || '';

$('#toggleSignup').onclick = () => {
  signupMode = !signupMode;
  $$('.signup-only').forEach(e => e.classList.toggle('hidden', !signupMode));
  $('#loginBtn').textContent = signupMode ? 'สมัครใช้งาน' : 'เข้าสู่ระบบ';
  $('#toggleSignup').textContent = signupMode ? 'มีบัญชีแล้ว? เข้าสู่ระบบ' : 'ยังไม่มีบัญชี? สมัครใช้งาน';
};

$('#loginForm').onsubmit = async e => {
  e.preventDefault();
  const f = new FormData(e.target), btn = $('#loginBtn'); btn.disabled = true;
  try {
    if (signupMode) {
      const { data, error } = await sb.auth.signUp({ email: f.get('email'), password: f.get('password'), options: { data: { full_name: f.get('full_name') } } });
      if (error) throw error;
      if (!data.session) { toast('สมัครเรียบร้อย กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ'); return; }
    } else {
      const { error } = await sb.auth.signInWithPassword({ email: f.get('email'), password: f.get('password') });
      if (error) throw error;
    }
    await boot();
  } catch (err) { toast(errMsg(err) === 'Invalid login credentials' ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : errMsg(err), true); }
  finally { btn.disabled = false; }
};

async function logout() { await sb.auth.signOut(); S.user = S.profile = null; showLogin(); }
$('#logoutBtn').onclick = logout; $('#pendingLogout').onclick = logout;

async function boot() {
  if (cfg.SUPABASE_URL.includes('YOUR-PROJECT')) {
    showLogin(); toast('ยังไม่ได้ตั้งค่า config.js (SUPABASE_URL / ANON KEY)', true); return;
  }
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return showLogin();
  S.user = user;
  const { data: prof, error } = await sb.from('profiles').select('*').eq('id', user.id).single();
  if (error) { toast('โหลดข้อมูลผู้ใช้ไม่สำเร็จ: ' + errMsg(error), true); return showLogin(); }
  S.profile = prof;
  if (!prof.active || (!isAdmin() && !prof.facility_id)) return showOnly('pendingView');

  try { if (localStorage.getItem('mode') === 'supply') S.mode = 'supply'; } catch (_) {}
  await loadRefs();
  $$('#modeSeg button').forEach(b => b.classList.toggle('active', b.dataset.mode === S.mode));
  let saved = null; try { saved = Number(localStorage.getItem('fid')); } catch (_) {}
  S.fid = isAdmin() ? (S.facilities.find(f => f.id === saved)?.id || S.facilities[0]?.id) : prof.facility_id;

  const sel = $('#facilitySelect');
  sel.innerHTML = S.facilities.filter(f => f.active || isAdmin()).map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('');
  sel.value = S.fid; sel.disabled = !isAdmin();
  $('#userLabel').textContent = (prof.full_name || prof.email) + (isAdmin() ? ' (admin)' : '');
  $$('.admin-only').forEach(e => e.classList.toggle('hidden', !isAdmin()));
  showOnly('appView'); go(S.tab);
}

$('#facilitySelect').onchange = e => { S.fid = Number(e.target.value); try { localStorage.setItem('fid', S.fid); } catch (_) {} go(S.tab); };

async function loadRefs() {
  const { data: fac, error } = await sb.from('facilities').select('*').order('id');
  if (error) throw error;
  S.facilities = fac;
  S.drugs = await fetchAll(() => sb.from('drugs').select('*').order('name'));
  S.drugById = new Map(S.drugs.map(d => [d.id, d]));
  buildItemList();
}
// รายการให้เลือกในช่องค้นหา เฉพาะประเภทของโหมดปัจจุบัน (ยา หรือ วัสดุ)
function buildItemList() {
  S.drugByLabel = new Map(S.drugs.filter(d => d.active && d.item_type === S.mode).map(d => [drugLabel(d), d]));
  $('#drugList').innerHTML = [...S.drugByLabel.keys()].map(l => `<option value="${esc(l)}">`).join('');
}
function resolveDrug(text) {
  text = (text || '').trim(); if (!text) return null;
  if (S.drugByLabel.has(text)) return S.drugByLabel.get(text);
  const t = text.toLowerCase();
  return S.drugs.find(d => d.active && d.item_type === S.mode && (d.code?.toLowerCase() === t || d.name.toLowerCase() === t)) || null;
}
$('#modeSeg').onclick = e => {
  const m = e.target.closest('button')?.dataset.mode; if (!m || m === S.mode) return;
  S.mode = m; try { localStorage.setItem('mode', m); } catch (_) {}
  $$('#modeSeg button').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
  buildItemList(); go(S.tab);
};

/* ---------- navigation ---------- */
const views = {};
$('#tabs').onclick = e => { const t = e.target.closest('button')?.dataset.tab; if (t) go(t); };
async function go(tab) {
  if (tab === 'admin' && !isAdmin()) tab = 'dashboard';
  S.tab = tab;
  $$('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  main().innerHTML = '<div class="loading">กำลังโหลด…</div>';
  try { await views[tab](); } catch (e) { main().innerHTML = `<div class="card">เกิดข้อผิดพลาด: ${esc(errMsg(e))}</div>`; }
}

function stockBadges(r) {
  const b = [];
  if (r.total_qty <= 0) b.push('<span class="badge b-grey">ไม่มีในคลัง</span>');
  if (r.expired_qty > 0) b.push('<span class="badge b-red">มียาหมดอายุ</span>');
  if (r.min_qty > 0 && r.total_qty - r.expired_qty <= r.min_qty) b.push('<span class="badge b-amber">ต่ำกว่าจุดสั่งซื้อ</span>');
  if (r.near_exp_qty > 0) b.push(`<span class="badge b-yellow">ใกล้หมดอายุ</span>`);
  if (!b.length) b.push('<span class="badge b-green">ปกติ</span>');
  return b.join('');
}
const isLow = r => r.min_qty > 0 && r.total_qty - r.expired_qty <= r.min_qty;

/* ---------- ภาพรวม ---------- */
views.dashboard = async () => {
  let html = '';
  if (isAdmin()) {
    const rows = await fetchAll(() => sb.from('v_stock').select('facility_id,total_qty,stock_value,min_qty,expired_qty,near_exp_qty').eq('item_type', S.mode));
    const by = new Map(S.facilities.filter(f => f.active).map(f => [f.id, { items: 0, value: 0, low: 0, near: 0, exp: 0 }]));
    for (const r of rows) {
      const g = by.get(r.facility_id); if (!g) continue;
      if (r.total_qty > 0) g.items++;
      g.value += Number(r.stock_value);
      if (isLow(r)) g.low++; if (r.near_exp_qty > 0) g.near++; if (r.expired_qty > 0) g.exp++;
    }
    const tot = [...by.values()].reduce((a, g) => ({ value: a.value + g.value, low: a.low + g.low, near: a.near + g.near, exp: a.exp + g.exp }), { value: 0, low: 0, near: 0, exp: 0 });
    html += `<h2>ภาพรวมเครือข่าย ${S.facilities.filter(f => f.active).length} แห่ง — ${L()}</h2>
      <div class="kpis">
        <div class="kpi"><b>${fmt(tot.value, 0)}</b><span>มูลค่า${L()}คงคลังรวม (บาท)</span></div>
        <div class="kpi amber"><b>${tot.low}</b><span>รายการต่ำกว่าจุดสั่งซื้อ</span></div>
        <div class="kpi yellow"><b>${tot.near}</b><span>รายการใกล้หมดอายุ (≤${NEAR_DAYS} วัน)</span></div>
        <div class="kpi red"><b>${tot.exp}</b><span>รายการมียาหมดอายุค้างคลัง</span></div>
      </div>
      <div class="card table-wrap"><table><thead><tr><th>หน่วยบริการ</th><th class="n">รายการ${L()}ที่มี</th><th class="n">มูลค่า (บาท)</th><th class="n">ต่ำกว่าจุดสั่งซื้อ</th><th class="n">ใกล้หมดอายุ</th><th class="n">หมดอายุค้าง</th></tr></thead><tbody>
      ${[...by].map(([id, g]) => `<tr class="click" data-fid="${id}"><td>${esc(facName(id))}</td><td class="n">${g.items}</td><td class="n">${fmt(g.value, 0)}</td>
        <td class="n">${g.low ? `<span class="badge b-amber">${g.low}</span>` : 0}</td><td class="n">${g.near ? `<span class="badge b-yellow">${g.near}</span>` : 0}</td><td class="n">${g.exp ? `<span class="badge b-red">${g.exp}</span>` : 0}</td></tr>`).join('')}
      </tbody></table><p class="muted">คลิกที่แถวเพื่อดูคงคลังของหน่วยนั้น</p></div>`;
  }
  html += `<h2>${esc(facName(S.fid))} — ${L()}</h2><div id="facSummary"><div class="loading">กำลังโหลด…</div></div>`;
  main().innerHTML = html;
  $$('tr[data-fid]').forEach(tr => tr.onclick = () => { S.fid = Number(tr.dataset.fid); $('#facilitySelect').value = S.fid; try { localStorage.setItem('fid', S.fid); } catch (_) {} go('stock'); });

  const [stock, allLots] = await Promise.all([
    fetchAll(() => sb.from('v_stock').select('*').eq('facility_id', S.fid).eq('item_type', S.mode)),
    fetchAll(() => sb.from('lots').select('id,drug_id,lot_no,exp_date,qty').eq('facility_id', S.fid).gt('qty', 0).lte('exp_date', addDays(NEAR_DAYS)).order('exp_date'))
  ]);
  const lots = allLots.filter(l => inMode(l.drug_id));
  const low = stock.filter(isLow);
  const value = stock.reduce((a, r) => a + Number(r.stock_value), 0);
  $('#facSummary').innerHTML = `
    <div class="kpis">
      <div class="kpi"><b>${stock.filter(r => r.total_qty > 0).length}</b><span>รายการ${L()}ที่มีในคลัง</span></div>
      <div class="kpi"><b>${fmt(value, 0)}</b><span>มูลค่าคงคลัง (บาท)</span></div>
      <div class="kpi amber"><b>${low.length}</b><span>ต่ำกว่าจุดสั่งซื้อ</span></div>
      <div class="kpi red"><b>${lots.filter(l => daysTo(l.exp_date) < 0).length}</b><span>ล็อตหมดอายุค้างคลัง</span></div>
    </div>
    <div class="card"><h3>ล็อตที่หมดอายุแล้ว / จะหมดอายุภายใน ${NEAR_DAYS} วัน</h3>
      ${lots.length ? `<div class="table-wrap"><table><thead><tr><th>${L()}</th><th>Lot</th><th>วันหมดอายุ</th><th class="n">เหลือ (วัน)</th><th class="n">คงเหลือ</th></tr></thead><tbody>
      ${lots.map(l => { const dd = daysTo(l.exp_date); return `<tr><td>${esc(drugName(l.drug_id))}</td><td>${esc(l.lot_no)}</td><td>${thDate(l.exp_date)}</td>
        <td class="n"><span class="badge ${dd < 0 ? 'b-red' : dd <= 30 ? 'b-amber' : 'b-yellow'}">${dd < 0 ? 'หมดแล้ว' : dd}</span></td><td class="n">${fmt(l.qty)} ${esc(S.drugById.get(l.drug_id)?.unit || '')}</td></tr>`; }).join('')}
      </tbody></table></div>` : '<p class="muted">ไม่มี</p>'}</div>
    <div class="card"><h3>ต่ำกว่าจุดสั่งซื้อ (ควรเบิก)</h3>
      ${low.length ? `<div class="table-wrap"><table><thead><tr><th>${L()}</th><th class="n">คงเหลือใช้ได้</th><th class="n">จุดสั่งซื้อ</th><th class="n">ระดับสูงสุด</th><th class="n">แนะนำเบิก</th></tr></thead><tbody>
      ${low.map(r => { const usable = r.total_qty - r.expired_qty; const sug = r.max_qty ? Math.max(0, r.max_qty - usable) : ''; return `<tr><td>${esc(r.drug_name)} ${esc(r.strength || '')}</td><td class="n">${fmt(usable)}</td><td class="n">${fmt(r.min_qty)}</td><td class="n">${r.max_qty ? fmt(r.max_qty) : '-'}</td><td class="n"><b>${sug === '' ? '-' : fmt(sug)}</b> ${esc(r.unit)}</td></tr>`; }).join('')}
      </tbody></table></div>` : '<p class="muted">ไม่มี (หรือยังไม่ได้ตั้งจุดสั่งซื้อในหน้า "คงคลัง")</p>'}</div>`;
};

/* ---------- คงคลัง ---------- */
views.stock = async () => {
  main().innerHTML = `<div class="card no-print"><div class="row">
      <label>ค้นหา<input id="sq" placeholder="ชื่อยา / รหัส"></label>
      <label>สถานะ<select id="sf"><option value="">ทั้งหมด</option><option value="low">ต่ำกว่าจุดสั่งซื้อ</option><option value="near">ใกล้หมดอายุ</option><option value="exp">มียาหมดอายุ</option><option value="zero">ไม่มีในคลัง</option></select></label>
      <label style="flex:0 0 auto;flex-direction:row;align-items:center"><input type="checkbox" id="sh" checked style="width:auto"> เฉพาะที่มีในคลัง</label>
      <button class="btn" id="sx">ส่งออก CSV</button><button class="btn" onclick="print()">พิมพ์</button></div></div>
    <div class="card table-wrap" id="stbl"><div class="loading">กำลังโหลด…</div></div>`;
  const rows = await fetchAll(() => sb.from('v_stock').select('*').eq('facility_id', S.fid).eq('item_type', S.mode).order('drug_name'));
  const filtered = () => {
    const q = $('#sq').value.trim().toLowerCase(), f = $('#sf').value, has = $('#sh').checked;
    return rows.filter(r => (!q || r.drug_name.toLowerCase().includes(q) || (r.code || '').toLowerCase().includes(q))
      && (!has || f === 'zero' || r.total_qty > 0)
      && (!f || (f === 'low' && isLow(r)) || (f === 'near' && r.near_exp_qty > 0) || (f === 'exp' && r.expired_qty > 0) || (f === 'zero' && r.total_qty <= 0)));
  };
  const draw = () => {
    const list = filtered();
    $('#stbl').innerHTML = `<h2>คงคลัง${L()} — ${esc(facName(S.fid))} <small class="muted">(${list.length} รายการ)</small></h2>
      <table><thead><tr><th>รหัส</th><th>ชื่อ${L()}</th><th>หน่วย</th><th class="n">คงเหลือ</th><th class="n">ใช้เฉลี่ย/เดือน</th><th class="n">พอใช้ (เดือน)</th><th>หมดอายุใกล้สุด</th><th class="n">จุดสั่งซื้อ</th><th>สถานะ</th></tr></thead><tbody>
      ${list.map(r => `<tr class="click" data-d="${r.drug_id}"><td>${esc(r.code || '')}</td><td>${esc(r.drug_name)} ${esc(r.strength || '')}</td><td>${esc(r.unit)}</td>
        <td class="n"><b>${fmt(r.total_qty)}</b></td><td class="n">${fmt(r.avg_monthly_use, 1)}</td>
        <td class="n">${r.avg_monthly_use > 0 ? fmt((r.total_qty - r.expired_qty) / r.avg_monthly_use, 1) : '-'}</td>
        <td>${thDate(r.nearest_exp)}</td><td class="n">${r.min_qty ? fmt(r.min_qty) : '-'}</td><td>${stockBadges(r)}</td></tr>`).join('') || '<tr><td colspan="9" class="muted">ไม่พบรายการ</td></tr>'}
      </tbody></table>`;
    $$('tr[data-d]').forEach(tr => tr.onclick = () => drugModal(Number(tr.dataset.d), rows.find(r => r.drug_id === Number(tr.dataset.d)), views.stock));
  };
  ['sq', 'sf', 'sh'].forEach(id => $('#' + id).addEventListener('input', draw));
  $('#sx').onclick = () => downloadCSV(`คงคลัง${L()}_${facName(S.fid)}_${today()}.csv`,
    [['รหัส', 'ชื่อ', 'ความแรง/ขนาด', 'หน่วย', 'คงเหลือ', 'หมดอายุแล้ว', 'ใกล้หมดอายุ', 'หมดอายุใกล้สุด', 'ใช้เฉลี่ย/เดือน', 'จุดสั่งซื้อ', 'ระดับสูงสุด', 'มูลค่า (บาท)'],
     ...filtered().map(r => [r.code, r.drug_name, r.strength, r.unit, r.total_qty, r.expired_qty, r.near_exp_qty, r.nearest_exp === NOEXP ? '' : r.nearest_exp, (+r.avg_monthly_use).toFixed(1), r.min_qty, r.max_qty, (+r.stock_value).toFixed(2)])]);
  draw();
};

async function drugModal(drugId, row, after) {
  const d = S.drugById.get(drugId);
  const [{ data: lots, error }, { data: txs }] = await Promise.all([
    sb.from('lots').select('*').eq('facility_id', S.fid).eq('drug_id', drugId).gt('qty', 0).order('exp_date'),
    sb.from('stock_tx').select('tx_date,tx_type,qty,balance_after,ref_no,source,note').eq('facility_id', S.fid).eq('drug_id', drugId).order('created_at', { ascending: false }).limit(15)
  ]);
  if (error) return toast(errMsg(error), true);
  openModal(`<div class="modal-head"><div><h2>${esc(drugLabel(d))}</h2><p class="muted">${esc(facName(S.fid))}</p></div><button class="btn sm" data-close>ปิด</button></div>
    <h3>ล็อตคงเหลือ (เรียงตามวันหมดอายุ — จ่ายแบบ FEFO)</h3>
    <div class="table-wrap"><table><thead><tr><th>Lot</th><th>วันหมดอายุ</th><th class="n">คงเหลือ</th><th class="n">ทุน/หน่วย</th></tr></thead><tbody>
    ${lots.map(l => `<tr><td>${esc(l.lot_no)}</td><td>${thDate(l.exp_date)} ${daysTo(l.exp_date) < 0 ? '<span class="badge b-red">หมดอายุ</span>' : daysTo(l.exp_date) <= NEAR_DAYS ? '<span class="badge b-yellow">ใกล้หมด</span>' : ''}</td><td class="n">${fmt(l.qty)}</td><td class="n">${l.unit_cost != null ? fmt(l.unit_cost) : '-'}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">ไม่มี</td></tr>'}
    </tbody></table></div>
    <h3>จุดสั่งซื้อ / ระดับสูงสุด</h3>
    <form id="lvlForm" class="row"><label>จุดสั่งซื้อ (min)<input name="min" type="number" min="0" step="any" value="${row?.min_qty || 0}"></label>
      <label>ระดับสูงสุด (max)<input name="max" type="number" min="0" step="any" value="${row?.max_qty ?? ''}"></label>
      <button class="btn primary">บันทึก</button></form>
    <p class="muted">ใช้เฉลี่ย ${fmt(row?.avg_monthly_use, 1)} ${esc(d.unit)}/เดือน — แนวทางทั่วไป: min ≈ ใช้ 1 เดือน, max ≈ ใช้ 2–3 เดือน (ปรับตามรอบเบิกของเครือข่าย)</p>
    <h3>ความเคลื่อนไหวล่าสุด</h3>
    <div class="table-wrap"><table><thead><tr><th>วันที่</th><th>ประเภท</th><th class="n">จำนวน</th><th class="n">คงเหลือ</th><th>อ้างอิง</th></tr></thead><tbody>
    ${(txs || []).map(t => `<tr><td>${thDate(t.tx_date)}</td><td>${TX[t.tx_type]}</td><td class="n ${t.qty > 0 ? 't-in' : 't-out'}">${t.qty > 0 ? '+' : ''}${fmt(t.qty)}</td><td class="n">${fmt(t.balance_after)}</td><td>${esc([t.ref_no, t.source, t.note].filter(Boolean).join(' · '))}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">ยังไม่มี</td></tr>'}
    </tbody></table></div>`);
  $('#lvlForm').onsubmit = async e => {
    e.preventDefault(); const f = new FormData(e.target);
    const { error } = await sb.from('stock_levels').upsert({ facility_id: S.fid, drug_id: drugId, min_qty: Number(f.get('min') || 0), max_qty: f.get('max') === '' ? null : Number(f.get('max')) });
    if (error) return toast(errMsg(error), true);
    toast('บันทึกแล้ว'); closeModal(); after && after();
  };
}

/* ---------- ฟอร์มหลายรายการ (รับ/จ่าย) ---------- */
function linesForm({ title, header, cols, rowHtml, onSave }) {
  main().innerHTML = `<div class="card"><h2>${title} — ${esc(facName(S.fid))}</h2>
    <div class="grid-form">${header}</div>
    <h3>รายการ</h3>
    <div class="table-wrap"><table class="lines"><thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}<th></th></tr></thead><tbody id="lines"></tbody></table></div>
    <div class="row" style="margin-top:10px"><button class="btn" id="addLine">+ เพิ่มรายการ</button><span class="spacer"></span><button class="btn primary" id="saveLines">บันทึกทั้งหมด</button></div>
    <p class="muted" id="saveMsg"></p></div>`;
  const add = () => {
    const tr = document.createElement('tr'); tr.innerHTML = rowHtml() + '<td><button class="btn sm danger" title="ลบ">×</button></td>';
    tr.lastElementChild.firstElementChild.onclick = () => tr.remove();
    $('#lines').append(tr); tr.querySelector('input')?.focus(); return tr;
  };
  for (let i = 0; i < 3; i++) add();
  $('#addLine').onclick = add;
  $('#saveLines').onclick = async () => {
    const btn = $('#saveLines'); btn.disabled = true;
    const trs = $$('#lines tr').filter(tr => tr.querySelector('.drug').value.trim());
    let ok = 0, bad = 0;
    for (const tr of trs) {
      tr.classList.remove('err'); tr.title = '';
      try { await onSave(tr); ok++; tr.remove(); }
      catch (e) { bad++; tr.classList.add('err'); tr.title = errMsg(e); $('#saveMsg').textContent = `แถวสีแดงบันทึกไม่สำเร็จ (ชี้ที่แถวเพื่อดูสาเหตุ): ${errMsg(e)}`; }
    }
    btn.disabled = false;
    if (!bad) { $('#saveMsg').textContent = ''; if (!$('#lines').children.length) add(); }
    toast(`บันทึกสำเร็จ ${ok} รายการ${bad ? `, ไม่สำเร็จ ${bad}` : ''}`, bad > 0);
  };
}
const hv = id => $('#' + id).value.trim() || null;

views.receive = async () => linesForm({
  title: `รับ${L()}เข้าคลัง`,
  header: `<label>วันที่รับ<input type="date" id="h_date" value="${today()}"></label>
    <label>เลขที่เอกสาร (ใบเบิก/ใบส่งของ/ใบตรวจรับ)<input id="h_ref"></label>
    <label>รับจาก<input id="h_src" placeholder="${isSupply() ? 'เช่น ร้าน/บริษัท, รพ.แม่ข่าย, สสอ.' : 'เช่น รพ.แม่ข่าย / คลังยา สสอ.'}"></label>
    <label>หมายเหตุ<input id="h_note"></label>`,
  cols: isSupply() ? ['วัสดุ', 'Lot (ถ้ามี)', 'วันหมดอายุ (ถ้ามี)', 'จำนวน', 'ราคา/หน่วย']
                   : ['ยา', 'Lot', 'วันหมดอายุ', 'จำนวน', 'ทุน/หน่วย'],
  rowHtml: () => `<td><input class="drug" list="drugList" placeholder="พิมพ์ชื่อหรือรหัส${L()}"></td><td><input class="lot"></td><td><input type="date" class="exp"></td><td><input type="number" class="qty" min="0" step="any"></td><td><input type="number" class="cost" min="0" step="any"></td>`,
  onSave: async tr => {
    const d = resolveDrug(tr.querySelector('.drug').value); if (!d) throw new Error(`ไม่พบ${L()}ในบัญชี`);
    let exp = tr.querySelector('.exp').value, lot = tr.querySelector('.lot').value.trim();
    if (!exp) { if (d.item_type === 'supply') exp = NOEXP; else throw new Error('กรุณาระบุวันหมดอายุ'); }
    if (daysTo(exp) < 0) throw new Error('ล็อตนี้หมดอายุแล้ว');
    // วัสดุที่ไม่มี Lot: แยกล็อตตามรอบรับ (วันที่/เลขที่เอกสาร) เพื่อคิดมูลค่าตามราคาซื้อจริงแบบ FIFO
    if (!lot && d.item_type === 'supply') lot = `รับ ${hv('h_date') || today()}${hv('h_ref') ? ' / ' + hv('h_ref') : ''}`;
    const cost = tr.querySelector('.cost').value;
    const { error } = await sb.rpc('receive_stock', { p_facility_id: S.fid, p_drug_id: d.id, p_qty: Number(tr.querySelector('.qty').value), p_lot_no: lot, p_exp_date: exp, p_unit_cost: cost === '' ? null : Number(cost), p_tx_date: hv('h_date'), p_ref_no: hv('h_ref'), p_source: hv('h_src'), p_note: hv('h_note') });
    if (error) throw error;
  }
});

views.dispense = async () => {
  linesForm({
    title: `จ่าย${L()}ออกจากคลัง (${isSupply() ? 'FIFO' : 'FEFO'} อัตโนมัติ)`,
    header: `<label>วันที่จ่าย<input type="date" id="h_date" value="${today()}"></label>
      <label>เลขที่ใบเบิก/อ้างอิง<input id="h_ref"></label>
      <label>จ่ายให้<input id="h_src" placeholder="${isSupply() ? 'เช่น งานแพทย์แผนไทย / ห้องทำแผล / งานธุรการ' : 'เช่น ห้องจ่ายยา / เยี่ยมบ้าน / อสม.'}"></label>
      <label>หมายเหตุ<input id="h_note"></label>`,
    cols: [L(), 'จำนวน', 'คงเหลือใช้ได้'],
    rowHtml: () => `<td><input class="drug" list="drugList" placeholder="พิมพ์ชื่อหรือรหัส${L()}"></td><td><input type="number" class="qty" min="0" step="any"></td><td class="avail muted">-</td>`,
    onSave: async tr => {
      const d = resolveDrug(tr.querySelector('.drug').value); if (!d) throw new Error(`ไม่พบ${L()}ในบัญชี`);
      const { error } = await sb.rpc('dispense_stock', { p_facility_id: S.fid, p_drug_id: d.id, p_qty: Number(tr.querySelector('.qty').value), p_tx_date: hv('h_date'), p_ref_no: hv('h_ref'), p_source: hv('h_src'), p_note: hv('h_note') });
      if (error) throw error;
    }
  });
  $('#lines').addEventListener('change', async e => {
    if (!e.target.classList.contains('drug')) return;
    const tr = e.target.closest('tr'), d = resolveDrug(e.target.value), cell = tr.querySelector('.avail');
    if (!d) { cell.textContent = `ไม่พบ${L()}`; return; }
    const { data } = await sb.from('v_stock').select('total_qty,expired_qty').eq('facility_id', S.fid).eq('drug_id', d.id).maybeSingle();
    cell.textContent = data ? `${fmt(data.total_qty - data.expired_qty)} ${d.unit}` : '0';
  });
};

/* ---------- ตัดหมดอายุ / ตรวจนับ ---------- */
views.adjust = async () => {
  main().innerHTML = `<div class="card"><h2>ตัด${L()}หมดอายุ/ชำรุด / ปรับยอดตามการตรวจนับ — ${esc(facName(S.fid))}</h2>
    <div class="row"><label>เลือก${L()}<input id="adrug" list="drugList" placeholder="พิมพ์ชื่อหรือรหัส${L()}"></label>
      <label style="flex:0 0 160px">วันที่<input type="date" id="adate" value="${today()}"></label>
      <button class="btn" id="aexp">แสดงล็อตหมดอายุทั้งหมด</button></div>
    <div id="alots" style="margin-top:12px"></div></div>`;
  const drawLots = (lots, showDrug) => {
    $('#alots').innerHTML = lots.length ? `<div class="table-wrap"><table class="lines"><thead><tr>${showDrug ? `<th>${L()}</th>` : ''}<th>Lot</th><th>วันหมดอายุ</th><th class="n">คงเหลือในระบบ</th><th>ทำรายการ</th><th>จำนวน</th><th>เหตุผล</th><th></th></tr></thead><tbody>
      ${lots.map(l => `<tr data-lot="${l.id}">${showDrug ? `<td>${esc(drugName(l.drug_id))}</td>` : ''}<td>${esc(l.lot_no)}</td><td>${thDate(l.exp_date)} ${daysTo(l.exp_date) < 0 ? '<span class="badge b-red">หมดอายุ</span>' : ''}</td><td class="n">${fmt(l.qty)}</td>
        <td><select class="atype"><option value="expire">ตัดออก (หมดอายุ/เสื่อม/แตก)</option><option value="adjust">ปรับเป็นยอดที่นับได้</option></select></td>
        <td><input type="number" class="aqty" min="0" step="any" value="${daysTo(l.exp_date) < 0 ? l.qty : ''}"></td><td><input class="anote" placeholder="${daysTo(l.exp_date) < 0 ? 'หมดอายุ' : 'เช่น ตรวจนับประจำเดือน'}"></td>
        <td><button class="btn sm primary">บันทึก</button></td></tr>`).join('')}</tbody></table></div>
      <p class="muted">"ตัดออก" = ใส่จำนวนที่ต้องการตัด · "ปรับเป็นยอดที่นับได้" = ใส่จำนวนที่นับได้จริง ระบบคำนวณส่วนต่างให้ (ต้องระบุเหตุผล)</p>` : '<p class="muted">ไม่มีล็อตคงเหลือ</p>';
    $$('#alots tr[data-lot] button').forEach(b => b.onclick = async () => {
      const tr = b.closest('tr'), type = tr.querySelector('.atype').value, note = tr.querySelector('.anote').value.trim() || (type === 'expire' ? tr.querySelector('.anote').placeholder : '');
      b.disabled = true;
      const { error } = await sb.rpc('lot_adjust', { p_lot_id: Number(tr.dataset.lot), p_type: type, p_qty: Number(tr.querySelector('.aqty').value), p_tx_date: $('#adate').value || null, p_note: note || null });
      b.disabled = false;
      if (error) return toast(errMsg(error), true);
      toast('บันทึกแล้ว'); reload();
    });
  };
  let mode = null;
  const reload = async () => {
    if (mode === 'exp') {
      drawLots((await fetchAll(() => sb.from('lots').select('*').eq('facility_id', S.fid).gt('qty', 0).lt('exp_date', today()).order('exp_date'))).filter(l => inMode(l.drug_id)), true);
    } else if (mode) {
      const { data, error } = await sb.from('lots').select('*').eq('facility_id', S.fid).eq('drug_id', mode).gt('qty', 0).order('exp_date');
      if (error) return toast(errMsg(error), true); drawLots(data, false);
    }
  };
  $('#adrug').onchange = () => { const d = resolveDrug($('#adrug').value); if (!d) return toast(`ไม่พบ${L()}`, true); mode = d.id; reload(); };
  $('#aexp').onclick = () => { mode = 'exp'; $('#adrug').value = ''; reload(); };
};

/* ---------- ประวัติ ---------- */
views.history = async () => {
  main().innerHTML = `<div class="card no-print"><div class="row">
    <label>ตั้งแต่<input type="date" id="hf" value="${today().slice(0, 8)}01"></label><label>ถึง<input type="date" id="ht" value="${today()}"></label>
    <label>ประเภท<select id="hty"><option value="">ทั้งหมด</option>${Object.entries(TX).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
    <label>${L()}<input id="hd" list="drugList" placeholder="ทั้งหมด"></label>
    <button class="btn primary" id="hgo">แสดง</button><button class="btn" id="hx">ส่งออก CSV</button></div></div>
    <div class="card table-wrap" id="htbl"></div>`;
  let data = [];
  const load = async () => {
    $('#htbl').innerHTML = '<div class="loading">กำลังโหลด…</div>';
    const d = resolveDrug($('#hd').value), ty = $('#hty').value;
    data = await fetchAll(() => { let q = sb.from('stock_tx').select('*, lots(lot_no,exp_date)').eq('facility_id', S.fid).gte('tx_date', $('#hf').value).lte('tx_date', $('#ht').value); if (ty) q = q.eq('tx_type', ty); if (d) q = q.eq('drug_id', d.id); return q.order('tx_date', { ascending: false }).order('id', { ascending: false }); });
    data = data.filter(t => inMode(t.drug_id));
    $('#htbl').innerHTML = `<h2>ประวัติการเคลื่อนไหว${L()} — ${esc(facName(S.fid))} <small class="muted">(${data.length} รายการ)</small></h2>
      <table><thead><tr><th>วันที่</th><th>ประเภท</th><th>${L()}</th><th>Lot / หมดอายุ</th><th class="n">จำนวน</th><th class="n">คงเหลือ</th><th>เลขที่</th><th>รับจาก/จ่ายให้</th><th>หมายเหตุ</th></tr></thead><tbody>
      ${data.map(t => `<tr><td>${thDate(t.tx_date)}</td><td>${TX[t.tx_type]}</td><td>${esc(drugName(t.drug_id))}</td><td>${esc(t.lots?.lot_no || '')} ${t.lots ? '· ' + thDate(t.lots.exp_date) : ''}</td>
        <td class="n ${t.qty > 0 ? 't-in' : 't-out'}">${t.qty > 0 ? '+' : ''}${fmt(t.qty)}</td><td class="n">${fmt(t.balance_after)}</td><td>${esc(t.ref_no || '')}</td><td>${esc(t.source || '')}</td><td>${esc(t.note || '')}</td></tr>`).join('') || '<tr><td colspan="9" class="muted">ไม่มีรายการ</td></tr>'}
      </tbody></table>`;
  };
  $('#hgo').onclick = load;
  $('#hx').onclick = () => downloadCSV(`ประวัติ${L()}_${facName(S.fid)}_${$('#hf').value}_${$('#ht').value}.csv`,
    [['วันที่', 'ประเภท', 'รหัส', 'ชื่อ', 'Lot', 'วันหมดอายุ', 'จำนวน', 'คงเหลือ', 'เลขที่', 'รับจาก/จ่ายให้', 'หมายเหตุ'],
     ...data.map(t => [t.tx_date, TX[t.tx_type], S.drugById.get(t.drug_id)?.code, drugName(t.drug_id), t.lots?.lot_no, t.lots?.exp_date === NOEXP ? '' : t.lots?.exp_date, t.qty, t.balance_after, t.ref_no, t.source, t.note])]);
  await load();
};

/* ---------- รายงานรับ-จ่ายรายเดือน ---------- */
views.report = async () => {
  const ym = today().slice(0, 7);
  main().innerHTML = `<div class="card no-print"><div class="row"><label style="flex:0 0 200px">เดือน<input type="month" id="rm" value="${ym}"></label>
    <button class="btn primary" id="rgo">แสดง</button><button class="btn" id="rx">ส่งออก CSV</button><button class="btn" onclick="print()">พิมพ์</button></div></div>
    <div class="card table-wrap" id="rtbl"></div>`;
  let out = [];
  const load = async () => {
    $('#rtbl').innerHTML = '<div class="loading">กำลังคำนวณ…</div>';
    const [y, m] = $('#rm').value.split('-').map(Number);
    const from = `${y}-${String(m).padStart(2, '0')}-01`, to = new Date(y, m, 0).toLocaleDateString('sv-SE');
    const [stock, txs] = await Promise.all([
      fetchAll(() => sb.from('v_stock').select('drug_id,code,drug_name,strength,unit,unit_price,total_qty').eq('facility_id', S.fid).eq('item_type', S.mode)),
      fetchAll(() => sb.from('stock_tx').select('drug_id,tx_type,qty,tx_date').eq('facility_id', S.fid).gte('tx_date', from))
    ]);
    const acc = new Map();
    for (const t of txs) {
      const a = acc.get(t.drug_id) || { after: 0, in: 0, out: 0, adj: 0 }; acc.set(t.drug_id, a);
      if (t.tx_date > to) a.after += Number(t.qty);
      else if (t.tx_type === 'receive' || t.tx_type === 'opening') a.in += Number(t.qty);
      else if (t.tx_type === 'dispense') a.out += -Number(t.qty);
      else a.adj += Number(t.qty);
    }
    out = stock.map(r => { const a = acc.get(r.drug_id) || { after: 0, in: 0, out: 0, adj: 0 }; const close = r.total_qty - a.after; return { ...r, open: close - a.in + a.out - a.adj, in: a.in, out: a.out, adj: a.adj, close }; })
      .filter(r => r.open || r.in || r.out || r.adj || r.close).sort((a, b) => a.drug_name.localeCompare(b.drug_name, 'th'));
    const val = k => out.reduce((s, r) => s + r[k] * r.unit_price, 0);
    $('#rtbl').innerHTML = `<h2>รายงานรับ-จ่าย${L()} ${esc(facName(S.fid))} ประจำเดือน ${new Date(from + 'T00:00:00').toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}</h2>
      <table><thead><tr><th>รหัส</th><th>ชื่อ${L()}</th><th>หน่วย</th><th class="n">ยกมา</th><th class="n">รับ</th><th class="n">จ่าย</th><th class="n">ปรับ/ตัด</th><th class="n">คงเหลือ</th><th class="n">มูลค่าคงเหลือ</th></tr></thead><tbody>
      ${out.map(r => `<tr><td>${esc(r.code || '')}</td><td>${esc(r.drug_name)} ${esc(r.strength || '')}</td><td>${esc(r.unit)}</td><td class="n">${fmt(r.open)}</td><td class="n">${fmt(r.in)}</td><td class="n">${fmt(r.out)}</td><td class="n">${fmt(r.adj)}</td><td class="n"><b>${fmt(r.close)}</b></td><td class="n">${fmt(r.close * r.unit_price)}</td></tr>`).join('') || '<tr><td colspan="9" class="muted">ไม่มีข้อมูล</td></tr>'}
      </tbody><tfoot><tr><th colspan="3">มูลค่ารวม (บาท, ราคากลาง)</th><th class="n">${fmt(val('open'))}</th><th class="n">${fmt(val('in'))}</th><th class="n">${fmt(val('out'))}</th><th class="n">${fmt(val('adj'))}</th><th class="n">${fmt(val('close'))}</th><th></th></tr></tfoot></table>`;
  };
  $('#rgo').onclick = load;
  $('#rx').onclick = () => downloadCSV(`รายงานรับจ่าย${L()}_${facName(S.fid)}_${$('#rm').value}.csv`,
    [['รหัส', 'ชื่อ', 'ความแรง', 'หน่วย', 'ยกมา', 'รับ', 'จ่าย', 'ปรับ/ตัด', 'คงเหลือ', 'ราคา/หน่วย', 'มูลค่าคงเหลือ'],
     ...out.map(r => [r.code, r.drug_name, r.strength, r.unit, r.open, r.in, r.out, r.adj, r.close, r.unit_price, (r.close * r.unit_price).toFixed(2)])]);
  await load();
};

/* ---------- ทะเบียนคุม (บัญชีวัสดุ / บัญชียา) รายปีงบประมาณ ---------- */
// ปีงบประมาณ (ค.ศ. ปีที่สิ้นสุด): ต.ค.–ก.ย.
const fyOf = d => +d.slice(0, 4) + (+d.slice(5, 7) >= 10 ? 1 : 0);

views.ledger = async () => {
  const cur = fyOf(today());
  main().innerHTML = `<div class="card no-print"><h2>ทะเบียนคุม${L()} (${isSupply() ? 'บัญชีวัสดุ' : 'บัญชียา'})</h2>
    <div class="row"><label>${L()}<input id="lgItem" list="drugList" placeholder="พิมพ์ชื่อหรือรหัส — เว้นว่างเพื่อแสดงทุกรายการที่มีความเคลื่อนไหว"></label>
      <label style="flex:0 0 160px">ปีงบประมาณ<select id="lgFy">${[0, 1, 2, 3].map(i => `<option value="${cur - i}">${cur - i + 543}</option>`).join('')}</select></label>
      <button class="btn primary" id="lgGo">แสดง</button><button class="btn" onclick="print()">พิมพ์</button></div>
    <p class="muted">มูลค่าคิดตามราคาที่รับเข้าจริงของแต่ละล็อต (จ่ายออกแบบ ${isSupply() ? 'FIFO' : 'FEFO'}) — ล็อตที่ไม่ได้ระบุราคาใช้ราคากลางในบัญชี</p></div>
    <div id="lgOut"></div>`;
  $('#lgGo').onclick = async () => {
    const txt = $('#lgItem').value.trim(), item = txt ? resolveDrug(txt) : null;
    if (txt && !item) return toast(`ไม่พบ${L()}`, true);
    $('#lgOut').innerHTML = '<div class="loading">กำลังจัดทำทะเบียน…</div>';
    try { $('#lgOut').innerHTML = await buildLedger(item, Number($('#lgFy').value)); }
    catch (e) { $('#lgOut').innerHTML = `<div class="card">เกิดข้อผิดพลาด: ${esc(errMsg(e))}</div>`; }
  };
};

async function buildLedger(item, fy) {
  const from = `${fy - 1}-10-01`, to = `${fy}-09-30`;
  const byItem = q => item ? q.eq('drug_id', item.id) : q;
  const [lots, txs, lvls] = await Promise.all([
    fetchAll(() => byItem(sb.from('lots').select('id,drug_id,lot_no,exp_date,qty,unit_cost').eq('facility_id', S.fid)).order('id')),
    fetchAll(() => byItem(sb.from('stock_tx').select('id,drug_id,lot_id,tx_type,qty,tx_date,ref_no,source,note').eq('facility_id', S.fid).gte('tx_date', from)).order('tx_date').order('id')),
    fetchAll(() => byItem(sb.from('stock_levels').select('*').eq('facility_id', S.fid)))
  ]);
  const items = item ? [item] : S.drugs.filter(d => d.item_type === S.mode).sort((a, b) => a.name.localeCompare(b.name, 'th'));
  const lotsBy = new Map(), txBy = new Map();
  lots.forEach(l => (lotsBy.get(l.drug_id) || lotsBy.set(l.drug_id, []).get(l.drug_id)).push(l));
  txs.forEach(t => (txBy.get(t.drug_id) || txBy.set(t.drug_id, []).get(t.drug_id)).push(t));
  const lvlBy = new Map(lvls.map(v => [v.drug_id, v]));
  const blocks = [];

  for (const d of items) {
    const ilots = lotsBy.get(d.id) || [], itx = txBy.get(d.id) || [];
    // ยอดของแต่ละล็อต ณ วันต้นปีงบ = คงเหลือปัจจุบัน − ความเคลื่อนไหวตั้งแต่ต้นปีงบ
    const q = new Map(ilots.map(l => [l.id, Number(l.qty)])), cost = new Map(ilots.map(l => [l.id, l.unit_cost != null ? Number(l.unit_cost) : Number(d.unit_price)]));
    itx.forEach(t => q.set(t.lot_id, (q.get(t.lot_id) || 0) - Number(t.qty)));
    const sumQ = () => [...q.values()].reduce((a, v) => a + v, 0);
    const sumV = () => [...q].reduce((a, [id, v]) => a + v * (cost.get(id) ?? 0), 0);
    const inFy = itx.filter(t => t.tx_date <= to);
    if (!item && !inFy.length && sumQ() === 0) continue;

    const lotOf = id => ilots.find(l => l.id === id);
    let rows = `<tr><td>${thDate(from)}</td><td></td><td>ยอดยกมา</td><td class="n"></td><td class="n"></td><td class="n"></td><td class="n"><b>${fmt(sumQ())}</b></td><td class="n">${fmt(sumV())}</td><td></td></tr>`;
    let tin = 0, tout = 0;
    for (const t of inFy) {
      q.set(t.lot_id, (q.get(t.lot_id) || 0) + Number(t.qty));
      const lt = lotOf(t.lot_id), qty = Number(t.qty);
      if (qty > 0) tin += qty; else tout += -qty;
      const who = t.source || TX[t.tx_type];
      const note = [t.tx_type === 'adjust' || t.tx_type === 'expire' ? TX[t.tx_type] : '', !isSupply() && lt ? `Lot ${lt.lot_no} หมดอายุ ${thDate(lt.exp_date)}` : '', t.note].filter(Boolean).join(' · ');
      rows += `<tr><td>${thDate(t.tx_date)}</td><td>${esc(t.ref_no || '')}</td><td>${esc(who)}</td><td class="n">${fmt(cost.get(t.lot_id))}</td>
        <td class="n">${qty > 0 ? fmt(qty) : ''}</td><td class="n">${qty < 0 ? fmt(-qty) : ''}</td><td class="n">${fmt(sumQ())}</td><td class="n">${fmt(sumV())}</td><td>${esc(note)}</td></tr>`;
    }
    const lv = lvlBy.get(d.id);
    blocks.push(`<div class="card ledger">
      <h3 class="lh">${isSupply() ? 'บัญชีวัสดุ' : 'บัญชียา'}</h3>
      <div class="meta"><span>ส่วนราชการ <b>${esc(facName(S.fid))}</b></span><span>ปีงบประมาณ <b>${fy + 543}</b></span>
        <span>ประเภท <b>${esc(d.category || '-')}</b></span><span>ชื่อหรือชนิด <b>${esc(d.name)}${d.strength ? ' ' + esc(d.strength) : ''}</b></span>
        <span>รหัส <b>${esc(d.code || '-')}</b></span><span>หน่วยนับ <b>${esc(d.unit)}</b></span>
        <span>จำนวนอย่างสูง <b>${lv?.max_qty ? fmt(lv.max_qty) : '-'}</b></span><span>จำนวนอย่างต่ำ <b>${lv?.min_qty ? fmt(lv.min_qty) : '-'}</b></span></div>
      <div class="table-wrap"><table><thead><tr><th>วัน เดือน ปี</th><th>ที่เอกสาร</th><th>รับจาก / จ่ายให้</th><th>ราคาต่อหน่วย</th><th>รับ</th><th>จ่าย</th><th>คงเหลือ</th><th>มูลค่าคงเหลือ (บาท)</th><th>หมายเหตุ</th></tr></thead>
      <tbody>${rows}</tbody><tfoot><tr><th colspan="4">รวมทั้งปีงบประมาณ</th><th class="n">${fmt(tin)}</th><th class="n">${fmt(tout)}</th><th class="n">${fmt(sumQ())}</th><th class="n">${fmt(sumV())}</th><th></th></tr></tfoot></table></div></div>`);
  }
  return blocks.join('') || `<div class="card muted">ไม่มีความเคลื่อนไหวในปีงบประมาณ ${fy + 543}</div>`;
}

/* ---------- ผู้ดูแลระบบ ---------- */
views.admin = async () => {
  const { data: users, error } = await sb.from('profiles').select('*').order('created_at');
  if (error) throw error;
  const facOpts = sel => `<option value="">— ยังไม่กำหนด —</option>` + S.facilities.map(f => `<option value="${f.id}" ${f.id === sel ? 'selected' : ''}>${esc(f.name)}</option>`).join('');
  main().innerHTML = `
  <div class="card"><h2>ผู้ใช้งาน</h2><p class="muted">ผู้ใช้สมัครเองที่หน้าเข้าสู่ระบบ แล้วผู้ดูแลกำหนด รพ.สต. และสิทธิ์ที่นี่</p>
    <div class="table-wrap"><table><thead><tr><th>อีเมล</th><th>ชื่อ</th><th>รพ.สต.</th><th>สิทธิ์</th><th>ใช้งาน</th><th></th></tr></thead><tbody>
    ${users.map(u => `<tr data-u="${u.id}"><td>${esc(u.email)}</td><td><input class="un" value="${esc(u.full_name || '')}"></td><td><select class="uf">${facOpts(u.facility_id)}</select></td>
      <td><select class="ur"><option value="staff" ${u.role === 'staff' ? 'selected' : ''}>เจ้าหน้าที่</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>ผู้ดูแลระบบ</option></select></td>
      <td><input type="checkbox" class="ua" style="width:auto" ${u.active ? 'checked' : ''}></td><td><button class="btn sm primary">บันทึก</button></td></tr>`).join('')}
    </tbody></table></div></div>

  <div class="card"><h2>หน่วยบริการ</h2><div class="table-wrap"><table><thead><tr><th>รหัสหน่วยบริการ</th><th>ชื่อ</th><th>ใช้งาน</th><th></th></tr></thead><tbody>
    ${S.facilities.map(f => `<tr data-f="${f.id}"><td><input class="fh" value="${esc(f.hcode)}"></td><td><input class="fn" value="${esc(f.name)}"></td><td><input type="checkbox" class="fa" style="width:auto" ${f.active ? 'checked' : ''}></td><td><button class="btn sm primary">บันทึก</button></td></tr>`).join('')}
    </tbody></table></div><button class="btn" id="addFac" style="margin-top:8px">+ เพิ่มหน่วยบริการ</button></div>

  <div class="card"><div class="row"><h2 style="margin:0">บัญชี${L()} (${S.drugs.filter(d => d.item_type === S.mode).length} รายการ)</h2><span class="spacer"></span>
    <input id="dq" placeholder="ค้นหา" style="max-width:220px"><button class="btn primary" id="addDrug">+ เพิ่ม${L()}</button></div>
    <p class="muted" style="margin:6px 0 0">สลับ ยา/วัสดุ ได้ที่ปุ่มมุมขวาบน</p>
    <div class="table-wrap" style="max-height:420px;overflow:auto;margin-top:10px" id="dtbl"></div></div>

  <div class="card"><h2>นำเข้าข้อมูลจาก CSV (ย้ายจาก Google Sheet)</h2>
    <p class="muted">บันทึก Sheet เป็น CSV (UTF-8) ให้หัวคอลัมน์ตรงกับแม่แบบ วันที่ใช้ได้ทั้ง 2027-03-31 หรือ 31/03/2570</p>
    <div class="row"><label>1) บัญชียาและวัสดุ (คอลัมน์ item_type: drug หรือ supply)<input type="file" id="impDrug" accept=".csv"></label><button class="btn sm" id="tplDrug">โหลดแม่แบบ</button></div>
    <div class="row" style="margin-top:10px"><label>2) ยอดยกมา (คงคลังตั้งต้นทุก รพ.สต.)<input type="file" id="impOpen" accept=".csv"></label><button class="btn sm" id="tplOpen">โหลดแม่แบบ</button></div>
    <pre id="impLog" class="muted" style="white-space:pre-wrap;max-height:240px;overflow:auto"></pre></div>`;

  $$('tr[data-u] button').forEach(b => b.onclick = async () => {
    const tr = b.closest('tr');
    const { error } = await sb.from('profiles').update({ full_name: tr.querySelector('.un').value, facility_id: Number(tr.querySelector('.uf').value) || null, role: tr.querySelector('.ur').value, active: tr.querySelector('.ua').checked }).eq('id', tr.dataset.u);
    toast(error ? errMsg(error) : 'บันทึกแล้ว', !!error);
  });
  $$('tr[data-f] button').forEach(b => b.onclick = async () => {
    const tr = b.closest('tr');
    const { error } = await sb.from('facilities').update({ hcode: tr.querySelector('.fh').value.trim(), name: tr.querySelector('.fn').value.trim(), active: tr.querySelector('.fa').checked }).eq('id', Number(tr.dataset.f));
    if (error) return toast(errMsg(error), true);
    toast('บันทึกแล้ว'); await loadRefs(); boot();
  });
  $('#addFac').onclick = async () => {
    const hcode = prompt('รหัสหน่วยบริการ (5 หลัก)'); if (!hcode) return; const name = prompt('ชื่อ รพ.สต.'); if (!name) return;
    const { error } = await sb.from('facilities').insert({ hcode, name });
    if (error) return toast(errMsg(error), true); await loadRefs(); boot();
  };

  const drawDrugs = () => {
    const q = $('#dq').value.trim().toLowerCase();
    const list = S.drugs.filter(d => d.item_type === S.mode && (!q || d.name.toLowerCase().includes(q) || (d.code || '').toLowerCase().includes(q)));
    $('#dtbl').innerHTML = `<table><thead><tr><th>รหัส</th><th>ชื่อ${L()}</th><th>${isSupply() ? 'ขนาด/รุ่น' : 'ความแรง'}</th><th>รูปแบบ</th><th>หน่วย</th><th>กลุ่ม</th><th class="n">ราคา</th><th>สถานะ</th><th></th></tr></thead><tbody>
      ${list.map(d => `<tr><td>${esc(d.code || '')}</td><td>${esc(d.name)}</td><td>${esc(d.strength || '')}</td><td>${esc(d.dosage_form || '')}</td><td>${esc(d.unit)}</td><td>${esc(d.category || '')}</td><td class="n">${fmt(d.unit_price)}</td><td>${d.active ? '<span class="badge b-green">ใช้</span>' : '<span class="badge b-grey">ยกเลิก</span>'}</td><td><button class="btn sm" data-ed="${d.id}">แก้ไข</button></td></tr>`).join('')}
      </tbody></table>`;
    $$('[data-ed]').forEach(b => b.onclick = () => drugForm(S.drugById.get(Number(b.dataset.ed))));
  };
  $('#dq').oninput = drawDrugs; $('#addDrug').onclick = () => drugForm(null); drawDrugs();

  $('#tplDrug').onclick = () => downloadCSV('แม่แบบ_บัญชียาและวัสดุ.csv', [['item_type', 'code', 'name', 'strength', 'dosage_form', 'unit', 'category', 'unit_price'],
    ['drug', 'PARA500', 'Paracetamol', '500 mg', 'tablet', 'เม็ด', 'ED', '0.25'], ['supply', 'GAUZE3', 'ผ้าก๊อซ', '3x3 นิ้ว', '', 'ห่อ', 'วัสดุการแพทย์', '12'], ['supply', 'A4', 'กระดาษ A4', '80 แกรม', '', 'รีม', 'วัสดุสำนักงาน', '115']]);
  $('#tplOpen').onclick = () => downloadCSV('แม่แบบ_ยอดยกมา.csv', [['hcode', 'drug_code', 'lot_no', 'exp_date', 'qty', 'unit_cost'], ['00001', 'PARA500', 'A123', '31/12/2570', '1000', '0.25'], ['00001', 'A4', '', '', '20', '115']]);
  const log = s => { $('#impLog').textContent += s + '\n'; };

  $('#impDrug').onchange = async e => {
    const file = e.target.files[0]; if (!file) return; $('#impLog').textContent = '';
    const rows = parseCSV(await file.text());
    const recs = [], errs = [];
    rows.forEach((r, i) => { const t = (r.item_type || 'drug').toLowerCase(); if (!r.code || !r.name) errs.push(`แถว ${i + 2}: ไม่มี code หรือ name`); else if (!ITEM_TYPES[t]) errs.push(`แถว ${i + 2}: item_type ต้องเป็น drug หรือ supply`); else recs.push({ item_type: t, code: r.code, name: r.name, strength: r.strength || null, dosage_form: r.dosage_form || null, unit: r.unit || 'เม็ด', category: r.category || null, unit_price: Number(r.unit_price || 0), active: true }); });
    errs.forEach(log);
    for (let i = 0; i < recs.length; i += 500) {
      const { error } = await sb.from('drugs').upsert(recs.slice(i, i + 500), { onConflict: 'code' });
      if (error) { log('ผิดพลาด: ' + errMsg(error)); return; }
    }
    log(`นำเข้า/อัปเดตบัญชี ${recs.length} รายการ (ยา ${recs.filter(r => r.item_type === 'drug').length}, วัสดุ ${recs.filter(r => r.item_type === 'supply').length})`); await loadRefs(); drawDrugs(); e.target.value = '';
  };

  $('#impOpen').onchange = async e => {
    const file = e.target.files[0]; if (!file) return; $('#impLog').textContent = '';
    const rows = parseCSV(await file.text());
    if (!confirm(`นำเข้ายอดยกมา ${rows.length} แถว? (ถ้านำเข้าซ้ำ ยอดจะถูกบวกเพิ่ม)`)) { e.target.value = ''; return; }
    const facByH = new Map(S.facilities.map(f => [f.hcode, f.id])), drugByCode = new Map(S.drugs.map(d => [d.code, d]));
    let ok = 0;
    for (const [i, r] of rows.entries()) {
      const fid = facByH.get(r.hcode), d = drugByCode.get(r.drug_code), qty = Number(r.qty);
      const exp = normDate(r.exp_date) || (d?.item_type === 'supply' && !r.exp_date ? NOEXP : null);
      if (!fid) { log(`แถว ${i + 2}: ไม่พบรหัสหน่วยบริการ ${r.hcode}`); continue; }
      if (!d) { log(`แถว ${i + 2}: ไม่พบรหัสยา/วัสดุ ${r.drug_code}`); continue; }
      if (!exp) { log(`แถว ${i + 2}: วันหมดอายุไม่ถูกต้อง "${r.exp_date}"`); continue; }
      if (!(qty > 0)) continue;
      const { error } = await sb.rpc('receive_stock', { p_facility_id: fid, p_drug_id: d.id, p_qty: qty, p_lot_no: r.lot_no || (d.item_type === 'supply' ? 'ยอดยกมา' : ''), p_exp_date: exp, p_unit_cost: r.unit_cost === '' || r.unit_cost == null ? null : Number(r.unit_cost), p_source: 'ยอดยกมา', p_opening: true });
      if (error) log(`แถว ${i + 2}: ${errMsg(error)}`); else ok++;
      if ((i + 1) % 50 === 0) log(`… ดำเนินการแล้ว ${i + 1}/${rows.length} แถว`);
    }
    log(`นำเข้ายอดยกมาสำเร็จ ${ok} จาก ${rows.length} แถว`); e.target.value = '';
  };
};

function drugForm(d) {
  const type = d?.item_type || S.mode;
  openModal(`<div class="modal-head"><h2>${d ? 'แก้ไข' : 'เพิ่ม'}${ITEM_TYPES[type]}</h2><button class="btn sm" data-close>ปิด</button></div>
    <form id="dform" class="grid-form">
      <label>ประเภท<select name="item_type">${Object.entries(ITEM_TYPES).map(([k, v]) => `<option value="${k}" ${k === type ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label>รหัส<input name="code" value="${esc(d?.code || '')}" required></label>
      <label>ชื่อ<input name="name" value="${esc(d?.name || '')}" required></label>
      <label>ความแรง / ขนาด / รุ่น<input name="strength" value="${esc(d?.strength || '')}"></label>
      <label>รูปแบบ<input name="dosage_form" value="${esc(d?.dosage_form || '')}"></label>
      <label>หน่วยนับ<input name="unit" value="${esc(d?.unit || (type === 'supply' ? 'ชิ้น' : 'เม็ด'))}" required></label>
      <label>กลุ่ม / ประเภทวัสดุ<input name="category" list="catList" value="${esc(d?.category || '')}"></label>
      <datalist id="catList">${[...SUPPLY_CATS, 'ED', 'NED', 'ยาสมุนไพร', 'เวชภัณฑ์มิใช่ยา'].map(c => `<option value="${c}">`).join('')}</datalist>
      <label>ราคา/หน่วย<input name="unit_price" type="number" step="any" min="0" value="${d?.unit_price ?? 0}"></label>
      <label>สถานะ<select name="active"><option value="1">ใช้งาน</option><option value="0" ${d && !d.active ? 'selected' : ''}>ยกเลิก</option></select></label>
      <button class="btn primary">บันทึก</button></form>`);
  $('#dform').onsubmit = async e => {
    e.preventDefault(); const f = Object.fromEntries(new FormData(e.target));
    const rec = { item_type: f.item_type, code: f.code.trim(), name: f.name.trim(), strength: f.strength || null, dosage_form: f.dosage_form || null, unit: f.unit.trim(), category: f.category || null, unit_price: Number(f.unit_price || 0), active: f.active === '1' };
    const { error } = d ? await sb.from('drugs').update(rec).eq('id', d.id) : await sb.from('drugs').insert(rec);
    if (error) return toast(errMsg(error), true);
    toast('บันทึกแล้ว'); closeModal(); await loadRefs(); go('admin');
  };
}

boot().catch(e => { showLogin(); toast(errMsg(e), true); });

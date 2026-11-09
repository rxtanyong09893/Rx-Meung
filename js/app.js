'use strict';
/* ================= Utilities ================= */
const $ = (s, r) => (r || document).querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Number(n || 0).toLocaleString('th-TH-u-nu-latn');  // เลขอารบิกเสมอ
const money = n => Number(n || 0).toLocaleString('th-TH-u-nu-latn', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const thDate = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + (+iso.slice(0, 4) + 543) : '-';
const thDT = s => s ? thDate(s) + ' ' + s.slice(11, 16) : '-';
const todayIso = () => { const d = new Date(), z = n => ('0' + n).slice(-2); return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); };
const fyStart = () => { const t = todayIso(), y = +t.slice(0, 4); return (+t.slice(5, 7) >= 10 ? y : y - 1) + '-10-01'; };
const ST = { pending: 'รออนุมัติ', processing: 'กำลังดำเนินการ', approved: 'อนุมัติแล้ว', rejected: 'ไม่อนุมัติ', cancelled: 'ยกเลิก', active: 'ใช้งาน', disabled: 'ระงับ' };
const badge = s => `<span class="badge b-${esc(s)}">${esc(ST[s] || s)}</span>`;
const expBadge = (e) => { const t = todayIso(), n = new Date(Date.now() + 180 * 864e5), nl = n.getFullYear() + '-' + ('0' + (n.getMonth() + 1)).slice(-2) + '-' + ('0' + n.getDate()).slice(-2); return e < t ? '<span class="badge b-exp">หมดอายุ</span>' : e <= nl ? '<span class="badge b-near">ใกล้หมดอายุ</span>' : ''; };
/** dropdown เลือกเวชภัณฑ์ (select แบบเดียวกับหน้าบันทึก ME) จัดกลุ่มตามหมวด เรียงตามชื่อ */
const drugOpts = (ds, blank, sel) => {
  const g = {}; ds.forEach(d => { const c = d.category || 'ไม่ระบุหมวด'; (g[c] = g[c] || []).push(d); });
  const cats = Object.keys(g).sort((a, b) => a.localeCompare(b, 'th'));
  const op = d => `<option value="${esc(d.drugId)}"${d.drugId === sel ? ' selected' : ''}>${esc(d.name)} (${esc(d.unit)})</option>`;
  return `<option value="">${esc(blank)}</option>` + (cats.length < 2 ? ds.slice().sort((a, b) => a.name.localeCompare(b.name, 'th')).map(op).join('')
    : cats.map(c => `<optgroup label="${esc(c)}">${g[c].sort((a, b) => a.name.localeCompare(b.name, 'th')).map(op).join('')}</optgroup>`).join(''));
};
const daysTo = e => Math.round((new Date(e + 'T00:00:00') - new Date(todayIso() + 'T00:00:00')) / 864e5);
const ICON = {
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  plus: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>',
  list: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>',
  box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  swap: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  act: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'
};
const ico = n => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;
const LOGO = '<img src="logo.jpg" alt="โลโก้ องค์การบริหารส่วนจังหวัดปัตตานี" style="width:100%;height:100%;display:block">';

const S = { rp: 'rcvdoc', rf: { fy: '', month: '', drug: '', supplier: '', rcvNo: '' }, token: null, user: null, view: 'home', meta: null, cart: {}, drugs: [], wh: 'lots' };
try { S.token = sessionStorage.getItem('tk'); } catch (e) {}
const saveTk = () => { try { S.token ? sessionStorage.setItem('tk', S.token) : sessionStorage.removeItem('tk'); } catch (e) {} };

let busyN = 0;
const busy = on => { busyN = Math.max(0, busyN + (on ? 1 : -1)); $('#busy').classList.toggle('hide', busyN === 0); };
function toast(m, err) { const t = document.createElement('div'); t.className = 'tst' + (err ? ' e' : ''); t.textContent = m; $('#toast').appendChild(t); setTimeout(() => t.remove(), err ? 5000 : 2800); }
/* ---- เชื่อมต่อ Supabase: ทุกคำสั่งผ่าน public.api(token, action, payload) เหมือน google.script.run.api เดิม ---- */
const CFG = window.APP_CONFIG || {};
let sb = null, SB_ERR = '';
try {
  if (!window.supabase) throw new Error('โหลดไลบรารี Supabase ไม่สำเร็จ (cdn.jsdelivr.net) กรุณาตรวจสอบอินเทอร์เน็ต หรือเครือข่ายหน่วยงานที่บล็อกเว็บไซต์นี้');
  sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
} catch (e) { SB_ERR = e.message; }
async function srv(action, payload) {
  let r;
  try {
    const res = await sb.rpc('api', { p_token: S.token || '', p_action: action, p_payload: payload || {} });
    if (res.error) throw res.error;
    r = res.data;
  } catch (e) { console.error(e); throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่'); }
  if (r && r.ok) return r.data;
  if (r && r.auth) forceLogout();
  throw new Error((r && r.error) || 'เกิดข้อผิดพลาด');
}
/* คำสั่งอ่านข้อมูล: โหลดข้อมูลตามสิทธิ์จากเซิร์ฟเวอร์ แล้วคำนวณด้วยโค้ดเดิมของ Code.gs (server.js) */
const isAdm = () => !!(S.user && S.user.role === 'admin');
const run = (t, fn, extra) => srv('load', Object.assign({ t: t }, extra || {})).then(D => fn(Server(D, S.meta || { hospitals: [] })));
const LOAN_T = ['Loans', 'LoanLines', 'LoanReturns', 'LoanReturnLines'];
const LOCAL = {
  dashboard: () => run(['Requests', 'RequestItems', 'Issues', 'Loans', 'LoanLines', 'LoanReturns', 'MedErrors'].concat(isAdm() ? ['Drugs', 'Lots'] : []), X => X.dashboard_(S.user)),
  drugList: () => run(['Drugs', 'Lots'], X => X.drugList_(S.user)),
  requests: p => run(['Requests', 'RequestItems'], X => X.listRequests_(S.user, p)),
  requestDetail: p => run(['Requests', 'RequestItems', 'Drugs'].concat(isAdm() ? ['Lots'] : []), X => X.requestDetail_(S.user, p)),
  previewApprove: p => run(['Requests', 'RequestItems', 'Lots', 'Drugs'], X => X.previewApprove_(S.user, p)),
  issues: p => run(['Issues'], X => X.listIssues_(S.user, p)),
  issueDetail: p => run(['Issues', 'IssueItems', 'Requests', 'RequestItems'], X => X.getIssue_(S.user, p.docNo)),
  stockSummary: () => run(['Drugs', 'Lots'], X => X.computeStock_()),
  lots: p => run(['Drugs', 'Lots'], X => X.lotsList_(S.user, p)),
  stockCard: p => run(['Drugs', 'StockCard'], X => X.stockCard_(S.user, p), { drugId: p.drugId || '' }),
  report: p => run(p.rpt === 'isssum' ? ['Issues', 'IssueItems'] : p.rpt === 'loansum' ? LOAN_T : ['Receipts', 'Drugs'], X => X.report_(p)),
  loans: () => run(['Loans', 'LoanLines', 'LoanReturns'], X => X.loanRows_(S.user)),
  loanDetail: p => run(LOAN_T, X => X.loanDetail_(S.user, p)),
  loanDoc: p => run(LOAN_T, X => X.loanReport_(S.user, p.loanId)),
  loanReg: p => run(LOAN_T, X => X.loanRegReport_(S.user, p)),
  users: () => run(['Users'], X => X.usersList_()),
  logs: () => run(['Logs'], X => X.logsList_()),
  meList: p => run(['MedErrors'], X => X.meList_(S.user, p)),
  meReport: p => run(['MedErrors'], X => X.meReport_(S.user, p))
};
function call(action, payload, quiet) {
  if (!quiet) busy(true);
  const p = payload || {};
  return Promise.resolve().then(() => LOCAL[action] ? LOCAL[action](p) : srv(action, p)).finally(() => { if (!quiet) busy(false); });
}
/** รันงานที่ผู้ใช้กด: แสดง error เป็น toast และกันกดซ้ำ */
async function act(btn, fn) {
  if (btn) { if (btn.disabled) return; btn.disabled = true; }
  try { return await fn(); } catch (e) { toast(e.message, true); } finally { if (btn) btn.disabled = false; }
}
function modal(title, html, o) {
  o = o || {}; const m = document.createElement('div'); m.className = 'mbg';
  m.innerHTML = `<div class="modal ${o.wide ? 'wide' : ''}" role="dialog" aria-modal="true"><div class="mh"><h3>${esc(title)}</h3>${o.force ? '' : '<button class="x" data-close aria-label="ปิด">×</button>'}</div><div class="mb">${html}</div></div>`;
  document.body.appendChild(m);
  m.addEventListener('mousedown', e => { m._d = e.target === m; });
  m.addEventListener('click', e => { if (!o.force && ((e.target === m && m._d) || e.target.closest('[data-close]'))) m.remove(); });
  return m;
}
const $id = (m, id) => m.querySelector('#' + id);
const val = (m, id) => { const e = $id(m, id); return e ? e.value : ''; };
const empty = t => `<div class="empty">${esc(t)}</div>`;
const tbl = (head, rows, cls) => `<div class="tw"><table><thead><tr>${head.map(h => `<th class="${h[1] || ''}">${esc(h[0])}</th>`).join('')}</tr></thead><tbody>${rows || ''}</tbody></table></div>`;
function b64blob(b64, mime) { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: mime }); }
function saveBlob(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); }

/* idle logout 30 นาที */
let idleT; const idleReset = () => { clearTimeout(idleT); if (S.token) idleT = setTimeout(() => { toast('ออกจากระบบอัตโนมัติ เนื่องจากไม่มีการใช้งาน', true); doLogout(); }, 30 * 60 * 1000); };
['click', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, idleReset, { passive: true }));

/* ================= Auth ================= */
function forceLogout() { S.token = null; S.user = null; saveTk(); showLogin(); }
async function doLogout() { try { await call('logout', {}, true); } catch (e) {} forceLogout(); }
function showLogin(tab) {
  tab = tab || 'in'; const H = (S.meta && S.meta.hospitals) || [];
  $('#root').innerHTML = `<div class="lg"><div class="lgc"><div class="lgh"><div class="logo">${LOGO}</div><h2 style="color:#fff">ระบบจัดการด้านยาปฐมภูมิ</h2><div>เครือข่าย รพ.สต. อำเภอเมืองปัตตานี</div></div><div class="lgb">
  <div class="seg" style="width:100%"><button class="${tab === 'in' ? 'on' : ''}" id="tIn" style="flex:1">เข้าสู่ระบบ</button><button class="${tab === 'up' ? 'on' : ''}" id="tUp" style="flex:1">สมัครใช้งาน</button></div>
  ${tab === 'in' ? `<label for="lu">ชื่อผู้ใช้</label><input id="lu" autocomplete="username" autocapitalize="none" maxlength="20"><label for="lp">รหัสผ่าน (4 ตัวอักษร)</label><input id="lp" type="password" maxlength="4" autocomplete="current-password"><div id="lm"></div><button class="btn" id="lgo" style="width:100%;margin-top:14px">เข้าสู่ระบบ</button>`
  : `<label for="ru">ชื่อผู้ใช้ (a-z 0-9 _ , 3-20 ตัว)</label><input id="ru" maxlength="20" autocapitalize="none"><label for="rn">ชื่อ-สกุล</label><input id="rn" maxlength="60"><label for="rh">หน่วยบริการ</label><select id="rh"><option value="">— เลือก —</option>${H.map(h => `<option value="${esc(h.code)}">${esc(h.name)}</option>`).join('')}</select><label for="rp">กำหนดรหัสผ่าน (4 ตัวอักษร/ตัวเลข)</label><input id="rp" type="password" maxlength="4"><div id="lm"></div><button class="btn" id="rgo" style="width:100%;margin-top:14px">ส่งใบสมัคร</button><p class="mut" style="font-size:.85rem">บัญชีจะใช้งานได้หลังแอดมินอนุมัติ</p>`}
  </div></div></div>`;
  $('#tIn').onclick = () => showLogin('in'); $('#tUp').onclick = () => { showLogin('up'); loadMeta().then(() => { if ($('#rh') && !$('#rh').options[1] && S.meta.hospitals.length) showLogin('up'); }); };
  const msg = (t, ok) => { $('#lm').innerHTML = `<div class="msg ${ok ? 'o' : 'e'}">${esc(t)}</div>`; };
  if (tab === 'in') {
    const go = () => act($('#lgo'), async () => {
      try { const r = await call('login', { username: $('#lu').value, password: $('#lp').value }); S.token = r.token; S.user = r.user; saveTk(); startApp(); }
      catch (e) { msg(e.message); $('#lp').value = ''; }
    });
    $('#lgo').onclick = go; $('#lp').onkeydown = e => { if (e.key === 'Enter') go(); }; $('#lu').onkeydown = e => { if (e.key === 'Enter') $('#lp').focus(); };
  } else {
    $('#rgo').onclick = () => act($('#rgo'), async () => {
      try { const r = await call('register', { username: $('#ru').value, name: $('#rn').value, hospCode: $('#rh').value, password: $('#rp').value }); msg(r.message, true); $('#rp').value = ''; }
      catch (e) { msg(e.message); }
    });
  }
}

/* ================= Shell / Router ================= */
const NAV_U = [['home', 'หน้าหลัก', 'home'], ['req_new', 'ขอเบิกยา', 'plus'], ['req_list', 'ประวัติคำขอ', 'list'], ['issues', 'ใบเบิกยา', 'file'], ['loans', 'ยืม-คืนยา', 'swap'], ['me', 'บันทึก ME', 'alert']];
const NAV_A = [['home', 'ภาพรวม', 'home'], ['req_list', 'คำขอเบิก', 'list'], ['issues', 'ใบเบิกยา', 'file'], ['loans', 'ยืม-คืนยา', 'swap'], ['me', 'ME', 'alert'], ['warehouse', 'คลังยา', 'box'], ['stockcard', 'Stock Card', 'book'], ['reports', 'รายงาน', 'chart'], ['users', 'ผู้ใช้งาน', 'users'], ['logs', 'บันทึกระบบ', 'act']];
function startApp() {
  const adm = S.user.role === 'admin', nav = adm ? NAV_A : NAV_U; idleReset();
  $('#root').innerHTML = `<div class="top"><div class="logo">${LOGO}</div><div class="ttl">ระบบจัดการด้านยาปฐมภูมิ เครือข่าย รพ.สต. อำเภอเมืองปัตตานี<small>${esc(S.user.hospName)}</small></div><span class="chip">${esc(S.user.name)}</span><button class="tbtn" id="bPw">รหัสผ่าน</button><button class="tbtn" id="bOut">ออก</button></div>
  <div class="shell"><nav class="side">${nav.map(n => `<a data-v="${n[0]}">${ico(n[2])}<span>${n[1]}</span></a>`).join('')}</nav><main id="view"></main></div>
  <nav class="bnav">${nav.map(n => `<a data-v="${n[0]}">${ico(n[2])}<span>${n[1]}</span></a>`).join('')}</nav>`;
  document.querySelectorAll('[data-v]').forEach(a => a.onclick = () => go(a.dataset.v));
  $('#bOut').onclick = doLogout; $('#bPw').onclick = () => pwModal(false);
  if (S.user.mustChange) pwModal(true);
  go('home');
}
async function go(v) {
  S.view = v; document.querySelectorAll('[data-v]').forEach(a => a.classList.toggle('on', a.dataset.v === v));
  const el = $('#view'); el.innerHTML = '<div class="empty">กำลังโหลด…</div>';
  try { await VIEWS[v](el); } catch (e) { el.innerHTML = `<div class="card"><div class="msg e">${esc(e.message)}</div></div>`; }
  window.scrollTo(0, 0);
}
function pwModal(force) {
  const m = modal(force ? 'กรุณาเปลี่ยนรหัสผ่านก่อนใช้งาน' : 'เปลี่ยนรหัสผ่าน', `<label>รหัสผ่านเดิม</label><input id="po" type="password" maxlength="4"><label>รหัสผ่านใหม่ (4 ตัวอักษร/ตัวเลข)</label><input id="pn" type="password" maxlength="4"><div class="mf"><button class="btn" id="ps">บันทึก</button></div>`, { force });
  $id(m, 'ps').onclick = e => act(e.target, async () => { await call('changePassword', { oldPassword: val(m, 'po'), newPassword: val(m, 'pn') }); S.user.mustChange = false; m.remove(); toast('เปลี่ยนรหัสผ่านแล้ว'); });
}

/* ================= Views ================= */
const VIEWS = {};
const MN_SHORT = ['ต.ค.', 'พ.ย.', 'ธ.ค.', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.'];
const barChart = vals => { const mx = Math.max.apply(null, vals.concat([1])); return `<div style="display:flex;align-items:flex-end;gap:6px;height:140px;padding-top:6px">${vals.map((v, i) => `<div style="flex:1;text-align:center;font-size:.72rem;min-width:0"><div title="${esc(money(v))} บาท" style="background:${v ? 'var(--g2)' : '#e3eeea'};height:${Math.max(3, Math.round(v / mx * 100))}px;border-radius:4px 4px 0 0"></div>${MN_SHORT[i]}</div>`).join('')}</div>`; };
const stat = (n, label, cls, id) => `<div class="stat ${cls || ''}" ${id ? `id="${id}" style="cursor:pointer"` : ''}><b>${n}</b><span>${label}</span></div>`;
const loanLine = (rows, who) => rows.length ? tbl([['รายการยา'], ['ค้างคืน', 'r'], [who], ['วันที่ให้ยืม']], rows.map(x => `<tr class="clk" data-ln="${esc(x.loanId)}"><td>${esc(x.name)}</td><td class="r">${fmt(x.qty)} ${esc(x.unit)}</td><td>${esc(x.other)}</td><td>${thDate(x.date)}</td></tr>`).join('')) : empty('ไม่มีรายการค้าง');
/* ---- หน้าหลัก: จัดกลุ่ม การเบิกยา -> ยืม-คืนยา -> ME -> อื่นๆ ทุกการ์ดสถานะกดแล้วไปยังแท็บของตัวเอง ---- */
const tile = (n, label, cls, key) => `<button type="button" class="tile ${cls || ''} ${Number(n) ? '' : 'z'}" data-g="${key}"><b>${n}</b><span>${label}</span></button>`;
const tileS = (n, label, cls) => `<div class="tile st ${cls || ''}"><b>${n}</b><span>${label}</span></div>`;
function homeGo(k) {
  const a = k.split(':');
  if (a[0] === 'req') { S.reqFilter = a[1] === 'all' ? '' : a[1]; return go('req_list'); }
  if (a[0] === 'iss') return go('issues');
  if (a[0] === 'wh') return go('warehouse');
  if (a[0] === 'loan') { S.lt = a[1]; return go('loans'); }
  if (a[0] === 'me') {
    const o = {}; if (a[1] === 'month') o.month = String(+todayIso().slice(5, 7)); if (a[1] === 'reach') o.sev = 'REACH'; if (a[1] === 'harm') o.sev = 'HARM'; if (a[1] === 't') o.type = a[2];
    S.mf = Object.assign({ fy: String(curFY()), month: '', hosp: '', sev: '', type: '' }, o); return go('me');
  }
}
VIEWS.home = async el => {
  const d = await call('dashboard'), adm = d.role !== 'user';
  const sec = (icon, title, btn, body) => `<section class="pn"><div class="ph"><h3>${ico(icon)}${title}</h3>${btn || ''}</div>${body}</section>`;
  const pl = (t, link) => `<div class="pl"><span>${t}</span>${link ? `<button type="button" class="lnk" data-g="${link[0]}">${link[1]}</button>` : ''}</div>`;
  if (!adm) {
    const c = d.counts || {}, L = d.loans || {}, hasL = (L.borrowed || []).length || (L.lent || []).length;
    el.innerHTML = `<div class="hh"><h2>สวัสดี ${esc(S.user.name)}</h2><span class="mut">${esc(S.user.hospName)} · ปีงบประมาณ ${d.fy}</span></div>
    ${sec('file', 'การเบิกยา', '<button class="btn sm" id="hNew">+ ขอเบิกยา</button>',
      `<div class="tiles">${tile(c.pending || 0, 'คำขอรออนุมัติ', c.pending ? 'w' : '', 'req:pending')}${tile(c.approved || 0, 'อนุมัติแล้ว', '', 'req:approved')}${tile(c.rejected || 0, 'ไม่อนุมัติ', c.rejected ? 'd' : '', 'req:rejected')}</div>${pl('คำขอเบิกล่าสุด', ['req:all', 'ดูทั้งหมด'])}${reqTable(d.recent)}`)}
    ${sec('swap', 'การยืม-คืนยา', '<button class="btn sec sm" id="hBor">+ ขอยืมยา</button>',
      `<div class="tiles">${tile(L.borrowedCount || 0, 'ยืมอยู่ (ยังไม่คืน)', L.borrowedCount ? 'w' : '', 'loan:bor')}${tile(L.lentCount || 0, 'ให้ยืมอยู่ (ยังไม่ได้รับคืน)', L.lentCount ? 'b' : '', 'loan:len')}${tile(L.waiting || 0, 'คำขอยืมรอพิจารณา', '', 'loan:wait')}${tile(L.todo || 0, 'รอคุณพิจารณา (หน่วยอื่นขอยืม)', L.todo ? 'w' : '', 'loan:todo')}</div>
      ${hasL ? `<div class="grid2"><div>${pl('ยาที่เรายืมจากหน่วยบริการอื่น')}${loanLine(L.borrowed || [], 'ยืมจาก')}</div><div>${pl('ยาที่เราให้ยืมไป')}${loanLine(L.lent || [], 'ให้ยืมแก่')}</div></div>` : ''}`)}
    ${meHomeHtml(d.me)}`;
    $('#hNew').onclick = () => go('req_new'); $('#hBor').onclick = loanNew; $('#hMe').onclick = () => meNew(() => go('home'));
  } else {
    const lowTbl = (rows, key, head, col) => rows.length ? tbl([['รายการ'], [head, 'r']], rows.map(x => `<tr><td>${esc(x.name)}</td><td class="r">${fmt(x[key])} ${esc(x.unit)}</td></tr>`).join('')) : empty('ไม่มี');
    el.innerHTML = `<div class="hh"><h2>ภาพรวมคลังยา</h2><span class="mut">ปีงบประมาณ ${d.fy}</span></div>
    ${sec('file', 'การเบิกยา', '',
      `<div class="tiles">${tile(d.pending, 'คำขอรออนุมัติ', d.pending ? 'w' : '', 'req:pending')}${d.processing ? tile(d.processing, 'ค้างดำเนินการ (ต้องตรวจสอบ)', 'd', 'req:processing') : ''}${tile(d.issueCount, 'ใบเบิกปีงบนี้', 'b', 'iss')}${tileS(money(d.issueValue), 'มูลค่าเบิกปีงบนี้ (บาท)', '')}</div>
      <div class="grid2"><div>${pl('คำขอรออนุมัติ', ['req:pending', 'ดูทั้งหมด'])}${reqTable(d.recent)}</div>
      <div>${pl('หน่วยบริการที่เบิกมูลค่าสูงสุดปีงบนี้')}${d.topHosp.length ? tbl([['หน่วยบริการ'], ['ใบเบิก', 'r'], ['มูลค่า (บาท)', 'r']], d.topHosp.map(x => `<tr><td>${esc(x.name)}</td><td class="r">${x.count}</td><td class="r">${money(x.value)}</td></tr>`).join('')) : empty('ยังไม่มีการเบิก')}</div></div>`)}
    ${sec('swap', 'การยืม-คืนยา', '',
      `<div class="tiles">${tile(d.loanOpen, 'ยังไม่เสร็จสิ้น', d.loanOpen ? 'b' : '', 'loan:open')}${tile(d.loanOverdue, 'ยังค้างคืน', d.loanOverdue ? 'w' : '', 'loan:late')}</div>
      ${d.loanLate.length ? pl('ยืม-คืนยาที่ยังค้างคืน', ['loan:late', 'ดูทั้งหมด']) + tbl([['เลขที่'], ['ผู้ให้ยืม'], ['ผู้ยืม'], ['วันที่ขอยืม']], d.loanLate.map(r => `<tr class="clk" data-ln="${esc(r.loanId)}"><td>${esc(r.loanId)}</td><td>${esc(r.lenderName)}</td><td>${esc(r.borrowerName)}</td><td>${thDate(r.createdAt.slice(0, 10))}</td></tr>`).join('')) : ''}`)}
    ${meHomeHtml(d.me)}
    ${sec('box', 'สต็อกคลังยา', '<button type="button" class="lnk" data-g="wh">ไปหน้าคลังยา</button>',
      `<div class="grid3"><div>${pl('ใกล้หมด (ต่ำกว่าจุดสั่งซื้อ)')}${lowTbl(d.low, 'available', 'คงเหลือ')}</div><div>${pl('ใกล้หมดอายุ (≤180 วัน)')}${lowTbl(d.near, 'qty', 'จำนวน')}</div><div>${pl('หมดอายุแล้ว (ยังมียอดคงเหลือ)')}${lowTbl(d.expired, 'qty', 'จำนวน')}</div></div>`)}`;
  }
  el.querySelectorAll('.tiles').forEach(t => t.classList.add('c' + t.children.length));
  el.querySelectorAll('[data-g]').forEach(b => b.onclick = () => homeGo(b.dataset.g));
  bindClicks(el);
};

function reqTable(list) {
  if (!list || !list.length) return empty('ยังไม่มีรายการ');
  const adm = S.user.role === 'admin';
  return tbl([['เลขที่คำขอ'], ['วันที่'], ...(adm ? [['หน่วยบริการ']] : []), ['รายการ', 'c'], ['สถานะ'], ['ใบเบิก']],
    list.map(r => `<tr class="clk" data-req="${esc(r.reqId)}"><td>${esc(r.reqId)}</td><td>${thDT(r.createdAt)}</td>${adm ? `<td>${esc(r.hospName)}</td>` : ''}<td class="c">${r.itemCount}</td><td>${badge(r.status)}</td><td>${esc(r.docNo || '-')}</td></tr>`).join(''));
}
function issueTable(list) {
  if (!list || !list.length) return empty('ยังไม่มีใบเบิก');
  const adm = S.user.role === 'admin';
  return tbl([['เลขที่ใบเบิก'], ['วันที่เบิก'], ...(adm ? [['หน่วยบริการ']] : []), ['รายการ', 'c'], ['มูลค่า (บาท)', 'r']],
    list.map(i => `<tr class="clk" data-issue="${esc(i.docNo)}"><td>${esc(i.docNo)}</td><td>${thDate(i.issueDate)}</td>${adm ? `<td>${esc(i.hospName)}</td>` : ''}<td class="c">${i.itemCount}</td><td class="r">${money(i.totalValue)}</td></tr>`).join(''));
}
function bindClicks(root) {
  root.querySelectorAll('[data-req]').forEach(r => r.onclick = () => openRequest(r.dataset.req));
  root.querySelectorAll('[data-issue]').forEach(r => r.onclick = () => openIssue(r.dataset.issue));
  root.querySelectorAll('[data-ln]').forEach(r => r.onclick = () => openLoan(r.dataset.ln));
}

/* ---- ขอเบิกยา (หน่วยบริการ) ---- */
VIEWS.req_new = async el => {
  if (S.user.role === 'admin') { el.innerHTML = '<div class="card"><div class="msg e">บัญชีแอดมินไม่สามารถยื่นคำขอเบิก</div></div>'; return; }
  S.drugs = await call('drugList'); S.cart = {};
  el.innerHTML = `<h2>ขอเบิกยา/เวชภัณฑ์</h2><div class="card"><p class="mut" style="margin:0 0 8px">รายการที่คงคลังเป็น 0 (แสดง "หมด") จะเบิกไม่ได้จนกว่าคลังยาจะรับยาเข้า</p><div class="row"><input id="q" class="grow" placeholder="ค้นหาชื่อยา…" autocomplete="off"><button class="btn" id="send">ส่งคำขอ (<span id="cn">0</span>)</button></div></div><div id="dl"></div>`;
  const draw = () => {
    const q = $('#q').value.trim().toLowerCase(), L = S.drugs.filter(d => !q || d.name.toLowerCase().includes(q));
    $('#dl').innerHTML = L.length ? tbl([['รายการยา'], ['หน่วย'], ['คลังมี', 'r'], ['จำนวนที่ขอ', 'r']], L.map(d => d.available > 0
      ? `<tr><td>${esc(d.name)}</td><td>${esc(d.unit)}</td><td class="r">${fmt(d.available)}</td><td class="r" style="width:130px"><input type="number" inputmode="numeric" min="0" step="1" data-d="${esc(d.drugId)}" value="${S.cart[d.drugId] || ''}" style="width:110px;text-align:right"></td></tr>`
      : `<tr style="color:#8a9a95"><td>${esc(d.name)}</td><td>${esc(d.unit)}</td><td class="r"><span class="badge b-exp">หมด</span></td><td class="r" style="width:130px"><input disabled placeholder="เบิกไม่ได้" title="คงคลังเป็น 0 ยังเบิกไม่ได้" style="width:110px;text-align:center;background:#f1f4f3"></td></tr>`).join('')) : empty('ไม่พบรายการ');
    $('#dl').querySelectorAll('input[data-d]').forEach(i => i.oninput = () => { const n = parseInt(i.value, 10); if (n > 0) S.cart[i.dataset.d] = n; else delete S.cart[i.dataset.d]; $('#cn').textContent = Object.keys(S.cart).length; });
  };
  $('#q').oninput = draw; draw();
  $('#send').onclick = e => {
    Object.keys(S.cart).forEach(id => { const d = S.drugs.find(x => x.drugId === id); if (!d || !(d.available > 0)) delete S.cart[id]; });
    const items = Object.keys(S.cart).map(id => ({ drugId: id, qty: S.cart[id] })); if (!items.length) return toast('กรุณาระบุจำนวนยาที่ต้องการเบิกอย่างน้อย 1 รายการ', true);
    const m = modal('ยืนยันส่งคำขอเบิก', `<p>ส่งคำขอเบิก <b>${items.length}</b> รายการ</p>${tbl([['รายการ'], ['จำนวน', 'r']], items.map(i => { const d = S.drugs.find(x => x.drugId === i.drugId); return `<tr><td>${esc(d.name)}</td><td class="r">${fmt(i.qty)} ${esc(d.unit)}</td></tr>`; }).join(''))}<label>หมายเหตุ (ถ้ามี)</label><textarea id="nt" maxlength="200" rows="2"></textarea><div class="mf"><button class="btn sec" data-close>กลับไปแก้ไข</button><button class="btn" id="ok">ยืนยันส่งคำขอ</button></div>`);
    $id(m, 'ok').onclick = b => act(b.target, async () => { const r = await call('createRequest', { items: items, note: val(m, 'nt') }); m.remove(); toast('ส่งคำขอแล้ว เลขที่ ' + r.reqId); go('req_list'); });
  };
};

/* ---- รายการคำขอ ---- */
VIEWS.req_list = async el => {
  const adm = S.user.role === 'admin', f = S.reqFilter === undefined ? (adm ? 'pending' : '') : S.reqFilter;
  const list = await call('requests', { status: f });
  const chips = [['', 'ทั้งหมด'], ['pending', 'รออนุมัติ'], ['approved', 'อนุมัติแล้ว'], ['rejected', 'ไม่อนุมัติ'], ['cancelled', 'ยกเลิก']];
  el.innerHTML = `<h2>${adm ? 'คำขอเบิกจากหน่วยบริการ' : 'ประวัติคำขอเบิก'}</h2><div class="seg" style="margin-top:10px">${chips.map(c => `<button data-f="${c[0]}" class="${f === c[0] ? 'on' : ''}">${c[1]}</button>`).join('')}</div>${reqTable(list)}`;
  el.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { S.reqFilter = b.dataset.f; go('req_list'); });
  bindClicks(el);
};
async function openRequest(id) {
  const d = await call('requestDetail', { reqId: id }), r = d.req, adm = S.user.role === 'admin', pend = r.status === 'pending';
  const head = `<div class="kv"><b>เลขที่คำขอ</b><span>${esc(r.reqId)}</span><b>หน่วยบริการ</b><span>${esc(r.hospName)}</span><b>วันที่ขอ</b><span>${thDT(r.createdAt)} โดย ${esc(r.createdBy)}</span><b>สถานะ</b><span>${badge(r.status)}</span>${r.note ? `<b>หมายเหตุ</b><span>${esc(r.note)}</span>` : ''}${r.reason ? `<b>เหตุผล</b><span>${esc(r.reason)}</span>` : ''}${r.docNo ? `<b>ใบเบิก</b><span>${esc(r.docNo)}</span>` : ''}</div>`;
  if (adm && pend) {
    const m = modal('พิจารณาอนุมัติคำขอ', head + `<div class="tw"><table><thead><tr><th>รายการ</th><th>หน่วย</th><th class="r">ขอ</th><th class="r">มีใช้ได้</th><th class="r">อนุมัติ</th></tr></thead><tbody>${d.items.map(i => `<tr><td>${esc(i.name)}</td><td>${esc(i.unit)}</td><td class="r">${fmt(i.qtyReq)}</td><td class="r">${fmt(i.available)}</td><td class="r" style="width:110px"><input type="number" min="0" max="${i.qtyReq}" step="1" data-q="${esc(i.drugId)}" value="${Math.min(i.qtyReq, i.available)}" style="width:90px;text-align:right"></td></tr>`).join('')}</tbody></table></div>
    <div class="row" style="margin-top:10px"><button class="btn sec sm" id="pv">ตรวจสอบการตัด LOT (FEFO)</button></div><div id="fefo"></div>
    <div class="fg"><div><label>ผู้อนุมัติ (แสดงบนใบเบิก)</label><div class="mut" style="padding:8px 0">${esc((S.meta && S.meta.approver) || '')}<br><small>${esc((S.meta && S.meta.approverTitle) || '')}</small></div></div><div><label>หมายเหตุบนใบเบิก</label><input id="nt" maxlength="200" value="${esc(r.note)}"></div></div>
    <div class="mf"><button class="btn bad" id="rj">ไม่อนุมัติ</button><button class="btn" id="ok">อนุมัติ และออกใบเบิก</button></div>`, { wide: true });
    const qmap = () => { const o = {}; m.querySelectorAll('[data-q]').forEach(i => o[i.dataset.q] = i.value); return o; };
    $id(m, 'pv').onclick = b => act(b.target, async () => {
      const p = await call('previewApprove', { reqId: id, qty: qmap() });
      $id(m, 'fefo').innerHTML = '<h3 style="margin:10px 0 4px">การตัดสต็อกตาม FEFO</h3>' + tbl([['รายการ'], ['LOT'], ['หมดอายุ'], ['จำนวน', 'r']], p.map(x => x.qty === 0 ? '' : (x.lots.length ? x.lots.map((l, k) => `<tr>${k ? '<td></td>' : `<td>${esc(x.name)}</td>`}<td>${esc(l.lotNo)}</td><td>${thDate(l.expDate)}</td><td class="r">${fmt(l.qty)} ${esc(x.unit)}</td></tr>`).join('') : '') + (x.short > 0 ? `<tr><td>${esc(x.name)}</td><td colspan="3" style="color:var(--bad)">สต็อกที่ใช้ได้ไม่พอ ขาด ${fmt(x.short)}</td></tr>` : '')).join(''));
    });
    $id(m, 'ok').onclick = b => act(b.target, async () => {
      if (!confirm('ยืนยันอนุมัติ ตัดสต็อกตามหลัก FEFO และออกเลขที่ใบเบิก?\n(ไม่สามารถย้อนกลับได้)')) return;
      const r2 = await call('approveRequest', { reqId: id, qty: qmap(), approver: (S.meta && S.meta.approver) || '', note: val(m, 'nt') });
      m.remove(); toast('อนุมัติแล้ว ใบเบิกเลขที่ ' + r2.docNo); go(S.view); openIssue(r2.docNo);
    });
    $id(m, 'rj').onclick = b => act(b.target, async () => {
      const why = prompt('ระบุเหตุผลที่ไม่อนุมัติ'); if (why == null) return;
      await call('rejectRequest', { reqId: id, reason: why }); m.remove(); toast('บันทึกการไม่อนุมัติแล้ว'); go(S.view);
    });
    return;
  }
  const m = modal('รายละเอียดคำขอ', head + tbl([['รายการ'], ['หน่วย'], ['ขอ', 'r'], ['อนุมัติ', 'r']], d.items.map(i => `<tr><td>${esc(i.name)}</td><td>${esc(i.unit)}</td><td class="r">${fmt(i.qtyReq)}</td><td class="r">${r.status === 'approved' ? fmt(i.qtyApproved) : '-'}</td></tr>`).join('')) +
    `<div class="mf">${r.docNo ? '<button class="btn" id="vi">ดูใบเบิก</button>' : ''}${!adm && pend ? '<button class="btn bad" id="cx">ยกเลิกคำขอ</button>' : ''}<button class="btn sec" data-close>ปิด</button></div>`, { wide: true });
  if (r.docNo) $id(m, 'vi').onclick = () => { m.remove(); openIssue(r.docNo); };
  if (!adm && pend) $id(m, 'cx').onclick = b => act(b.target, async () => { if (!confirm('ยืนยันยกเลิกคำขอนี้?')) return; await call('cancelRequest', { reqId: id }); m.remove(); toast('ยกเลิกคำขอแล้ว'); go(S.view); });
}

/* ---- ใบเบิกยา ---- */
VIEWS.issues = async el => {
  const fy = S.fy || '', list = await call('issues', { fy: fy });
  const cur = (() => { const t = todayIso(); return +t.slice(0, 4) + 543 + (+t.slice(5, 7) >= 10 ? 1 : 0); })();
  el.innerHTML = `<h2>ใบเบิกยา</h2><div class="row" style="margin:10px 0"><label style="margin:0">ปีงบประมาณ</label><select id="fy" style="width:140px"><option value="">ทั้งหมด</option>${[0, 1, 2, 3].map(k => `<option value="${cur - k}" ${String(cur - k) === String(fy) ? 'selected' : ''}>${cur - k}</option>`).join('')}</select></div>${issueTable(list)}`;
  $('#fy').onchange = e => { S.fy = e.target.value; go('issues'); }; bindClicks(el);
};
function issueHtml(d) {
  const i = d.issue, td = (v, al) => `<td style="text-align:${al}">${v}</td>`;
  const rows = d.items.map((x, n) => `<tr>${td(n + 1, 'center')}<td>${esc(x.drugName)}</td>${td(esc(x.unit), 'center')}${td(x.qtyReq == null ? '' : fmt(x.qtyReq), 'right')}${td(fmt(x.qty), 'right')}${td(money(x.value), 'right')}${td(thDate(x.expDate), 'center')}${td(esc(x.lotNo), 'center')}</tr>`).join('');
  const sg = (t, nm, sub) => `<div>ลงชื่อ ................................................ ${t}<br>(${nm ? esc(nm) : '&nbsp;'.repeat(34)})${sub ? '<br>' + esc(sub).replace(/\n/g, '<br>') : ''}</div>`;
  return `<div class="sheet"><div class="t1">${esc(i.issuer)}</div><div class="t1">${esc(i.issuerSub)}</div><div class="t1" style="margin-bottom:8px">ใบอนุมัติเบิก</div>
  <div><b>เลขที่ใบเบิก</b> ปีงบประมาณ ${esc(i.docNo)} &nbsp;&nbsp;&nbsp;&nbsp; <b>วันที่เบิก</b> ${thDate(i.issueDate)}</div><div><b>หน่วยงานที่เบิก</b> ${esc(i.hospName)}</div>
  <div><b>หมายเหตุ:</b> ${esc(i.note)}</div><div style="font-weight:700;margin:6px 0">อนุมัติให้เบิกเวชภัณฑ์ตามรายการต่อไปนี้</div>
  <table><thead><tr><th style="width:44px">ลำดับ</th><th>เวชภัณฑ์</th><th style="width:52px">หน่วย</th><th style="width:66px">จำนวนเบิก</th><th style="width:76px">จำนวนอนุมัติ</th><th style="width:80px">มูลค่าเบิก</th><th style="width:84px">วันหมดอายุ</th><th style="width:80px">เลข LOT</th></tr></thead><tbody>${rows}</tbody></table>
  <div style="margin-top:8px;font-weight:600;text-align:center">จำนวนเบิก ${i.itemCount} รายการ &nbsp;&nbsp;&nbsp; มูลค่ารวม ${money(i.totalValue)} บาท</div>
  <div class="sigs">${sg('ผู้เบิก', i.requester)}${sg('ผู้จ่าย', i.keeper, i.keeperTitle)}${sg('ผู้อนุมัติ', i.approverName, i.approverTitle)}${sg('ผู้รับ', i.requester)}</div></div>`;
}
async function openIssue(docNo) {
  const d = await call('issueDetail', { docNo: docNo });
  const m = modal('ใบเบิกยา ' + docNo, `<div class="tw" style="border:0">${issueHtml(d)}</div><div class="mf"><button class="btn sec" id="pr">พิมพ์ (A4)</button><button class="btn sec" id="pd">ดาวน์โหลด PDF</button><button class="btn sec" id="wd">ดาวน์โหลด Word</button><button class="btn line" id="ln">แชร์เข้า LINE</button></div>`, { wide: true });
  $id(m, 'pr').onclick = () => printHtml(issueHtml(d));
  $id(m, 'pd').onclick = b => act(b.target, () => download({ kind: 'issue', docNo: docNo }, 'pdf'));
  $id(m, 'wd').onclick = b => act(b.target, () => download({ kind: 'issue', docNo: docNo }, 'docx'));
  $id(m, 'ln').onclick = () => lineModal({ kind: 'issue', docNo: docNo }, 'ใบเบิกยา ' + docNo + ' ' + d.issue.hospName);
}
function printHtml(html) { const p = $('#printArea'); p.innerHTML = html; setTimeout(() => { window.print(); setTimeout(() => { p.innerHTML = ''; }, 800); }, 150); }
/* ---- ดาวน์โหลด PDF / Word และแชร์ LINE: สร้างเอกสารในเบราว์เซอร์จากหน้าเอกสารเดียวกับที่พิมพ์ ---- */
async function docHtml(p) {
  if (p.kind === 'issue') { const d = await call('issueDetail', { docNo: p.docNo }, true); return { html: issueHtml(d), name: 'ใบเบิก-' + String(p.docNo).replace(/[\/\\]/g, '-') }; }
  if (p.kind === 'stockcard') { const r = await call('stockCard', p, true); return { html: scHtml(r), name: 'StockCard-' + r.drug.name.replace(/[\/\\:*?"<>|]/g, '-') }; }
  if (p.kind === 'loan') { const rep = await call('loanDoc', { loanId: p.loanId }, true); return { html: repHtml(rep), name: 'ใบยืม-คืนยา-' + p.loanId }; }
  const rep = await call(p.kind === 'loanreg' ? 'loanReg' : p.kind === 'mereport' ? 'meReport' : 'report', p, true);
  return { html: repHtml(rep), name: 'รายงาน-' + rep.rpt };
}
const scriptCache = {};
function loadScript(src) {
  return scriptCache[src] || (scriptCache[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => { delete scriptCache[src]; rej(new Error('โหลดเครื่องมือสร้างไฟล์ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ต')); }; document.head.appendChild(s); }));
}
/** PDF: A4 ขอบกระดาษตามงานสารบรรณ แนวตั้ง/แนวนอนตามความกว้างตาราง ฟอนต์ Sarabun 12pt (ตาเห็นเท่ากับ TH SarabunPSK 16) */
async function pdfBlob(html) {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js');
  const host = document.createElement('div'); host.className = 'pdfhost'; host.innerHTML = '<div class="pdfdoc">' + html + '</div>'; document.body.appendChild(host);
  try {
    const L = landscapeNeeded(host), wmm = L ? 297 - 25 - 20 : 210 - 30 - 20;
    host.firstElementChild.style.width = Math.round(wmm / 25.4 * 96) + 'px';
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    return await html2pdf().set({ margin: L ? [25, 25, 20, 20] : [25, 30, 20, 20], image: { type: 'jpeg', quality: 0.96 }, html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: L ? 'landscape' : 'portrait' }, pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.sigs'] } }).from(host.firstElementChild).outputPdf('blob');
  } finally { host.remove(); }
}
/** Word (.doc): TH SarabunPSK 16 · A4 · ขอบบน 2.5 ล่าง 2 ซ้าย 3 (แนวนอน 2.5) ขวา 2 ซม. · เปิดได้ใน Microsoft Word / LibreOffice */
function wordBlob(html) {
  const box = document.createElement('div'); box.innerHTML = html;
  box.querySelectorAll('.sigs').forEach(sg => { // ลายมือชื่อ: grid → ตารางไม่มีเส้น 2 คอลัมน์ (หรือตามจำนวนช่อง)
    const cells = [...sg.children], cols = Math.max(1, (sg.style.gridTemplateColumns.match(/repeat\((\d+)/) || [0, 2])[1] | 0), t = document.createElement('table');
    t.className = 'sigt'; for (let i = 0; i < cells.length; i += cols) { const tr = t.insertRow(); cells.slice(i, i + cols).forEach(c => { const td = tr.insertCell(); td.innerHTML = c.innerHTML; }); }
    sg.replaceWith(t);
  });
  document.body.appendChild(box); const L = landscapeNeeded(box); box.remove();
  // Word อ่าน CSS class ได้ไม่ครบ จึงใส่รูปแบบลงในแต่ละองค์ประกอบโดยตรง
  box.querySelectorAll('.t1').forEach(e => { e.style.textAlign = 'center'; e.style.fontWeight = 'bold'; });
  box.querySelectorAll('.t2').forEach(e => { e.style.textAlign = 'center'; });
  box.querySelectorAll('table').forEach(t => {
    const sig = t.classList.contains('sigt');
    t.setAttribute('border', sig ? '0' : '1'); t.setAttribute('cellspacing', '0'); t.setAttribute('cellpadding', '3'); t.setAttribute('width', '100%');
    t.style.borderCollapse = 'collapse'; t.style.width = '100%';
    t.querySelectorAll('th,td').forEach(c => {
      c.style.border = sig ? 'none' : '.75pt solid #000'; c.style.fontFamily = '"TH SarabunPSK"'; c.style.fontSize = '16pt'; c.style.width = '';
      if (c.tagName === 'TH') { c.style.background = '#E7E6E6'; c.style.textAlign = 'center'; }
      if (sig) { c.style.textAlign = 'center'; c.style.verticalAlign = 'top'; c.style.paddingTop = '18pt'; c.setAttribute('width', Math.round(100 / Math.max(1, t.rows[0].cells.length)) + '%'); }
    });
  });
  box.innerHTML = box.innerHTML.replace(/\.{33,}/g, '.'.repeat(32));
  // ตัวเลขเป็นเลขอารบิกเสมอ: กำหนดภาษาของกลุ่มตัวเลขเป็นอังกฤษ (กัน Word ที่ตั้งค่า Numeral = Context แสดงเป็นเลขไทย)
  const tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT), tn = []; while (tw.nextNode()) if (/\d/.test(tw.currentNode.nodeValue)) tn.push(tw.currentNode);
  tn.forEach(t => { const f = document.createElement('span'); f.innerHTML = esc(t.nodeValue).replace(/[\d][\d,.:/]*/g, m => `<span lang="EN-US" style="mso-ansi-language:EN-US;mso-bidi-language:EN-US">${m}</span>`); t.replaceWith(...f.childNodes); });
  const css = `@page Section1{size:${L ? '841.9pt 595.3pt' : '595.3pt 841.9pt'};mso-page-orientation:${L ? 'landscape' : 'portrait'};margin:70.9pt 56.7pt 56.7pt ${L ? '70.9pt' : '85.05pt'}}div.Section1{page:Section1}
  body,p,div,td,th{font-family:"TH SarabunPSK";font-size:16pt;line-height:1.0}.t1{text-align:center;font-weight:bold}.t2{text-align:center}
  table{border-collapse:collapse;width:100%}th,td{border:.75pt solid #000;padding:1pt 3pt;vertical-align:top}th{background:#E7E6E6;text-align:center}
  table.sigt td{border:none;text-align:center;padding-top:18pt}`;
  const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><style>${css}</style></head><body><div class="Section1">${box.innerHTML}</div></body></html>`;
  return new Blob(['\ufeff' + doc], { type: 'application/msword' });
}
async function download(p, format) {
  busy(true);
  try {
    const d = await docHtml(p);
    if (format !== 'pdf') { saveBlob(wordBlob(d.html), d.name + '.doc'); toast('ดาวน์โหลดไฟล์แล้ว'); return; }
    let blob;
    try { blob = await pdfBlob(d.html); }
    catch (e) { console.error(e); toast('สร้างไฟล์ PDF ไม่สำเร็จ — เปิดหน้าพิมพ์แทน ให้เลือกเครื่องพิมพ์ "บันทึกเป็น PDF"', true); printHtml(d.html); return; }
    saveBlob(blob, d.name + '.pdf'); toast('ดาวน์โหลดไฟล์แล้ว');
  } finally { busy(false); }
}
function lineModal(p, text) {
  const link = location.href.split('#')[0], u = 'https://line.me/R/share?text=' + encodeURIComponent(text + '\nเปิดดูในระบบ: ' + link);
  const m = modal('แชร์เข้า LINE', `<p>เลือกวิธีส่ง</p><div class="card"><b>1) ส่งเป็นไฟล์ PDF</b> <span class="mut">(แนะนำ บนมือถือ — เลือก LINE จากเมนูแชร์ของเครื่อง)</span><div id="s1" style="margin-top:8px"><button class="btn sec" id="prep">เตรียมไฟล์ PDF</button></div></div>
  <div class="card"><b>2) ส่งข้อความแจ้ง</b> <span class="mut">ส่งเลขที่เอกสารพร้อมลิงก์เข้าระบบ ผู้รับต้องเข้าสู่ระบบจึงเปิดดูเอกสารได้</span><div id="s2" style="margin-top:8px"><a class="btn line" style="display:inline-block;text-decoration:none" target="_blank" rel="noopener" href="${esc(u)}">เปิด LINE เพื่อส่งข้อความ</a></div></div>`);
  $id(m, 'prep').onclick = b => act(b.target, async () => {
    busy(true); let file;
    try { const d = await docHtml(p); file = new File([await pdfBlob(d.html)], d.name + '.pdf', { type: 'application/pdf' }); } finally { busy(false); }
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      $id(m, 's1').innerHTML = '<button class="btn line" id="sh">เปิดเมนูแชร์ → เลือก LINE</button>';
      $id(m, 'sh').onclick = async () => { try { await navigator.share({ files: [file], title: file.name }); } catch (e) { if (e.name !== 'AbortError') toast('เครื่องนี้แชร์ไฟล์ไม่ได้ ใช้วิธีส่งข้อความหรือดาวน์โหลดแทน', true); } };
    } else { $id(m, 's1').innerHTML = '<div class="msg e">เบราว์เซอร์นี้ไม่รองรับการแชร์ไฟล์ — ดาวน์โหลด PDF แล้วแนบใน LINE หรือใช้วิธีส่งข้อความ</div><button class="btn sec" id="dl" style="margin-top:8px">ดาวน์โหลด PDF</button>'; $id(m, 'dl').onclick = () => saveBlob(file, file.name); }
  });
}

/* ---- คลังยา (แอดมิน) ---- */
VIEWS.warehouse = async el => {
  el.innerHTML = `<h2>คลังยาและ LOT</h2><div class="seg" style="margin-top:10px">${[['lots', 'คงเหลือ / LOT'], ['recv', 'รับยาเข้า'], ['drugs', 'ทะเบียนยา']].map(t => `<button data-t="${t[0]}" class="${S.wh === t[0] ? 'on' : ''}">${t[1]}</button>`).join('')}</div><div id="wb"></div>`;
  el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { S.wh = b.dataset.t; go('warehouse'); });
  const wb = $('#wb');
  if (S.wh === 'lots') {
    const [st, lots] = await Promise.all([call('stockSummary'), call('lots', {})]);
    const nd = (S.meta && S.meta.nearDays) || 180, F = S.whf = S.whf || { q: '', cat: '', st: '' }, open = S.whOpen = S.whOpen || {};
    const stat = d => d.onHand <= 0 ? 'out' : d.expired > 0 ? 'exp' : (d.minStock > 0 && d.available <= d.minStock) ? 'low' : d.nearExp > 0 ? 'near' : 'ok';
    const SL = { out: ['หมดคลัง', 'b-cancelled'], exp: ['มียาหมดอายุค้างคลัง', 'b-exp'], low: ['ต่ำกว่าจุดสั่งซื้อ', 'b-pending'], near: ['ใกล้หมดอายุ', 'b-near'], ok: ['ปกติ', 'b-approved'] };
    const act0 = st.filter(d => d.active === 'Y'), cnt = k => act0.filter(d => stat(d) === k).length;
    const cats = [...new Set(act0.map(d => d.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th'));
    const lotsOf = id => lots.filter(l => l.drugId === id);
    const nearest = id => { const ls = lotsOf(id); return ls.length ? ls[0].expDate : ''; };
    const value = act0.reduce((s, d) => s + lotsOf(d.drugId).reduce((a, l) => a + l.qtyRemain * l.unitPrice, 0), 0);
    wb.innerHTML = `<div class="tiles c3" style="margin-bottom:10px">
      <button class="tile" data-fs=""><b>${fmt(act0.length)}</b><span>รายการยาทั้งหมด · มูลค่า ${money(value)} บ.</span></button>
      <button class="tile w" data-fs="low"><b>${cnt('low')}</b><span>ต่ำกว่าจุดสั่งซื้อ</span></button>
      <button class="tile b" data-fs="near"><b>${cnt('near')}</b><span>ใกล้หมดอายุ (≤ ${nd} วัน)</span></button>
      <button class="tile d" data-fs="exp"><b>${cnt('exp')}</b><span>มียาหมดอายุค้างคลัง</span></button>
      <button class="tile z" data-fs="out"><b>${cnt('out')}</b><span>หมดคลัง</span></button>
      <button class="tile" data-fs="ok"><b>${cnt('ok')}</b><span>ปกติ</span></button></div>
      <div class="card"><div class="fg"><div><label>ค้นหาชื่อยา</label><input id="fq" placeholder="พิมพ์ชื่อยา…" value="${esc(F.q)}"></div>
      <div><label>หมวด</label><select id="fc"><option value="">ทุกหมวด</option>${cats.map(c => `<option value="${esc(c)}"${c === F.cat ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
      <div><label>สถานะ</label><select id="fs"><option value="">ทั้งหมด</option>${Object.keys(SL).map(k => `<option value="${k}"${k === F.st ? ' selected' : ''}>${SL[k][0]}</option>`).join('')}</select></div></div>
      <div class="row sp" style="margin-top:8px"><span class="mut" id="fn"></span><span><button class="lnk" id="xa">แสดง LOT ทั้งหมด</button> · <button class="lnk" id="xc">ซ่อน LOT ทั้งหมด</button></span></div></div><div id="lt"></div>`;
    const lotTable = d => { const ls = lotsOf(d.drugId); return ls.length ? `<table style="margin:2px 0 6px;background:#fff;border:1px solid var(--line)"><thead><tr><th>เลข LOT</th><th>วันหมดอายุ</th><th class="r">คงเหลือ</th><th class="r">รับเข้า</th><th class="r">ราคา/หน่วย</th><th class="r">มูลค่าคงเหลือ</th><th>วันที่รับ</th><th>ผู้ขาย/ใบส่งของ</th><th></th></tr></thead><tbody>${ls.map(l => { const dd = daysTo(l.expDate);
        return `<tr><td><b>${esc(l.lotNo)}</b></td><td>${thDate(l.expDate)}<br><small class="${dd < 0 ? '' : 'mut'}" style="${dd < 0 ? 'color:var(--bad);font-weight:600' : dd <= nd ? 'color:var(--warn)' : ''}">${dd < 0 ? 'หมดอายุแล้ว ' + fmt(-dd) + ' วัน' : 'เหลือ ' + fmt(dd) + ' วัน'}</small></td><td class="r"><b>${fmt(l.qtyRemain)}</b></td><td class="r">${fmt(l.qtyIn)}</td><td class="r">${money(l.unitPrice)}</td><td class="r">${money(l.qtyRemain * l.unitPrice)}</td><td>${thDate(String(l.receivedAt).slice(0, 10))}</td><td>${esc(l.supplier || '-')}</td><td><button class="btn sec sm" data-adj="${esc(l.lotId)}" data-n="${esc(d.name + ' LOT ' + l.lotNo)}">ปรับปรุง</button></td></tr>`; }).join('')}</tbody></table>` : '<div class="mut" style="padding:4px 0 8px">ไม่มี LOT คงเหลือ</div>'; };
    const draw = () => {
      F.q = $('#fq').value.trim(); F.cat = $('#fc').value; F.st = $('#fs').value;
      const q = F.q.toLowerCase(), L = act0.filter(d => (!q || d.name.toLowerCase().includes(q)) && (!F.cat || d.category === F.cat) && (!F.st || stat(d) === F.st));
      $('#fn').textContent = 'แสดง ' + fmt(L.length) + ' จาก ' + fmt(act0.length) + ' รายการ · คลิกที่รายการยาเพื่อดู LOT';
      wb.querySelectorAll('[data-fs]').forEach(b => b.style.outline = b.dataset.fs === F.st && F.st ? '2px solid var(--g2)' : '');
      $('#lt').innerHTML = L.length ? tbl([['รายการยา'], ['หน่วย'], ['คงเหลือใช้ได้', 'r'], ['จุดสั่งซื้อ', 'r'], ['LOT', 'c'], ['หมดอายุใกล้สุด'], ['สถานะ'], ['', 'c']], L.map(d => { const k = stat(d), ne = nearest(d.drugId), o = !!open[d.drugId];
        return `<tr class="clk" data-tg="${esc(d.drugId)}"><td><b>${esc(d.name)}</b>${d.category ? `<br><small class="mut">${esc(d.category)}</small>` : ''}</td><td>${esc(d.unit)}</td><td class="r"><b style="font-size:1.05rem">${fmt(d.available)}</b>${d.expired ? `<br><small style="color:var(--bad)">+ หมดอายุ ${fmt(d.expired)}</small>` : ''}</td><td class="r">${d.minStock ? fmt(d.minStock) : '-'}</td><td class="c">${d.lotCount}</td><td>${ne ? thDate(ne) : '-'}</td><td><span class="badge ${SL[k][1]}">${SL[k][0]}</span></td><td class="c" style="color:var(--g2);font-size:1.1rem">${o ? '▾' : '▸'}</td></tr>`
          + (o ? `<tr class="sub"><td colspan="8" style="padding:4px 10px 4px 22px">${lotTable(d)}</td></tr>` : ''); }).join('')) : empty('ไม่พบรายการตามเงื่อนไข');
      $('#lt').querySelectorAll('[data-tg]').forEach(r => r.onclick = () => { open[r.dataset.tg] = !open[r.dataset.tg]; draw(); });
      $('#lt').querySelectorAll('[data-adj]').forEach(b => b.onclick = e => { e.stopPropagation(); adjModal(b.dataset.adj, b.dataset.n); });
    };
    $('#fq').oninput = draw; $('#fc').onchange = draw; $('#fs').onchange = draw;
    wb.querySelectorAll('[data-fs]').forEach(b => b.onclick = () => { $('#fs').value = b.dataset.fs === F.st ? '' : b.dataset.fs; draw(); });
    $('#xa').onclick = () => { act0.forEach(d => open[d.drugId] = true); draw(); }; $('#xc').onclick = () => { Object.keys(open).forEach(k => delete open[k]); draw(); };
    draw();
  } else if (S.wh === 'recv') {
    const ds = (await call('stockSummary')).filter(d => d.active === 'Y');
    wb.innerHTML = `<div class="card"><h3>บันทึกรับยาเข้าคลัง <small class="mut" style="font-weight:400">(รับได้หลายรายการในครั้งเดียว)</small></h3><p class="mut" style="margin:2px 0 6px">บันทึก 1 ครั้ง = ใบรับยา 1 ใบ · ระบบออกเลขที่ใบรับให้อัตโนมัติเรียงตามลำดับ 1, 2, 3, … ในแต่ละปีงบประมาณ · วันที่รับ = วันนี้</p>
      <div class="fg"><div><label>ผู้ขาย / แหล่งที่มา</label><input id="rs" maxlength="80" placeholder="เช่น องค์การเภสัชกรรม"></div><div><label>เลขที่ใบส่งของ / ใบกำกับภาษี</label><input id="ri" maxlength="40" placeholder="ถ้ามี"></div></div>
      <div class="tw" style="margin-top:10px"><table><thead><tr><th class="c" style="width:36px">#</th><th style="min-width:270px">เวชภัณฑ์</th><th style="min-width:60px">หน่วย</th><th style="min-width:110px">เลข LOT</th><th style="min-width:140px">วันหมดอายุ</th><th class="r" style="min-width:90px">จำนวน</th><th class="r" style="min-width:100px">ราคา/หน่วย</th><th class="r" style="min-width:90px">มูลค่า</th><th></th></tr></thead><tbody id="rrows"></tbody></table></div>
      <div class="row sp" style="margin-top:8px"><button class="btn sec sm" id="radd">+ เพิ่มรายการ</button><b id="rsum"></b></div>
      <div class="mf"><button class="btn" id="rv">บันทึกรับยา</button></div></div>`;
    const sum = () => { let n = 0, v = 0; wb.querySelectorAll('#rrows tr').forEach(r => { const q = +r.querySelector('[data-q]').value || 0, p = +r.querySelector('[data-p]').value || 0; r.querySelector('[data-v]').textContent = q && p ? money(q * p) : ''; if (r.querySelector('[data-d]').value) { n++; v += q * p; } });
      $('#rsum').textContent = `${fmt(n)} รายการ · มูลค่ารวม ${money(v)} บาท`; $('#rv').textContent = n ? `บันทึกรับยา (${fmt(n)} รายการ)` : 'บันทึกรับยา';
      wb.querySelectorAll('#rrows tr').forEach((r, k) => { r.cells[0].textContent = k + 1; const d = ds.find(x => x.drugId === r.querySelector('[data-d]').value); r.querySelector('[data-un]').textContent = d ? d.unit : '-'; }); };
    const add = () => { const tr = document.createElement('tr');
      tr.innerHTML = `<td class="c"></td><td><select data-d>${drugOpts(ds, '— เลือกเวชภัณฑ์ —')}</select></td><td data-un class="mut">-</td><td><input data-l maxlength="30"></td><td><input data-e type="date" min="${todayIso()}"></td><td><input data-q type="number" min="1" step="1" inputmode="numeric" style="text-align:right"></td><td><input data-p type="number" min="0" step="0.01" inputmode="decimal" style="text-align:right"></td><td class="r" data-v></td><td><button class="btn sec sm" data-x title="ลบแถว">✕</button></td>`;
      tr.querySelector('[data-x]').onclick = () => { tr.remove(); if (!wb.querySelector('#rrows tr')) add(); sum(); };
      tr.querySelectorAll('input,select').forEach(e => e.oninput = sum); $('#rrows').appendChild(tr); sum(); };
    add(); add(); add(); $('#radd').onclick = add;
    $('#rv').onclick = b => {
      const items = []; let err = '';
      wb.querySelectorAll('#rrows tr').forEach((r, k) => { const g = a => r.querySelector(a).value.trim(), it = { drugId: g('[data-d]'), lotNo: g('[data-l]'), expDate: g('[data-e]'), qty: g('[data-q]'), unitPrice: g('[data-p]') };
        if (!it.drugId && !it.lotNo && !it.expDate && !it.qty && !it.unitPrice) return;
        if (!err && (!it.drugId || !it.lotNo || !it.expDate || !(+it.qty > 0) || it.unitPrice === '')) err = `รายการที่ ${k + 1}: กรุณากรอกเวชภัณฑ์ เลข LOT วันหมดอายุ จำนวน และราคาให้ครบ`;
        items.push(it); });
      if (err) return toast(err, true); if (!items.length) return toast('กรุณากรอกรายการยาอย่างน้อย 1 รายการ', true);
      if (!$('#rs').value.trim()) return toast('กรุณากรอกผู้ขาย / แหล่งที่มา', true);
      const nm = id => { const d = ds.find(x => x.drugId === id); return d ? d : { name: id, unit: '' }; };
      const tot = items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
      const m = modal('ยืนยันบันทึกใบรับยา', `<div class="kv"><b>ผู้ขาย</b><span>${esc($('#rs').value.trim())}</span><b>เลขที่ใบส่งของ</b><span>${esc($('#ri').value.trim() || '-')}</span><b>วันที่รับ</b><span>${thDate(todayIso())}</span><b>เลขที่ใบรับ</b><span class="mut">ระบบออกเลขถัดไปให้เมื่อกดยืนยัน</span></div>${tbl([['#', 'c'], ['เวชภัณฑ์'], ['หน่วย'], ['LOT'], ['หมดอายุ'], ['จำนวน', 'r'], ['ราคา/หน่วย', 'r'], ['มูลค่า', 'r']], items.map((i, k) => `<tr><td class="c">${k + 1}</td><td>${esc(nm(i.drugId).name)}</td><td>${esc(nm(i.drugId).unit)}</td><td>${esc(i.lotNo)}</td><td>${thDate(i.expDate)}</td><td class="r">${fmt(i.qty)}</td><td class="r">${money(i.unitPrice)}</td><td class="r">${money(i.qty * i.unitPrice)}</td></tr>`).join('') + `<tr class="head"><td></td><td colspan="6">รวม ${fmt(items.length)} รายการ</td><td class="r">${money(tot)}</td></tr>`)}<div class="mf"><button class="btn sec" data-close>กลับไปแก้ไข</button><button class="btn" id="ok">ยืนยันบันทึก</button></div>`, { wide: true });
      $id(m, 'ok').onclick = b2 => act(b2.target, async () => { const r = await call('receiveMany', { supplier: $('#rs').value, invoiceNo: $('#ri').value, items: items }); m.remove(); toast(`บันทึกใบรับยาเลขที่ ${r.rcvSeq}/${r.fy} แล้ว (${fmt(r.count)} รายการ)`); go('warehouse'); rcvDocModal(r.rcvSeq, r.fy); });
    };
  } else {
    const st = await call('stockSummary');
    wb.innerHTML = `<div class="row sp" style="margin-bottom:10px"><span class="mut">ทะเบียนเวชภัณฑ์ทั้งหมด ${st.length} รายการ</span><button class="btn" id="da">+ เพิ่มเวชภัณฑ์</button></div>` +
      tbl([['ชื่อเวชภัณฑ์'], ['หน่วย'], ['หมวด'], ['จุดสั่งซื้อ', 'r'], ['สถานะ'], ['']], st.map(d => `<tr><td>${esc(d.name)}</td><td>${esc(d.unit)}</td><td>${esc(d.category)}</td><td class="r">${fmt(d.minStock)}</td><td>${badge(d.active === 'Y' ? 'active' : 'disabled')}</td><td><button class="btn sec sm" data-de="${esc(d.drugId)}">แก้ไข</button> <button class="btn sec sm" data-dt="${esc(d.drugId)}" data-a="${d.active === 'Y' ? 0 : 1}">${d.active === 'Y' ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}</button></td></tr>`).join(''));
    $('#da').onclick = () => drugModal(null);
    wb.querySelectorAll('[data-de]').forEach(b => b.onclick = () => drugModal(st.find(x => x.drugId === b.dataset.de)));
    wb.querySelectorAll('[data-dt]').forEach(b => b.onclick = () => act(b, async () => { await call('drugToggle', { drugId: b.dataset.dt, active: b.dataset.a === '1' }); go('warehouse'); }));
  }
};
function drugModal(d) {
  const m = modal(d ? 'แก้ไขเวชภัณฑ์' : 'เพิ่มเวชภัณฑ์', `<label>ชื่อเวชภัณฑ์</label><input id="dn" maxlength="80" value="${esc(d ? d.name : '')}"><div class="fg"><div><label>หน่วยนับ</label><select id="du"><option value="">— เลือกหน่วย —</option>${(d && d.unit && !UNITS.includes(d.unit) ? [d.unit] : []).concat(UNITS).map(u => `<option value="${esc(u)}"${d && d.unit === u ? ' selected' : ''}>${esc(u)}</option>`).join('')}</select></div><div><label>หมวด</label><input id="dc" maxlength="40" value="${esc(d ? d.category : '')}"></div><div><label>จุดสั่งซื้อขั้นต่ำ</label><input id="dm" type="number" min="0" step="1" value="${d ? d.minStock : 0}"></div></div><div class="mf"><button class="btn" id="ds">บันทึก</button></div>`);
  $id(m, 'ds').onclick = b => act(b.target, async () => { await call('drugSave', { drugId: d ? d.drugId : '', name: val(m, 'dn'), unit: val(m, 'du'), category: val(m, 'dc'), minStock: val(m, 'dm') }); m.remove(); toast('บันทึกแล้ว'); go('warehouse'); });
}
function adjModal(lotId, name) {
  const m = modal('ปรับปรุงยอด ' + name, `<p class="mut">ใส่จำนวนเป็น + เพื่อเพิ่ม หรือ − เพื่อลด (เช่น ตัดจำหน่ายยาหมดอายุ ยาเสียหาย นับสต็อกไม่ตรง) ทุกรายการจะบันทึกใน Stock Card</p><label>จำนวนปรับปรุง (+/−)</label><input id="aq" type="number" step="1" inputmode="numeric"><label>เหตุผล</label><input id="ar" maxlength="120"><div class="mf"><button class="btn" id="as">บันทึก</button></div>`);
  $id(m, 'as').onclick = b => act(b.target, async () => { await call('adjust', { lotId: lotId, delta: val(m, 'aq'), reason: val(m, 'ar') }); m.remove(); toast('ปรับปรุงยอดแล้ว'); go('warehouse'); });
}

/* ---- Stock Card ---- */
VIEWS.stockcard = async el => {
  const ds = await call('stockSummary');
  el.innerHTML = `<h2>Stock Card</h2><div class="card"><div class="fg"><div style="grid-column:1/-1"><label>เวชภัณฑ์</label><select id="sd">${drugOpts(ds, '— เลือกเวชภัณฑ์ —')}</select></div><div><label>ตั้งแต่วันที่</label><input id="sf" type="date" value="${fyStart()}"></div><div><label>ถึงวันที่</label><input id="st" type="date" value="${todayIso()}"></div></div><div class="mf"><button class="btn" id="sg">แสดง</button></div></div><div id="sr"></div>`;
  $('#sg').onclick = b => act(b.target, async () => {
    const d = ds.find(x => x.drugId === $('#sd').value); if (!d) throw new Error('กรุณาเลือกเวชภัณฑ์');
    const p = { drugId: d.drugId, from: $('#sf').value, to: $('#st').value }, r = await call('stockCard', p);
    const html = scHtml(r);
    $('#sr').innerHTML = `<div class="row" style="margin-bottom:10px"><button class="btn sec" id="p1">พิมพ์</button><button class="btn sec" id="p2">PDF</button><button class="btn sec" id="p3">Word</button></div><div class="tw" style="border:0">${html}</div>`;
    $('#p1').onclick = () => printHtml(html); $('#p2').onclick = e => act(e.target, () => download(Object.assign({ kind: 'stockcard' }, p), 'pdf')); $('#p3').onclick = e => act(e.target, () => download(Object.assign({ kind: 'stockcard' }, p), 'docx'));
  });
};
function scHtml(r) {
  return `<div class="sheet"><div class="t1">บัญชีเวชภัณฑ์ (Stock Card)</div><div><b>รายการ:</b> ${esc(r.drug.name)} &nbsp; <b>หน่วย:</b> ${esc(r.drug.unit)}</div><div style="margin-bottom:6px"><b>ช่วงวันที่:</b> ${r.from ? thDate(r.from) : 'เริ่มต้น'} ถึง ${r.to ? thDate(r.to) : 'ปัจจุบัน'} &nbsp; <b>ยอดยกมา:</b> ${fmt(r.opening)}</div>
    <table><thead><tr><th>วันที่</th><th>เอกสารอ้างอิง</th><th>รายการ/หน่วยงาน</th><th>LOT</th><th>หมดอายุ</th><th>รับ</th><th>จ่าย</th><th>คงเหลือ</th></tr></thead><tbody>${r.rows.length ? r.rows.map(x => `<tr><td style="text-align:center">${thDate(x.date)}</td><td style="text-align:center">${esc(x.ref || '-')}</td><td>${esc(x.type)} ${esc(x.party)}</td><td style="text-align:center">${esc(x.lotNo)}</td><td style="text-align:center">${thDate(x.expDate)}</td><td style="text-align:right">${x.qtyIn ? fmt(x.qtyIn) : ''}</td><td style="text-align:right">${x.qtyOut ? fmt(x.qtyOut) : ''}</td><td style="text-align:right">${fmt(x.balance)}</td></tr>`).join('') : '<tr><td colspan="8" style="text-align:center">ไม่มีความเคลื่อนไหวในช่วงที่เลือก</td></tr>'}</tbody></table><div style="margin-top:6px;font-weight:600">ยอดคงเหลือปลายงวด: ${fmt(r.closing)} ${esc(r.drug.unit)}</div></div>`;
}

/* ---- ผู้ใช้งาน ---- */
VIEWS.users = async el => {
  const us = await call('users'), H = S.meta.hospitals;
  el.innerHTML = `<div class="row sp"><h2>ผู้ใช้งาน</h2><button class="btn" id="ua">+ เพิ่มผู้ใช้</button></div><p class="mut">ผู้สมัครใหม่แสดงสถานะ "รออนุมัติ" — กด แก้ไข แล้วเปลี่ยนเป็น "ใช้งาน"</p>` +
    tbl([['ชื่อผู้ใช้'], ['ชื่อ-สกุล'], ['หน่วยบริการ'], ['สิทธิ์'], ['สถานะ'], ['เข้าล่าสุด'], ['']], us.map(u => `<tr><td>${esc(u.username)}</td><td>${esc(u.name)}</td><td>${esc(u.hospName)}</td><td>${u.role === 'admin' ? 'แอดมิน' : 'หน่วยบริการ'}</td><td>${badge(u.status)}</td><td>${thDT(u.lastLogin)}</td><td><button class="btn sec sm" data-ue="${esc(u.username)}">แก้ไข</button> <button class="btn sec sm" data-ur="${esc(u.username)}">ตั้งรหัสใหม่</button></td></tr>`).join(''));
  const form = u => { const e = !!u;
    const m = modal(e ? 'แก้ไขผู้ใช้ ' + u.username : 'เพิ่มผู้ใช้', `<div class="fg"><div><label>ชื่อผู้ใช้</label><input id="mu" maxlength="20" value="${esc(e ? u.username : '')}" ${e ? 'disabled' : ''}></div>${e ? '' : '<div><label>รหัสผ่าน (4 ตัว)</label><input id="mp" maxlength="4"></div>'}<div><label>ชื่อ-สกุล</label><input id="mn" maxlength="60" value="${esc(e ? u.name : '')}"></div><div><label>สิทธิ์</label><select id="mr"><option value="user">หน่วยบริการ</option><option value="admin" ${e && u.role === 'admin' ? 'selected' : ''}>แอดมิน</option></select></div><div><label>หน่วยบริการ</label><select id="mh">${H.map(h => `<option value="${esc(h.code)}" ${e && u.hospCode === h.code ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}</select></div><div><label>สถานะ</label><select id="ms">${['active', 'pending', 'disabled'].map(s => `<option value="${s}" ${(e ? u.status : 'active') === s ? 'selected' : ''}>${ST[s] || 'รออนุมัติ'}</option>`).join('')}</select></div></div><div class="mf"><button class="btn" id="msv">บันทึก</button></div>`);
    $id(m, 'msv').onclick = b => act(b.target, async () => { await call('userSave', { username: e ? u.username : val(m, 'mu'), password: e ? '' : val(m, 'mp'), name: val(m, 'mn'), role: val(m, 'mr'), hospCode: val(m, 'mh'), status: val(m, 'ms') }); m.remove(); toast('บันทึกแล้ว'); go('users'); });
  };
  $('#ua').onclick = () => form(null);
  el.querySelectorAll('[data-ue]').forEach(b => b.onclick = () => form(us.find(x => x.username === b.dataset.ue)));
  el.querySelectorAll('[data-ur]').forEach(b => b.onclick = () => {
    const m = modal('ตั้งรหัสผ่านใหม่ ' + b.dataset.ur, `<label>รหัสผ่านใหม่ (4 ตัวอักษร/ตัวเลข)</label><input id="np" maxlength="4"><p class="mut">ผู้ใช้จะถูกบังคับให้เปลี่ยนรหัสเมื่อเข้าสู่ระบบครั้งถัดไป</p><div class="mf"><button class="btn" id="nps">บันทึก</button></div>`);
    $id(m, 'nps').onclick = x => act(x.target, async () => { await call('userResetPw', { username: b.dataset.ur, password: val(m, 'np') }); m.remove(); toast('ตั้งรหัสผ่านใหม่แล้ว'); });
  });
};
VIEWS.logs = async el => {
  const ls = await call('logs');
  el.innerHTML = '<div class="row sp"><h2>บันทึกการใช้งาน (300 รายการล่าสุด)</h2><button class="btn sec" id="bk">ดาวน์โหลดสำรองข้อมูล (Excel)</button></div><p class="mut">ควรสำรองข้อมูลทุกสัปดาห์ เก็บไฟล์ไว้ในเครื่องหรือไดรฟ์ส่วนตัว (มี HN ผู้ป่วย ห้ามแชร์)</p>' + tbl([['เวลา'], ['ผู้ใช้'], ['การกระทำ'], ['รายละเอียด']], ls.map(l => `<tr><td>${thDT(l.time)}</td><td>${esc(l.user)}</td><td>${esc(l.action)}</td><td>${esc(l.detail)}</td></tr>`).join(''));
  $('#bk').onclick = b => act(b.target, backupXlsx);
};
/** สำรองฐานข้อมูลทั้งหมดเป็นไฟล์ Excel แยกแผ่นงานตามตาราง (แทน Trigger สำรองรายสัปดาห์ของ GAS) */
async function backupXlsx() {
  const T = ['Hospitals', 'Users', 'Drugs', 'Lots', 'Requests', 'RequestItems', 'Issues', 'IssueItems', 'StockCard', 'Receipts', 'Loans', 'LoanLines', 'LoanReturns', 'LoanReturnLines', 'MedErrors', 'Logs'];
  busy(true);
  try {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
    const D = await srv('load', { t: T, full: true }), wb = XLSX.utils.book_new();
    T.forEach(n => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(D[n] || []), n));
    XLSX.writeFile(wb, 'สำรอง-ฐานข้อมูลยา-' + bkkDateTime(new Date()).replace(/[: ]/g, '').slice(0, 13) + '.xlsx');
    toast('ดาวน์โหลดไฟล์สำรองข้อมูลแล้ว');
  } finally { busy(false); }
}


/* ---- ยืม-คืนยาระหว่างหน่วยบริการ ---- */
// ขั้นตอน: 1) ผู้ยืมกดขอยืม → 2) ผู้ให้ยืมพิจารณา/อนุมัติ → 3) ผู้ยืมกดคืนยา
const LST = { requested: 'รอผู้ให้ยืมพิจารณา', active: 'ยืมอยู่ (ยังคืนไม่ครบ)', returned: 'คืนครบแล้ว', closed: 'ปิดรายการ', rejected: 'ไม่อนุมัติ', cancelled: 'ยกเลิก' };
const LCL = { requested: 'pending', active: 'near', returned: 'approved', closed: 'cancelled', rejected: 'rejected', cancelled: 'cancelled' };
const lbadge = s => `<span class="badge b-${LCL[s] || 'cancelled'}">${esc(LST[s] || s)}</span>`;
const UNITS = ['เม็ด', 'แคปซูล', 'กล่อง', 'ขวด', 'หลอด', 'ซอง', 'แผง', 'ชิ้น', 'อัน', 'ถุง', 'แพ็ค', 'ม้วน', 'amp', 'vial'];
const addDaysIso = n => { const d = new Date(Date.now() + n * 864e5), z = x => ('0' + x).slice(-2); return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); };
VIEWS.loans = async el => {
  const adm = S.user.role === 'admin', rows = await call('loans');
  const tabs = adm ? [['all', 'ทั้งหมด'], ['open', 'ยังไม่เสร็จสิ้น'], ['late', 'ยังค้างคืน']] : [['todo', 'รอคุณพิจารณา'], ['wait', 'รอผู้ให้ยืมพิจารณา'], ['bor', 'ยืมอยู่'], ['len', 'ให้ยืมอยู่'], ['all', 'ทั้งหมด']];
  if (!tabs.some(t => t[0] === S.lt)) S.lt = tabs[0][0];
  const F = { all: () => true, open: r => r.open, late: r => r.overdue, todo: r => r.todo, in: r => r.role === 'borrower', out: r => r.role === 'lender', wait: r => r.role === 'borrower' && r.status === 'requested', bor: r => r.role === 'borrower' && r.status === 'active' && r.outstanding > 0, len: r => r.role === 'lender' && r.status === 'active' && r.outstanding > 0 }, list = rows.filter(F[S.lt]);
  el.innerHTML = `<div class="row sp"><h2>ยืม-คืนยาระหว่างหน่วยบริการ</h2>${adm ? '' : '<button class="btn" id="lnew">+ ขอยืมยา</button>'}</div>
  <div class="row" style="margin:8px 0"><button class="btn sec sm" id="lrOut">${adm ? 'ทะเบียนการให้ยืม' : 'ทะเบียนที่เราให้ยืม'}</button><button class="btn sec sm" id="lrIn">${adm ? 'ทะเบียนการยืม' : 'ทะเบียนที่เรายืมหน่วยบริการอื่น'}</button></div>
  <div class="seg">${tabs.map(t => `<button data-lt="${t[0]}" class="${S.lt === t[0] ? 'on' : ''}">${t[1]} (${rows.filter(F[t[0]]).length})</button>`).join('')}</div>
  ${list.length ? tbl([['เลขที่'], ['วันที่ขอ'], ['ผู้ให้ยืม'], ['ผู้ยืม'], ['รายการ', 'c'], ['วันที่คืนจริง'], ['สถานะ']], list.map(r => `<tr class="clk" data-ln="${esc(r.loanId)}"><td>${esc(r.loanId)}${r.todo ? ' <span class="badge b-pending">รอคุณ</span>' : ''}</td><td>${thDate(r.createdAt.slice(0, 10))}</td><td>${esc(r.lenderName)}</td><td>${esc(r.borrowerName)}</td><td class="c">${r.itemCount}</td><td>${r.returnDates && r.returnDates.length ? r.returnDates.map(thDate).join('<br>') : '-'}</td><td>${lbadge(r.status)}</td></tr>`).join('')) : empty('ไม่มีรายการ')}`;
  el.querySelectorAll('[data-lt]').forEach(b => b.onclick = () => { S.lt = b.dataset.lt; go('loans'); });
  el.querySelectorAll('[data-ln]').forEach(r => r.onclick = () => openLoan(r.dataset.ln));
  if ($('#lnew')) $('#lnew').onclick = loanNew;
  $('#lrOut').onclick = () => loanRegModal('out'); $('#lrIn').onclick = () => loanRegModal('in');
};
function loanNew() {
  const H = S.meta.hospitals.filter(h => h.code !== S.user.hospCode);
  const m = modal('ขอยืมยาจากหน่วยบริการอื่น', `<div class="fg"><div><label>ยืมจาก</label><select id="ll"><option value="">— เลือกหน่วยบริการ —</option>${H.map(h => `<option value="${esc(h.code)}">${esc(h.name)}</option>`).join('')}</select></div></div>
  <label>รายการยาที่ขอยืม (กรอกชื่อยา จำนวน และหน่วย)</label><div id="lrows"></div><button class="btn sec sm" id="ladd" style="margin-top:6px">+ เพิ่มรายการ</button>
  <label>หมายเหตุ (ถ้ามี)</label><textarea id="lno" maxlength="200" rows="2"></textarea><div class="mf"><button class="btn sec" data-close>ยกเลิก</button><button class="btn" id="lsv">ส่งคำขอยืม</button></div>`, { wide: true });
  const add = () => { const r = document.createElement('div'); r.className = 'row'; r.setAttribute('data-lr', '1'); r.style.marginBottom = '6px'; r.innerHTML = '<input class="grow" placeholder="ชื่อยา" data-n maxlength="80" autocomplete="off"><input type="number" min="1" step="1" inputmode="numeric" placeholder="จำนวน" data-q style="width:100px"><select data-u style="width:120px"><option value="">— หน่วย —</option>' + UNITS.map(u => `<option value="${esc(u)}">${esc(u)}</option>`).join('') + '</select>'; $id(m, 'lrows').appendChild(r); };
  add(); $id(m, 'ladd').onclick = add;
  $id(m, 'lsv').onclick = b => act(b.target, async () => {
    const items = []; m.querySelectorAll('[data-lr]').forEach(r => {
      const n = r.querySelector('[data-n]').value, q = r.querySelector('[data-q]').value, u = r.querySelector('[data-u]').value; if (!n.trim() && !q && !u.trim()) return;
      items.push({ name: n, qty: q, unit: u });
    });
    const r = await call('loanCreate', { lender: val(m, 'll'), note: val(m, 'lno'), items: items });
    m.remove(); toast('ส่งคำขอยืมแล้ว เลขที่ ' + r.loanId); go('loans');
  });
}
async function openLoan(id) {
  const d = await call('loanDetail', { loanId: id }), l = d.loan, adm = l.role === 'admin', isL = adm || l.role === 'lender', isB = adm || l.role === 'borrower';
  const kv = (k, v) => v ? `<b>${k}</b><span>${v}</span>` : '';
  const head = `<div class="kv">${kv('เลขที่', esc(l.loanId) + ' ' + lbadge(l.status))}${kv('ผู้ให้ยืม', esc(l.lenderName))}${kv('ผู้ยืม', esc(l.borrowerName))}${kv('วันที่ขอ', thDT(l.createdAt) + ' โดย ' + esc(l.createdBy))}${kv('วันที่คืนจริง', d.returns.length ? d.returns.map(r => thDate(r.createdAt.slice(0, 10))).filter((x, i, a) => a.indexOf(x) === i).join(', ') : '-')}${kv('หมายเหตุ', esc(l.note))}${kv('ผู้อนุมัติให้ยืม', l.decidedBy ? esc(l.decidedBy) + ' ' + thDT(l.decidedAt) : '')}${kv('เหตุผล', esc(l.reason))}</div>`;
  const its = tbl([['รายการยา'], ['หน่วย'], ['ขอยืม', 'r'], ['ให้ยืม', 'r'], ['คืนแล้ว', 'r'], ['ค้างคืน', 'r']], d.items.map(i => `<tr><td>${esc(i.name)}</td><td>${esc(i.unit)}</td><td class="r">${fmt(i.qtyReq)}</td><td class="r">${fmt(i.qtyLent)}</td><td class="r">${fmt(i.qtyReturned)}</td><td class="r">${l.status === 'active' ? fmt(i.outstanding) : '-'}</td></tr>`).join(''));
  const rets = d.returns.length ? '<h3 style="margin:14px 0 6px">ประวัติการคืน</h3>' + d.returns.map(r => `<div class="card" style="padding:10px"><div class="mut">${thDT(r.createdAt)} โดย ${esc(r.createdBy)}</div><div>${r.items.map(x => `${esc(x.name)} ${fmt(x.qty)} ${esc(x.unit)}`).join('<br>')}</div>${r.note ? `<div class="mut">หมายเหตุ: ${esc(r.note)}</div>` : ''}</div>`).join('') : '';
  const btn = [];
  if (l.status === 'requested' && isL) btn.push('<button class="btn" id="bDec">พิจารณา / อนุมัติ</button>');
  if (l.status === 'requested' && isB) btn.push('<button class="btn bad" id="bCan">ยกเลิกคำขอ</button>');
  if (l.status === 'active' && isB) btn.push('<button class="btn" id="bRet">คืนยา</button>');
  if (adm && (l.status === 'requested' || l.status === 'active')) btn.push('<button class="btn sec" id="bCls">ปิดรายการ (แอดมิน)</button>');
  const m = modal('รายการยืม-คืนยา ' + id, head + its + rets + `<div class="mf">${btn.join('')}<button class="btn sec" id="bPr">พิมพ์</button><button class="btn sec" id="bPd">PDF</button><button class="btn sec" id="bWd">Word</button></div>`, { wide: true });
  const on = (i, fn) => { const e = $id(m, i); if (e) e.onclick = b => act(b.target, fn); };
  on('bDec', async () => loanDecideModal(d, m)); on('bRet', async () => loanReturnModal(d, m));
  on('bCan', async () => { if (!confirm('ยืนยันยกเลิกคำขอยืมนี้?')) return; await call('loanCancel', { loanId: id }); m.remove(); toast('ยกเลิกแล้ว'); go('loans'); });
  on('bCls', async () => { const why = prompt('ระบุเหตุผลการปิดรายการ (เช่น เคลียร์ยอดนอกระบบ)'); if (why == null) return; await call('loanClose', { loanId: id, reason: why }); m.remove(); toast('ปิดรายการแล้ว'); go('loans'); });
  on('bPr', async () => printHtml(repHtml(await call('loanDoc', { loanId: id })))); on('bPd', () => download({ kind: 'loan', loanId: id }, 'pdf')); on('bWd', () => download({ kind: 'loan', loanId: id }, 'docx'));
}
const qtyRows = (items, key) => items.map(i => `<tr><td>${esc(i.name)} <span class="mut">(${esc(i.unit)})</span></td><td class="r">${fmt(key === 'req' ? i.qtyReq : i.outstanding)}</td><td class="r" style="width:110px"><input type="number" min="0" max="${key === 'req' ? i.qtyReq : i.outstanding}" step="1" value="${key === 'req' ? i.qtyReq : i.outstanding}" data-q="${i.lineNo}" style="width:95px;text-align:right"></td></tr>`).join('');
const qtyOf = (m, items) => items.map(i => ({ lineNo: i.lineNo, qty: m.querySelector('[data-q="' + i.lineNo + '"]').value }));
function loanDecideModal(d, parent) {
  const l = d.loan, m = modal('พิจารณาคำขอยืม ' + l.loanId, `<p class="mut">${esc(l.borrowerName)} ขอยืมจาก ${esc(l.lenderName)} — ระบุจำนวนที่ให้ยืมจริง (ใส่ 0 หากไม่ให้ยืมรายการนั้น)</p>
  <div class="tw"><table><thead><tr><th>รายการยา</th><th class="r">ขอยืม</th><th class="r">ให้ยืม</th></tr></thead><tbody>${qtyRows(d.items, 'req')}</tbody></table></div>
  <div class="mf"><button class="btn bad" id="dj">ไม่อนุมัติ</button><button class="btn" id="da">อนุมัติให้ยืม</button></div>`, { wide: true });
  $id(m, 'da').onclick = b => act(b.target, async () => { await call('loanDecide', { loanId: l.loanId, approve: true, items: qtyOf(m, d.items) }); m.remove(); parent.remove(); toast('อนุมัติให้ยืมแล้ว'); go('loans'); openLoan(l.loanId); });
  $id(m, 'dj').onclick = b => act(b.target, async () => { const why = prompt('ระบุเหตุผลที่ไม่อนุมัติ'); if (why == null) return; await call('loanDecide', { loanId: l.loanId, approve: false, reason: why }); m.remove(); parent.remove(); toast('บันทึกการไม่อนุมัติแล้ว'); go('loans'); });
}
function loanReturnModal(d, parent) {
  const l = d.loan, open = d.items.filter(i => i.outstanding > 0);
  const m = modal('คืนยา ' + l.loanId, `<p class="mut">ระบุจำนวนที่คืนครั้งนี้ (คืนทีละส่วนได้) ยอดคืนจะถูกนับทันที และรายการจะปิดเมื่อคืนครบทุกรายการ</p><div class="tw"><table><thead><tr><th>รายการยา</th><th class="r">ค้างคืน</th><th class="r">คืนครั้งนี้</th></tr></thead><tbody>${qtyRows(open, 'out')}</tbody></table></div><label>หมายเหตุ</label><input id="rn" maxlength="200"><div class="mf"><button class="btn" id="rs">ยืนยันคืนยา</button></div>`, { wide: true });
  $id(m, 'rs').onclick = b => act(b.target, async () => { const r = await call('loanReturn', { loanId: l.loanId, items: qtyOf(m, open), note: val(m, 'rn') }); m.remove(); parent.remove(); toast(r.closed ? 'คืนครบแล้ว ปิดรายการ' : 'บันทึกการคืนแล้ว'); go('loans'); openLoan(l.loanId); });
}
function loanRegModal(type) {
  const adm = S.user.role === 'admin', cur = curFY(), ttl = type === 'out' ? (adm ? 'ทะเบียนการให้ยืม' : 'ทะเบียนที่เราให้ยืมหน่วยบริการอื่น') : (adm ? 'ทะเบียนการยืม' : 'ทะเบียนที่เรายืมหน่วยบริการอื่น');
  const m = modal(ttl + ' (ดาวน์โหลดได้)', `<div class="fg"><div><label>ปีงบประมาณ</label><select id="gf"><option value="">ทั้งหมด</option>${[0, 1, 2, 3, 4, 5].map(k => `<option value="${cur - k}" ${k === 0 ? 'selected' : ''}>${cur - k}</option>`).join('')}</select></div><div><label>เดือน</label><select id="gm"><option value="">ทั้งปี</option>${MN_NO.map((n, i) => `<option value="${n}">${MN_FULL[i]}</option>`).join('')}</select></div><div><label>สถานะ</label><select id="gs"><option value="">ทั้งหมด</option><option value="open">เฉพาะที่ยังไม่เสร็จสิ้น</option></select></div>${adm ? `<div><label>หน่วยบริการ</label><select id="gh"><option value="">ทุกหน่วย</option>${S.meta.hospitals.map(h => `<option value="${esc(h.code)}">${esc(h.name)}</option>`).join('')}</select></div>` : ''}</div><div class="mf"><button class="btn" id="gg">แสดงทะเบียน</button></div><div id="rres"></div>`, { wide: true });
  $id(m, 'gg').onclick = b => act(b.target, async () => { const p = { type: type, fy: val(m, 'gf'), month: val(m, 'gm'), status: val(m, 'gs'), hosp: adm ? val(m, 'gh') : '' }; showReport(await call('loanReg', p), p, 'loanreg'); });
}

/* ---- รายงาน (แอดมิน): ทะเบียนรับยา / สรุปมูลค่ารับ / สรุปมูลค่าเบิกรายหน่วย ---- */
const MN_FULL = ['ตุลาคม', 'พฤศจิกายน', 'ธันวาคม', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน'], MN_NO = [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const curFY = () => { const t = todayIso(); return +t.slice(0, 4) + 543 + (+t.slice(5, 7) >= 10 ? 1 : 0); };
const algn = (t, i) => t.aligns[i] === 'r' ? 'r' : t.aligns[i] === 'c' ? 'c' : '';
VIEWS.reports = async el => {
  const cur = curFY(), tabs = [['rcvdoc', 'รับยาเข้าตามลำดับใบรับ'], ['rcvreg', 'ทะเบียนรับยาเข้า'], ['rcvsum', 'สรุปมูลค่ารับยาเข้า'], ['isssum', 'สรุปมูลค่าเบิกรายหน่วย'], ['loansum', 'สรุปยืม-คืนยา']];
  if (S.rf.fy === '' && !S.rfInit) { S.rf.fy = String(cur); S.rfInit = true; }
  const ds = S.rp === 'rcvreg' ? await call('stockSummary') : [];
  el.innerHTML = `<h2>รายงาน</h2><div class="seg" style="margin-top:10px">${tabs.map(t => `<button data-rt="${t[0]}" class="${S.rp === t[0] ? 'on' : ''}">${t[1]}</button>`).join('')}</div>
  <div class="card"><div class="fg"><div><label>ปีงบประมาณ</label><select id="rfy"><option value="">ทั้งหมด</option>${[0, 1, 2, 3, 4, 5].map(k => `<option value="${cur - k}" ${String(cur - k) === S.rf.fy ? 'selected' : ''}>${cur - k}</option>`).join('')}</select></div>
  <div><label>เดือน</label><select id="rmo"><option value="">ทั้งปี</option>${MN_NO.map((m, i) => `<option value="${m}" ${String(m) === S.rf.month ? 'selected' : ''}>${MN_FULL[i]}</option>`).join('')}</select></div>
  ${S.rp === 'rcvreg' ? `<div><label>เวชภัณฑ์</label><select id="rdr">${drugOpts(ds, 'ทั้งหมด', S.rf.drug)}</select></div>` : ''}${S.rp === 'rcvdoc' ? `<div><label>เลขที่ใบรับ (เว้นว่าง = ทุกใบ)</label><input id="rno" type="number" min="1" step="1" inputmode="numeric" value="${esc(S.rf.rcvNo)}"></div>` : ''}${S.rp === 'rcvreg' || S.rp === 'rcvdoc' ? `<div><label>ผู้ขาย / เลขที่ใบส่งของ</label><input id="rsu" maxlength="80" value="${esc(S.rf.supplier)}"></div>` : ''}</div>
  <div class="mf"><button class="btn" id="rgo">แสดงรายงาน</button></div></div><div id="rres"></div>`;
  const keep = () => { S.rf.fy = $('#rfy').value; S.rf.month = $('#rmo').value; if (S.rp === 'rcvreg') S.rf.drug = $('#rdr').value; if (S.rp === 'rcvdoc') S.rf.rcvNo = $('#rno').value; if ($('#rsu')) S.rf.supplier = $('#rsu').value; };
  const params = () => {
    keep(); let drugId = '';
    if (S.rp === 'rcvreg') drugId = S.rf.drug || '';
    return { rpt: S.rp, fy: S.rf.fy, month: S.rf.month, drugId: drugId, supplier: S.rp === 'rcvreg' || S.rp === 'rcvdoc' ? S.rf.supplier : '', rcvNo: S.rp === 'rcvdoc' ? S.rf.rcvNo : '' };
  };
  const run = () => act($('#rgo'), async () => { const p = params(); showReport(await call('report', p), p); });
  $('#rgo').onclick = run;
  el.querySelectorAll('[data-rt]').forEach(b => b.onclick = () => { keep(); S.rp = b.dataset.rt; go('reports'); });
  run();
};
/** ใบรับยา 1 ใบ (หลังบันทึก หรือเปิดจากรายงาน) พร้อมพิมพ์ / PDF / Word */
async function rcvDocModal(no, fy) {
  const p = { kind: 'report', rpt: 'rcvdoc', fy: String(fy), month: '', rcvNo: String(no) }, rep = await call('report', p), html = repHtml(rep);
  const m = modal('ใบรับยาเลขที่ ' + no + '/' + fy, `<div class="tw" style="border:0">${html}</div><div class="mf"><button class="btn sec" id="p1">พิมพ์ (A4)</button><button class="btn sec" id="p2">ดาวน์โหลด PDF</button><button class="btn sec" id="p3">ดาวน์โหลด Word</button></div>`, { wide: true });
  $id(m, 'p1').onclick = () => printHtml(html); $id(m, 'p2').onclick = b => act(b.target, () => download(p, 'pdf')); $id(m, 'p3').onclick = b => act(b.target, () => download(p, 'docx'));
}
function repHtml(rep) {
  const tb = t => (t.title ? `<div style="font-weight:700;margin:10px 0 4px">${esc(t.title)}</div>` : '') + `<table><thead><tr>${t.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${t.rows.map(r => `<tr>${r.map((c, i) => `<td style="text-align:${t.aligns[i] === 'r' ? 'right' : t.aligns[i] === 'c' ? 'center' : 'left'}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  return `<div class="sheet"><div class="t1">${esc(rep.title)}</div>${rep.sub.map(s => `<div class="t2" style="font-weight:400">${esc(s)}</div>`).join('')}<div class="t2">${rep.stats.map(s => esc(s[0]) + ' ' + esc(s[1])).join(' &nbsp;&nbsp;&nbsp; ')}</div>${rep.tables.filter(t => !t.ui).map(tb).join('')}${rep.sigs ? `<div class="sigs" style="grid-template-columns:repeat(${rep.sigs.length},1fr)">${rep.sigs.map(s => `<div>ลงชื่อ ........................................ (${esc(s[0])})<br>( ${s[1] ? esc(s[1]) : '&nbsp;'.repeat(30)} )</div>`).join('')}</div>` : ''}</div>`;
}
function csvOf(rep) {
  const q = v => { let s = String(v == null ? '' : v); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  const L = [[rep.title]].concat(rep.sub.map(s => [s]), rep.stats.map(s => [s[0], s[1]]));
  rep.tables.forEach(t => { L.push([]); if (t.title) L.push([t.title]); L.push(t.head); t.rows.forEach(r => L.push(r)); });
  return '\ufeff' + L.map(r => r.map(q).join(',')).join('\r\n');
}
function showReport(rep, p, kind) {
  kind = kind || 'report';
  $('#rres').innerHTML = `<div class="grid" style="margin-bottom:12px">${rep.stats.map(s => `<div class="stat"><b>${esc(s[1])}</b><span>${esc(s[0])}</span></div>`).join('')}</div>
  <div class="row" style="margin-bottom:10px"><button class="btn sec" id="x1">พิมพ์</button><button class="btn sec" id="x2">PDF</button><button class="btn sec" id="x3">Word</button><button class="btn sec" id="x4">CSV (Excel)</button></div>${rep.note ? `<div class="msg e">${esc(rep.note)}</div>` : ''}
  ${rep.tables.map(t => (t.title ? `<h3 style="margin:14px 0 6px">${esc(t.title)}</h3>` : '') + tbl(t.head.map((h, i) => [h, algn(t, i)]), t.rows.map(r => `<tr>${r.map((c, i) => `<td class="${algn(t, i)}">${esc(c)}</td>`).join('')}</tr>`).join('')) + (t.rows.length ? '' : empty('ไม่มีข้อมูลในเงื่อนไขที่เลือก'))).join('')}`;
  $('#x1').onclick = () => printHtml(repHtml(rep));
  $('#x2').onclick = e => act(e.target, () => download(Object.assign({}, p, { kind: kind }), 'pdf'));
  $('#x3').onclick = e => act(e.target, () => download(Object.assign({}, p, { kind: kind }), 'docx'));
  $('#x4').onclick = () => { saveBlob(new Blob([csvOf(rep)], { type: 'text/csv;charset=utf-8' }), 'รายงาน-' + rep.rpt + '-' + (p.fy || 'ทั้งหมด') + '.csv'); toast('ดาวน์โหลด CSV แล้ว'); };
}

/* ================= บันทึกความคลาดเคลื่อนทางยา (Medication Error: ME) ================= */
const ME_TYPE = { presc: 'Prescribing error', trans: 'Transcribing error', pre: 'Pre-dispensing error', disp: 'Dispensing error', admin: 'Administration error' };
const ME_TYPE_TH = { presc: 'การสั่งใช้ยา', trans: 'การคัดลอก/บันทึกคำสั่งใช้ยา', pre: 'ก่อนจ่ายยา (จัด/ตรวจสอบยา)', disp: 'การจ่ายยา/ส่งมอบ', admin: 'การบริหารยา/การใช้ยา' };
const ME_KIND = {
  presc: ['สั่งยาผิดชนิด/ผิดตัวยา', 'สั่งขนาดยา (dose) ผิด', 'สั่งความถี่/ระยะเวลาการใช้ยาผิด', 'สั่งยาผิดรูปแบบ/ความแรง', 'สั่งยาซ้ำซ้อน', 'สั่งยาที่ผู้ป่วยมีประวัติแพ้', 'สั่งยาที่มีปฏิกิริยาต่อกัน/ข้อห้ามใช้', 'สั่งยาผิดคน', 'คำสั่งใช้ยาไม่ชัดเจน/อ่านไม่ออก', 'อื่นๆ (ระบุในรายละเอียด)'],
  trans: ['คัดลอก/คีย์ชื่อยาผิด', 'คัดลอก/คีย์ขนาดยาหรือความแรงผิด', 'คัดลอก/คีย์วิธีใช้หรือความถี่ผิด', 'คัดลอก/คีย์จำนวนยาผิด', 'คัดลอก/คีย์ข้อมูลผู้ป่วยผิดคน', 'คัดลอกรายการยาไม่ครบ/ตกหล่น', 'อื่นๆ (ระบุในรายละเอียด)'],
  pre: ['จัดยาผิดชนิด', 'จัดยาผิดความแรง/รูปแบบ', 'จัดยาผิดจำนวน', 'จัดยาไม่ครบ/ตกหล่น', 'หยิบยาสลับกันเพราะชื่อหรือหน้าตาคล้าย (LASA)', 'จัดยาหมดอายุ/เสื่อมสภาพ', 'ติดฉลากยาผิด/วิธีใช้บนฉลากผิด', 'ติดฉลากสลับผู้ป่วย', 'ไม่ได้ตรวจสอบซ้ำก่อนจ่าย', 'อื่นๆ (ระบุในรายละเอียด)'],
  disp: ['จ่ายยาผิดคน', 'จ่ายยาผิดชนิด', 'จ่ายยาผิดความแรง/รูปแบบ', 'จ่ายยาผิดจำนวน', 'จ่ายยาไม่ครบ/ตกหล่น', 'จ่ายยาซ้ำ', 'จ่ายยาที่ผู้ป่วยแพ้ (ไม่ได้ซักประวัติ)', 'ให้คำแนะนำการใช้ยาผิดหรือไม่ได้ให้คำแนะนำ', 'จ่ายยาหมดอายุ/เสื่อมสภาพ', 'อื่นๆ (ระบุในรายละเอียด)'],
  admin: ['ให้ยาผิดคน', 'ให้ยาผิดชนิด', 'ให้ยาผิดขนาด', 'ให้ยาผิดเวลา/ลืมให้ยา', 'ให้ยาผิดวิธี/ผิดทางที่ให้ยา (route)', 'ให้ยาผิดเทคนิค (เช่น ฉีด/พ่น/หยอดยาไม่ถูกวิธี)', 'ให้ยานานเกินหรือหยุดก่อนกำหนด', 'ให้ยาหมดอายุ/เสื่อมสภาพ', 'อื่นๆ (ระบุในรายละเอียด)']
}; // ต้องตรงกับ ME_KINDS ใน Code.gs
const ME_SEV = { A: 'มีเหตุการณ์ที่อาจก่อให้เกิดความคลาดเคลื่อน', B: 'เกิดความคลาดเคลื่อน แต่ยังไม่ถึงผู้ป่วย', C: 'ถึงผู้ป่วย แต่ไม่เกิดอันตราย', D: 'ถึงผู้ป่วย ต้องเฝ้าระวังเพื่อให้มั่นใจว่าไม่เกิดอันตราย', E: 'เกิดอันตรายชั่วคราว ต้องได้รับการรักษา/แก้ไข', F: 'เกิดอันตรายชั่วคราว ต้องนอน รพ. หรือนอนนานขึ้น', G: 'เกิดอันตรายถาวร', H: 'เกิดอันตรายถึงขั้นต้องช่วยชีวิต', I: 'เสียชีวิต' };
const meReach = r => 'CDEFGHI'.indexOf(r.severity) >= 0, meHarm = r => 'EFGHI'.indexOf(r.severity) >= 0;
const sevBadge = s => `<span class="badge ${'EFGHI'.indexOf(s) >= 0 ? 'b-rejected' : 'CD'.indexOf(s) >= 0 ? 'b-near' : 'b-approved'}" title="${esc(ME_SEV[s] || '')}">${esc(s)}</span>`;
const meSevOpts = (sel, all) => (all ? '<option value="">ทุกระดับ</option>' + [['REACH', 'C-I — ถึงผู้ป่วย (ทุกระดับ C ขึ้นไป)'], ['HARM', 'E-I — เกิดอันตราย (ทุกระดับ E ขึ้นไป)']].map(g => `<option value="${g[0]}" ${g[0] === sel ? 'selected' : ''}>${g[1]}</option>`).join('') : '<option value="">— เลือกระดับความรุนแรง —</option>') + Object.keys(ME_SEV).map(k => `<option value="${k}" ${k === sel ? 'selected' : ''}>${k} — ${esc(ME_SEV[k])}</option>`).join('');
const meTypeOpts = (sel, all) => (all ? '<option value="">ทุกประเภท</option>' : '<option value="">— เลือกประเภท —</option>') + Object.keys(ME_TYPE).map(k => `<option value="${k}" ${k === sel ? 'selected' : ''}>${ME_TYPE[k]} (${ME_TYPE_TH[k]})</option>`).join('');
const meKindOpts = type => '<option value="">' + (type ? '— เลือกชนิดความคลาดเคลื่อน —' : '— เลือกประเภทก่อน —') + '</option>' + (ME_KIND[type] || []).map(k => `<option value="${esc(k)}">${esc(k)}</option>`).join('');
const meFyOpts = sel => { const cur = curFY(); return '<option value="">ทั้งหมด</option>' + [0, 1, 2, 3, 4, 5].map(k => `<option value="${cur - k}" ${String(cur - k) === String(sel) ? 'selected' : ''}>${cur - k}</option>`).join(''); };
const meMoOpts = sel => '<option value="">ทั้งปี</option>' + MN_NO.map((n, i) => `<option value="${n}" ${String(n) === String(sel) ? 'selected' : ''}>${MN_FULL[i]}</option>`).join('');
const meHospOpts = sel => '<option value="">ทุกหน่วยบริการ</option>' + S.meta.hospitals.map(h => `<option value="${esc(h.code)}" ${h.code === sel ? 'selected' : ''}>${esc(h.name)}</option>`).join('');
/** ส่วนสถิติ ME สำหรับหน้าหลัก (d.me จาก dashboard) — การ์ดและชิปประเภทกดแล้วไปหน้า ME พร้อมตัวกรอง */
const ME_SHORT = { presc: 'Prescribing', trans: 'Transcribing', pre: 'Pre-dispensing', disp: 'Dispensing', admin: 'Administration' };
function meHomeHtml(me) {
  me = me || { total: 0, month: 0, reach: 0, harm: 0, byType: [] };
  const adm = S.user.role === 'admin';
  return `<section class="pn"><div class="ph"><h3>${ico('alert')}ความคลาดเคลื่อนทางยา (ME) <small class="mut">ปีงบประมาณนี้</small></h3>${adm ? '' : '<button class="btn sm" id="hMe" style="background:var(--warn)">+ บันทึก ME</button>'}</div>
  <div class="tiles">${tile(me.total, 'ME ทั้งหมด', me.total ? 'b' : '', 'me:all')}${tile(me.month, 'ME เดือนนี้', '', 'me:month')}${tile(me.reach, 'ถึงผู้ป่วย (C-I)', me.reach ? 'w' : '', 'me:reach')}${tile(me.harm, 'เกิดอันตราย (E-I)', me.harm ? 'd' : '', 'me:harm')}</div>
  <div class="chips">${me.byType.map(t => `<button type="button" class="chp ${t.count ? '' : 'z'}" data-g="me:t:${t.key}" title="${esc(ME_TYPE_TH[t.key] || '')}"><span>${esc(ME_SHORT[t.key] || t.name)}</span><b>${t.count}</b></button>`).join('')}</div>
  ${adm && (me.byHosp || []).length ? `<div class="pl" style="margin-top:8px"><span>หน่วยบริการที่มี ME สูงสุด</span></div>${tbl([['หน่วยบริการ'], ['ME', 'r'], ['E-I', 'r']], me.byHosp.map(x => `<tr><td>${esc(x.name)}</td><td class="r">${fmt(x.count)}</td><td class="r">${fmt(x.harm)}</td></tr>`).join(''))}` : ''}</section>`;
}

VIEWS.me = async el => {
  const adm = S.user.role === 'admin';
  if (!S.mf) S.mf = { fy: String(curFY()), month: '', hosp: '', sev: '', type: '' };
  const F = S.mf, rows = await call('meList', F); S.meRows = {}; rows.forEach(r => S.meRows[r.meId] = r);
  const okRows = rows.filter(r => r.status === 'active'), reach = okRows.filter(meReach).length, harm = okRows.filter(meHarm).length;
  el.innerHTML = `<div class="row sp"><h2>บันทึกความคลาดเคลื่อนทางยา (Medication Error)</h2>${adm ? '' : '<button class="btn" id="menew">+ บันทึก ME</button>'}</div>
  <div class="row" style="margin:8px 0"><button class="btn sec sm" id="mer1">รายงานทะเบียน ME</button><button class="btn sec sm" id="mer2">รายงานสรุป ME</button></div>
  <div class="card"><div class="fg"><div><label>ปีงบประมาณ</label><select id="mfy">${meFyOpts(F.fy)}</select></div><div><label>เดือน</label><select id="mmo">${meMoOpts(F.month)}</select></div>
  ${adm ? `<div><label>หน่วยบริการ</label><select id="mho">${meHospOpts(F.hosp)}</select></div>` : ''}<div><label>ระดับความรุนแรง</label><select id="msv">${meSevOpts(F.sev, 1)}</select></div><div><label>ประเภท</label><select id="mty">${meTypeOpts(F.type, 1)}</select></div></div></div>
  <div class="grid" style="margin-bottom:12px"><div class="stat"><b>${fmt(okRows.length)}</b><span>ME ทั้งหมด</span></div><div class="stat w"><b>${fmt(reach)}</b><span>ถึงผู้ป่วย (C-I)</span></div><div class="stat d"><b>${fmt(harm)}</b><span>เกิดอันตราย (E-I)</span></div></div>
  ${rows.length ? tbl([['เลขที่'], ['วันที่เกิดเหตุ'], adm ? ['หน่วยบริการ'] : null, ['HN'], ['ชื่อยา'], ['ประเภท / ชนิด'], ['ระดับ', 'c'], ['สถานะ']].filter(Boolean), rows.map(r => `<tr class="clk" data-me="${esc(r.meId)}"><td>${esc(r.meId)}</td><td>${thDate(r.date)}</td>${adm ? `<td>${esc(r.hospName)}</td>` : ''}<td>${esc(r.hn)}</td><td>${esc(r.drugName)}${r.drugPair ? ' <span class="mut">⇄ ' + esc(r.drugPair) + '</span>' : ''}</td><td>${esc(ME_TYPE[r.errType] || r.errType)}${r.errKind ? '<br><span class="mut">' + esc(r.errKind) + '</span>' : ''}</td><td class="c">${sevBadge(r.severity)}</td><td>${r.status === 'active' ? '<span class="badge b-active">ใช้งาน</span>' : badge('cancelled')}</td></tr>`).join('')) : empty('ไม่มีรายการ ME ในเงื่อนไขที่เลือก')}${rows.length >= 1000 ? '<div class="msg e">แสดง 1,000 รายการล่าสุด กรุณากรองให้แคบลง</div>' : ''}`;
  const bind = (id, k) => { const e = $('#' + id); if (e) e.onchange = () => { F[k] = e.value; go('me'); }; };
  bind('mfy', 'fy'); bind('mmo', 'month'); bind('mho', 'hosp'); bind('msv', 'sev'); bind('mty', 'type');
  el.querySelectorAll('[data-me]').forEach(r => r.onclick = () => openME(r.dataset.me));
  if ($('#menew')) $('#menew').onclick = () => meNew();
  $('#mer1').onclick = () => meRepModal('mereg'); $('#mer2').onclick = () => meRepModal('mesum');
};
function meNew(after) {
  const m = modal('บันทึกความคลาดเคลื่อนทางยา (ME)', `<div class="fg"><div><label>วันที่เกิดเหตุ</label><input id="md" type="date" max="${todayIso()}" value="${todayIso()}"></div><div><label>HN ผู้ป่วย</label><input id="mh" maxlength="15" autocomplete="off" inputmode="text"></div></div>
  <label>ประเภทความคลาดเคลื่อน</label><select id="mt">${meTypeOpts('')}</select>
  <label>ชนิดความคลาดเคลื่อนที่เกิดขึ้น</label><select id="mk">${meKindOpts('')}</select>
  <label>ระดับความรุนแรง (NCC MERP)</label><select id="ms">${meSevOpts('')}</select>
  <div class="fg"><div><label>ชื่อยา (ที่สั่ง/ที่ควรได้รับ)</label><input id="mdr" maxlength="120" autocomplete="off"></div><div><label>ยาคู่ที่เกิดความคลาดเคลื่อน (ถ้ามี เช่น จ่ายผิดเป็นยาอะไร)</label><input id="mdp" maxlength="120" autocomplete="off"></div></div>
  <label>รายละเอียดเหตุการณ์</label><textarea id="mdt" maxlength="500" rows="3"></textarea>
  <label>การแก้ไข/แนวทางป้องกัน</label><textarea id="mac" maxlength="300" rows="2"></textarea>
  <div class="msg" style="background:#fef3c7;color:#92400e">กรอกเฉพาะ HN ห้ามระบุชื่อ-นามสกุลผู้ป่วยในช่องข้อความ</div>
  <div class="mf"><button class="btn sec" data-close>ยกเลิก</button><button class="btn" id="msv2">บันทึก</button></div>`, { wide: true });
  $id(m, 'mt').onchange = () => { $id(m, 'mk').innerHTML = meKindOpts(val(m, 'mt')); };
  $id(m, 'msv2').onclick = b => act(b.target, async () => {
    const r = await call('meCreate', { date: val(m, 'md'), hn: val(m, 'mh'), errType: val(m, 'mt'), errKind: val(m, 'mk'), severity: val(m, 'ms'), drugName: val(m, 'mdr'), drugPair: val(m, 'mdp'), detail: val(m, 'mdt'), action: val(m, 'mac') });
    m.remove(); toast('บันทึก ME แล้ว เลขที่ ' + r.meId); if (after) after(); else go('me');
  });
}
function openME(id) {
  const r = (S.meRows || {})[id]; if (!r) return;
  const kv = (k, v) => v ? `<b>${k}</b><span>${v}</span>` : '';
  const body = `<div class="kv">${kv('เลขที่', esc(r.meId) + ' ' + (r.status === 'active' ? '' : badge('cancelled')))}${kv('หน่วยบริการ', esc(r.hospName))}${kv('วันที่เกิดเหตุ', thDate(r.date))}${kv('HN', esc(r.hn))}${kv('ประเภท', esc(r.typeName) + ' (' + esc(ME_TYPE_TH[r.errType] || '') + ')')}${kv('ชนิด', esc(r.errKind))}${kv('ระดับความรุนแรง', sevBadge(r.severity) + ' ' + esc(ME_SEV[r.severity] || ''))}${kv('ชื่อยา', esc(r.drugName))}${kv('ยาคู่', esc(r.drugPair))}${kv('รายละเอียด', esc(r.detail))}${kv('การแก้ไข/ป้องกัน', esc(r.action))}${kv('ผู้รายงาน', esc(r.reporter) + ' ' + thDT(r.createdAt))}${r.status === 'active' ? '' : kv('ยกเลิกโดย', esc(r.voidBy) + ' ' + thDT(r.voidAt)) + kv('เหตุผล', esc(r.voidReason))}</div>`;
  const m = modal('รายการ ME ' + id, body + `<div class="mf">${r.canVoid ? '<button class="btn bad" id="mvo">ยกเลิกรายการ</button>' : ''}<button class="btn sec" data-close>ปิด</button></div>`);
  if ($id(m, 'mvo')) $id(m, 'mvo').onclick = b => act(b.target, async () => {
    const why = prompt('ระบุเหตุผลการยกเลิกรายการ ME (เช่น บันทึกซ้ำ/ผิดพลาด)'); if (why == null) return;
    await call('meVoid', { meId: id, reason: why }); m.remove(); toast('ยกเลิกรายการแล้ว'); go('me');
  });
}
function meRepModal(rpt) {
  const adm = S.user.role === 'admin', reg = rpt === 'mereg', F = S.mf || {};
  const m = modal(reg ? 'ทะเบียน ME (ดาวน์โหลดได้)' : 'สรุป ME (ดาวน์โหลดได้)', `<div class="fg"><div><label>ปีงบประมาณ</label><select id="gf">${meFyOpts(F.fy === undefined ? curFY() : F.fy)}</select></div><div><label>เดือน</label><select id="gm">${meMoOpts('')}</select></div>
  ${adm ? `<div><label>หน่วยบริการ</label><select id="gh">${meHospOpts('')}</select></div>` : ''}${reg ? `<div><label>ระดับความรุนแรง</label><select id="gs">${meSevOpts('', 1)}</select></div><div><label>ประเภท</label><select id="gt">${meTypeOpts('', 1)}</select></div>` : ''}</div>
  <div class="mf"><button class="btn" id="gg">แสดงรายงาน</button></div><div id="rres"></div>`, { wide: true });
  $id(m, 'gg').onclick = b => act(b.target, async () => {
    const p = { rpt: rpt, fy: val(m, 'gf'), month: val(m, 'gm'), hosp: adm ? val(m, 'gh') : '', sev: reg ? val(m, 'gs') : '', type: reg ? val(m, 'gt') : '' };
    showReport(await call('meReport', p), p, 'mereport');
  });
}

/* ================= Boot ================= */
function withTimeout(p, ms) { return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('หมดเวลาเชื่อมต่อเซิร์ฟเวอร์')), ms))]); }
async function loadMeta() { if (S.meta && S.meta.hospitals.length) return; try { S.meta = await withTimeout(call('meta', {}, true), 20000); } catch (e) { S.meta = { hospitals: [] }; } }
window.addEventListener('error', ev => { const r = $('#root'); if (r && !r.querySelector('.lg,.top')) r.innerHTML = '<div style="padding:30px;color:#991b1b">เกิดข้อผิดพลาดในการโหลดหน้าเว็บ: ' + esc(ev.message) + '</div>'; });
function boot() {
  if (typeof Server !== 'function' || typeof landscapeNeeded !== 'function' || !window.APP_CONFIG || !sb || !CFG.SUPABASE_URL || /YOUR-/.test(CFG.SUPABASE_URL + CFG.SUPABASE_ANON_KEY)) {
    const why = typeof Server !== 'function' ? 'ไม่พบไฟล์ js/server.js บน GitHub' : typeof landscapeNeeded !== 'function' ? 'ไม่พบไฟล์ js/app2.js บน GitHub' : !window.APP_CONFIG ? 'อ่านไฟล์ config.js ไม่ได้ (ไม่พบไฟล์ หรือเครื่องหมาย \' , หายไป)' : !window.supabase ? SB_ERR : !sb ? 'ค่าใน config.js ไม่ถูกต้อง: ' + SB_ERR : 'ยังไม่ได้ใส่ค่าใน config.js';
    $('#root').innerHTML = `<div class="lg"><div class="lgc"><div class="lgh"><h2 style="color:#fff">เชื่อมต่อระบบไม่สำเร็จ</h2></div><div class="lgb"><div class="msg e">${esc(why)}</div><p>แก้ไขไฟล์ <b>config.js</b> ใส่ SUPABASE_URL (ขึ้นต้นด้วย https:// ลงท้ายด้วย .supabase.co) และ SUPABASE_ANON_KEY ของโปรเจกต์ Supabase แล้วอัปโหลดขึ้น GitHub อีกครั้ง</p></div></div></div>`;
    return;
  }
  showLogin();                       // แสดงหน้าเข้าสู่ระบบทันที ไม่รอเซิร์ฟเวอร์
  loadMeta().then(() => { if ($('#rh') && !$('#rh').options[1]) showLogin('up'); });
  if (S.token) withTimeout(call('me', {}, true), 20000).then(u => { S.user = u; startApp(); }).catch(() => { S.token = null; saveTk(); });
}
// เริ่มทำงานหลังโหลดทุกไฟล์ (รวม app2.js) แล้ว
document.addEventListener('DOMContentLoaded', boot);

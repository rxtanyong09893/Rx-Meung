/* server.js — ฟังก์ชันอ่านข้อมูล/คำนวณ/รายงาน ย้ายมาจาก Code.gs เดิม (โค้ดเดียวกัน)
 * ทำงานในเบราว์เซอร์กับข้อมูลที่เซิร์ฟเวอร์ (Supabase) ส่งมาตามสิทธิ์ของผู้ใช้ — งานบันทึกทั้งหมดทำที่เซิร์ฟเวอร์ */
'use strict';
const bkkDate = d => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const bkkDateTime = d => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(d).replace('T', ' ');

/** D = ตารางข้อมูล { Drugs:[...], Lots:[...], ... } ชื่อฟิลด์ตรงกับชีตเดิม · M = meta จากเซิร์ฟเวอร์ */
function Server(D, M) {
const APP = { TITLE: M.title, TZ: 'Asia/Bangkok', ISSUER: M.issuer, ISSUER_SUB: M.issuerSub, KEEPER: M.keeper, KEEPER_TITLE: M.keeperTitle, APPROVER: M.approver || '', APPROVER_TITLE: M.approverTitle || '', NEAR_EXP_DAYS: M.nearDays || 180 };
const HOSPITALS = M.hospitals;
const readAll_ = name => (D[name] || []).map(o => Object.assign({}, o));

function fail_(m) { const e = new Error(m); e.user = true; throw e; }
function authFail_() { const e = new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'); e.user = true; e.auth = true; throw e; }
function now_() { return bkkDateTime(new Date()); }
function today_() { return bkkDate(new Date()); }
function fyOf_(iso) { const y = +iso.slice(0, 4), m = +iso.slice(5, 7); return y + 543 + (m >= 10 ? 1 : 0); }
function pad_(n, w) { return ('0000000000' + n).slice(-w); }
function thDate_(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + (+iso.slice(0, 4) + 543) : '-'; }
function hospOf_(code) { return HOSPITALS.find(h => h.code === code) || { code: code, name: code === 'ADMIN' ? 'คลังยา (แอดมิน)' : code, full: code === 'ADMIN' ? 'คลังยา' : code }; }
function str_(v, max, req, label) {
  const s = String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
  if (req && !s) fail_('กรุณากรอก' + label);
  if (s.length > max) fail_(label + 'ยาวเกินกำหนด (ไม่เกิน ' + max + ' ตัวอักษร)');
  return s;
}
function int_(v, min, max, label) { const n = Number(v); if (v === '' || v == null || !Number.isInteger(n) || n < min || n > max) fail_(label + 'ไม่ถูกต้อง'); return n; }
function num_(v, min, max, label) { const n = Number(v); if (v === '' || v == null || !isFinite(n) || n < min || n > max) fail_(label + 'ไม่ถูกต้อง'); return Math.round(n * 100) / 100; }
function date_(v, label) {
  const s = String(v || ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) fail_(label + 'ไม่ถูกต้อง');
  const d = new Date(s + 'T00:00:00Z'); if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) fail_(label + 'ไม่ถูกต้อง'); return s;
}
function availOf_(drugId, lots, today) { return lots.filter(l => l.drugId === drugId && l.qtyRemain > 0 && l.expDate >= today).reduce((s, l) => s + l.qtyRemain, 0); }
function alloc_(drugId, qty, lots, today) { // FEFO: หมดอายุก่อนจ่ายก่อน ข้าม LOT ที่หมดอายุแล้ว
  const cand = lots.filter(l => l.drugId === drugId && l.qtyRemain > 0 && l.expDate >= today)
    .sort((a, b) => a.expDate < b.expDate ? -1 : a.expDate > b.expDate ? 1 : (a.receivedAt < b.receivedAt ? -1 : a.receivedAt > b.receivedAt ? 1 : 0));
  let need = qty; const out = [];
  for (const l of cand) { if (need <= 0) break; const t = Math.min(need, l.qtyRemain); out.push({ lot: l, qty: t }); need -= t; }
  return { alloc: out, short: need };
}
function computeStock_() {
  const lots = readAll_('Lots'), today = today_(), near = new Date(Date.now() + APP.NEAR_EXP_DAYS * 864e5);
  const nearIso = bkkDate(near);
  return readAll_('Drugs').map(d => {
    const ls = lots.filter(l => l.drugId === d.drugId && l.qtyRemain > 0);
    return { drugId: d.drugId, name: d.name, unit: d.unit, category: d.category, minStock: d.minStock, active: d.active,
      onHand: ls.reduce((s, l) => s + l.qtyRemain, 0),
      available: ls.filter(l => l.expDate >= today).reduce((s, l) => s + l.qtyRemain, 0),
      nearExp: ls.filter(l => l.expDate >= today && l.expDate <= nearIso).reduce((s, l) => s + l.qtyRemain, 0),
      expired: ls.filter(l => l.expDate < today).reduce((s, l) => s + l.qtyRemain, 0), lotCount: ls.length };
  });
}
function lotsList_(u, p) {
  const drugs = readAll_('Drugs'); const today = today_();
  return readAll_('Lots').filter(l => p.all || l.qtyRemain > 0).map(l => {
    const d = drugs.find(x => x.drugId === l.drugId) || { name: l.drugId, unit: '' };
    return { lotId: l.lotId, drugId: l.drugId, drugName: d.name, unit: d.unit, lotNo: l.lotNo, expDate: l.expDate, qtyIn: l.qtyIn, qtyRemain: l.qtyRemain, unitPrice: l.unitPrice, receivedAt: l.receivedAt, supplier: l.supplier, expired: l.expDate < today };
  }).sort((a, b) => a.drugName.localeCompare(b.drugName, 'th') || (a.expDate < b.expDate ? -1 : 1));
}
function drugList_(u) {
  const st = computeStock_();
  return st.filter(d => d.active === 'Y').map(d => ({ drugId: d.drugId, name: d.name, unit: d.unit, category: d.category, available: d.available }))
    .sort((a, b) => a.name.localeCompare(b.name, 'th'));
}
function stockCard_(u, p) {
  const d = readAll_('Drugs').find(x => x.drugId === p.drugId); if (!d) fail_('กรุณาเลือกเวชภัณฑ์');
  const from = p.from ? date_(p.from, 'วันที่เริ่มต้น') : '0000-00-00', to = p.to ? date_(p.to, 'วันที่สิ้นสุด') : '9999-12-31';
  const all = readAll_('StockCard').filter(r => r.drugId === d.drugId).sort((a, b) => a.txId < b.txId ? -1 : 1);
  const before = all.filter(r => r.date < from), rows = all.filter(r => r.date >= from && r.date <= to).slice(0, 3000);
  const opening = before.length ? before[before.length - 1].balance : 0;
  return { drug: { drugId: d.drugId, name: d.name, unit: d.unit }, from: p.from || '', to: p.to || '', opening: opening, closing: rows.length ? rows[rows.length - 1].balance : opening,
    rows: rows.map(r => ({ date: r.date, type: r.type, ref: r.ref, party: r.party, lotNo: r.lotNo, expDate: r.expDate, qtyIn: r.qtyIn, qtyOut: r.qtyOut, balance: r.balance })) };
}

function listRequests_(u, p) {
  const adm = u.role === 'admin', items = readAll_('RequestItems'); const st = String(p.status || '');
  return readAll_('Requests').filter(r => (adm ? (!p.hospCode || r.hospCode === p.hospCode) : r.hospCode === u.hospCode) && (!st || r.status === st))
    .sort((a, b) => idCmp_(b.reqId, a.reqId)).slice(0, 300)
    .map(r => ({ reqId: r.reqId, hospCode: r.hospCode, hospName: hospOf_(r.hospCode).name, createdAt: r.createdAt, createdBy: r.createdBy, status: r.status, docNo: r.docNo, note: r.note, itemCount: items.filter(i => i.reqId === r.reqId).length }));
}
function requestDetail_(u, p) {
  const r = readAll_('Requests').find(x => x.reqId === p.reqId); if (!r) fail_('ไม่พบคำขอ');
  if (u.role !== 'admin' && r.hospCode !== u.hospCode) fail_('ไม่มีสิทธิ์ดูคำขอนี้');
  const drugs = readAll_('Drugs'), lots = u.role === 'admin' ? readAll_('Lots') : [], today = today_();
  const items = readAll_('RequestItems').filter(i => i.reqId === r.reqId).map(i => {
    const d = drugs.find(x => x.drugId === i.drugId) || { name: i.drugId, unit: '' };
    return { drugId: i.drugId, name: d.name, unit: d.unit, qtyReq: i.qtyReq, qtyApproved: i.qtyApproved, available: u.role === 'admin' ? availOf_(i.drugId, lots, today) : null };
  });
  return { req: { reqId: r.reqId, hospCode: r.hospCode, hospName: hospOf_(r.hospCode).name, createdAt: r.createdAt, createdBy: r.createdBy, note: r.note, status: r.status, docNo: r.docNo, decidedAt: r.decidedAt, decidedBy: r.decidedBy, reason: r.reason }, items: items };
}
function plan_(ris, qtyMap, lots, drugs, today) {
  return ris.map(ri => {
    const d = drugs.find(x => x.drugId === ri.drugId) || { name: ri.drugId, unit: '' };
    const raw = qtyMap && Object.prototype.hasOwnProperty.call(qtyMap, ri.drugId) ? qtyMap[ri.drugId] : ri.qtyReq;
    const q = Number(raw);
    if (raw === '' || raw == null || !Number.isInteger(q) || q < 0 || q > ri.qtyReq) fail_('จำนวนอนุมัติของ "' + d.name + '" ต้องเป็นจำนวนเต็ม 0–' + ri.qtyReq);
    const a = alloc_(ri.drugId, q, lots, today);
    return { drugId: ri.drugId, name: d.name, unit: d.unit, qtyReq: ri.qtyReq, qty: q, available: availOf_(ri.drugId, lots, today), short: a.short,
      lots: a.alloc.map(x => ({ lotId: x.lot.lotId, lotNo: x.lot.lotNo, expDate: x.lot.expDate, qty: x.qty, unitPrice: x.lot.unitPrice })) };
  });
}
function previewApprove_(u, p) {
  const r = readAll_('Requests').find(x => x.reqId === p.reqId); if (!r) fail_('ไม่พบคำขอ');
  return plan_(readAll_('RequestItems').filter(i => i.reqId === r.reqId), p.qty || {}, readAll_('Lots'), readAll_('Drugs'), today_());
}
function listIssues_(u, p) {
  const adm = u.role === 'admin', fy = p.fy ? int_(p.fy, 2500, 2700, 'ปีงบประมาณ') : 0;
  return readAll_('Issues').filter(i => (adm || i.hospCode === u.hospCode) && (!fy || i.fy === fy)).sort((a, b) => b.fy - a.fy || b.seq - a.seq).slice(0, 500)
    .map(i => ({ docNo: i.docNo, fy: i.fy, issueDate: i.issueDate, hospCode: i.hospCode, hospName: hospOf_(i.hospCode).name, itemCount: i.itemCount, totalValue: i.totalValue, status: i.status }));
}
function getIssue_(u, docNo) {
  const i = readAll_('Issues').find(x => x.docNo === String(docNo)); if (!i) fail_('ไม่พบใบเบิก');
  if (u.role !== 'admin' && i.hospCode !== u.hospCode) fail_('ไม่มีสิทธิ์ดูใบเบิกนี้');
  const h = hospOf_(i.hospCode), req = readAll_('Requests').find(r => r.reqId === i.reqId), ris = readAll_('RequestItems').filter(r => r.reqId === i.reqId), seen = {};
  return { issue: { docNo: i.docNo, fy: i.fy, issueDate: i.issueDate, reqId: i.reqId, hospCode: i.hospCode, hospName: h.name, hospFull: h.full, itemCount: i.itemCount, totalValue: i.totalValue, note: i.note, approver: i.approver || APP.KEEPER, status: i.status, cancelReason: i.cancelReason, cancelBy: i.cancelBy, cancelAt: i.cancelAt,
      requester: req ? req.createdBy : '', issuer: APP.ISSUER, issuerSub: APP.ISSUER_SUB, keeper: APP.KEEPER, keeperTitle: APP.KEEPER_TITLE, approverName: APP.APPROVER, approverTitle: APP.APPROVER_TITLE },
    items: readAll_('IssueItems').filter(x => x.docNo === i.docNo).map(x => {
      const first = !seen[x.drugId]; seen[x.drugId] = 1; const ri = ris.find(r => r.drugId === x.drugId);
      return { drugId: x.drugId, drugName: x.drugName, unit: x.unit, lotNo: x.lotNo, expDate: x.expDate, qty: x.qty, unitPrice: x.unitPrice, value: x.value, qtyReq: first && ri ? ri.qtyReq : null };
    }) };
}

function usersList_() {
  return readAll_('Users').map(x => ({ username: x.username, name: x.name, role: x.role, hospCode: x.hospCode, hospName: hospOf_(x.hospCode).name, status: x.status, createdAt: x.createdAt, lastLogin: x.lastLogin }))
    .sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) || a.username.localeCompare(b.username));
}
function logsList_() { return readAll_('Logs').slice(-300).reverse().map(l => ({ time: l.time, user: l.user, action: l.action, detail: l.detail })); }
function dashboard_(u) {
  const fy = fyOf_(today_());
  if (u.role !== 'admin') {
    const rq = readAll_('Requests').filter(r => r.hospCode === u.hospCode), c = {};
    rq.forEach(r => c[r.status] = (c[r.status] || 0) + 1);
    const lr = loanRows_(u), myIs = readAll_('Issues').filter(i => i.hospCode === u.hospCode && i.fy === fy && i.status !== 'cancelled');
    const act = r => r.status === 'active' && r.outstanding > 0;
    return { role: 'user', counts: c, recent: listRequests_(u, {}).slice(0, 5), fy: fy,
      issueCount: myIs.length, issueValue: sum_(myIs, i => i.totalValue), me: meStat_(u, fy),
      loans: Object.assign({ todo: lr.filter(r => r.todo).length, overdue: lr.filter(r => r.overdue && r.role === 'borrower').length,
        borrowedCount: lr.filter(r => r.role === 'borrower' && act(r)).length, lentCount: lr.filter(r => r.role === 'lender' && act(r)).length, waiting: lr.filter(r => r.role === 'borrower' && r.status === 'requested').length, recent: lr.slice(0, 5) }, loanLists_(u)) };
  }
  const st = computeStock_().filter(d => d.active === 'Y'), rq = readAll_('Requests'), is = readAll_('Issues').filter(i => i.fy === fy && i.status !== 'cancelled'), lr = loanRows_(u);
  return { role: 'admin', fy: fy,
    pending: rq.filter(r => r.status === 'pending').length, processing: rq.filter(r => r.status === 'processing').length,
    low: st.filter(d => d.minStock > 0 && d.available <= d.minStock).map(d => ({ name: d.name, unit: d.unit, available: d.available, minStock: d.minStock })).slice(0, 15),
    near: st.filter(d => d.nearExp > 0).map(d => ({ name: d.name, unit: d.unit, qty: d.nearExp })).slice(0, 15),
    expired: st.filter(d => d.expired > 0).map(d => ({ name: d.name, unit: d.unit, qty: d.expired })).slice(0, 15),
    loanOpen: lr.filter(r => r.open).length, loanOverdue: lr.filter(r => r.overdue).length, loanLate: lr.filter(r => r.overdue).slice(0, 8),
    topHosp: HOSPITALS.map(h => { const x = is.filter(i => i.hospCode === h.code); return { name: h.name, count: x.length, value: sum_(x, i => i.totalValue) }; }).filter(x => x.count > 0).sort((a, b) => b.value - a.value).slice(0, 5),
    issueCount: is.length, issueValue: Math.round(is.reduce((s, i) => s + i.totalValue, 0) * 100) / 100,
    me: meStat_(u, fy), recent: listRequests_(u, { status: 'pending' }).slice(0, 6) };
}

function fmtN_(n) { return Number(n || 0).toLocaleString('en-US'); }
function fmtM_(n) { return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
const MONTHS = ['ต.ค.', 'พ.ย.', 'ธ.ค.', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.'];
const MONTH_NO = [10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8, 9];
function r2_(n) { return Math.round(n * 100) / 100; }
function monthOf_(iso) { return +iso.slice(5, 7); }
function repFilter_(p) { return { fy: p.fy ? int_(p.fy, 2500, 2700, 'ปีงบประมาณ') : 0, mo: p.month ? int_(p.month, 1, 12, 'เดือน') : 0 }; }
function subLine_(f) { return 'ปีงบประมาณ ' + (f.fy || 'ทั้งหมด') + (f.mo ? '   เดือน ' + MONTHS[MONTH_NO.indexOf(f.mo)] : '') + '   (ออกรายงานวันที่ ' + thDate_(today_()) + ')'; }
function pct_(v, t) { return t > 0 ? (Math.round(v / t * 1000) / 10).toFixed(1) + '%' : '-'; }
function groupBy_(rows, keyFn) { const m = {}; rows.forEach(r => { const k = keyFn(r); (m[k] = m[k] || []).push(r); }); return m; }
function sum_(rows, fn) { return r2_(rows.reduce((s, r) => s + fn(r), 0)); }
function rcvRows_(f, p) {
  const drugs = readAll_('Drugs'), sup = p.supplier ? str_(p.supplier, 80, false, 'ผู้ขาย').toLowerCase() : '';
  return readAll_('Receipts').filter(r => (!f.fy || r.fy === f.fy) && (!f.mo || monthOf_(r.date) === f.mo) && (!p.drugId || r.drugId === String(p.drugId)) && (!sup || (r.supplier + ' ' + (r.invoiceNo || '')).toLowerCase().indexOf(sup) >= 0))
    .sort((a, b) => a.date < b.date ? 1 : a.date > b.date ? -1 : (a.rcvId < b.rcvId ? 1 : -1))
    .map(r => { const d = drugs.find(x => x.drugId === r.drugId) || { name: r.drugId, unit: '' }; return Object.assign({}, r, { drugName: d.name, unit: d.unit }); });
}
function report_(p) {
  const f = repFilter_(p);
  if (p.rpt === 'rcvreg') return repRcvReg_(f, p);
  if (p.rpt === 'rcvsum') return repRcvSum_(f, p);
  if (p.rpt === 'rcvdoc') return repRcvDoc_(f, p);
  if (p.rpt === 'isssum') return repIssSum_(f);
  if (p.rpt === 'loansum') return repLoanSum_(f);
  fail_('ไม่พบรายงานที่เลือก');
}
function repRcvReg_(f, p) {
  const rows = rcvRows_(f, p), total = sum_(rows, r => r.value), shown = rows.slice(0, 2000);
  return { rpt: 'rcvreg', title: 'ทะเบียนการรับยาเข้าคลัง', sub: [subLine_(f)], stats: [['จำนวนรายการรับ', fmtN_(rows.length)], ['รวมมูลค่า (บาท)', fmtM_(total)]],
    tables: [{ title: '', head: ['ใบรับที่', 'วันที่รับ', 'เวชภัณฑ์', 'หน่วย', 'LOT', 'หมดอายุ', 'จำนวน', 'ราคา/หน่วย', 'มูลค่า', 'ผู้ขาย', 'เลขที่ใบส่งของ'], aligns: ['c', 'c', 'l', 'c', 'c', 'c', 'r', 'r', 'r', 'l', 'l'], widths: [34, 44, 92, 30, 40, 44, 38, 40, 46, 70, 52],
      rows: shown.map(r => [rcvNo_(r), thDate_(r.date), r.drugName, r.unit, r.lotNo, thDate_(r.expDate), fmtN_(r.qty), fmtM_(r.unitPrice), fmtM_(r.value), r.supplier, r.invoiceNo || '-']) }],
    note: rows.length > shown.length ? 'แสดง 2,000 รายการแรกจากทั้งหมด ' + rows.length + ' รายการ กรุณากรองช่วงให้แคบลง' : '' };
}
const rcvNo_ = r => r.rcvSeq ? String(r.rcvSeq).padStart(3, '0') + '/' + r.fy : '-';
/** เรียงเลขที่เอกสาร (RQ999 ก่อน RQ1000) */
const idCmp_ = (a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0);
/** รายงานการรับยาเข้าตามลำดับใบรับยา: แต่ละใบแสดงวันที่ ผู้ขาย เลขที่ใบส่งของ ผู้รับ และรายการยาครบทุกรายการ เรียงเลขที่ 1, 2, 3, … */
function repRcvDoc_(f, p) {
  const no = p.rcvNo ? int_(p.rcvNo, 1, 1e7, 'เลขที่ใบรับ') : 0;
  const rows = rcvRows_(f, p).filter(r => !no || r.rcvSeq === no), g = groupBy_(rows, r => r.fy + '|' + pad_(r.rcvSeq || 0, 7) + '|' + (r.rcvSeq ? '' : r.date + r.supplier));
  const keys = Object.keys(g).sort(), total = sum_(rows, r => r.value);
  const tables = keys.slice(0, 300).map(k => {
    const it = g[k].sort((a, b) => a.rcvId < b.rcvId ? -1 : 1), h = it[0], v = sum_(it, r => r.value);
    return { title: (h.rcvSeq ? 'ใบรับยาเลขที่ ' + rcvNo_(h) : 'ใบรับยา (บันทึกก่อนมีเลขที่ใบรับ)') + '   วันที่รับ ' + thDate_(h.date) + '   ผู้ขาย ' + (h.supplier || '-') + '   เลขที่ใบส่งของ ' + (h.invoiceNo || '-') + '   ผู้รับ ' + (h.by || '-'),
      head: ['ลำดับ', 'เวชภัณฑ์', 'หน่วย', 'เลข LOT', 'วันหมดอายุ', 'จำนวน', 'ราคา/หน่วย', 'มูลค่า (บาท)'], aligns: ['c', 'l', 'c', 'c', 'c', 'r', 'r', 'r'], widths: [34, 150, 44, 60, 60, 50, 50, 51],
      rows: it.map((r, n) => [String(n + 1), r.drugName, r.unit, r.lotNo, thDate_(r.expDate), fmtN_(r.qty), fmtM_(r.unitPrice), fmtM_(r.value)]).concat([['', 'รวม ' + it.length + ' รายการ', '', '', '', '', '', fmtM_(v)]]) };
  });
  const one = no && keys.length === 1;
  return { rpt: 'rcvdoc', title: one ? 'ใบรับยาเข้าคลัง ' + APP.ISSUER : 'รายงานการรับยาเข้าคลัง ตามลำดับใบรับยา', sub: one ? [APP.ISSUER_SUB] : [subLine_(f) + (no ? '   เลขที่ใบรับ ' + no : '')],
    stats: one ? [] : [['จำนวนใบรับ', fmtN_(keys.length)], ['จำนวนรายการ', fmtN_(rows.length)], ['รวมมูลค่า (บาท)', fmtM_(total)]], tables: tables,
    sigs: one ? [['ผู้รับยา', g[keys[0]][0].by], ['ผู้ตรวจรับ', '']] : null,
    note: keys.length > 300 ? 'แสดง 300 ใบแรกจาก ' + keys.length + ' ใบ กรุณากรองช่วงให้แคบลง' : '' };
}
function repRcvSum_(f, p) {
  const rows = rcvRows_(f, p), total = sum_(rows, r => r.value), tables = [];
  if (!f.fy) {
    const g = groupBy_(rows, r => r.fy);
    tables.push({ title: 'สรุปรายปีงบประมาณ', head: ['ปีงบประมาณ', 'ครั้งที่รับ', 'มูลค่า (บาท)'], aligns: ['c', 'r', 'r'], widths: [150, 150, 199],
      rows: Object.keys(g).sort().reverse().map(k => [k, fmtN_(g[k].length), fmtM_(sum_(g[k], r => r.value))]) });
  }
  tables.push({ title: 'สรุปรายเดือน', head: ['เดือน', 'ครั้งที่รับ', 'มูลค่า (บาท)', '% ของยอดรวม'], aligns: ['l', 'r', 'r', 'r'], widths: [130, 110, 140, 119],
    rows: MONTH_NO.map((m, i) => { const x = rows.filter(r => monthOf_(r.date) === m); return [MONTHS[i], fmtN_(x.length), fmtM_(sum_(x, r => r.value)), pct_(sum_(x, r => r.value), total)]; }).concat([['รวม', fmtN_(rows.length), fmtM_(total), total > 0 ? '100.0%' : '-']]) });
  const gd = groupBy_(rows, r => r.drugId);
  tables.push({ title: 'สรุปตามเวชภัณฑ์ (เรียงตามมูลค่า)', head: ['เวชภัณฑ์', 'หน่วย', 'จำนวนรับ', 'มูลค่า (บาท)', '%'], aligns: ['l', 'c', 'r', 'r', 'r'], widths: [185, 50, 80, 110, 74],
    rows: Object.keys(gd).map(k => ({ n: gd[k][0].drugName, u: gd[k][0].unit, q: gd[k].reduce((s, r) => s + r.qty, 0), v: sum_(gd[k], r => r.value) })).sort((a, b) => b.v - a.v).slice(0, 300).map(x => [x.n, x.u, fmtN_(x.q), fmtM_(x.v), pct_(x.v, total)]) });
  const gs = groupBy_(rows, r => r.supplier || '(ไม่ระบุ)');
  tables.push({ title: 'สรุปตามผู้ขาย', head: ['ผู้ขาย', 'รายการที่รับ', 'มูลค่า (บาท)', '%'], aligns: ['l', 'r', 'r', 'r'], widths: [235, 70, 120, 74],
    rows: Object.keys(gs).map(k => ({ n: k, c: gs[k].length, v: sum_(gs[k], r => r.value) })).sort((a, b) => b.v - a.v).slice(0, 300).map(x => [x.n, fmtN_(x.c), fmtM_(x.v), pct_(x.v, total)]) });
  return { rpt: 'rcvsum', title: 'สรุปมูลค่าการรับยาเข้าคลัง', sub: [subLine_(f)], stats: [['จำนวนครั้งที่รับ', fmtN_(rows.length)], ['รวมมูลค่า (บาท)', fmtM_(total)]], tables: tables, note: '' };
}
function repIssSum_(f) {
  const is = readAll_('Issues').filter(i => i.status !== 'cancelled' && (!f.fy || i.fy === f.fy) && (!f.mo || monthOf_(i.issueDate) === f.mo)), total = sum_(is, i => i.totalValue), docs = {};
  is.forEach(i => docs[i.docNo] = 1);
  const items = readAll_('IssueItems').filter(x => docs[x.docNo]);
  const perH = HOSPITALS.map(h => { const x = is.filter(i => i.hospCode === h.code); return { h: h, n: x.length, it: x.reduce((s, i) => s + i.itemCount, 0), v: sum_(x, i => i.totalValue), list: x }; });
  const t1 = { title: 'สรุปมูลค่าการเบิกแต่ละหน่วยบริการ', head: ['หน่วยบริการ', 'จำนวนใบเบิก', 'จำนวนรายการ', 'มูลค่า (บาท)', '%'], aligns: ['l', 'r', 'r', 'r', 'r'], widths: [180, 70, 75, 100, 74],
    rows: perH.map(x => [x.h.name, fmtN_(x.n), fmtN_(x.it), fmtM_(x.v), pct_(x.v, total)]).concat([['รวมทุกหน่วย', fmtN_(is.length), fmtN_(is.reduce((s, i) => s + i.itemCount, 0)), fmtM_(total), total > 0 ? '100.0%' : '-']]) };
  const t2 = { title: 'มูลค่าการเบิกรายเดือน แยกตามหน่วยบริการ (บาท)', ui: true, head: ['หน่วยบริการ'].concat(MONTHS, ['รวม']), aligns: ['l'].concat(MONTHS.map(() => 'r'), ['r']),
    rows: perH.map(x => [x.h.name].concat(MONTH_NO.map(m => { const v = sum_(x.list.filter(i => monthOf_(i.issueDate) === m), i => i.totalValue); return v ? fmtM_(v) : '-'; }), [fmtM_(x.v)])) };
  const gd = groupBy_(items, x => x.drugId);
  const t3 = { title: 'เวชภัณฑ์ที่เบิกมูลค่าสูงสุด 10 อันดับ', head: ['เวชภัณฑ์', 'หน่วย', 'จำนวนที่เบิก', 'มูลค่า (บาท)'], aligns: ['l', 'c', 'r', 'r'], widths: [215, 55, 100, 129],
    rows: Object.keys(gd).map(k => ({ n: gd[k][0].drugName, u: gd[k][0].unit, q: gd[k].reduce((s, x) => s + x.qty, 0), v: sum_(gd[k], x => x.value) })).sort((a, b) => b.v - a.v).slice(0, 10).map(x => [x.n, x.u, fmtN_(x.q), fmtM_(x.v)]) };
  return { rpt: 'isssum', title: 'สรุปมูลค่าการเบิกยาของแต่ละหน่วยบริการ', sub: [subLine_(f)], stats: [['จำนวนใบเบิก', fmtN_(is.length)], ['รวมมูลค่าเบิก (บาท)', fmtM_(total)]], tables: [t1, t2, t3], note: '' };
}
function addDays_(n) { return bkkDate(new Date(Date.now() + n * 864e5)); }
function readLoans_() { return readAll_('Loans').map(l => { if (l.status === 'approved') l.status = 'active'; return l; }); } // รองรับข้อมูลทดสอบจากขั้นตอนเดิม
function loanRole_(u, l) { if (u.role === 'admin') return 'admin'; if (u.hospCode === l.lender) return 'lender'; if (u.hospCode === l.borrower) return 'borrower'; return null; }
function loanGet_(u, id) {
  const l = readLoans_().find(x => x.loanId === String(id)); if (!l) fail_('ไม่พบรายการยืม');
  const role = loanRole_(u, l); if (!role) fail_('ไม่มีสิทธิ์ดูรายการนี้'); return { l: l, role: role };
}
/** วันที่คืน: ทั้งใบ (loanId) หรือเฉพาะรายการ (loanId + lineNo) — คืนหลายครั้งแสดงทุกวันที่ */
function retDates_(loanId, lineNo) {
  const rs = readAll_('LoanReturns').filter(r => r.loanId === loanId), rl = lineNo == null ? null : readAll_('LoanReturnLines');
  const ds = rs.filter(r => !rl || rl.some(x => x.retId === r.retId && x.lineNo === lineNo)).map(r => String(r.createdAt).slice(0, 10)).sort();
  return ds.filter((d, i) => ds.indexOf(d) === i);
}
const retText_ = ds => ds.length ? ds.map(thDate_).join(', ') : '-';
function lineMap_(arr) { const m = {}; (Array.isArray(arr) ? arr : []).forEach(x => { if (x) m[String(x.lineNo)] = x; }); return m; }
function loanRows_(u) {
  const loans = readLoans_(), lines = readAll_('LoanLines'), today = today_();
  return loans.filter(l => u.role === 'admin' || l.lender === u.hospCode || l.borrower === u.hospCode).sort((a, b) => idCmp_(b.loanId, a.loanId)).slice(0, 500).map(l => {
    const its = lines.filter(i => i.loanId === l.loanId), out = its.reduce((s, i) => s + Math.max(0, i.qtyLent - i.qtyReturned), 0), role = loanRole_(u, l);
    return { loanId: l.loanId, createdAt: l.createdAt, lender: l.lender, borrower: l.borrower, lenderName: hospOf_(l.lender).name, borrowerName: hospOf_(l.borrower).name, dueDate: l.dueDate, status: l.status, itemCount: its.length, outstanding: out, role: role, origin: l.origin || 'borrower',
      returnDates: retDates_(l.loanId), overdue: l.status === 'active' && out > 0, open: l.status === 'requested' || l.status === 'active', todo: role === 'lender' && l.status === 'requested' };
  });
}
function loanLists_(u) { // สำหรับ dashboard: ยาที่ยังค้างคืน แยกเป็น "ที่เรายืม" และ "ที่เราให้ยืม"
  const today = today_(), lines = readAll_('LoanLines'), borrowed = [], lent = [];
  readLoans_().filter(l => l.status === 'active' && (l.borrower === u.hospCode || l.lender === u.hospCode)).forEach(l => lines.filter(i => i.loanId === l.loanId && i.qtyLent > i.qtyReturned).forEach(i => {
    const mine = l.borrower === u.hospCode;
    (mine ? borrowed : lent).push({ loanId: l.loanId, name: i.name, unit: i.unit, qty: i.qtyLent - i.qtyReturned, other: hospOf_(mine ? l.lender : l.borrower).name, date: String(l.decidedAt || l.createdAt).slice(0, 10) });
  }));
  const by = (a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
  return { borrowed: borrowed.sort(by).slice(0, 30), lent: lent.sort(by).slice(0, 30) };
}
function loanDetail_(u, p) {
  const g = loanGet_(u, p.loanId), l = g.l;
  const items = readAll_('LoanLines').filter(i => i.loanId === l.loanId).sort((a, b) => a.lineNo - b.lineNo).map(i => ({ lineNo: i.lineNo, name: i.name, unit: i.unit, qtyReq: i.qtyReq, qtyLent: i.qtyLent, qtyReturned: i.qtyReturned, outstanding: Math.max(0, i.qtyLent - i.qtyReturned) }));
  const rl = readAll_('LoanReturnLines');
  const returns = readAll_('LoanReturns').filter(r => r.loanId === l.loanId).sort((a, b) => idCmp_(a.retId, b.retId)).map(r => ({ retId: r.retId, createdAt: r.createdAt, createdBy: r.createdBy, note: r.note, items: rl.filter(x => x.retId === r.retId).map(x => ({ name: x.name, unit: x.unit, qty: x.qty })) }));
  const out = items.reduce((s, i) => s + i.outstanding, 0);
  return { loan: { loanId: l.loanId, createdAt: l.createdAt, lender: l.lender, borrower: l.borrower, lenderName: hospOf_(l.lender).name, borrowerName: hospOf_(l.borrower).name, dueDate: l.dueDate, status: l.status, note: l.note, createdBy: l.createdBy, decidedAt: l.decidedAt, decidedBy: l.decidedBy, reason: l.reason, closedAt: l.closedAt, role: g.role, origin: l.origin || 'borrower', overdue: false }, items: items, returns: returns };
}
const LOAN_ST = { requested: 'รอผู้ให้ยืมพิจารณา', approved: 'ยืมอยู่ (ยังคืนไม่ครบ)', active: 'ยืมอยู่ (ยังคืนไม่ครบ)', returned: 'คืนครบแล้ว', closed: 'ปิดรายการ', rejected: 'ไม่อนุมัติ', cancelled: 'ยกเลิก' };
function loanReport_(u, loanId) { // ใบยืม-คืนรายใบ (พิมพ์/PDF/Word)
  const d = loanDetail_(u, { loanId: loanId }), l = d.loan;
  return { rpt: 'loan-' + l.loanId, title: 'ใบยืม-คืนยาระหว่างหน่วยบริการ',
    sub: ['เลขที่ ' + l.loanId + (l.origin === 'lender' ? '     วันที่ให้ยืม ' + thDate_(l.createdAt.slice(0, 10)) + '     (บันทึกโดยผู้ให้ยืม)' : '     วันที่ขอยืม ' + thDate_(l.createdAt.slice(0, 10)) + (l.decidedAt ? '     วันที่ให้ยืม ' + thDate_(l.decidedAt.slice(0, 10)) : '')), 'ผู้ให้ยืม: ' + l.lenderName + '     ผู้ยืม: ' + l.borrowerName, 'สถานะ: ' + (LOAN_ST[l.status] || l.status) + (l.note ? '     หมายเหตุ: ' + l.note : '')],
    stats: [['จำนวนรายการยา', fmtN_(d.items.length)], ['ค้างคืนรวม', fmtN_(d.items.reduce((s, i) => s + i.outstanding, 0))]],
    tables: [{ title: 'รายการยืม', head: ['ลำดับ', 'รายการยา', 'หน่วย', 'ขอยืม', 'ให้ยืม', 'คืนแล้ว', 'ค้างคืน'], aligns: ['c', 'l', 'c', 'r', 'r', 'r', 'r'], widths: [34, 190, 50, 55, 55, 55, 60],
      rows: d.items.map((i, n) => [String(n + 1), i.name, i.unit, fmtN_(i.qtyReq), fmtN_(i.qtyLent), fmtN_(i.qtyReturned), fmtN_(i.outstanding)]) },
      { title: 'ประวัติการคืน', head: ['วันที่คืน', 'รายการยา', 'จำนวน', 'หน่วย'], aligns: ['c', 'l', 'r', 'c'], widths: [70, 270, 80, 79],
        rows: [].concat.apply([], d.returns.map(r => r.items.map(x => [thDate_(r.createdAt.slice(0, 10)), x.name, fmtN_(x.qty), x.unit]))) }],
    sigs: [['ผู้ให้ยืม', l.decidedBy], ['ผู้ยืม', l.origin === 'lender' ? '' : l.createdBy]], note: '' };
}
function repLoanSum_(f) {
  const today = today_(), all = readLoans_(), lines = readAll_('LoanLines');
  const ls = all.filter(l => { const d = l.createdAt.slice(0, 10); return (!f.fy || fyOf_(d) === f.fy) && (!f.mo || monthOf_(d) === f.mo); });
  const lent = ['active', 'returned', 'closed'], outOf = l => lines.filter(i => i.loanId === l.loanId).reduce((s, i) => s + Math.max(0, i.qtyLent - i.qtyReturned), 0);
  const act = all.filter(l => l.status === 'active' && outOf(l) > 0);
  const t1 = { title: 'สรุปการยืม-คืนยาแต่ละหน่วยบริการ', head: ['หน่วยบริการ', 'ให้ยืม (ครั้ง)', 'ขอยืม (ครั้ง)', 'ให้ยืมค้างคืน', 'ยืมค้างคืน'], aligns: ['l', 'r', 'r', 'r', 'r'], widths: [175, 80, 80, 85, 79],
    rows: HOSPITALS.map(h => [h.name, fmtN_(ls.filter(l => l.lender === h.code && lent.indexOf(l.status) >= 0).length), fmtN_(ls.filter(l => l.borrower === h.code).length), fmtN_(act.filter(l => l.lender === h.code).length), fmtN_(act.filter(l => l.borrower === h.code).length)]) };
  const rows = []; act.forEach(l => lines.filter(i => i.loanId === l.loanId && i.qtyLent > i.qtyReturned).forEach(i => rows.push([l.loanId, hospOf_(l.lender).name, hospOf_(l.borrower).name, i.name, fmtN_(i.qtyLent - i.qtyReturned) + ' ' + i.unit, thDate_(String(l.decidedAt || l.createdAt).slice(0, 10)), retText_(retDates_(l.loanId, i.lineNo))])));
  const t2 = { title: 'รายการค้างคืนทั้งหมด (ณ วันที่ออกรายงาน)', head: ['เลขที่', 'ผู้ให้ยืม', 'ผู้ยืม', 'รายการยา', 'ค้างคืน', 'วันที่ให้ยืม', 'คืนบางส่วนเมื่อ'], aligns: ['c', 'l', 'l', 'l', 'r', 'c', 'c'], widths: [56, 70, 70, 120, 50, 60, 73], rows: rows.slice(0, 300) };
  return { rpt: 'loansum', title: 'สรุปการยืม-คืนยาระหว่างหน่วยบริการ', sub: [subLine_(f)], stats: [['ใบยืมในช่วงที่เลือก', fmtN_(ls.length)], ['รายการยาค้างคืน', fmtN_(rows.length)]], tables: [t1, t2], note: rows.length > 300 ? 'แสดง 300 รายการแรกจาก ' + rows.length : '' };
}
/** ทะเบียนยืม-คืนยา แยก 2 ทะเบียน: type='out' ทะเบียนที่ให้ยืมแก่หน่วยอื่น | type='in' ทะเบียนที่ยืมจากหน่วยอื่น
 *  หน่วยบริการเห็นเฉพาะของตนเอง แอดมินเห็นทุกหน่วยหรือเลือกกรองตามหน่วยได้ */
function loanRegReport_(u, p) {
  const f = repFilter_(p), today = today_(), adm = u.role === 'admin', type = p.type === 'in' ? 'in' : 'out', hosp = adm ? (p.hosp ? String(p.hosp) : '') : u.hospCode, st = String(p.status || '');
  if (adm && hosp && !HOSPITALS.some(h => h.code === hosp)) fail_('หน่วยบริการไม่ถูกต้อง');
  const lines = readAll_('LoanLines'), both = adm && !hosp;
  const ls = readLoans_().filter(l => { const d = l.createdAt.slice(0, 10); return (!hosp || (type === 'out' ? l.lender === hosp : l.borrower === hosp)) && (!f.fy || fyOf_(d) === f.fy) && (!f.mo || monthOf_(d) === f.mo) && (st !== 'open' || l.status === 'requested' || l.status === 'active'); }).sort((a, b) => a.loanId < b.loanId ? -1 : 1);
  const rows = []; let out = 0;
  ls.forEach(l => lines.filter(i => i.loanId === l.loanId).sort((a, b) => a.lineNo - b.lineNo).forEach(i => {
    const o = l.status === 'active' ? Math.max(0, i.qtyLent - i.qtyReturned) : 0; out += o;
    const party = both ? [hospOf_(l.lender).name, hospOf_(l.borrower).name] : [hospOf_(type === 'out' ? l.borrower : l.lender).name];
    rows.push([l.loanId, thDate_(l.createdAt.slice(0, 10))].concat(party, [i.name, i.unit, fmtN_(i.qtyLent), fmtN_(i.qtyReturned), l.status === 'active' ? fmtN_(o) : '-', retText_(retDates_(l.loanId, i.lineNo)), (LOAN_ST[l.status] || l.status) + (l.origin === 'lender' ? ' (บันทึกโดยผู้ให้ยืม)' : '')]));
  }));
  const hn = hosp ? hospOf_(hosp).name : 'ทุกหน่วยบริการ', title = type === 'out' ? 'ทะเบียนยาที่ให้ยืมแก่หน่วยบริการอื่น' : 'ทะเบียนยาที่ยืมจากหน่วยบริการอื่น';
  const head = ['เลขที่', 'วันที่ยืม'].concat(both ? ['ผู้ให้ยืม', 'ผู้ยืม'] : [type === 'out' ? 'ผู้ยืม' : 'ผู้ให้ยืม'], ['รายการยา', 'หน่วย', type === 'out' ? 'ให้ยืม' : 'ยืม', 'คืนแล้ว', 'ค้างคืน', 'วันที่คืน', 'สถานะ']);
  return { rpt: 'loanreg-' + type, title: title, sub: [subLine_(f), 'หน่วยบริการ: ' + hn + (st === 'open' ? '   (เฉพาะรายการที่ยังไม่เสร็จสิ้น)' : '')],
    stats: [['จำนวนใบยืม', fmtN_(ls.length)], ['ยาค้างคืน (หน่วยนับรวม)', fmtN_(out)]],
    tables: [{ title: '', head: head, aligns: ['c', 'c'].concat(both ? ['l', 'l'] : ['l'], ['l', 'c', 'r', 'r', 'r', 'c', 'l']), widths: both ? [42, 44, 50, 50, 84, 28, 32, 32, 32, 44, 61] : [44, 46, 62, 108, 30, 34, 34, 34, 46, 61], rows: rows.slice(0, 3000) }],
    note: rows.length > 3000 ? 'แสดง 3,000 รายการแรกจาก ' + rows.length + ' กรุณากรองให้แคบลง' : '' };
}

/* ============================ บันทึกความคลาดเคลื่อนทางยา (Medication Error: ME) ============================ */
const ME_VOID_DAYS = 7;
const ME_TYPES = { presc: 'Prescribing error', trans: 'Transcribing error', pre: 'Pre-dispensing error', disp: 'Dispensing error', admin: 'Administration error' };
const ME_ABBR = { presc: 'Presc.', trans: 'Trans.', pre: 'Pre-disp.', disp: 'Disp.', admin: 'Admin.' };
/** ชนิดความคลาดเคลื่อน (dropdown) แยกตามประเภท — ค่าที่บันทึกคือข้อความนี้ ต้องตรงกับ ME_KIND ใน JS.html */
const ME_KINDS = {
  presc: ['สั่งยาผิดชนิด/ผิดตัวยา', 'สั่งขนาดยา (dose) ผิด', 'สั่งความถี่/ระยะเวลาการใช้ยาผิด', 'สั่งยาผิดรูปแบบ/ความแรง', 'สั่งยาซ้ำซ้อน', 'สั่งยาที่ผู้ป่วยมีประวัติแพ้', 'สั่งยาที่มีปฏิกิริยาต่อกัน/ข้อห้ามใช้', 'สั่งยาผิดคน', 'คำสั่งใช้ยาไม่ชัดเจน/อ่านไม่ออก', 'อื่นๆ (ระบุในรายละเอียด)'],
  trans: ['คัดลอก/คีย์ชื่อยาผิด', 'คัดลอก/คีย์ขนาดยาหรือความแรงผิด', 'คัดลอก/คีย์วิธีใช้หรือความถี่ผิด', 'คัดลอก/คีย์จำนวนยาผิด', 'คัดลอก/คีย์ข้อมูลผู้ป่วยผิดคน', 'คัดลอกรายการยาไม่ครบ/ตกหล่น', 'อื่นๆ (ระบุในรายละเอียด)'],
  pre: ['จัดยาผิดชนิด', 'จัดยาผิดความแรง/รูปแบบ', 'จัดยาผิดจำนวน', 'จัดยาไม่ครบ/ตกหล่น', 'หยิบยาสลับกันเพราะชื่อหรือหน้าตาคล้าย (LASA)', 'จัดยาหมดอายุ/เสื่อมสภาพ', 'ติดฉลากยาผิด/วิธีใช้บนฉลากผิด', 'ติดฉลากสลับผู้ป่วย', 'ไม่ได้ตรวจสอบซ้ำก่อนจ่าย', 'อื่นๆ (ระบุในรายละเอียด)'],
  disp: ['จ่ายยาผิดคน', 'จ่ายยาผิดชนิด', 'จ่ายยาผิดความแรง/รูปแบบ', 'จ่ายยาผิดจำนวน', 'จ่ายยาไม่ครบ/ตกหล่น', 'จ่ายยาซ้ำ', 'จ่ายยาที่ผู้ป่วยแพ้ (ไม่ได้ซักประวัติ)', 'ให้คำแนะนำการใช้ยาผิดหรือไม่ได้ให้คำแนะนำ', 'จ่ายยาหมดอายุ/เสื่อมสภาพ', 'อื่นๆ (ระบุในรายละเอียด)'],
  admin: ['ให้ยาผิดคน', 'ให้ยาผิดชนิด', 'ให้ยาผิดขนาด', 'ให้ยาผิดเวลา/ลืมให้ยา', 'ให้ยาผิดวิธี/ผิดทางที่ให้ยา (route)', 'ให้ยาผิดเทคนิค (เช่น ฉีด/พ่น/หยอดยาไม่ถูกวิธี)', 'ให้ยานานเกินหรือหยุดก่อนกำหนด', 'ให้ยาหมดอายุ/เสื่อมสภาพ', 'อื่นๆ (ระบุในรายละเอียด)']
};
const ME_SEV = {
  A: 'มีเหตุการณ์ที่อาจก่อให้เกิดความคลาดเคลื่อน', B: 'เกิดความคลาดเคลื่อน แต่ยังไม่ถึงผู้ป่วย', C: 'ถึงผู้ป่วย แต่ไม่เกิดอันตราย',
  D: 'ถึงผู้ป่วย ต้องเฝ้าระวังเพื่อให้มั่นใจว่าไม่เกิดอันตราย', E: 'เกิดอันตรายชั่วคราว ต้องได้รับการรักษา/แก้ไข', F: 'เกิดอันตรายชั่วคราว ต้องนอน รพ. หรือนอนนานขึ้น',
  G: 'เกิดอันตรายถาวร', H: 'เกิดอันตรายถึงขั้นต้องช่วยชีวิต', I: 'เสียชีวิต'
};
const meReach_ = r => 'CDEFGHI'.indexOf(r.severity) >= 0; // ถึงผู้ป่วย
const meHarm_ = r => 'EFGHI'.indexOf(r.severity) >= 0;  // เกิดอันตราย
function meCanVoid_(u, r) {
  if (u.role === 'admin') return true;
  if (r.hospCode !== u.hospCode) return false;
  const t = new Date(String(r.createdAt).replace(' ', 'T') + '+07:00').getTime();
  return isFinite(t) && Date.now() - t <= ME_VOID_DAYS * 864e5;
}
function meView_(u, r) {
  return { meId: r.meId, date: r.date, fy: r.fy, hospCode: r.hospCode, hospName: hospOf_(r.hospCode).name, errType: r.errType, typeName: ME_TYPES[r.errType] || r.errType, errKind: r.errKind,
    severity: r.severity, drugName: r.drugName, drugPair: r.drugPair, hn: r.hn, detail: r.detail, action: r.action, reporter: r.reporter, createdAt: r.createdAt,
    status: r.status, voidReason: r.voidReason, voidBy: r.voidBy, voidAt: r.voidAt, canVoid: r.status === 'active' && meCanVoid_(u, r) };
}
/** กรองตามสิทธิ์: หน่วยบริการเห็นเฉพาะของตนเอง แอดมินเลือกหน่วยได้ */
function meFilter_(u, p) {
  const f = repFilter_(p), adm = u.role === 'admin', hosp = adm ? String(p.hosp || '') : u.hospCode;
  if (adm && hosp && !HOSPITALS.some(h => h.code === hosp)) fail_('หน่วยบริการไม่ถูกต้อง');
  const sev = String(p.sev || '').toUpperCase(), type = String(p.type || ''), grp = { REACH: 'CDEFGHI', HARM: 'EFGHI' }; // REACH = ถึงผู้ป่วย (C-I), HARM = เกิดอันตราย (E-I)
  if (sev && !ME_SEV[sev] && !grp[sev]) fail_('ระดับความรุนแรงไม่ถูกต้อง'); if (type && !ME_TYPES[type]) fail_('ประเภทความคลาดเคลื่อนไม่ถูกต้อง');
  const sevOk = r => !sev || (grp[sev] ? grp[sev].indexOf(r.severity) >= 0 : r.severity === sev);
  const rows = readAll_('MedErrors').filter(r => (!hosp || r.hospCode === hosp) && (!f.fy || r.fy === f.fy) && (!f.mo || monthOf_(r.date) === f.mo) && sevOk(r) && (!type || r.errType === type));
  return { f: f, hosp: hosp, sev: sev, type: type, rows: rows };
}
function meList_(u, p) {
  const x = meFilter_(u, p);
  return x.rows.sort((a, b) => (a.createdAt + a.meId) < (b.createdAt + b.meId) ? 1 : -1).slice(0, 1000).map(r => meView_(u, r));
}
/** สถิติ ME ปีงบประมาณปัจจุบันสำหรับหน้าหลัก (หน่วยบริการเห็นของตนเอง แอดมินเห็นทุกหน่วย) */
function meStat_(u, fy) {
  const adm = u.role === 'admin', mo = monthOf_(today_()), rs = readAll_('MedErrors').filter(r => r.status === 'active' && r.fy === fy && (adm || r.hospCode === u.hospCode));
  const o = { total: rs.length, month: rs.filter(r => monthOf_(r.date) === mo).length, reach: rs.filter(meReach_).length, harm: rs.filter(meHarm_).length,
    byType: Object.keys(ME_TYPES).map(k => ({ key: k, name: ME_TYPES[k], count: rs.filter(r => r.errType === k).length })),
    // รายเดือนตลอดปีงบ (ต.ค.–ก.ย.) แยก 3 กลุ่มความรุนแรง: A-B ยังไม่ถึงผู้ป่วย / C-D ถึงผู้ป่วยแต่ไม่เกิดอันตราย / E-I เกิดอันตราย
    byMonth: MONTH_NO.map(m => { const x = rs.filter(r => monthOf_(r.date) === m); return { mo: m, ab: x.filter(r => !meReach_(r)).length, cd: x.filter(r => meReach_(r) && !meHarm_(r)).length, ei: x.filter(meHarm_).length }; }),
    bySev: Object.keys(ME_SEV).map(k => ({ sev: k, count: rs.filter(r => r.severity === k).length })),
    topDrugs: (() => { const g = {}; rs.forEach(r => { const k = String(r.drugName || '').trim(); if (k) { const kk = k.toLowerCase(); g[kk] = g[kk] || { name: k, count: 0 }; g[kk].count++; } }); return Object.keys(g).map(k => g[k]).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 5); })(),
    topKinds: (() => { const g = {}; rs.forEach(r => { if (r.errKind) g[r.errKind] = (g[r.errKind] || 0) + 1; }); return Object.keys(g).map(k => ({ name: k, count: g[k] })).sort((a, b) => b.count - a.count).slice(0, 5); })() };
  if (adm) o.byHosp = HOSPITALS.map(h => { const x = rs.filter(r => r.hospCode === h.code); return { code: h.code, name: h.name, count: x.length, reach: x.filter(r => meReach_(r) && !meHarm_(r)).length, harm: x.filter(meHarm_).length }; }).sort((a, b) => b.count - a.count);
  return o;
}
function meReport_(u, p) {
  const x = meFilter_(u, p), all = x.rows.filter(r => r.status === 'active'), f = x.f, hn = x.hosp ? hospOf_(x.hosp).name : 'ทุกหน่วยบริการ', TK = Object.keys(ME_TYPES);
  const sub = [subLine_(f), 'หน่วยบริการ: ' + hn + (x.sev ? '   ระดับ ' + (x.sev === 'REACH' ? 'C-I (ถึงผู้ป่วย)' : x.sev === 'HARM' ? 'E-I (เกิดอันตราย)' : x.sev) : '') + (x.type ? '   ประเภท ' + ME_TYPES[x.type] : '')];
  const reach = all.filter(meReach_).length, harm = all.filter(meHarm_).length;
  const stats = [['ME ทั้งหมด', fmtN_(all.length)], ['ถึงผู้ป่วย (C-I)', fmtN_(reach) + ' (' + pct_(reach, all.length) + ')'], ['เกิดอันตราย (E-I)', fmtN_(harm)]];
  if (p.rpt === 'mereg') {
    const one = !!x.hosp;  // รายงานของหน่วยบริการเดียว (หน่วยบริการเอง หรือแอดมินเลือกหน่วย) ไม่ต้องมีคอลัมน์หน่วยบริการ
    const rows = all.sort((a, b) => idCmp_(a.meId, b.meId)).map(r => [r.meId, thDate_(r.date)].concat(one ? [] : [hospOf_(r.hospCode).name], [r.hn, r.drugName, r.drugPair || '-', (ME_TYPES[r.errType] || r.errType).replace(' error', ''), r.errKind || '-', r.severity, r.detail, r.reporter || '-']));
    const head = ['เลขที่', 'วันที่'].concat(one ? [] : ['หน่วยบริการ'], ['HN', 'ชื่อยา', 'ยาคู่', 'ประเภท', 'ชนิด', 'ระดับ', 'รายละเอียด', 'ผู้รายงาน']);
    const aligns = ['c', 'c'].concat(one ? [] : ['l'], ['c', 'l', 'l', 'l', 'l', 'c', 'l', 'l']);
    const widths = one ? [36, 42, 38, 60, 50, 48, 62, 24, 90, 49] : [34, 40, 44, 34, 52, 42, 44, 56, 22, 80, 51];
    return { rpt: 'mereg', title: 'ทะเบียนความคลาดเคลื่อนทางยา (Medication Error)' + (one ? ' ' + hn : ''), sub: sub, stats: stats,
      tables: [{ title: '', head: head, aligns: aligns, widths: widths, rows: rows.slice(0, 3000) }],
      note: rows.length > 3000 ? 'แสดง 3,000 รายการแรกจาก ' + rows.length + ' กรุณากรองให้แคบลง' : '' };
  }
  if (p.rpt === 'mesum') {
    const H = x.hosp ? [hospOf_(x.hosp)] : HOSPITALS, cnt = (rs, t) => rs.filter(r => r.errType === t).length;
    const line = (name, rs) => [name].concat(TK.map(k => fmtN_(cnt(rs, k))), [fmtN_(rs.length), fmtN_(rs.filter(meReach_).length), fmtN_(rs.filter(meHarm_).length)]);
    const t1rows = H.map(h => line(h.name, all.filter(r => r.hospCode === h.code))); t1rows.push(line('รวม', all));
    const kindRows = []; TK.forEach(k => ME_KINDS[k].forEach(kd => { const n = all.filter(r => r.errType === k && r.errKind === kd).length; if (n > 0) kindRows.push([ME_TYPES[k].replace(' error', ''), kd, n]); }));
    kindRows.sort((a, b) => b[2] - a[2]);
    return { rpt: 'mesum', title: 'สรุปความคลาดเคลื่อนทางยา (Medication Error)', sub: sub, stats: stats, tables: [
      { title: 'จำแนกตามหน่วยบริการและประเภท (Presc.=Prescribing, Trans.=Transcribing, Pre-disp.=Pre-dispensing, Disp.=Dispensing, Admin.=Administration)', head: ['หน่วยบริการ'].concat(TK.map(k => ME_ABBR[k]), ['รวม', 'ถึงผู้ป่วย (C-I)', 'อันตราย (E-I)']), aligns: ['l', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r'], widths: [105, 44, 44, 48, 44, 46, 40, 64, 64], rows: t1rows },
      { title: 'จำแนกตามชนิดความคลาดเคลื่อน (เรียงจากมากไปน้อย)', head: ['ประเภท', 'ชนิดความคลาดเคลื่อน', 'จำนวน', 'ร้อยละ'], aligns: ['l', 'l', 'r', 'r'], widths: [95, 284, 60, 60], rows: kindRows.map(r => [r[0], r[1], fmtN_(r[2]), pct_(r[2], all.length)]) },
      { title: 'จำแนกตามระดับความรุนแรง', head: ['ระดับ', 'ความหมาย', 'จำนวน', 'ร้อยละ'], aligns: ['c', 'l', 'r', 'r'], widths: [40, 319, 60, 80], rows: Object.keys(ME_SEV).map(k => { const n = all.filter(r => r.severity === k).length; return [k, ME_SEV[k], fmtN_(n), pct_(n, all.length)]; }) },
      { title: 'จำแนกตามเดือน', head: ['เดือน', 'ME ทั้งหมด', 'ถึงผู้ป่วย (C-I)', 'อันตราย (E-I)'], aligns: ['l', 'r', 'r', 'r'], widths: [150, 115, 117, 117], rows: MONTH_NO.map((m, i) => { const rs = all.filter(r => monthOf_(r.date) === m); return [MONTHS[i], fmtN_(rs.length), fmtN_(rs.filter(meReach_).length), fmtN_(rs.filter(meHarm_).length)]; }) }
    ], note: '' };
  }
  fail_('ไม่พบรายงานที่เลือก');
}

return { computeStock_, lotsList_, drugList_, stockCard_, listRequests_, requestDetail_, previewApprove_, listIssues_, getIssue_, usersList_, logsList_,
  dashboard_, report_, loanRows_, loanDetail_, loanReport_, loanRegReport_, meList_, meReport_ };
}

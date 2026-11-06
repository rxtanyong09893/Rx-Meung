'use strict';
/* app2.js (เดิม JS2.html) — ยกเลิกใบเบิก/รับยาคืน และการพิมพ์ A4 ตามงานสารบรรณ (โหลดต่อจาก app.js)
   การอนุมัติบนฐานข้อมูลทำในทรานแซกชันเดียว จึงไม่มีคำขอค้าง "กำลังดำเนินการ" อีก */
(function () {
  const issueHtml0 = issueHtml;

  /* ---------- ใบเบิก: แสดงสถานะยกเลิก + ปุ่มยกเลิกใบเบิก ---------- */
  const cxBadge = i => i.status === 'cancelled' ? '<span class="badge b-cancelled">ยกเลิกแล้ว</span>' : '<span class="badge b-approved">ปกติ</span>';
  issueTable = function (list) {
    if (!list || !list.length) return empty('ยังไม่มีใบเบิก');
    const adm = S.user.role === 'admin';
    return tbl([['เลขที่ใบเบิก'], ['วันที่เบิก'], ...(adm ? [['หน่วยบริการ']] : []), ['รายการ', 'c'], ['มูลค่า (บาท)', 'r'], ['สถานะ']],
      list.map(i => `<tr class="clk" data-issue="${esc(i.docNo)}"${i.status === 'cancelled' ? ' style="color:#8a9a95"' : ''}><td>${esc(i.docNo)}</td><td>${thDate(i.issueDate)}</td>${adm ? `<td>${esc(i.hospName)}</td>` : ''}<td class="c">${i.itemCount}</td><td class="r">${i.status === 'cancelled' ? '<s>' + money(i.totalValue) + '</s>' : money(i.totalValue)}</td><td>${cxBadge(i)}</td></tr>`).join(''));
  };
  issueHtml = function (d) {
    const h = issueHtml0(d), i = d.issue;
    if (i.status !== 'cancelled') return h;
    return h.replace('<div class="sheet">', `<div class="sheet"><div style="border:3px solid #b91c1c;color:#b91c1c;font-weight:700;text-align:center;padding:4px 8px;margin-bottom:8px">ยกเลิกใบเบิกนี้แล้ว ${thDT(i.cancelAt)} โดย ${esc(i.cancelBy)}<br>เหตุผล: ${esc(i.cancelReason)}</div>`);
  };
  openIssue = async function (docNo) {
    let d; try { d = await call('issueDetail', { docNo: docNo }); } catch (e) { toast(e.message, true); return; }
    const cx = d.issue.status === 'cancelled', adm = S.user.role === 'admin';
    const m = modal('ใบเบิกยา ' + docNo + (cx ? ' (ยกเลิกแล้ว)' : ''), `<div class="tw" style="border:0">${issueHtml(d)}</div><div class="mf">${adm && !cx ? '<button class="btn bad" id="cxl">ยกเลิกใบเบิก / รับยาคืน</button>' : ''}<button class="btn sec" id="pr">พิมพ์ (A4)</button><button class="btn sec" id="pd">ดาวน์โหลด PDF</button><button class="btn sec" id="wd">ดาวน์โหลด Word</button>${cx ? '' : '<button class="btn line" id="ln">แชร์เข้า LINE</button>'}</div>`, { wide: true });
    $id(m, 'pr').onclick = () => printHtml(issueHtml(d));
    $id(m, 'pd').onclick = b => act(b.target, () => download({ kind: 'issue', docNo: docNo }, 'pdf'));
    $id(m, 'wd').onclick = b => act(b.target, () => download({ kind: 'issue', docNo: docNo }, 'docx'));
    if ($id(m, 'ln')) $id(m, 'ln').onclick = () => lineModal({ kind: 'issue', docNo: docNo }, 'ใบเบิกยา ' + docNo + ' ' + d.issue.hospName);
    if ($id(m, 'cxl')) $id(m, 'cxl').onclick = () => cancelIssueModal(d, m);
  };
  function cancelIssueModal(d, parent) {
    const i = d.issue;
    const m = modal('ยกเลิกใบเบิก ' + i.docNo, `<p>ยาทุกรายการในใบเบิกนี้จะถูก<b>รับคืนเข้า LOT เดิม</b> บันทึกใน Stock Card เป็น "รับคืน" อ้างอิงเลขที่ ${esc(i.docNo)} และคำขอเบิกที่เกี่ยวข้องจะเปลี่ยนเป็น "ยกเลิก"</p>`
      + tbl([['รายการ'], ['LOT'], ['หมดอายุ'], ['จำนวนรับคืน', 'r']], d.items.map(x => `<tr><td>${esc(x.drugName)}</td><td>${esc(x.lotNo)}</td><td>${thDate(x.expDate)} ${expBadge(x.expDate)}</td><td class="r">${fmt(x.qty)} ${esc(x.unit)}</td></tr>`).join(''))
      + `<div class="msg e">ใช้เมื่อยายังไม่ได้ส่งออกจากคลัง หรือหน่วยบริการส่งยาคืนครบทุกรายการแล้ว · ทำแล้วย้อนกลับไม่ได้ (เลขที่ใบเบิกนี้จะไม่ถูกนำมาใช้ใหม่)</div>
      <label for="cr">เหตุผลการยกเลิก</label><textarea id="cr" maxlength="200" rows="2"></textarea>
      <div class="mf"><button class="btn sec" data-close>กลับ</button><button class="btn bad" id="cok">ยืนยันยกเลิกใบเบิก</button></div>`, { wide: true });
    $id(m, 'cok').onclick = b => act(b.target, async () => {
      if (!val(m, 'cr').trim()) throw new Error('กรุณาระบุเหตุผลการยกเลิก');
      if (!confirm('ยืนยันยกเลิกใบเบิก ' + i.docNo + ' และรับยาคืนเข้าคลัง?')) return;
      const r = await call('issueCancel', { docNo: i.docNo, reason: val(m, 'cr') });
      m.remove(); parent.remove();
      toast('ยกเลิกใบเบิกแล้ว ยารับคืนเข้าคลัง' + (r.expired && r.expired.length ? ' (LOT หมดอายุแล้ว: ' + r.expired.join(', ') + ')' : ''), !!(r.expired && r.expired.length));
      go(S.view);
    });
  }
  /* ---------- พิมพ์ (A4) ตามรูปแบบงานสารบรรณ: แนวตั้ง/แนวนอนตามความกว้างตาราง + เลขหน้า "- ๒ -" ตั้งแต่หน้า 2 ---------- */
  const plainLen = s => String(s == null ? '' : s).replace(/[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/g, '').trim().length;
  function landscapeNeeded(root) { // กติกาเดียวกับ orientFor_ ใน Code.gs
    const wp = (210 - 50) / 25.4 * 72;
    return [...root.querySelectorAll('table')].some(t => {
      const rows = [...t.rows].map(r => [...r.cells]); if (!rows.length) return false;
      const n = rows[0].length; if (n >= 9) return true;
      let sum = 0;
      for (let c = 0; c < n; c++) {
        let body = 0, left = true;
        rows.slice(1).forEach(r => { const td = r[c]; if (!td) return; body = Math.max(body, plainLen(td.textContent)); const al = td.style.textAlign || (td.classList.contains('r') ? 'right' : td.classList.contains('c') ? 'center' : 'left'); if (al !== 'left') left = false; });
        sum += Math.max(Math.min(plainLen(rows[0][c].textContent), 7), Math.min(body, left ? 18 : 14), 2) * 6.2 + 10;
      }
      return sum > wp * 1.08;
    });
  }
  window.landscapeNeeded = landscapeNeeded;
  let pskName;
  function pskFont() { // ตรวจว่าเครื่องนี้มีฟอนต์ TH SarabunPSK / TH Sarabun New หรือไม่
    if (pskName !== undefined) return pskName;
    try {
      const c = document.createElement('canvas').getContext('2d'), t = 'กขคงจฉ abcxyz 0123456789'; c.font = '40px monospace'; const base = c.measureText(t).width;
      pskName = ['TH SarabunPSK', 'TH Sarabun New', 'THSarabunNew'].find(f => { c.font = '40px "' + f + '", monospace'; return c.measureText(t).width !== base; }) || '';
    } catch (e) { pskName = ''; }
    return pskName;
  }
  printHtml = function (html) {
    const p = $('#printArea'); p.innerHTML = html;
    const L = landscapeNeeded(p), f = pskFont(), ff = f ? '"' + f + '"' : '"Sarabun"', fs = f ? '16pt' : '12pt';
    p.style.setProperty('--pf', ff); p.style.setProperty('--ps', fs);
    let st = document.getElementById('pgsz'); if (!st) { st = document.createElement('style'); st.id = 'pgsz'; document.head.appendChild(st); }
    st.textContent = '@media print{@page{size:A4 ' + (L ? 'landscape' : 'portrait') + ';margin:' + (L ? '25mm 20mm 20mm 25mm' : '25mm 20mm 20mm 30mm')
      + ';@top-center{content:"- " counter(page) " -";font-family:' + ff + ',sans-serif;font-size:' + fs + '}}@page:first{@top-center{content:none}}}';
    if (!f) toast('เครื่องนี้ไม่มีฟอนต์ TH SarabunPSK จึงพิมพ์ด้วย Sarabun ขนาดเทียบเท่า');
    setTimeout(() => { window.print(); setTimeout(() => { p.innerHTML = ''; }, 800); }, 150);
  };
})();
-- ติดตั้งฐานข้อมูล ระบบจัดการด้านยาปฐมภูมิ (วางทั้งไฟล์ใน Supabase > SQL Editor แล้วกด Run ครั้งเดียว)
-- รันซ้ำได้: ไม่ลบข้อมูลที่มีอยู่ (อัปเดตเฉพาะฟังก์ชัน)
do $install$
declare r record;
begin
-- ===================== ระบบจัดการด้านยาปฐมภูมิ — โครงสร้างฐานข้อมูล (แทน Google Sheet) =====================
-- ตารางทั้งหมดอยู่ใน schema "rx" ซึ่งไม่เปิดผ่าน API — หน้าเว็บเข้าถึงได้ทางฟังก์ชัน public.api() เท่านั้น (เหมือน api() ใน Code.gs)

-- ล้างตารางของเวอร์ชันทดลองก่อนหน้า (ถ้ามี — ยังไม่มีข้อมูลใช้งานจริง)
drop view if exists public.v_stock;
drop table if exists public.stock_tx, public.lots, public.stock_levels, public.drugs, public.profiles, public.facilities cascade;
for r in select p.oid::regprocedure as f from pg_proc p where p.pronamespace = 'public'::regnamespace
         and p.proname in ('receive_stock','dispense_stock','lot_adjust','_balance','is_admin','my_facility','can_access','handle_new_user') loop
  execute 'drop function if exists ' || r.f || ' cascade';
end loop;
begin
  execute 'drop trigger if exists on_auth_user_created on auth.users';
exception when others then null;
end;

create schema if not exists rx;
revoke all on schema rx from public;

create table if not exists rx.settings (key text primary key, value text not null default '');
create table if not exists rx.hospitals (code text primary key, name text not null, full_name text not null, sort int not null default 0);
create table if not exists rx.users (
  username text primary key, hash text not null, name text not null, role text not null default 'user',
  hosp_code text not null, status text not null default 'pending', must_change boolean not null default false,
  created_at timestamptz not null default now(), last_login timestamptz);
create table if not exists rx.sessions (token text primary key, username text not null, expires_at timestamptz not null);
create table if not exists rx.throttle (key text primary key, n int not null default 0, expires_at timestamptz not null);
create table if not exists rx.counters (key text primary key, value bigint not null default 0);
create table if not exists rx.drugs (
  drug_id text primary key, name text not null, unit text not null, category text not null default '',
  min_stock int not null default 0, active boolean not null default true, seq bigserial);
create table if not exists rx.lots (
  lot_id text primary key, drug_id text not null references rx.drugs, lot_no text not null, exp_date date not null,
  qty_in int not null default 0, qty_remain int not null default 0 check (qty_remain >= 0), unit_price numeric(14,2) not null default 0,
  received_at timestamptz not null default now(), supplier text not null default '', by_name text not null default '');
create index if not exists lots_drug on rx.lots (drug_id, exp_date);
create table if not exists rx.requests (
  req_id text primary key, hosp_code text not null, created_at timestamptz not null default now(), created_by text not null default '',
  note text not null default '', status text not null default 'pending', doc_no text not null default '',
  decided_at timestamptz, decided_by text not null default '', reason text not null default '');
create table if not exists rx.request_items (
  req_id text not null references rx.requests, drug_id text not null, qty_req int not null, qty_approved int not null default 0, ord int not null default 0,
  primary key (req_id, drug_id));
create table if not exists rx.issues (
  doc_no text primary key, fy int not null, seq int not null, req_id text not null default '', hosp_code text not null,
  issue_date date not null, item_count int not null default 0, total_value numeric(14,2) not null default 0, note text not null default '',
  approver text not null default '', created_at timestamptz not null default now(), status text not null default '',
  cancel_reason text not null default '', cancel_by text not null default '', cancel_at timestamptz);
create table if not exists rx.issue_items (
  id bigserial primary key, doc_no text not null references rx.issues, drug_id text not null, drug_name text not null, unit text not null,
  lot_no text not null, exp_date date not null, qty int not null, unit_price numeric(14,2) not null, value numeric(14,2) not null);
create table if not exists rx.stock_card (
  id bigserial primary key, date date not null, drug_id text not null, type text not null, lot_no text not null default '',
  exp_date date, qty_in int not null default 0, qty_out int not null default 0, balance int not null default 0,
  ref text not null default '', party text not null default '', by_name text not null default '', created_at timestamptz not null default now());
create index if not exists stock_card_drug on rx.stock_card (drug_id, id);
create table if not exists rx.receipts (
  id bigserial primary key, date date not null, fy int not null, drug_id text not null, lot_no text not null, exp_date date not null,
  qty int not null, unit_price numeric(14,2) not null, value numeric(14,2) not null, supplier text not null default '',
  by_name text not null default '', created_at timestamptz not null default now());
create table if not exists rx.loans (
  loan_id text primary key, created_at timestamptz not null default now(), lender text not null, borrower text not null, due_date date not null,
  status text not null default 'requested', note text not null default '', created_by text not null default '',
  decided_at timestamptz, decided_by text not null default '', reason text not null default '', closed_at timestamptz);
create table if not exists rx.loan_lines (
  loan_id text not null references rx.loans, line_no int not null, name text not null, unit text not null,
  qty_req int not null, qty_lent int not null default 0, qty_returned int not null default 0, primary key (loan_id, line_no));
create table if not exists rx.loan_returns (
  ret_id text primary key, loan_id text not null references rx.loans, created_at timestamptz not null default now(),
  created_by text not null default '', note text not null default '');
create table if not exists rx.loan_return_lines (
  ret_id text not null references rx.loan_returns, line_no int not null, name text not null, unit text not null, qty int not null);
create table if not exists rx.med_errors (
  me_id text primary key, date date not null, fy int not null, hosp_code text not null, err_type text not null, severity text not null,
  drug_name text not null, drug_pair text not null default '', hn text not null, detail text not null, err_kind text not null default '',
  action text not null default '', reporter text not null default '', created_at timestamptz not null default now(),
  status text not null default 'active', void_reason text not null default '', void_by text not null default '', void_at timestamptz);
create table if not exists rx.me_kinds (err_type text not null, kind text not null, ord int not null, primary key (err_type, kind));
create table if not exists rx.logs (id bigserial primary key, time timestamptz not null default now(), username text not null default '', action text not null, detail text not null default '');

-- ปิดการเข้าถึงตรงทุกตาราง (เปิด RLS โดยไม่มี policy = ปฏิเสธทั้งหมด)
alter table rx.settings enable row level security;      alter table rx.hospitals enable row level security;
alter table rx.users enable row level security;         alter table rx.sessions enable row level security;
alter table rx.throttle enable row level security;      alter table rx.counters enable row level security;
alter table rx.drugs enable row level security;         alter table rx.lots enable row level security;
alter table rx.requests enable row level security;      alter table rx.request_items enable row level security;
alter table rx.issues enable row level security;        alter table rx.issue_items enable row level security;
alter table rx.stock_card enable row level security;    alter table rx.receipts enable row level security;
alter table rx.loans enable row level security;         alter table rx.loan_lines enable row level security;
alter table rx.loan_returns enable row level security;  alter table rx.loan_return_lines enable row level security;
alter table rx.med_errors enable row level security;    alter table rx.me_kinds enable row level security;
alter table rx.logs enable row level security;

-- ===================== ข้อมูลตั้งต้น (ค่าเดียวกับ APP / HOSPITALS / ME_KINDS ใน Code.gs) =====================
insert into rx.settings (key, value) values
  ('TITLE', 'ระบบจัดการด้านยาปฐมภูมิ เครือข่าย รพ.สต. อำเภอเมืองปัตตานี'),
  ('ISSUER', 'โรงพยาบาลส่งเสริมสุขภาพตำบลตันหยงลุโละ'),
  ('ISSUER_SUB', '(คลังยาส่วนกลาง อำเภอเมือง ปัตตานี)'),
  ('KEEPER', 'นางสาวสาลินี พรหมเมือง'),
  ('KEEPER_TITLE', 'ผู้รับผิดชอบคลังยา อำเภอเมือง จังหวัดปัตตานี'),
  ('NEAR_EXP_DAYS', '180'),
  ('LINE_TOKEN', ''), ('LINE_TO', ''), ('APP_URL', '')
on conflict (key) do nothing;

insert into rx.hospitals (code, name, full_name, sort) values
  ('H01', 'รพ.สต.บานา', 'โรงพยาบาลส่งเสริมสุขภาพตำบลบานา', 1),
  ('H02', 'รพ.สต.ตะลุโบะ', 'โรงพยาบาลส่งเสริมสุขภาพตำบลตะลุโบะ', 2),
  ('H03', 'รพ.สต.ปะกาฮะรัง', 'โรงพยาบาลส่งเสริมสุขภาพตำบลปะกาฮะรัง', 3),
  ('H04', 'รพ.สต.คลองมานิง', 'โรงพยาบาลส่งเสริมสุขภาพตำบลคลองมานิง', 4),
  ('H05', 'รพ.สต.บาราโหม', 'โรงพยาบาลส่งเสริมสุขภาพตำบลบาราโหม', 5),
  ('H06', 'รพ.สต.บาราเฮาะ', 'โรงพยาบาลส่งเสริมสุขภาพตำบลบาราเฮาะ', 6),
  ('H07', 'รพ.สต.รูสะมิแล', 'โรงพยาบาลส่งเสริมสุขภาพตำบลรูสะมิแล', 7),
  ('H08', 'สอน.ปูยุด', 'สถานีอนามัยเฉลิมพระเกียรติ 60 พรรษา นวมินทราชินี ปูยุด', 8),
  ('H09', 'รพ.สต.กะมิยอ', 'โรงพยาบาลส่งเสริมสุขภาพตำบลกะมิยอ', 9),
  ('H10', 'รพ.สต.ตันหยงลุโละ', 'โรงพยาบาลส่งเสริมสุขภาพตำบลตันหยงลุโละ', 10)
on conflict (code) do nothing;

insert into rx.me_kinds (err_type, kind, ord)
select t, k, o from (values
  ('presc', array['สั่งยาผิดชนิด/ผิดตัวยา','สั่งขนาดยา (dose) ผิด','สั่งความถี่/ระยะเวลาการใช้ยาผิด','สั่งยาผิดรูปแบบ/ความแรง','สั่งยาซ้ำซ้อน','สั่งยาที่ผู้ป่วยมีประวัติแพ้','สั่งยาที่มีปฏิกิริยาต่อกัน/ข้อห้ามใช้','สั่งยาผิดคน','คำสั่งใช้ยาไม่ชัดเจน/อ่านไม่ออก','อื่นๆ (ระบุในรายละเอียด)']),
  ('trans', array['คัดลอก/คีย์ชื่อยาผิด','คัดลอก/คีย์ขนาดยาหรือความแรงผิด','คัดลอก/คีย์วิธีใช้หรือความถี่ผิด','คัดลอก/คีย์จำนวนยาผิด','คัดลอก/คีย์ข้อมูลผู้ป่วยผิดคน','คัดลอกรายการยาไม่ครบ/ตกหล่น','อื่นๆ (ระบุในรายละเอียด)']),
  ('pre', array['จัดยาผิดชนิด','จัดยาผิดความแรง/รูปแบบ','จัดยาผิดจำนวน','จัดยาไม่ครบ/ตกหล่น','หยิบยาสลับกันเพราะชื่อหรือหน้าตาคล้าย (LASA)','จัดยาหมดอายุ/เสื่อมสภาพ','ติดฉลากยาผิด/วิธีใช้บนฉลากผิด','ติดฉลากสลับผู้ป่วย','ไม่ได้ตรวจสอบซ้ำก่อนจ่าย','อื่นๆ (ระบุในรายละเอียด)']),
  ('disp', array['จ่ายยาผิดคน','จ่ายยาผิดชนิด','จ่ายยาผิดความแรง/รูปแบบ','จ่ายยาผิดจำนวน','จ่ายยาไม่ครบ/ตกหล่น','จ่ายยาซ้ำ','จ่ายยาที่ผู้ป่วยแพ้ (ไม่ได้ซักประวัติ)','ให้คำแนะนำการใช้ยาผิดหรือไม่ได้ให้คำแนะนำ','จ่ายยาหมดอายุ/เสื่อมสภาพ','อื่นๆ (ระบุในรายละเอียด)']),
  ('admin', array['ให้ยาผิดคน','ให้ยาผิดชนิด','ให้ยาผิดขนาด','ให้ยาผิดเวลา/ลืมให้ยา','ให้ยาผิดวิธี/ผิดทางที่ให้ยา (route)','ให้ยาผิดเทคนิค (เช่น ฉีด/พ่น/หยอดยาไม่ถูกวิธี)','ให้ยานานเกินหรือหยุดก่อนกำหนด','ให้ยาหมดอายุ/เสื่อมสภาพ','อื่นๆ (ระบุในรายละเอียด)'])
) v(t, arr), unnest(arr) with ordinality u(k, o)
on conflict do nothing;
-- ===================== Helpers (เทียบ Helpers ใน Code.gs) =====================
create or replace function rx.fail(m text) returns void language plpgsql as $f$
begin raise exception using errcode = 'RX001', message = m; end $f$;

create or replace function rx.auth_fail() returns void language plpgsql as $f$
begin raise exception using errcode = 'RX002', message = 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'; end $f$;

create or replace function rx.today() returns date language sql stable as $f$
  select (now() at time zone 'Asia/Bangkok')::date $f$;

create or replace function rx.fy(d date) returns int language sql immutable as $f$
  select extract(year from d)::int + 543 + case when extract(month from d) >= 10 then 1 else 0 end $f$;

create or replace function rx.ts(t timestamptz) returns text language sql stable as $f$
  select coalesce(to_char(t at time zone 'Asia/Bangkok', 'YYYY-MM-DD HH24:MI:SS'), '') $f$;

create or replace function rx.ds(d date) returns text language sql immutable as $f$
  select coalesce(to_char(d, 'YYYY-MM-DD'), '') $f$;

create or replace function rx.thd(d date) returns text language sql immutable as $f$
  select case when d is null then '-' else to_char(d, 'DD/MM/') || (extract(year from d)::int + 543) end $f$;

create or replace function rx.pad(n bigint, w int) returns text language sql immutable as $f$
  select lpad(n::text, w, '0') $f$;

create or replace function rx.setting(k text) returns text language sql stable as $f$
  select coalesce((select value from rx.settings where key = k), '') $f$;

create or replace function rx.hname(c text) returns text language sql stable as $f$
  select coalesce((select name from rx.hospitals where code = c), case when c = 'ADMIN' then 'คลังยา (แอดมิน)' else c end) $f$;

create or replace function rx.next_id(k text, n int) returns bigint language plpgsql as $f$
declare v bigint;
begin
  insert into rx.counters (key, value) values (k, n)
  on conflict (key) do update set value = rx.counters.value + excluded.value returning value into v;
  return v - n + 1;
end $f$;

create or replace function rx.log(un text, act text, det text) returns void language sql as $f$
  insert into rx.logs (username, action, detail) values (coalesce(un, '-'), act, left(coalesce(det, ''), 500)) $f$;

-- ตรวจข้อความ: ตัดอักขระควบคุม/ช่องว่างหัวท้าย, บังคับกรอก, จำกัดความยาว
create or replace function rx.s(v text, mx int, req boolean, label text) returns text language plpgsql as $f$
declare x text := btrim(regexp_replace(coalesce(v, ''), '[\x01-\x1F\x7F]', ' ', 'g'));
begin
  if req and x = '' then perform rx.fail('กรุณากรอก' || label); end if;
  if char_length(x) > mx then perform rx.fail(label || 'ยาวเกินกำหนด (ไม่เกิน ' || mx || ' ตัวอักษร)'); end if;
  return x;
end $f$;

-- จำนวนเต็มในช่วง [mn, mx]
create or replace function rx.i(v text, mn bigint, mx bigint, label text) returns bigint language plpgsql as $f$
declare n numeric;
begin
  if v is null or btrim(v) = '' then perform rx.fail(label || 'ไม่ถูกต้อง'); end if;
  begin n := btrim(v)::numeric; exception when others then n := null; end;
  if n is null or n <> trunc(n) or n < mn or n > mx then perform rx.fail(label || 'ไม่ถูกต้อง'); end if;
  return n::bigint;
end $f$;

-- ตัวเลขทศนิยม 2 ตำแหน่ง
create or replace function rx.num(v text, mn numeric, mx numeric, label text) returns numeric language plpgsql as $f$
declare n numeric;
begin
  if v is null or btrim(v) = '' then perform rx.fail(label || 'ไม่ถูกต้อง'); end if;
  begin n := btrim(v)::numeric; exception when others then n := null; end;
  if n is null or n < mn or n > mx then perform rx.fail(label || 'ไม่ถูกต้อง'); end if;
  return round(n, 2);
end $f$;

create or replace function rx.dt(v text, label text) returns date language plpgsql as $f$
declare d date;
begin
  if v is null or v !~ '^\d{4}-\d{2}-\d{2}$' then perform rx.fail(label || 'ไม่ถูกต้อง'); end if;
  begin d := v::date; exception when others then d := null; end;
  if d is null or to_char(d, 'YYYY-MM-DD') <> v then perform rx.fail(label || 'ไม่ถูกต้อง'); end if;
  return d;
end $f$;

create or replace function rx.pw(v text) returns text language plpgsql as $f$
begin
  if coalesce(v, '') !~ '^[A-Za-z0-9]{4}$' then perform rx.fail('รหัสผ่านต้องเป็นตัวอักษรอังกฤษหรือตัวเลข 4 ตัวพอดี'); end if;
  return v;
end $f$;

create or replace function rx.uname(v text) returns text language plpgsql as $f$
declare x text := lower(btrim(coalesce(v, '')));
begin
  if x !~ '^[a-z0-9_]{3,20}$' then perform rx.fail('ชื่อผู้ใช้ต้องเป็น a-z 0-9 _ ความยาว 3-20 ตัว'); end if;
  return x;
end $f$;

create or replace function rx.hash(pw text) returns text language sql volatile as $f$
  select extensions.crypt(pw, extensions.gen_salt('bf', 8)) $f$;

create or replace function rx.pub_user(u rx.users) returns jsonb language sql stable as $f$
  select jsonb_build_object('username', u.username, 'name', u.name, 'role', u.role, 'hospCode', u.hosp_code,
    'hospName', rx.hname(u.hosp_code), 'mustChange', u.must_change) $f$;

create or replace function rx.err(m text) returns jsonb language sql immutable as $f$
  select jsonb_build_object('ok', false, 'error', m) $f$;

-- ===================== แจ้งเตือน LINE (Messaging API ผ่าน pg_net) =====================
-- ตั้งค่า: update rx.settings set value='...' where key in ('LINE_TOKEN','LINE_TO'); — ไม่ตั้ง = ไม่ส่ง
create or replace function rx.notify(msg text) returns void language plpgsql as $f$
declare tk text := rx.setting('LINE_TOKEN'); tgt text := rx.setting('LINE_TO');
begin
  if tk = '' or tgt = '' then return; end if;
  begin
    execute 'select net.http_post(url := $1, body := $2, headers := $3)'
      using 'https://api.line.me/v2/bot/message/push',
            jsonb_build_object('to', tgt, 'messages', jsonb_build_array(jsonb_build_object('type', 'text', 'text', left(msg, 4900)))),
            jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || tk);
  exception when others then perform rx.log('-', 'LINE_FAIL', sqlerrm);
  end;
end $f$;

-- ===================== Auth =====================
create or replace function rx.auth(t text) returns rx.users language plpgsql as $f$
declare un text; u rx.users;
begin
  if t is null or length(t) <> 64 then perform rx.auth_fail(); end if;
  select username into un from rx.sessions where token = t and expires_at > now();
  if un is null then perform rx.auth_fail(); end if;
  select * into u from rx.users where username = un;
  if u.username is null or u.status <> 'active' then perform rx.auth_fail(); end if;
  update rx.sessions set expires_at = now() + interval '6 hours' where token = t;
  return u;
end $f$;

create or replace function rx.do_login(p jsonb) returns jsonb language plpgsql as $f$
declare un text := lower(btrim(coalesce(p->>'username', ''))); pw text := coalesce(p->>'password', '');
        k text := 'F_' || md5(left(lower(btrim(coalesce(p->>'username', ''))), 40)); fails int; u rx.users; tk text;
begin
  select n into fails from rx.throttle where key = k and expires_at > now();
  if coalesce(fails, 0) >= 5 then return rx.err('ใส่รหัสผิดเกินกำหนด ระบบล็อกชั่วคราว 15 นาที'); end if;
  if un ~ '^[a-z0-9_]{3,20}$' then select * into u from rx.users where username = un; end if;
  if u.username is null or length(pw) <> 4 or u.hash <> extensions.crypt(pw, u.hash) then
    insert into rx.throttle (key, n, expires_at) values (k, 1, now() + interval '15 minutes')
    on conflict (key) do update set n = case when rx.throttle.expires_at > now() then rx.throttle.n + 1 else 1 end,
                                    expires_at = now() + interval '15 minutes';
    return rx.err('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  end if;
  if u.status = 'pending' then return rx.err('บัญชียังรอแอดมินอนุมัติ'); end if;
  if u.status <> 'active' then return rx.err('บัญชีนี้ถูกระงับ กรุณาติดต่อแอดมิน'); end if;
  delete from rx.throttle where key = k;
  delete from rx.sessions where expires_at < now();
  update rx.users set last_login = now() where username = un;
  tk := encode(extensions.gen_random_bytes(32), 'hex');
  insert into rx.sessions (token, username, expires_at) values (tk, un, now() + interval '6 hours');
  return jsonb_build_object('ok', true, 'data', jsonb_build_object('token', tk, 'user', rx.pub_user(u)));
end $f$;

-- ลืมรหัสแอดมิน / สร้างแอดมินครั้งแรก: รันใน SQL Editor →  select rx.reset_admin_password();
create or replace function rx.reset_admin_password() returns text language plpgsql as $f$
declare a text := 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'; b bytea := extensions.gen_random_bytes(4); pw text := ''; k int;
begin
  for k in 0..3 loop pw := pw || substr(a, (get_byte(b, k) % length(a)) + 1, 1); end loop;
  insert into rx.users (username, hash, name, role, hosp_code, status, must_change)
  values ('admin', rx.hash(pw), 'ผู้ดูแลระบบ', 'admin', 'ADMIN', 'active', true)
  on conflict (username) do update set hash = excluded.hash, must_change = true, status = 'active', role = 'admin';
  delete from rx.throttle where key = 'F_' || md5('admin');
  return 'ชื่อผู้ใช้: admin   รหัสผ่าน: ' || pw || '   (ระบบจะบังคับให้เปลี่ยนรหัสเมื่อเข้าสู่ระบบครั้งแรก)';
end $f$;
-- ===================== อ่านข้อมูลตามสิทธิ์ (แทน readAll_ ของแต่ละชีต) =====================
-- หน่วยบริการเห็นเฉพาะข้อมูลของหน่วยตนเอง แอดมินเห็นทั้งหมด — หน้าเว็บนำไปคำนวณต่อด้วยโค้ดเดียวกับ Code.gs
create or replace function rx.load(u rx.users, p jsonb) returns jsonb language plpgsql stable as $f$
declare adm boolean := u.role = 'admin'; hc text := u.hosp_code; nm text; out jsonb := '{}'::jsonb; v jsonb;
        full_dump boolean := coalesce((p->>'full')::boolean, false); dfil text := coalesce(p->>'drugId', '');
begin
  for nm in select jsonb_array_elements_text(coalesce(p->'t', '[]'::jsonb)) loop
    v := null;
    if nm = 'Drugs' then
      select jsonb_agg(jsonb_build_object('drugId', drug_id, 'name', name, 'unit', unit, 'category', category, 'minStock', min_stock,
        'active', case when active then 'Y' else 'N' end) order by seq) into v from rx.drugs;
    elsif nm = 'Lots' and adm then
      select jsonb_agg(jsonb_build_object('lotId', lot_id, 'drugId', drug_id, 'lotNo', lot_no, 'expDate', rx.ds(exp_date), 'qtyIn', qty_in,
        'qtyRemain', qty_remain, 'unitPrice', unit_price, 'receivedAt', rx.ts(received_at), 'supplier', supplier, 'by', by_name) order by lot_id) into v from rx.lots;
    elsif nm = 'Lots' then  -- หน่วยบริการ: เห็นเฉพาะยอดที่ใช้ได้รวมต่อรายการ (ไม่เห็น LOT/ราคา)
      select jsonb_agg(jsonb_build_object('lotId', '', 'drugId', drug_id, 'lotNo', '', 'expDate', '9999-12-31', 'qtyIn', q, 'qtyRemain', q,
        'unitPrice', 0, 'receivedAt', '', 'supplier', '', 'by', '')) into v
      from (select drug_id, sum(qty_remain)::int q from rx.lots where qty_remain > 0 and exp_date >= rx.today() group by drug_id) a;
    elsif nm = 'Requests' then
      select jsonb_agg(jsonb_build_object('reqId', req_id, 'hospCode', hosp_code, 'createdAt', rx.ts(created_at), 'createdBy', created_by, 'note', note,
        'status', status, 'docNo', doc_no, 'decidedAt', rx.ts(decided_at), 'decidedBy', decided_by, 'reason', reason) order by req_id) into v
      from rx.requests where adm or hosp_code = hc;
    elsif nm = 'RequestItems' then
      select jsonb_agg(jsonb_build_object('reqId', i.req_id, 'drugId', i.drug_id, 'qtyReq', i.qty_req, 'qtyApproved', i.qty_approved) order by i.req_id, i.ord) into v
      from rx.request_items i join rx.requests r using (req_id) where adm or r.hosp_code = hc;
    elsif nm = 'Issues' then
      select jsonb_agg(jsonb_build_object('docNo', doc_no, 'fy', fy, 'seq', seq, 'reqId', req_id, 'hospCode', hosp_code, 'issueDate', rx.ds(issue_date),
        'itemCount', item_count, 'totalValue', total_value, 'note', note, 'approver', approver, 'createdAt', rx.ts(created_at), 'status', status,
        'cancelReason', cancel_reason, 'cancelBy', cancel_by, 'cancelAt', rx.ts(cancel_at)) order by fy, seq) into v
      from rx.issues where adm or hosp_code = hc;
    elsif nm = 'IssueItems' then
      select jsonb_agg(jsonb_build_object('docNo', x.doc_no, 'drugId', x.drug_id, 'drugName', x.drug_name, 'unit', x.unit, 'lotNo', x.lot_no,
        'expDate', rx.ds(x.exp_date), 'qty', x.qty, 'unitPrice', x.unit_price, 'value', x.value) order by x.id) into v
      from rx.issue_items x join rx.issues i using (doc_no) where adm or i.hosp_code = hc;
    elsif nm = 'StockCard' and adm then
      select jsonb_agg(jsonb_build_object('txId', 'T' || rx.pad(id, 9), 'date', rx.ds(date), 'drugId', drug_id, 'type', type, 'lotNo', lot_no,
        'expDate', rx.ds(exp_date), 'qtyIn', qty_in, 'qtyOut', qty_out, 'balance', balance, 'ref', ref, 'party', party, 'by', by_name,
        'createdAt', rx.ts(created_at)) order by id) into v
      from rx.stock_card where dfil = '' or drug_id = dfil;
    elsif nm = 'Receipts' and adm then
      select jsonb_agg(jsonb_build_object('rcvId', 'RC' || rx.pad(id, 6), 'date', rx.ds(date), 'fy', fy, 'drugId', drug_id, 'lotNo', lot_no,
        'expDate', rx.ds(exp_date), 'qty', qty, 'unitPrice', unit_price, 'value', value, 'supplier', supplier, 'by', by_name,
        'createdAt', rx.ts(created_at)) order by id) into v from rx.receipts;
    elsif nm = 'Loans' then
      select jsonb_agg(jsonb_build_object('loanId', loan_id, 'createdAt', rx.ts(created_at), 'lender', lender, 'borrower', borrower, 'dueDate', rx.ds(due_date),
        'status', status, 'note', note, 'createdBy', created_by, 'decidedAt', rx.ts(decided_at), 'decidedBy', decided_by, 'reason', reason,
        'closedAt', rx.ts(closed_at)) order by loan_id) into v
      from rx.loans where adm or lender = hc or borrower = hc;
    elsif nm = 'LoanLines' then
      select jsonb_agg(jsonb_build_object('loanId', x.loan_id, 'lineNo', x.line_no, 'name', x.name, 'unit', x.unit, 'qtyReq', x.qty_req,
        'qtyLent', x.qty_lent, 'qtyReturned', x.qty_returned) order by x.loan_id, x.line_no) into v
      from rx.loan_lines x join rx.loans l using (loan_id) where adm or l.lender = hc or l.borrower = hc;
    elsif nm = 'LoanReturns' then
      select jsonb_agg(jsonb_build_object('retId', r.ret_id, 'loanId', r.loan_id, 'createdAt', rx.ts(r.created_at), 'createdBy', r.created_by,
        'status', 'done', 'note', r.note) order by r.ret_id) into v
      from rx.loan_returns r join rx.loans l using (loan_id) where adm or l.lender = hc or l.borrower = hc;
    elsif nm = 'LoanReturnLines' then
      select jsonb_agg(jsonb_build_object('retId', x.ret_id, 'lineNo', x.line_no, 'name', x.name, 'unit', x.unit, 'qty', x.qty) order by x.ret_id, x.line_no) into v
      from rx.loan_return_lines x join rx.loan_returns r using (ret_id) join rx.loans l using (loan_id) where adm or l.lender = hc or l.borrower = hc;
    elsif nm = 'MedErrors' then
      select jsonb_agg(jsonb_build_object('meId', me_id, 'date', rx.ds(date), 'fy', fy, 'hospCode', hosp_code, 'errType', err_type, 'severity', severity,
        'drugName', drug_name, 'drugPair', drug_pair, 'hn', hn, 'detail', detail, 'errKind', err_kind, 'action', action, 'reporter', reporter,
        'createdAt', rx.ts(created_at), 'status', status, 'voidReason', void_reason, 'voidBy', void_by, 'voidAt', rx.ts(void_at)) order by me_id) into v
      from rx.med_errors where adm or hosp_code = hc;
    elsif nm = 'Users' and adm then
      select jsonb_agg(jsonb_build_object('username', username, 'name', name, 'role', role, 'hospCode', hosp_code, 'status', status,
        'mustChange', case when must_change then 'Y' else 'N' end, 'createdAt', rx.ts(created_at), 'lastLogin', rx.ts(last_login)) order by username) into v
      from rx.users;
    elsif nm = 'Logs' and adm then
      select jsonb_agg(jsonb_build_object('time', rx.ts(time), 'user', username, 'action', action, 'detail', detail) order by id) into v
      from (select * from rx.logs order by id desc limit case when full_dump then null else 300 end) a;
    elsif nm = 'Hospitals' then
      select jsonb_agg(jsonb_build_object('code', code, 'name', name, 'full', full_name) order by sort) into v from rx.hospitals;
    end if;
    out := out || jsonb_build_object(nm, coalesce(v, '[]'::jsonb));
  end loop;
  return out;
end $f$;

create or replace function rx.meta() returns jsonb language sql stable as $f$
  select jsonb_build_object('title', rx.setting('TITLE'), 'keeper', rx.setting('KEEPER'), 'keeperTitle', rx.setting('KEEPER_TITLE'),
    'issuer', rx.setting('ISSUER'), 'issuerSub', rx.setting('ISSUER_SUB'), 'nearDays', coalesce(nullif(rx.setting('NEAR_EXP_DAYS'), '')::int, 180),
    'hospitals', coalesce((select jsonb_agg(jsonb_build_object('code', code, 'name', name, 'full', full_name) order by sort) from rx.hospitals), '[]'::jsonb)) $f$;
-- ===================== งานบันทึกข้อมูล (เทียบฟังก์ชันใน Code.gs / Maint.gs) =====================
-- ทุกฟังก์ชันทำงานในทรานแซกชันเดียว: สำเร็จทั้งหมด หรือไม่บันทึกเลย (ไม่มีสถานะค้าง "กำลังดำเนินการ" แบบ Google Sheet)

/* ---------- ผู้ใช้ / รหัสผ่าน ---------- */
create or replace function rx.a_register(p jsonb) returns jsonb language plpgsql as $f$
declare cnt int; un text; pw text; nm text; hc text := coalesce(p->>'hospCode', '');
begin
  select t.n into cnt from rx.throttle t where key = 'REG' and expires_at > now();
  if coalesce(cnt, 0) >= 30 then perform rx.fail('มีการสมัครจำนวนมากในช่วงนี้ กรุณาลองใหม่ภายหลัง'); end if;
  un := rx.uname(p->>'username'); pw := rx.pw(p->>'password'); nm := rx.s(p->>'name', 60, true, 'ชื่อ-สกุล');
  if not exists (select 1 from rx.hospitals where code = hc) then perform rx.fail('กรุณาเลือกหน่วยบริการ'); end if;
  if exists (select 1 from rx.users where username = un) then perform rx.fail('ชื่อผู้ใช้นี้ถูกใช้แล้ว'); end if;
  insert into rx.users (username, hash, name, role, hosp_code, status) values (un, rx.hash(pw), nm, 'user', hc, 'pending');
  insert into rx.throttle (key, n, expires_at) values ('REG', 1, now() + interval '1 hour')
  on conflict (key) do update set n = case when rx.throttle.expires_at > now() then rx.throttle.n + 1 else 1 end,
    expires_at = case when rx.throttle.expires_at > now() then rx.throttle.expires_at else now() + interval '1 hour' end;
  perform rx.log(un, 'REGISTER', rx.hname(hc));
  return jsonb_build_object('message', 'ส่งใบสมัครแล้ว กรุณารอแอดมินอนุมัติบัญชี');
end $f$;

create or replace function rx.a_change_password(u rx.users, p jsonb) returns jsonb language plpgsql as $f$
declare np text := rx.pw(p->>'newPassword'); op text := coalesce(p->>'oldPassword', '');
begin
  if u.hash <> extensions.crypt(op, u.hash) then perform rx.fail('รหัสผ่านเดิมไม่ถูกต้อง'); end if;
  if np = op then perform rx.fail('รหัสผ่านใหม่ต้องไม่ซ้ำรหัสเดิม'); end if;
  update rx.users set hash = rx.hash(np), must_change = false where username = u.username;
  perform rx.log(u.username, 'CHANGE_PW', '');
  return 'true'::jsonb;
end $f$;

create or replace function rx.a_user_save(u rx.users, p jsonb) returns jsonb language plpgsql as $f$
declare un text := rx.uname(p->>'username'); nm text := rx.s(p->>'name', 60, true, 'ชื่อ-สกุล');
        rl text := case when p->>'role' = 'admin' then 'admin' else 'user' end;
        st text := case when p->>'status' in ('active', 'pending', 'disabled') then p->>'status' else 'active' end; hc text;
begin
  hc := case when rl = 'admin' then 'ADMIN' else coalesce(p->>'hospCode', '') end;
  if rl <> 'admin' and not exists (select 1 from rx.hospitals where code = hc) then perform rx.fail('กรุณาเลือกหน่วยบริการ'); end if;
  if exists (select 1 from rx.users where username = un) then
    if un = u.username and (rl <> 'admin' or st <> 'active') then perform rx.fail('ไม่สามารถลดสิทธิ์หรือระงับบัญชีของตนเองได้'); end if;
    update rx.users set name = nm, role = rl, hosp_code = hc, status = st where username = un;
    if st <> 'active' then delete from rx.sessions where username = un; end if;
    perform rx.log(u.username, 'USER_EDIT', un || ' ' || st || ' ' || rl);
  else
    insert into rx.users (username, hash, name, role, hosp_code, status, must_change) values (un, rx.hash(rx.pw(p->>'password')), nm, rl, hc, st, true);
    perform rx.log(u.username, 'USER_ADD', un);
  end if;
  return 'true'::jsonb;
end $f$;

create or replace function rx.a_user_reset_pw(u rx.users, p jsonb) returns jsonb language plpgsql as $f$
declare pw text := rx.pw(p->>'password'); un text := coalesce(p->>'username', '');
begin
  if not exists (select 1 from rx.users where username = un) then perform rx.fail('ไม่พบผู้ใช้'); end if;
  update rx.users set hash = rx.hash(pw), must_change = true where username = un;
  delete from rx.throttle where key = 'F_' || md5(un);
  delete from rx.sessions where username = un;
  perform rx.log(u.username, 'USER_RESETPW', un);
  return 'true'::jsonb;
end $f$;

/* ---------- ทะเบียนยา / รับยา / ปรับปรุง ---------- */
create or replace function rx.a_drug_save(u rx.users, p jsonb) returns jsonb language plpgsql as $f$
declare nm text := rx.s(p->>'name', 80, true, 'ชื่อเวชภัณฑ์'); un text := rx.s(p->>'unit', 20, true, 'หน่วย');
        cat text := rx.s(p->>'category', 40, false, 'หมวด'); mn int; id text := coalesce(p->>'drugId', '');
begin
  mn := rx.i(coalesce(nullif(p->>'minStock', ''), '0'), 0, 1000000, 'จุดสั่งซื้อขั้นต่ำ');
  if exists (select 1 from rx.drugs where lower(name) = lower(nm) and drug_id <> id) then perform rx.fail('มีเวชภัณฑ์ชื่อนี้อยู่แล้ว'); end if;
  if id <> '' then
    update rx.drugs set name = nm, unit = un, category = cat, min_stock = mn where drug_id = id;
    if not found then perform rx.fail('ไม่พบเวชภัณฑ์'); end if;
    perform rx.log(u.username, 'DRUG_EDIT', nm);
  else
    id := 'D' || rx.pad(rx.next_id('DRUG', 1), 4);
    insert into rx.drugs (drug_id, name, unit, category, min_stock) values (id, nm, un, cat, mn);
    perform rx.log(u.username, 'DRUG_ADD', nm);
  end if;
  return jsonb_build_object('drugId', id);
end $f$;

create or replace function rx.a_drug_toggle(u rx.users, p jsonb) returns jsonb language plpgsql as $f$
declare nm text; a boolean := coalesce((p->>'active')::boolean, false);
begin
  update rx.drugs set active = a where drug_id = coalesce(p->>'drugId', '') returning name into nm;
  if nm is null then perform rx.fail('ไม่พบเวชภัณฑ์'); end if;
  perform rx.log(u.username, 'DRUG_TOGGLE', nm || ' ' || case when a then 'Y' else 'N' end);
  return 'true'::jsonb;
end $f$;

create or replace function rx.bal(d text) returns int language sql stable as $f$
  select coalesce(sum(qty_remain), 0)::int from rx.lots where drug_id = d $f$;

create or replace function rx.a_receive(u rx.users, p jsonb) returns jsonb language plpgsql as $f$
declare lno text := rx.s(p->>'lotNo', 30, true, 'เลข LOT'); ex date := rx.dt(p->>'expDate', 'วันหมดอายุ');
        q int := rx.i(p->>'qty', 1, 10000000, 'จำนวนรับ'); pr numeric := rx.num(p->>'unitPrice', 0, 10000000, 'ราคาต่อหน่วย');
        sup text := rx.s(p->>'supplier', 80, false, 'ผู้ขาย/เลขที่ใบส่งของ'); d rx.drugs; lid text; b int; td date := rx.today();
begin
  select * into d from rx.drugs where drug_id = coalesce(p->>'drugId', '') and active;
  if d.drug_id is null then perform rx.fail('ไม่พบเวชภัณฑ์ หรือถูกปิดใช้งาน'); end if;
  if ex < td then perform rx.fail('ไม่สามารถรับเวชภัณฑ์ที่หมดอายุแล้ว'); end if;
  select lot_id into lid from rx.lots where drug_id = d.drug_id and lot_no = lno and exp_date = ex and unit_price = pr order by lot_id limit 1;
  if lid is not null then
    update rx.lots set qty_in = qty_in + q, qty_remain = qty_remain + q where lot_id = lid;
  else
    lid := 'L' || rx.pad(rx.next_id('LOT', 1), 6);
    insert into rx.lots (lot_id, drug_id, lot_no, exp_date, qty_in, qty_remain, unit_price, supplier, by_name)
    values (lid, d.drug_id, lno, ex, q, q, pr, sup, u.name);
  end if;
  b := rx.bal(d.drug_id);
  insert into rx.stock_card (date, drug_id, type, lot_no, exp_date, qty_in, qty_out, balance, ref, party, by_name)
  values (td, d.drug_id, 'รับ', lno, ex, q, 0, b, sup, 'รับเข้าคลัง', u.name);
  insert into rx.receipts (date, fy, drug_id, lot_no, exp_date, qty, unit_price, value, supplier, by_name)
  values (td, rx.fy(td), d.drug_id, lno, ex, q, pr, round(q * pr, 2), sup, u.name);
  perform rx.log(u.username, 'RECEIVE', d.name || ' lot ' || lno || ' +' || q);
  return jsonb_build_object('lotId', lid, 'balance', b);
end $f$;

create or replace function rx.a_adjust(u rx.users, p jsonb) returns jsonb language plpgsql as $f$
declare dl int := rx.i(p->>'delta', -10000000, 10000000, 'จำนวนปรับปรุง'); rs text := rx.s(p->>'reason', 120, true, 'เหตุผลการปรับปรุง'); l rx.lots; b int;
begin
  if dl = 0 then perform rx.fail('จำนวนปรับปรุงต้องไม่เป็นศูนย์'); end if;
  select * into l from rx.lots where lot_id = coalesce(p->>'lotId', '') for update;
  if l.lot_id is null then perform rx.fail('ไม่พบ LOT'); end if;
  if l.qty_remain + dl < 0 then perform rx.fail('จำนวนคงเหลือใน LOT ไม่พอให้ปรับลด'); end if;
  update rx.lots set qty_remain = qty_remain + dl, qty_in = qty_in + greatest(dl, 0) where lot_id = l.lot_id;
  b := rx.bal(l.drug_id);
  insert into rx.stock_card (date, drug_id, type, lot_no, exp_date, qty_in, qty_out, balance, ref, party, by_name)
  values (rx.today(), l.drug_id, 'ปรับปรุง', l.lot_no, l.exp_date, greatest(dl, 0), greatest(-dl, 0), b, '', rs, u.name);
  perform rx.log(u.username, 'ADJUST', l.lot_id || ' ' || dl || ' ' || rs);
  return jsonb_build_object('balance', b);
end $f$;

/* ---------- คำขอเบิก ---------- */
create or replace function rx.a_create_request(u rx.users, p jsonb) returns jsonb language plpgsql as $f$
declare nt text := rx.s(p->>'note', 200, false, 'หมายเหตุ'); it jsonb := coalesce(p->'items', '[]'::jsonb); x jsonb;
        ids text[] := '{}'; qs int[] := '{}'; k int; q int; id text; rid text; link text;
begin
  if u.role = 'admin' or u.hosp_code = 'ADMIN' then perform rx.fail('บัญชีแอดมินไม่สามารถยื่นคำขอเบิก ให้ใช้บัญชีของหน่วยบริการ'); end if;
  if jsonb_typeof(it) <> 'array' or jsonb_array_length(it) = 0 then perform rx.fail('กรุณาเลือกรายการยาอย่างน้อย 1 รายการ'); end if;
  if jsonb_array_length(it) > 60 then perform rx.fail('เลือกได้ไม่เกิน 60 รายการต่อคำขอ'); end if;
  for x in select * from jsonb_array_elements(it) loop
    q := rx.i(x->>'qty', 1, 1000000, 'จำนวนที่ขอเบิก'); id := coalesce(x->>'drugId', '');
    k := array_position(ids, id);
    if k is null then ids := ids || id; qs := qs || q; else qs[k] := qs[k] + q; end if;
  end loop;
  foreach id in array ids loop
    if not exists (select 1 from rx.drugs where drug_id = id and active) then perform rx.fail('มีรายการที่ไม่พบในทะเบียนยา หรือปิดใช้งานแล้ว'); end if;
  end loop;
  if (select count(*) from rx.requests where hosp_code = u.hosp_code and status in ('pending', 'processing')) >= 10 then
    perform rx.fail('มีคำขอที่รออนุมัติครบ 10 รายการแล้ว'); end if;
  rid := 'RQ' || rx.pad(rx.next_id('REQ', 1), 6);
  insert into rx.requests (req_id, hosp_code, created_by, note, status) values (rid, u.hosp_code, u.name, nt, 'pending');
  for k in 1..array_length(ids, 1) loop
    insert into rx.request_items (req_id, drug_id, qty_req, ord) values (rid, ids[k], qs[k], k);
  end loop;
  perform rx.log(u.username, 'REQ_CREATE', rid || ' items=' || array_length(ids, 1));
  link := rx.setting('APP_URL');
  perform rx.notify('📋 คำขอเบิกยาใหม่ ' || rid || E'\nจาก: ' || rx.hname(u.hosp_code) || E'\nรายการ: ' || array_length(ids, 1) || E' รายการ\nผู้ขอ: ' || u.name
    || case when nt <> '' then E'\nหมายเหตุ: ' || nt else '' end || case when link <> '' then E'\n' || link else '' end);
  return jsonb_build_object('reqId', rid);
end $f$;

create or replace function rx.a_cancel_request(u rx.users, p jsonb) returns jsonb language plpgsql as $f$
declare r rx.requests;
begin
  select * into r from rx.requests where req_id = coalesce(p->>'reqId', '') for update;
  if r.req_id is null then perform rx.fail('ไม่พบคำขอ'); end if;
  if r.hosp_code <> u.hosp_code then perform rx.fail('ไม่มีสิทธิ์ยกเลิกคำขอนี้'); end if;
  if r.status <> 'pending' then perform rx.fail('ยกเลิกได้เฉพาะคำขอที่รออนุมัติ'); end if;
  update rx.requests set status = 'cancelled', decided_at = now(), decided_by = u.name where req_id = r.req_id;
  perform rx.log(u.username, 'REQ_CANCEL', r.req_id);
  return 'true'::jsonb;
end $f$;

create or replace function rx.a_reject_request(u rx.users, p jsonb) returns jsonb language plpgsql as $f$
declare rs text := rx.s(p->>'reason', 200, true, 'เหตุผลที่ไม่อนุมัติ'); r rx.requests;
begin
  select * into r from rx.requests where req_id = coalesce(p->>'reqId', '') for update;
  if r.req_id is null then perform rx.fail('ไม่พบคำขอ'); end if;
  if r.status <> 'pending' then perform rx.fail('คำขอนี้ถูกดำเนินการไปแล้ว'); end if;
  update rx.requests set status = 'rejected', reason = rs, decided_at = now(), decided_by = u.name where req_id = r.req_id;
  perform rx.log(u.username, 'REQ_REJECT', r.req_id);
  return 'true'::jsonb;
end $f$;

-- อนุมัติ: ตัดสต็อกตาม FEFO (หมดอายุก่อนจ่ายก่อน ข้าม LOT ที่หมดอายุแล้ว) แล้วออกเลขที่ใบเบิก ปีงบ/ลำดับ
create or replace function rx.a_approve_request(u rx.users, p jsonb) returns jsonb language plpgsql as $f$
declare ap text := rx.s(coalesce(nullif(p->>'approver', ''), rx.setting('KEEPER')), 60, true, 'ชื่อผู้อนุมัติ');
        nt text := rx.s(p->>'note', 200, false, 'หมายเหตุ'); qm jsonb := coalesce(p->'qty', '{}'::jsonb);
        r rx.requests; ri record; l record; raw text; q int; av int; need int; t int; short text[] := '{}'; nlines int := 0;
        pids text[] := '{}'; pqs int[] := '{}'; k int; dnm text; dun text;
        td date := rx.today(); vfy int; sq int; doc text; total numeric := 0; hn text; b int;
begin
  select * into r from rx.requests where req_id = coalesce(p->>'reqId', '') for update;
  if r.req_id is null then perform rx.fail('ไม่พบคำขอ'); end if;
  if r.status <> 'pending' then perform rx.fail('คำขอนี้ถูกดำเนินการไปแล้ว'); end if;
  for ri in select i.*, coalesce(d.name, i.drug_id) dname from rx.request_items i left join rx.drugs d using (drug_id) where i.req_id = r.req_id order by i.ord loop
    raw := case when qm ? ri.drug_id then qm->>ri.drug_id else ri.qty_req::text end;
    q := null;
    if raw is not null and btrim(raw) ~ '^\d+(\.0+)?$' then q := btrim(raw)::numeric::int; end if;
    if q is null or q < 0 or q > ri.qty_req then perform rx.fail('จำนวนอนุมัติของ "' || ri.dname || '" ต้องเป็นจำนวนเต็ม 0–' || ri.qty_req); end if;
    select coalesce(sum(qty_remain), 0) into av from rx.lots where drug_id = ri.drug_id and qty_remain > 0 and exp_date >= td;
    if q > av then short := short || ri.dname::text; end if;
    if q > 0 then nlines := nlines + 1; end if;
    pids := pids || ri.drug_id; pqs := pqs || q;
  end loop;
  if array_length(short, 1) > 0 then perform rx.fail('สต็อกที่ใช้ได้ไม่พอ: ' || array_to_string(short, ', ')); end if;
  if nlines = 0 then perform rx.fail('ไม่มีรายการที่อนุมัติ หากไม่อนุมัติให้ใช้ปุ่ม "ไม่อนุมัติ"'); end if;

  vfy := rx.fy(td); sq := rx.next_id('DOC' || vfy, 1); doc := vfy || '/' || rx.pad(sq, 3); hn := rx.hname(r.hosp_code);
  insert into rx.issues (doc_no, fy, seq, req_id, hosp_code, issue_date, item_count, total_value, note, approver)
  values (doc, vfy, sq, r.req_id, r.hosp_code, td, nlines, 0, coalesce(nullif(nt, ''), r.note), ap);
  for k in 1..array_length(pids, 1) loop
    update rx.request_items set qty_approved = pqs[k] where req_id = r.req_id and drug_id = pids[k];
    continue when pqs[k] = 0;
    select name, unit into dnm, dun from rx.drugs where drug_id = pids[k];
    need := pqs[k];
    for l in select * from rx.lots where drug_id = pids[k] and qty_remain > 0 and exp_date >= td order by exp_date, received_at, lot_id for update loop
      exit when need <= 0;
      t := least(need, l.qty_remain); need := need - t;
      update rx.lots set qty_remain = qty_remain - t where lot_id = l.lot_id;
      b := rx.bal(pids[k]);
      insert into rx.stock_card (date, drug_id, type, lot_no, exp_date, qty_in, qty_out, balance, ref, party, by_name)
      values (td, pids[k], 'จ่าย', l.lot_no, l.exp_date, 0, t, b, doc, hn, u.name);
      insert into rx.issue_items (doc_no, drug_id, drug_name, unit, lot_no, exp_date, qty, unit_price, value)
      values (doc, pids[k], dnm, dun, l.lot_no, l.exp_date, t, l.unit_price, round(t * l.unit_price, 2));
      total := total + round(t * l.unit_price, 2);
    end loop;
    if need > 0 then perform rx.fail('สต็อกที่ใช้ได้ไม่พอ: ' || dnm); end if;
  end loop;
  update rx.issues set total_value = total where doc_no = doc;
  update rx.requests set status = 'approved', doc_no = doc, decided_at = now(), decided_by = u.name where req_id = r.req_id;
  perform rx.log(u.username, 'REQ_APPROVE', r.req_id || ' -> ' || doc);
  return jsonb_build_object('docNo', doc);
end $f$;

-- ยกเลิกใบเบิก: รับยาคืนเข้า LOT เดิม บันทึก Stock Card "รับคืน" คำขอที่เกี่ยวข้องเป็น "ยกเลิก"
create or replace function rx.a_issue_cancel(u rx.users, p jsonb) returns jsonb language plpgsql as $f$
declare rs text := rx.s(p->>'reason', 200, true, 'เหตุผลการยกเลิกใบเบิก'); i rx.issues; x record; lid text; lex date; b int;
        expired jsonb := '[]'::jsonb; td date := rx.today(); hn text;
begin
  select * into i from rx.issues where doc_no = coalesce(p->>'docNo', '') for update;
  if i.doc_no is null then perform rx.fail('ไม่พบใบเบิก'); end if;
  if i.status = 'cancelled' then perform rx.fail('ใบเบิกนี้ถูกยกเลิกไปแล้ว'); end if;
  if not exists (select 1 from rx.issue_items where doc_no = i.doc_no) then perform rx.fail('ไม่พบรายการยาในใบเบิกนี้'); end if;
  hn := rx.hname(i.hosp_code);
  for x in select * from rx.issue_items where doc_no = i.doc_no order by id loop
    select lot_id, exp_date into lid, lex from rx.lots where drug_id = x.drug_id and lot_no = x.lot_no and exp_date = x.exp_date
      order by (unit_price = x.unit_price) desc, lot_id limit 1;
    if lid is null then perform rx.fail('ไม่พบ LOT ' || x.lot_no || ' ของ ' || x.drug_name || ' ในคลัง จึงรับคืนอัตโนมัติไม่ได้'); end if;
    update rx.lots set qty_remain = qty_remain + x.qty where lot_id = lid;
    if lex < td then expired := expired || to_jsonb(x.drug_name || ' LOT ' || x.lot_no); end if;
    b := rx.bal(x.drug_id);
    insert into rx.stock_card (date, drug_id, type, lot_no, exp_date, qty_in, qty_out, balance, ref, party, by_name)
    values (td, x.drug_id, 'รับคืน', x.lot_no, x.exp_date, x.qty, 0, b, i.doc_no, hn || ' (ยกเลิกใบเบิก)', u.name);
  end loop;
  update rx.issues set status = 'cancelled', cancel_reason = rs, cancel_by = u.name, cancel_at = now() where doc_no = i.doc_no;
  update rx.requests set status = 'cancelled', reason = left('ยกเลิกใบเบิก ' || i.doc_no || ': ' || rs, 250)
  where req_id = i.req_id and status = 'approved';
  perform rx.log(u.username, 'ISSUE_CANCEL', i.doc_no || ' ' || rs);
  return jsonb_build_object('expired', expired);
end $f$;

/* ---------- ยืม-คืนยาระหว่างหน่วยบริการ ---------- */
create or replace function rx.loan_role(u rx.users, l rx.loans) returns text language sql immutable as $f$
  select case when u.role = 'admin' then 'admin' when u.hosp_code = l.lender then 'lender' when u.hosp_code = l.borrower then 'borrower' else null end $f$;

create or replace function rx.loan_get(u rx.users, id text) returns rx.loans language plpgsql as $f$
declare l rx.loans;
begin
  select * into l from rx.loans where loan_id = coalesce(id, '') for update;
  if l.loan_id is null then perform rx.fail('ไม่พบรายการยืม'); end if;
  if rx.loan_role(u, l) is null then perform rx.fail('ไม่มีสิทธิ์ดูรายการนี้'); end if;
  return l;
end $f$;

create or replace function rx.a_loan_create(u rx.users, p jsonb) returns jsonb language plpgsql as $f$
declare ld text := coalesce(p->>'lender', ''); nt text := rx.s(p->>'note', 200, false, 'หมายเหตุ'); it jsonb := coalesce(p->'items', '[]'::jsonb);
        x jsonb; nm text; un text; q int; kk text; keys text[] := '{}'; nms text[] := '{}'; uns text[] := '{}'; qs int[] := '{}'; k int;
        td date := rx.today(); due date; id text;
begin
  if u.role = 'admin' or u.hosp_code = 'ADMIN' then perform rx.fail('บัญชีแอดมินไม่สามารถยื่นขอยืมยา ให้ใช้บัญชีของหน่วยบริการ'); end if;
  if not exists (select 1 from rx.hospitals where code = ld) or ld = u.hosp_code then
    perform rx.fail('กรุณาเลือกหน่วยบริการที่ต้องการยืมจาก (ต้องไม่ใช่หน่วยของตนเอง)'); end if;
  if jsonb_typeof(it) <> 'array' or jsonb_array_length(it) = 0 then perform rx.fail('กรุณากรอกรายการยาอย่างน้อย 1 รายการ'); end if;
  if jsonb_array_length(it) > 30 then perform rx.fail('ยืมได้ไม่เกิน 30 รายการต่อครั้ง'); end if;
  for x in select * from jsonb_array_elements(it) loop
    nm := rx.s(x->>'name', 80, true, 'ชื่อยา'); un := rx.s(x->>'unit', 20, true, 'หน่วย (เช่น เม็ด กล่อง ขวด)');
    q := rx.i(x->>'qty', 1, 1000000, 'จำนวนที่ขอยืม'); kk := lower(nm) || '|' || lower(un); k := array_position(keys, kk);
    if k is null then keys := keys || kk; nms := nms || nm; uns := uns || un; qs := qs || q; else qs[k] := qs[k] + q; end if;
  end loop;
  due := case when coalesce(p->>'dueDate', '') <> '' then rx.dt(p->>'dueDate', 'กำหนดคืน') else td + 30 end;
  if due < td then perform rx.fail('กำหนดคืนต้องไม่ใช่วันที่ผ่านมาแล้ว'); end if;
  if due > td + 365 then perform rx.fail('กำหนดคืนต้องไม่เกิน 1 ปี'); end if;
  if (select count(*) from rx.loans where borrower = u.hosp_code and status = 'requested') >= 20 then
    perform rx.fail('มีคำขอยืมที่รอพิจารณาครบ 20 รายการแล้ว'); end if;
  id := 'LN' || rx.pad(rx.next_id('LOAN', 1), 6);
  insert into rx.loans (loan_id, lender, borrower, due_date, status, note, created_by) values (id, ld, u.hosp_code, due, 'requested', nt, u.name);
  for k in 1..array_length(keys, 1) loop
    insert into rx.loan_lines (loan_id, line_no, name, unit, qty_req) values (id, k, nms[k], uns[k], qs[k]);
  end loop;
  perform rx.log(u.username, 'LOAN_CREATE', id || ' ' || u.hosp_code || '<-' || ld);
  return jsonb_build_object('loanId', id);
end $f$;

create or replace function rx.a_loan_decide(u rx.users, p jsonb) returns jsonb language plpgsql as $f$
declare l rx.loans := rx.loan_get(u, p->>'loanId'); ln rx.loan_lines; x jsonb; v text; anyl boolean := false; due date;
begin
  if rx.loan_role(u, l) = 'borrower' then perform rx.fail('เฉพาะผู้ให้ยืมเท่านั้นที่พิจารณาได้'); end if;
  if l.status <> 'requested' then perform rx.fail('รายการนี้ถูกดำเนินการไปแล้ว'); end if;
  if not coalesce((p->>'approve')::boolean, false) then
    update rx.loans set reason = rx.s(p->>'reason', 200, true, 'เหตุผลที่ไม่อนุมัติ'), status = 'rejected', decided_at = now(), decided_by = u.name where loan_id = l.loan_id;
    perform rx.log(u.username, 'LOAN_REJECT', l.loan_id);
    return 'true'::jsonb;
  end if;
  for ln in select * from rx.loan_lines where loan_id = l.loan_id order by line_no loop
    select value into x from jsonb_array_elements(coalesce(p->'items', '[]'::jsonb)) where value->>'lineNo' = ln.line_no::text limit 1;
    v := case when x is null then ln.qty_req::text else x->>'qty' end;
    ln.qty_lent := rx.i(v, 0, ln.qty_req, 'จำนวนที่ให้ยืม');
    if ln.qty_lent > 0 then anyl := true; end if;
    update rx.loan_lines set qty_lent = ln.qty_lent where loan_id = ln.loan_id and line_no = ln.line_no;
  end loop;
  if not anyl then perform rx.fail('ไม่มีรายการที่ให้ยืม หากไม่ให้ยืมให้ใช้ปุ่ม "ไม่อนุมัติ"'); end if;
  due := case when coalesce(p->>'dueDate', '') <> '' then rx.dt(p->>'dueDate', 'กำหนดคืน') else l.due_date end;
  if due < rx.today() then perform rx.fail('กำหนดคืนต้องไม่ใช่วันที่ผ่านมาแล้ว'); end if;
  update rx.loans set due_date = due, status = 'active', decided_at = now(), decided_by = u.name where loan_id = l.loan_id;
  perform rx.log(u.username, 'LOAN_APPROVE', l.loan_id);
  return 'true'::jsonb;
end $f$;

create or replace function rx.a_loan_cancel(u rx.users, p jsonb) returns jsonb language plpgsql as $f$
declare l rx.loans := rx.loan_get(u, p->>'loanId');
begin
  if rx.loan_role(u, l) = 'lender' then perform rx.fail('เฉพาะผู้ยืมเท่านั้นที่ยกเลิกได้'); end if;
  if l.status <> 'requested' then perform rx.fail('ยกเลิกได้เฉพาะคำขอที่ผู้ให้ยืมยังไม่พิจารณา'); end if;
  update rx.loans set status = 'cancelled', reason = rx.s(p->>'reason', 200, false, 'เหตุผล'), closed_at = now() where loan_id = l.loan_id;
  perform rx.log(u.username, 'LOAN_CANCEL', l.loan_id);
  return 'true'::jsonb;
end $f$;

create or replace function rx.a_loan_return(u rx.users, p jsonb) returns jsonb language plpgsql as $f$
declare nt text := rx.s(p->>'note', 200, false, 'หมายเหตุ'); l rx.loans := rx.loan_get(u, p->>'loanId'); ln rx.loan_lines; x jsonb; v text;
        q int; rid text; n int := 0; closed boolean;
begin
  if rx.loan_role(u, l) = 'lender' then perform rx.fail('เฉพาะผู้ยืมเท่านั้นที่บันทึกการคืนได้'); end if;
  if l.status <> 'active' then perform rx.fail('รายการนี้ไม่อยู่ในสถานะที่คืนยาได้'); end if;
  rid := 'RT' || rx.pad(rx.next_id('RET', 1), 6);
  insert into rx.loan_returns (ret_id, loan_id, created_by, note) values (rid, l.loan_id, u.name, nt);
  for ln in select * from rx.loan_lines where loan_id = l.loan_id and qty_lent > qty_returned order by line_no loop
    x := null;
    select value into x from jsonb_array_elements(coalesce(p->'items', '[]'::jsonb)) where value->>'lineNo' = ln.line_no::text limit 1;
    v := case when x is null or coalesce(x->>'qty', '') = '' then '0' else x->>'qty' end;
    q := rx.i(v, 0, ln.qty_lent - ln.qty_returned, 'จำนวนที่คืน');
    if q > 0 then
      n := n + 1;
      insert into rx.loan_return_lines (ret_id, line_no, name, unit, qty) values (rid, ln.line_no, ln.name, ln.unit, q);
      update rx.loan_lines set qty_returned = qty_returned + q where loan_id = ln.loan_id and line_no = ln.line_no;
    end if;
  end loop;
  if n = 0 then perform rx.fail('กรุณาระบุจำนวนที่คืนอย่างน้อย 1 รายการ'); end if;
  closed := not exists (select 1 from rx.loan_lines where loan_id = l.loan_id and qty_returned < qty_lent);
  if closed then update rx.loans set status = 'returned', closed_at = now() where loan_id = l.loan_id; end if;
  perform rx.log(u.username, 'LOAN_RETURN', l.loan_id || ' ' || rid || case when closed then ' closed' else '' end);
  return jsonb_build_object('retId', rid, 'closed', closed);
end $f$;

create or replace function rx.a_loan_close(u rx.users, p jsonb) returns jsonb language plpgsql as $f$
declare rs text := rx.s(p->>'reason', 200, true, 'เหตุผลการปิดรายการ'); l rx.loans;
begin
  select * into l from rx.loans where loan_id = coalesce(p->>'loanId', '') for update;
  if l.loan_id is null then perform rx.fail('ไม่พบรายการยืม'); end if;
  if l.status not in ('requested', 'active') then perform rx.fail('รายการนี้ปิดไปแล้ว'); end if;
  update rx.loans set status = 'closed', reason = rs, closed_at = now() where loan_id = l.loan_id;
  perform rx.log(u.username, 'LOAN_CLOSE', l.loan_id || ' ' || rs);
  return 'true'::jsonb;
end $f$;

/* ---------- บันทึกความคลาดเคลื่อนทางยา (ME) ---------- */
create or replace function rx.a_me_create(u rx.users, p jsonb) returns jsonb language plpgsql as $f$
declare dd date; ty text := coalesce(p->>'errType', ''); kd text := coalesce(p->>'errKind', ''); sv text := upper(coalesce(p->>'severity', ''));
        dr text; pr text; vhn text; dt text; ac text; id text; link text;
        tn jsonb := '{"presc":"Prescribing error","trans":"Transcribing error","pre":"Pre-dispensing error","disp":"Dispensing error","admin":"Administration error"}';
begin
  if u.role = 'admin' or u.hosp_code = 'ADMIN' then perform rx.fail('บัญชีแอดมินไม่สามารถบันทึก ME ให้ใช้บัญชีของหน่วยบริการ'); end if;
  dd := rx.dt(p->>'date', 'วันที่เกิดเหตุ');
  if dd > rx.today() then perform rx.fail('วันที่เกิดเหตุต้องไม่เกินวันนี้'); end if;
  if dd < rx.today() - 400 then perform rx.fail('วันที่เกิดเหตุย้อนหลังเกินกำหนด'); end if;
  if not tn ? ty then perform rx.fail('กรุณาเลือกประเภทความคลาดเคลื่อน'); end if;
  if not exists (select 1 from rx.me_kinds where err_type = ty and kind = kd) then perform rx.fail('กรุณาเลือกชนิดความคลาดเคลื่อนให้ตรงกับประเภท'); end if;
  if sv !~ '^[A-I]$' then perform rx.fail('กรุณาเลือกระดับความรุนแรง (A-I)'); end if;
  dr := rx.s(p->>'drugName', 120, true, 'ชื่อยา'); pr := rx.s(p->>'drugPair', 120, false, 'ยาคู่ที่เกิดความคลาดเคลื่อน');
  vhn := rx.s(p->>'hn', 15, true, 'HN');
  if vhn !~ '^[A-Za-z0-9/-]+$' then perform rx.fail('HN ใช้ได้เฉพาะตัวอักษรอังกฤษ ตัวเลข - และ /'); end if;
  dt := rx.s(p->>'detail', 500, true, 'รายละเอียดเหตุการณ์'); ac := rx.s(p->>'action', 300, false, 'การแก้ไข/ป้องกัน');
  if exists (select 1 from rx.med_errors where status = 'active' and hosp_code = u.hosp_code and date = dd and err_type = ty and err_kind = kd
             and lower(rx.med_errors.hn) = lower(vhn) and lower(drug_name) = lower(dr)) then
    perform rx.fail('มีรายการ ME นี้ (วันที่ HN ยา ประเภท ชนิดเดียวกัน) บันทึกไว้แล้ว'); end if;
  id := 'ME' || rx.pad(rx.next_id('ME', 1), 6);
  insert into rx.med_errors (me_id, date, fy, hosp_code, err_type, severity, drug_name, drug_pair, hn, detail, err_kind, action, reporter)
  values (id, dd, rx.fy(dd), u.hosp_code, ty, sv, dr, pr, vhn, dt, kd, ac, u.name);
  perform rx.log(u.username, 'ME_CREATE', id || ' ' || ty || ' ' || sv);  -- ไม่เก็บ HN ใน Logs
  if sv in ('E', 'F', 'G', 'H', 'I') then  -- ระดับ E-I แจ้งแอดมินทาง LINE (ไม่ส่ง HN/ชื่อผู้ป่วย)
    link := rx.setting('APP_URL');
    perform rx.notify('⚠️ รายงาน ME ระดับ ' || sv || ' ' || id || E'\nหน่วย: ' || rx.hname(u.hosp_code) || E'\nประเภท: ' || (tn->>ty) || ' / ' || kd
      || E'\nวันที่เกิดเหตุ: ' || rx.thd(dd) || E'\nผู้รายงาน: ' || u.name || case when link <> '' then E'\n' || link else '' end);
  end if;
  return jsonb_build_object('meId', id);
end $f$;

create or replace function rx.a_me_void(u rx.users, p jsonb) returns jsonb language plpgsql as $f$
declare rs text := rx.s(p->>'reason', 200, true, 'เหตุผลการยกเลิก'); r rx.med_errors;
begin
  select * into r from rx.med_errors where me_id = coalesce(p->>'meId', '') for update;
  if r.me_id is null then perform rx.fail('ไม่พบรายการ ME'); end if;
  if r.status <> 'active' then perform rx.fail('รายการนี้ถูกยกเลิกไปแล้ว'); end if;
  if not (u.role = 'admin' or (r.hosp_code = u.hosp_code and now() - r.created_at <= interval '7 days')) then
    perform rx.fail('ไม่มีสิทธิ์ยกเลิกรายการนี้ (หน่วยบริการยกเลิกได้ภายใน 7 วันหลังบันทึก)'); end if;
  update rx.med_errors set status = 'cancelled', void_reason = rs, void_by = u.name, void_at = now() where me_id = r.me_id;
  perform rx.log(u.username, 'ME_VOID', r.me_id);
  return 'true'::jsonb;
end $f$;
-- ===================== API dispatcher (เทียบ api(token, action, payload) ใน Code.gs) =====================
create or replace function rx.a_logout(t text) returns jsonb language plpgsql as $f$
begin delete from rx.sessions where token = t; return 'true'::jsonb; end $f$;

-- หน้าเว็บเรียกผ่าน supabase.rpc('api', { p_token, p_action, p_payload }) เท่านั้น
create or replace function public.api(p_token text, p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = rx, public, extensions as $f$
declare u rx.users; p jsonb := coalesce(p_payload, '{}'::jsonb); a text := coalesce(p_action, ''); r jsonb;
        adm_only text[] := array['approveRequest','rejectRequest','issueCancel','drugSave','drugToggle','receive','adjust','loanClose','userSave','userResetPw'];
        m text; st text;
begin
  if a = 'login' then return rx.do_login(p); end if;
  begin
    if a not in ('meta', 'register') then
      u := rx.auth(p_token);
      if a = any(adm_only) and u.role <> 'admin' then perform rx.fail('ไม่มีสิทธิ์ใช้งานส่วนนี้'); end if;
    end if;
    if a not in ('meta', 'load', 'me') then perform pg_advisory_xact_lock(7710); end if;  -- ทีละคำสั่ง เหมือน LockService
    r := case a
      when 'meta' then rx.meta()
      when 'register' then rx.a_register(p)
      when 'me' then rx.pub_user(u)
      when 'logout' then rx.a_logout(p_token)
      when 'load' then rx.load(u, p)
      when 'changePassword' then rx.a_change_password(u, p)
      when 'createRequest' then rx.a_create_request(u, p)
      when 'cancelRequest' then rx.a_cancel_request(u, p)
      when 'approveRequest' then rx.a_approve_request(u, p)
      when 'rejectRequest' then rx.a_reject_request(u, p)
      when 'issueCancel' then rx.a_issue_cancel(u, p)
      when 'drugSave' then rx.a_drug_save(u, p)
      when 'drugToggle' then rx.a_drug_toggle(u, p)
      when 'receive' then rx.a_receive(u, p)
      when 'adjust' then rx.a_adjust(u, p)
      when 'loanCreate' then rx.a_loan_create(u, p)
      when 'loanDecide' then rx.a_loan_decide(u, p)
      when 'loanCancel' then rx.a_loan_cancel(u, p)
      when 'loanReturn' then rx.a_loan_return(u, p)
      when 'loanClose' then rx.a_loan_close(u, p)
      when 'userSave' then rx.a_user_save(u, p)
      when 'userResetPw' then rx.a_user_reset_pw(u, p)
      when 'meCreate' then rx.a_me_create(u, p)
      when 'meVoid' then rx.a_me_void(u, p)
      else null end;
    if r is null then perform rx.fail('ไม่พบคำสั่งที่ร้องขอ'); end if;
    return jsonb_build_object('ok', true, 'data', r);
  exception
    when sqlstate 'RX001' then return jsonb_build_object('ok', false, 'error', sqlerrm);
    when sqlstate 'RX002' then return jsonb_build_object('ok', false, 'error', sqlerrm, 'auth', true);
    when others then
      get stacked diagnostics m = message_text, st = returned_sqlstate;
      perform rx.log(coalesce(u.username, '-'), 'ERROR', a || ': ' || st || ' ' || m);
      return jsonb_build_object('ok', false, 'error', 'เกิดข้อผิดพลาดของระบบ กรุณาลองใหม่อีกครั้ง หากยังเกิดซ้ำให้แจ้งแอดมิน');
  end;
end $f$;

revoke all on function public.api(text, text, jsonb) from public;
grant execute on function public.api(text, text, jsonb) to anon, authenticated;

-- pg_net สำหรับส่งแจ้งเตือน LINE (ถ้าเปิดใช้ไม่ได้ ระบบยังทำงานปกติ เพียงไม่ส่งแจ้งเตือน)
begin
  execute 'create extension if not exists pg_net';
exception when others then null;
end;
end
$install$;

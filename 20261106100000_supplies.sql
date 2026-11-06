-- เพิ่มโมดูลวัสดุ (ทะเบียนคุมวัสดุ) — รันต่อจาก 20261106000000_init.sql
-- เขียนเป็นคำสั่งเดียว (DO block) รันซ้ำได้ไม่เสียหาย

do $mig$
begin
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'drugs' and column_name = 'item_type') then
    alter table public.drugs add column item_type text not null default 'drug'
      check (item_type in ('drug', 'supply'));
    create index drugs_item_type on public.drugs (item_type);
  end if;

  create or replace view public.v_stock with (security_invoker = true) as
  select f.id as facility_id, f.name as facility_name,
         d.id as drug_id, d.code, d.name as drug_name, d.strength, d.unit, d.category, d.unit_price,
         coalesce(l.total_qty, 0)    as total_qty,
         coalesce(l.expired_qty, 0)  as expired_qty,
         coalesce(l.near_exp_qty, 0) as near_exp_qty,
         l.nearest_exp,
         coalesce(u.used_90d, 0) / 3.0 as avg_monthly_use,
         coalesce(sl.min_qty, 0) as min_qty, sl.max_qty,
         d.item_type,
         coalesce(l.stock_value, 0) as stock_value
  from public.facilities f
  cross join public.drugs d
  left join lateral (
    select sum(qty) as total_qty,
           sum(case when exp_date < current_date then qty end) as expired_qty,
           sum(case when exp_date >= current_date and exp_date < current_date + 90 then qty end) as near_exp_qty,
           min(case when qty > 0 then exp_date end) as nearest_exp,
           sum(qty * coalesce(lots.unit_cost, d.unit_price)) as stock_value
    from public.lots where facility_id = f.id and drug_id = d.id
  ) l on true
  left join lateral (
    select -sum(qty) as used_90d from public.stock_tx
    where facility_id = f.id and drug_id = d.id and tx_type = 'dispense' and tx_date >= current_date - 90
  ) u on true
  left join public.stock_levels sl on sl.facility_id = f.id and sl.drug_id = d.id
  where f.active and d.active and public.can_access(f.id);

  grant select on public.v_stock to authenticated;
end
$mig$;

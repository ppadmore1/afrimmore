create or replace function public.get_branch_portal(p_branch_id uuid, p_date date)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare r jsonb; d0 timestamptz := p_date::timestamptz; d1 timestamptz := (p_date+1)::timestamptz;
begin
  if auth.uid() is null or not public.can_access_branch(auth.uid(), p_branch_id) then
    raise exception 'Not allowed to view this branch';
  end if;
  select jsonb_build_object(
    'sales', (select jsonb_build_object('count',count(*),'total',coalesce(sum(total),0),
        'cash',coalesce(sum(total) filter (where payment_method='cash'),0),
        'card',coalesce(sum(total) filter (where payment_method='card'),0),
        'mobile_money',coalesce(sum(total) filter (where payment_method='mobile_money'),0),
        'bank_transfer',coalesce(sum(total) filter (where payment_method='bank_transfer'),0))
      from pos_sales where branch_id=p_branch_id and created_at>=d0 and created_at<d1 and status is distinct from 'cancelled'),
    'top_products', (select coalesce(jsonb_agg(t),'[]') from (select i.product_name name, sum(i.quantity) qty, sum(i.total) total
      from pos_sale_items i join pos_sales s on s.id=i.sale_id where s.branch_id=p_branch_id and s.created_at>=d0 and s.created_at<d1
      group by 1 order by 3 desc limit 10) t),
    'stock', (select coalesce(jsonb_agg(t order by t.name),'[]') from (select p.name, p.sku, coalesce(pb.stock_quantity,0) stock, p.low_stock_threshold min_level
      from products p left join product_branches pb on pb.product_id=p.id and pb.branch_id=p_branch_id
      where p.tenant_id = public.get_user_tenant_id(auth.uid())) t),
    'shifts', (select coalesce(jsonb_agg(t order by t.opened_at desc),'[]') from (select sh.opened_at, sh.closed_at, sh.status, sh.total_sales, sh.expected_cash,
        sh.counted_usd, sh.counted_lrd, sh.counted_mobile_money, sh.cash_difference, sh.mobile_money_difference,
        coalesce(pr.full_name, pr.email) cashier
      from pos_shifts sh left join profiles pr on pr.id=sh.user_id
      where sh.branch_id=p_branch_id and sh.opened_at >= d0 - interval '30 days' and sh.opened_at<d1 limit 100) t)
  ) into r;
  return r;
end $$;
revoke all on function public.get_branch_portal(uuid,date) from public, anon;
grant execute on function public.get_branch_portal(uuid,date) to authenticated;
CREATE OR REPLACE FUNCTION public.set_tenant_id_default() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tenant_id IS NULL AND auth.uid() IS NOT NULL THEN
    NEW.tenant_id := public.get_user_tenant_id(auth.uid());
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE t text; v_tenant uuid; v_plan uuid;
BEGIN
  SELECT id INTO v_plan FROM subscription_plans ORDER BY price_monthly DESC NULLS LAST LIMIT 1;
  INSERT INTO tenants (name, slug, owner_id, is_active, plan, max_users, max_branches)
  VALUES ('Afrimore Group', 'afrimore', '8a8521db-bd8b-493f-a4cc-5936a01795e8', true, 'enterprise', 100, 50)
  RETURNING id INTO v_tenant;
  IF v_plan IS NOT NULL THEN
    INSERT INTO tenant_subscriptions (tenant_id, plan_id, status) VALUES (v_tenant, v_plan, 'active');
  END IF;
  INSERT INTO tenant_users (tenant_id, user_id, role, is_owner)
  SELECT v_tenant, u.id, CASE WHEN u.id = '8a8521db-bd8b-493f-a4cc-5936a01795e8' THEN 'owner' ELSE 'member' END,
         u.id = '8a8521db-bd8b-493f-a4cc-5936a01795e8'
  FROM auth.users u WHERE NOT EXISTS (SELECT 1 FROM tenant_users x WHERE x.user_id = u.id);

  FOR t IN SELECT table_name FROM information_schema.columns
    WHERE table_schema='public' AND column_name='tenant_id'
      AND table_name NOT IN ('tenant_users','tenant_subscriptions','online_orders','online_order_items')
      AND table_name IN (SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE')
  LOOP
    EXECUTE format('UPDATE public.%I SET tenant_id = %L WHERE tenant_id IS NULL', t, v_tenant);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_tenant_id ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_set_tenant_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_default()', t);
  END LOOP;
END $$;
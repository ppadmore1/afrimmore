ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS purchase_cost numeric(12,2),
  ADD COLUMN IF NOT EXISTS freight_cost numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS customs_cost numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS local_transport_cost numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS min_selling_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS lead_time_days integer,
  ADD COLUMN IF NOT EXISTS safety_stock_days integer,
  ADD COLUMN IF NOT EXISTS is_service boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.products.purchase_cost IS 'Supplier price per unit before landed charges; cost_price = purchase + freight + customs + local transport';
COMMENT ON COLUMN public.products.min_selling_price IS 'Floor price: POS rejects lower effective prices unless a manager PIN override exists';

ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS lead_time_days integer;
ALTER TABLE public.product_suppliers
  ADD COLUMN IF NOT EXISTS min_order_qty integer,
  ADD COLUMN IF NOT EXISTS carton_qty integer;

-- Keep landed cost in sync when a breakdown is given
CREATE OR REPLACE FUNCTION public.compute_landed_cost()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.purchase_cost IS NOT NULL THEN
    NEW.cost_price := round(NEW.purchase_cost + coalesce(NEW.freight_cost,0) + coalesce(NEW.customs_cost,0) + coalesce(NEW.local_transport_cost,0), 2);
  END IF;
  IF NEW.min_selling_price IS NOT NULL AND NEW.min_selling_price > NEW.unit_price THEN
    RAISE EXCEPTION 'Minimum selling price (%) cannot be higher than the selling price (%)', NEW.min_selling_price, NEW.unit_price;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_compute_landed_cost ON public.products;
CREATE TRIGGER trg_compute_landed_cost BEFORE INSERT OR UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.compute_landed_cost();

-- Manager authorises a below-floor price with their PIN (server-side record)
CREATE OR REPLACE FUNCTION public.authorize_price_override(p_pin text, p_product_id uuid, p_price numeric)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_mgr record; v_recent int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Please sign in'; END IF;
  SELECT count(*) INTO v_recent FROM pin_attempt_log WHERE attempted_at > now() - interval '1 minute';
  IF v_recent >= 5 THEN RAISE EXCEPTION 'Too many PIN attempts. Please wait a moment.'; END IF;
  INSERT INTO pin_attempt_log (ip_hint) VALUES ('auth:' || auth.uid()::text);
  SELECT p.id, p.full_name INTO v_mgr FROM profiles p JOIN user_roles ur ON ur.user_id = p.id
   WHERE ur.role IN ('admin','owner','branch_manager') AND p.manager_pin IS NOT NULL
     AND p.manager_pin = extensions.crypt(p_pin, p.manager_pin)
     AND p.tenant_id IS NOT DISTINCT FROM get_user_tenant_id(auth.uid())
   LIMIT 1;
  IF v_mgr.id IS NULL THEN RAISE EXCEPTION 'Wrong manager PIN'; END IF;
  INSERT INTO manager_overrides (manager_id, action_type, reason, metadata)
  VALUES (v_mgr.id, 'below_min_price', 'Sell below minimum price',
          jsonb_build_object('cashier_id', auth.uid(), 'product_id', p_product_id, 'price', p_price));
  RETURN coalesce(v_mgr.full_name, 'Manager');
END $$;
REVOKE EXECUTE ON FUNCTION public.authorize_price_override(text, uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.authorize_price_override(text, uuid, numeric) TO authenticated;

-- Enforce the floor on every POS line
CREATE OR REPLACE FUNCTION public.enforce_min_selling_price()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_floor numeric; v_eff numeric; v_ok boolean;
BEGIN
  SELECT min_selling_price INTO v_floor FROM products WHERE id = NEW.product_id;
  IF v_floor IS NULL OR v_floor <= 0 THEN RETURN NEW; END IF;
  v_eff := NEW.unit_price * (1 - coalesce(NEW.discount,0) / 100);
  IF v_eff + 0.005 >= v_floor THEN RETURN NEW; END IF;
  IF auth.uid() IS NOT NULL AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'owner') OR has_role(auth.uid(),'branch_manager')) THEN RETURN NEW; END IF;
  SELECT EXISTS (SELECT 1 FROM manager_overrides
    WHERE action_type = 'below_min_price' AND created_at > now() - interval '30 minutes'
      AND metadata->>'cashier_id' = auth.uid()::text AND metadata->>'product_id' = NEW.product_id::text
      AND (metadata->>'price')::numeric <= v_eff + 0.005) INTO v_ok;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'Price for this item is below its minimum selling price (%). Manager PIN required.', v_floor;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_enforce_min_selling_price ON public.pos_sale_items;
CREATE TRIGGER trg_enforce_min_selling_price BEFORE INSERT ON public.pos_sale_items
FOR EACH ROW EXECUTE FUNCTION public.enforce_min_selling_price();
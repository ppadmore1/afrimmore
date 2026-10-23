CREATE TABLE public.online_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  order_number text NOT NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_email text,
  fulfillment_type text NOT NULL DEFAULT 'pickup' CHECK (fulfillment_type IN ('pickup','delivery')),
  delivery_address text,
  notes text,
  currency text NOT NULL DEFAULT 'USD',
  total_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','packed','out_for_delivery','ready_for_pickup','delivered','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.online_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.online_orders(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric NOT NULL,
  total numeric NOT NULL
);
GRANT SELECT, UPDATE ON public.online_orders TO authenticated;
GRANT SELECT ON public.online_order_items TO authenticated;
GRANT ALL ON public.online_orders, public.online_order_items TO service_role;
ALTER TABLE public.online_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.online_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant staff view orders" ON public.online_orders FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant staff update orders" ON public.online_orders FOR UPDATE TO authenticated USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND NOT public.has_role(auth.uid(),'cashier'));
CREATE POLICY "Tenant staff view order items" ON public.online_order_items FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant_id(auth.uid()));

-- Public catalog: only safe fields, only active products of an active tenant
CREATE OR REPLACE FUNCTION public.get_shop_catalog(p_slug text)
RETURNS TABLE(tenant_id uuid, tenant_name text, logo_url text, product_id uuid, name text, description text, unit_price numeric, image_url text, unit text, in_stock integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.name, t.logo_url, p.id, p.name, p.description, p.unit_price, p.image_url, p.unit, GREATEST(p.stock_quantity,0)
  FROM tenants t JOIN products p ON p.tenant_id = t.id
  WHERE t.slug = p_slug AND t.is_active AND p.is_active
  ORDER BY p.name
$$;
GRANT EXECUTE ON FUNCTION public.get_shop_catalog(text) TO anon, authenticated;

-- Place order: prices come from the database, stock is reserved
CREATE OR REPLACE FUNCTION public.place_online_order(p_slug text, p_customer_name text, p_customer_phone text, p_customer_email text, p_fulfillment_type text, p_delivery_address text, p_notes text, p_items jsonb)
RETURNS TABLE(order_id uuid, order_number text, total numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tenant uuid; v_order uuid; v_num text; v_total numeric := 0; it jsonb; v_p record; v_qty int;
BEGIN
  SELECT id INTO v_tenant FROM tenants WHERE slug = p_slug AND is_active;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Shop not found'; END IF;
  IF length(trim(coalesce(p_customer_name,''))) < 2 OR length(trim(coalesce(p_customer_phone,''))) < 6 THEN RAISE EXCEPTION 'Name and phone are required'; END IF;
  IF p_fulfillment_type NOT IN ('pickup','delivery') THEN RAISE EXCEPTION 'Invalid fulfillment type'; END IF;
  IF p_fulfillment_type = 'delivery' AND length(trim(coalesce(p_delivery_address,''))) < 5 THEN RAISE EXCEPTION 'Delivery address required'; END IF;
  IF jsonb_array_length(coalesce(p_items,'[]'::jsonb)) = 0 THEN RAISE EXCEPTION 'Cart is empty'; END IF;
  v_num := 'WEB-' || to_char(now(),'YYMMDD') || '-' || lpad((floor(random()*100000))::text,5,'0');
  INSERT INTO online_orders(tenant_id, order_number, customer_name, customer_phone, customer_email, fulfillment_type, delivery_address, notes)
  VALUES (v_tenant, v_num, left(trim(p_customer_name),120), left(trim(p_customer_phone),30), left(p_customer_email,200), p_fulfillment_type, left(p_delivery_address,500), left(p_notes,1000))
  RETURNING id INTO v_order;
  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (it->>'quantity')::int;
    IF v_qty IS NULL OR v_qty < 1 OR v_qty > 1000 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
    SELECT id, name, unit_price, stock_quantity INTO v_p FROM products WHERE id = (it->>'product_id')::uuid AND tenant_id = v_tenant AND is_active FOR UPDATE;
    IF v_p.id IS NULL THEN RAISE EXCEPTION 'Product unavailable'; END IF;
    IF v_p.stock_quantity < v_qty THEN RAISE EXCEPTION 'Not enough stock for %', v_p.name; END IF;
    UPDATE products SET stock_quantity = stock_quantity - v_qty WHERE id = v_p.id;
    INSERT INTO online_order_items(order_id, tenant_id, product_id, product_name, quantity, unit_price, total)
    VALUES (v_order, v_tenant, v_p.id, v_p.name, v_qty, v_p.unit_price, v_p.unit_price * v_qty);
    v_total := v_total + v_p.unit_price * v_qty;
  END LOOP;
  UPDATE online_orders SET total_amount = v_total WHERE id = v_order;
  RETURN QUERY SELECT v_order, v_num, v_total;
END $$;
GRANT EXECUTE ON FUNCTION public.place_online_order(text,text,text,text,text,text,text,jsonb) TO anon, authenticated;

-- Cancelling restores reserved stock
CREATE OR REPLACE FUNCTION public.restore_cancelled_order_stock() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    UPDATE products p SET stock_quantity = p.stock_quantity + i.quantity FROM online_order_items i WHERE i.order_id = NEW.id AND i.product_id = p.id;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_online_order_status BEFORE UPDATE ON public.online_orders FOR EACH ROW EXECUTE FUNCTION public.restore_cancelled_order_stock();
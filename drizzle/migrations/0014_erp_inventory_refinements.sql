-- 1. Automatic SKU generation
CREATE OR REPLACE FUNCTION public.generate_product_sku()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prefix text := 'PROD'; v_next int;
BEGIN
  IF NEW.sku IS NOT NULL AND btrim(NEW.sku) <> '' THEN RETURN NEW; END IF;
  IF NEW.category_id IS NOT NULL THEN
    SELECT upper(left(regexp_replace(name,'[^A-Za-z]','','g'),4)) INTO v_prefix FROM categories WHERE id = NEW.category_id;
    IF v_prefix IS NULL OR v_prefix = '' THEN v_prefix := 'PROD'; END IF;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('sku:'||coalesce(NEW.tenant_id::text,'')||v_prefix));
  SELECT coalesce(max((regexp_match(sku, '^AFR-'||v_prefix||'-(\d+)$'))[1]::int),0)+1 INTO v_next
    FROM products WHERE tenant_id IS NOT DISTINCT FROM NEW.tenant_id AND sku ~ ('^AFR-'||v_prefix||'-\d+$');
  NEW.sku := 'AFR-'||v_prefix||'-'||lpad(v_next::text,5,'0');
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_generate_product_sku ON public.products;
CREATE TRIGGER trg_generate_product_sku BEFORE INSERT OR UPDATE OF sku ON public.products
FOR EACH ROW EXECUTE FUNCTION public.generate_product_sku();

-- helper: adjust branch stock
CREATE OR REPLACE FUNCTION public._adjust_branch_stock(p_tenant uuid, p_product uuid, p_branch uuid, p_delta int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE product_branches SET stock_quantity = stock_quantity + p_delta, updated_at = now()
   WHERE product_id = p_product AND branch_id = p_branch;
  IF NOT FOUND THEN
    INSERT INTO product_branches(product_id, branch_id, stock_quantity, tenant_id) VALUES (p_product, p_branch, p_delta, p_tenant);
  END IF;
END $$;
REVOKE EXECUTE ON FUNCTION public._adjust_branch_stock(uuid,uuid,uuid,int) FROM PUBLIC, anon, authenticated;

-- 2. Two-stage transfers
CREATE OR REPLACE FUNCTION public.dispatch_stock_transfer(p_transfer_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t record; i record; v_avail int;
BEGIN
  SELECT * INTO t FROM stock_transfers WHERE id = p_transfer_id FOR UPDATE;
  IF t IS NULL OR t.tenant_id <> get_user_tenant_id(auth.uid()) THEN RAISE EXCEPTION 'Transfer not found'; END IF;
  IF NOT can_access_branch(auth.uid(), t.from_branch_id) THEN RAISE EXCEPTION 'You cannot dispatch from this branch'; END IF;
  IF t.status <> 'approved' THEN RAISE EXCEPTION 'Only approved transfers can be dispatched (current: %)', t.status; END IF;
  FOR i IN SELECT * FROM stock_transfer_items WHERE transfer_id = t.id LOOP
    SELECT coalesce(stock_quantity,0) INTO v_avail FROM product_branches WHERE product_id = i.product_id AND branch_id = t.from_branch_id;
    IF coalesce(v_avail,0) < i.quantity_requested THEN
      RAISE EXCEPTION 'Not enough stock for % at source branch (have %, need %)',
        (SELECT name FROM products WHERE id = i.product_id), coalesce(v_avail,0), i.quantity_requested;
    END IF;
    PERFORM _adjust_branch_stock(t.tenant_id, i.product_id, t.from_branch_id, -i.quantity_requested);
    INSERT INTO stock_movements(product_id, quantity, movement_type, reference_type, reference_id, branch_id, created_by, notes, tenant_id)
    VALUES (i.product_id, -i.quantity_requested, 'transfer_out', 'stock_transfer', t.id, t.from_branch_id, auth.uid(), 'Dispatched '||t.transfer_number||' (in transit)', t.tenant_id);
    UPDATE stock_transfer_items SET quantity_shipped = i.quantity_requested WHERE id = i.id;
  END LOOP;
  UPDATE stock_transfers SET status = 'in_transit', shipped_at = now(), updated_at = now() WHERE id = t.id;
END $$;

CREATE OR REPLACE FUNCTION public.receive_stock_transfer(p_transfer_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t record; i record; v_qty int;
BEGIN
  SELECT * INTO t FROM stock_transfers WHERE id = p_transfer_id FOR UPDATE;
  IF t IS NULL OR t.tenant_id <> get_user_tenant_id(auth.uid()) THEN RAISE EXCEPTION 'Transfer not found'; END IF;
  IF NOT can_access_branch(auth.uid(), t.to_branch_id) THEN RAISE EXCEPTION 'Only the receiving branch can confirm receipt'; END IF;
  IF t.status <> 'in_transit' THEN RAISE EXCEPTION 'Only in-transit transfers can be received (current: %)', t.status; END IF;
  FOR i IN SELECT * FROM stock_transfer_items WHERE transfer_id = t.id LOOP
    v_qty := coalesce(i.quantity_shipped, i.quantity_requested);
    PERFORM _adjust_branch_stock(t.tenant_id, i.product_id, t.to_branch_id, v_qty);
    INSERT INTO stock_movements(product_id, quantity, movement_type, reference_type, reference_id, branch_id, created_by, notes, tenant_id)
    VALUES (i.product_id, v_qty, 'transfer_in', 'stock_transfer', t.id, t.to_branch_id, auth.uid(), 'Received '||t.transfer_number, t.tenant_id);
    UPDATE stock_transfer_items SET quantity_received = v_qty WHERE id = i.id;
  END LOOP;
  UPDATE stock_transfers SET status = 'received', received_at = now(), updated_at = now() WHERE id = t.id;
END $$;

-- 3. Goods receipt posting
CREATE OR REPLACE FUNCTION public.receive_purchase_order(p_po_id uuid, p_branch_id uuid, p_items jsonb, p_notes text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE po record; it jsonb; poi record; v_qty int; v_receipt uuid; v_all boolean;
BEGIN
  SELECT * INTO po FROM purchase_orders WHERE id = p_po_id FOR UPDATE;
  IF po IS NULL OR po.tenant_id <> get_user_tenant_id(auth.uid()) THEN RAISE EXCEPTION 'Purchase order not found'; END IF;
  IF p_branch_id IS NULL THEN RAISE EXCEPTION 'Choose the branch receiving the goods'; END IF;
  IF NOT can_access_branch(auth.uid(), p_branch_id) THEN RAISE EXCEPTION 'You cannot receive into this branch'; END IF;
  IF po.status IN ('cancelled','received') THEN RAISE EXCEPTION 'This order is %', po.status; END IF;
  INSERT INTO goods_receipts(purchase_order_id, received_by, notes, tenant_id) VALUES (po.id, auth.uid(), p_notes, po.tenant_id) RETURNING id INTO v_receipt;
  FOR it IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_qty := (it->>'quantity')::int;
    IF v_qty IS NULL OR v_qty <= 0 THEN CONTINUE; END IF;
    SELECT * INTO poi FROM purchase_order_items WHERE purchase_order_id = po.id AND product_id = (it->>'product_id')::uuid LIMIT 1;
    IF poi IS NULL THEN RAISE EXCEPTION 'Product not on this order'; END IF;
    IF poi.quantity_received + v_qty > poi.quantity THEN RAISE EXCEPTION 'Receiving more than ordered'; END IF;
    UPDATE purchase_order_items SET quantity_received = quantity_received + v_qty WHERE id = poi.id;
    PERFORM _adjust_branch_stock(po.tenant_id, poi.product_id, p_branch_id, v_qty);
    INSERT INTO goods_receipt_items(goods_receipt_id, product_id, quantity_received, tenant_id) VALUES (v_receipt, poi.product_id, v_qty, po.tenant_id);
    INSERT INTO stock_movements(product_id, quantity, movement_type, reference_type, reference_id, branch_id, created_by, notes, unit_cost, total_cost, tenant_id)
    VALUES (poi.product_id, v_qty, 'purchase_receipt', 'goods_receipt', v_receipt, p_branch_id, auth.uid(), 'Received on '||po.po_number, poi.unit_cost, poi.unit_cost * v_qty, po.tenant_id);
  END LOOP;
  SELECT bool_and(quantity_received >= quantity) INTO v_all FROM purchase_order_items WHERE purchase_order_id = po.id;
  UPDATE purchase_orders SET status = CASE WHEN v_all THEN 'received'::purchase_order_status ELSE status END,
    received_date = CASE WHEN v_all THEN current_date ELSE received_date END, updated_at = now() WHERE id = po.id;
  RETURN v_receipt;
END $$;

REVOKE EXECUTE ON FUNCTION public.dispatch_stock_transfer(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.receive_stock_transfer(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.receive_purchase_order(uuid,uuid,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dispatch_stock_transfer(uuid), public.receive_stock_transfer(uuid), public.receive_purchase_order(uuid,uuid,jsonb,text) TO authenticated;
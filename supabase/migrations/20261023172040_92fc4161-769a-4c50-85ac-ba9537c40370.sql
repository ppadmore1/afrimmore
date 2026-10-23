DROP POLICY IF EXISTS "Admins can manage discount codes" ON public.discount_codes;
CREATE POLICY "Admins can manage discount codes" ON public.discount_codes FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'owner'))
WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'owner'));

DROP POLICY IF EXISTS "Tenant admins can manage invitations" ON public.invitations;
CREATE POLICY "Tenant admins can manage invitations" ON public.invitations FOR ALL TO authenticated
USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'owner')))
WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'owner')));

CREATE OR REPLACE FUNCTION public.delete_invitations(p_ids uuid[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count int;
BEGIN
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'owner')) THEN
    RAISE EXCEPTION 'Only admins can delete invitations';
  END IF;
  DELETE FROM invitations WHERE id = ANY(p_ids)
    AND (tenant_id IS NULL OR tenant_id = get_user_tenant_id(auth.uid()));
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;
GRANT EXECUTE ON FUNCTION public.delete_invitations(uuid[]) TO authenticated;

DROP FUNCTION IF EXISTS public.process_pos_sale(uuid, text, payment_method, numeric, uuid, jsonb, uuid);

CREATE FUNCTION public.process_pos_sale(p_customer_id uuid, p_customer_name text, p_payment_method payment_method, p_amount_paid numeric, p_created_by uuid, p_items jsonb, p_shift_id uuid DEFAULT NULL, p_discount_code text DEFAULT NULL)
 RETURNS TABLE(sale_id uuid, sale_number text, change_amount numeric)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_sale_id UUID; v_sale_number TEXT; v_item JSONB;
  v_product_stock INT; v_product_price DECIMAL; v_product_tax_rate DECIMAL;
  v_calculated_subtotal DECIMAL := 0; v_calculated_tax DECIMAL := 0; v_calculated_discount DECIMAL := 0;
  v_calculated_total DECIMAL; v_item_subtotal DECIMAL; v_item_discount_amount DECIMAL;
  v_item_tax_amount DECIMAL; v_item_total DECIMAL; v_change_amount DECIMAL;
  v_payment_number TEXT; v_today_prefix TEXT; v_next_seq INT;
  v_code RECORD; v_coupon DECIMAL := 0;
BEGIN
  IF NOT is_staff() THEN RAISE EXCEPTION 'Unauthorized: User must be staff to process sales'; END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Invalid sale: No items provided'; END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT unit_price, COALESCE(tax_rate, 0), stock_quantity INTO v_product_price, v_product_tax_rate, v_product_stock
    FROM products WHERE id = (v_item->>'product_id')::UUID FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Product not found: %', v_item->>'product_id'; END IF;
    IF v_product_stock < (v_item->>'quantity')::DECIMAL THEN
      RAISE EXCEPTION 'Insufficient stock for product %. Available: %, Requested: %', v_item->>'product_id', v_product_stock, (v_item->>'quantity')::DECIMAL;
    END IF;
    IF COALESCE((v_item->>'discount')::DECIMAL,0) < 0 OR COALESCE((v_item->>'discount')::DECIMAL,0) > 100 THEN
      RAISE EXCEPTION 'Invalid item discount';
    END IF;
    v_item_subtotal := v_product_price * (v_item->>'quantity')::DECIMAL;
    v_item_discount_amount := v_item_subtotal * COALESCE((v_item->>'discount')::DECIMAL, 0) / 100;
    v_item_tax_amount := (v_item_subtotal - v_item_discount_amount) * v_product_tax_rate / 100;
    v_calculated_subtotal := v_calculated_subtotal + (v_item_subtotal - v_item_discount_amount);
    v_calculated_tax := v_calculated_tax + v_item_tax_amount;
    v_calculated_discount := v_calculated_discount + v_item_discount_amount;
  END LOOP;

  IF p_discount_code IS NOT NULL AND length(trim(p_discount_code)) > 0 THEN
    SELECT * INTO v_code FROM discount_codes
     WHERE upper(code) = upper(trim(p_discount_code)) AND status = 'active'
       AND valid_from <= now() AND (valid_until IS NULL OR valid_until >= now())
       AND (usage_limit IS NULL OR COALESCE(usage_count,0) < usage_limit)
       AND (tenant_id IS NULL OR tenant_id = get_user_tenant_id(auth.uid()))
     LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'Promo code is invalid or expired'; END IF;
    IF v_calculated_subtotal < COALESCE(v_code.min_purchase_amount,0) THEN
      RAISE EXCEPTION 'Promo code needs a minimum purchase of %', v_code.min_purchase_amount;
    END IF;
    IF v_code.discount_type = 'percentage' THEN
      v_coupon := v_calculated_subtotal * v_code.discount_value / 100;
      IF v_code.max_discount_amount IS NOT NULL THEN v_coupon := LEAST(v_coupon, v_code.max_discount_amount); END IF;
    ELSE
      v_coupon := v_code.discount_value;
    END IF;
    v_coupon := LEAST(v_coupon, v_calculated_subtotal);
  END IF;

  v_calculated_discount := v_calculated_discount + v_coupon;
  v_calculated_total := GREATEST(0, v_calculated_subtotal + v_calculated_tax - v_coupon);

  IF p_payment_method = 'cash' AND p_amount_paid + 0.005 < v_calculated_total THEN
    RAISE EXCEPTION 'Insufficient payment amount. Required: %, Received: %', v_calculated_total, p_amount_paid;
  END IF;
  v_change_amount := GREATEST(0, p_amount_paid - v_calculated_total);

  v_today_prefix := 'POS-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-';
  SELECT COALESCE(MAX(SUBSTRING(ps.sale_number FROM '\d{4}$')::INT), 0) + 1 INTO v_next_seq
  FROM pos_sales ps WHERE ps.sale_number LIKE v_today_prefix || '%';
  v_sale_number := v_today_prefix || LPAD(v_next_seq::TEXT, 4, '0');

  INSERT INTO pos_sales (sale_number, customer_id, customer_name, subtotal, tax_total, discount_total, total, amount_paid, change_amount, payment_method, status, created_by, shift_id)
  VALUES (v_sale_number, p_customer_id, p_customer_name, v_calculated_subtotal, v_calculated_tax, v_calculated_discount, v_calculated_total, p_amount_paid, v_change_amount, p_payment_method, 'paid', p_created_by, p_shift_id)
  RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT unit_price, COALESCE(tax_rate, 0), stock_quantity INTO v_product_price, v_product_tax_rate, v_product_stock
    FROM products WHERE id = (v_item->>'product_id')::UUID;
    v_item_subtotal := v_product_price * (v_item->>'quantity')::DECIMAL;
    v_item_discount_amount := v_item_subtotal * COALESCE((v_item->>'discount')::DECIMAL, 0) / 100;
    v_item_tax_amount := (v_item_subtotal - v_item_discount_amount) * v_product_tax_rate / 100;
    v_item_total := v_item_subtotal - v_item_discount_amount + v_item_tax_amount;
    INSERT INTO pos_sale_items (sale_id, product_id, product_name, quantity, unit_price, discount, tax_rate, total)
    VALUES (v_sale_id, (v_item->>'product_id')::UUID, (v_item->>'product_name')::TEXT, (v_item->>'quantity')::DECIMAL, v_product_price, COALESCE((v_item->>'discount')::DECIMAL, 0), v_product_tax_rate, v_item_total);
    UPDATE products SET stock_quantity = stock_quantity - (v_item->>'quantity')::INT WHERE id = (v_item->>'product_id')::UUID;
    INSERT INTO stock_movements (product_id, quantity, movement_type, reference_type, reference_id, created_by, notes)
    VALUES ((v_item->>'product_id')::UUID, -(v_item->>'quantity')::INT, 'sale', 'pos_sale', v_sale_id, p_created_by, 'POS Sale: ' || v_sale_number);
  END LOOP;

  v_payment_number := 'PAY-' || v_sale_number;
  INSERT INTO payments (payment_number, pos_sale_id, amount, payment_method, created_by)
  VALUES (v_payment_number, v_sale_id, v_calculated_total, p_payment_method, p_created_by);

  RETURN QUERY SELECT v_sale_id, v_sale_number, v_change_amount;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.process_pos_sale(uuid, text, payment_method, numeric, uuid, jsonb, uuid, text) TO authenticated;
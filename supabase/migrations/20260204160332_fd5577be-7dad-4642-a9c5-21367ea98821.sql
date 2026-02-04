CREATE OR REPLACE FUNCTION public.process_pos_sale(p_customer_id uuid, p_customer_name text, p_payment_method payment_method, p_amount_paid numeric, p_created_by uuid, p_items jsonb)
 RETURNS TABLE(sale_id uuid, sale_number text, change_amount numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sale_id UUID;
  v_sale_number TEXT;
  v_item JSONB;
  v_product_stock INT;
  v_product_price DECIMAL;
  v_product_tax_rate DECIMAL;
  v_calculated_subtotal DECIMAL := 0;
  v_calculated_tax DECIMAL := 0;
  v_calculated_discount DECIMAL := 0;
  v_calculated_total DECIMAL;
  v_item_subtotal DECIMAL;
  v_item_discount_amount DECIMAL;
  v_item_tax_amount DECIMAL;
  v_item_total DECIMAL;
  v_change_amount DECIMAL;
  v_payment_number TEXT;
  v_today_prefix TEXT;
  v_next_seq INT;
BEGIN
  -- Verify user is staff
  IF NOT is_staff() THEN
    RAISE EXCEPTION 'Unauthorized: User must be staff to process sales';
  END IF;

  -- Validate items array
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Invalid sale: No items provided';
  END IF;

  -- Calculate totals from product prices in database (server-side validation)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Get actual product price and tax rate from database
    SELECT unit_price, COALESCE(tax_rate, 0), stock_quantity
    INTO v_product_price, v_product_tax_rate, v_product_stock
    FROM products
    WHERE id = (v_item->>'product_id')::UUID
    FOR UPDATE; -- Lock row to prevent race conditions
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found: %', v_item->>'product_id';
    END IF;
    
    -- Validate stock availability
    IF v_product_stock < (v_item->>'quantity')::DECIMAL THEN
      RAISE EXCEPTION 'Insufficient stock for product %. Available: %, Requested: %', 
        v_item->>'product_id', v_product_stock, (v_item->>'quantity')::DECIMAL;
    END IF;
    
    -- Calculate item totals using database prices
    v_item_subtotal := v_product_price * (v_item->>'quantity')::DECIMAL;
    v_item_discount_amount := v_item_subtotal * COALESCE((v_item->>'discount')::DECIMAL, 0) / 100;
    v_item_tax_amount := (v_item_subtotal - v_item_discount_amount) * v_product_tax_rate / 100;
    
    v_calculated_subtotal := v_calculated_subtotal + (v_item_subtotal - v_item_discount_amount);
    v_calculated_tax := v_calculated_tax + v_item_tax_amount;
    v_calculated_discount := v_calculated_discount + v_item_discount_amount;
  END LOOP;
  
  v_calculated_total := v_calculated_subtotal + v_calculated_tax;
  
  -- Validate payment amount for cash payments
  IF p_payment_method = 'cash' AND p_amount_paid < v_calculated_total THEN
    RAISE EXCEPTION 'Insufficient payment amount. Required: %, Received: %', v_calculated_total, p_amount_paid;
  END IF;
  
  v_change_amount := GREATEST(0, p_amount_paid - v_calculated_total);
  
  -- Generate unique sale number atomically
  v_today_prefix := 'POS-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-';
  
  SELECT COALESCE(MAX(SUBSTRING(ps.sale_number FROM '\d{4}$')::INT), 0) + 1
  INTO v_next_seq
  FROM pos_sales ps
  WHERE ps.sale_number LIKE v_today_prefix || '%';
  
  v_sale_number := v_today_prefix || LPAD(v_next_seq::TEXT, 4, '0');
  
  -- Insert POS sale with server-calculated values
  INSERT INTO pos_sales (
    sale_number, customer_id, customer_name, subtotal, tax_total,
    discount_total, total, amount_paid, change_amount, payment_method,
    status, created_by
  ) VALUES (
    v_sale_number, p_customer_id, p_customer_name, v_calculated_subtotal, v_calculated_tax,
    v_calculated_discount, v_calculated_total, p_amount_paid, v_change_amount, p_payment_method,
    'paid', p_created_by
  ) RETURNING id INTO v_sale_id;
  
  -- Process each item atomically
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Get actual product details from database
    SELECT unit_price, COALESCE(tax_rate, 0), stock_quantity
    INTO v_product_price, v_product_tax_rate, v_product_stock
    FROM products
    WHERE id = (v_item->>'product_id')::UUID;
    
    -- Calculate item totals
    v_item_subtotal := v_product_price * (v_item->>'quantity')::DECIMAL;
    v_item_discount_amount := v_item_subtotal * COALESCE((v_item->>'discount')::DECIMAL, 0) / 100;
    v_item_tax_amount := (v_item_subtotal - v_item_discount_amount) * v_product_tax_rate / 100;
    v_item_total := v_item_subtotal - v_item_discount_amount + v_item_tax_amount;
    
    -- Insert sale item with server-calculated values
    INSERT INTO pos_sale_items (
      sale_id, product_id, product_name, quantity, unit_price,
      discount, tax_rate, total
    ) VALUES (
      v_sale_id,
      (v_item->>'product_id')::UUID,
      (v_item->>'product_name')::TEXT,
      (v_item->>'quantity')::DECIMAL,
      v_product_price, -- Use database price, not client-supplied
      COALESCE((v_item->>'discount')::DECIMAL, 0),
      v_product_tax_rate,
      v_item_total
    );
    
    -- Update stock atomically
    UPDATE products
    SET stock_quantity = stock_quantity - (v_item->>'quantity')::INT
    WHERE id = (v_item->>'product_id')::UUID;
    
    -- Record stock movement
    INSERT INTO stock_movements (
      product_id, quantity, movement_type, reference_type,
      reference_id, created_by, notes
    ) VALUES (
      (v_item->>'product_id')::UUID,
      -(v_item->>'quantity')::INT,
      'sale',
      'pos_sale',
      v_sale_id,
      p_created_by,
      'POS Sale: ' || v_sale_number
    );
  END LOOP;
  
  -- Create payment record
  v_payment_number := 'PAY-' || v_sale_number;
  INSERT INTO payments (
    payment_number, pos_sale_id, amount, payment_method, created_by
  ) VALUES (
    v_payment_number,
    v_sale_id,
    v_calculated_total,
    p_payment_method,
    p_created_by
  );
  
  -- Return with explicit column aliases to avoid ambiguity
  RETURN QUERY SELECT v_sale_id AS sale_id, v_sale_number AS sale_number, v_change_amount AS change_amount;
END;
$function$;
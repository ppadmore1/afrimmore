CREATE OR REPLACE FUNCTION public.safe_delete_product(p_product_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'owner')) THEN
    RAISE EXCEPTION 'Only admins can delete products';
  END IF;
  IF EXISTS (SELECT 1 FROM pos_sale_items WHERE product_id = p_product_id)
     OR EXISTS (SELECT 1 FROM invoice_items WHERE product_id = p_product_id)
     OR EXISTS (SELECT 1 FROM vendor_bill_items WHERE product_id = p_product_id)
     OR EXISTS (SELECT 1 FROM receipt_items WHERE product_id = p_product_id) THEN
    RAISE EXCEPTION 'This product has sales or invoices, so it cannot be deleted. Turn it off (deactivate) instead.';
  END IF;
  DELETE FROM custom_field_values WHERE entity_type = 'product' AND entity_id = p_product_id;
  DELETE FROM product_serials WHERE product_id = p_product_id;
  DELETE FROM stock_transfer_items WHERE product_id = p_product_id;
  DELETE FROM inventory_adjustment_items WHERE product_id = p_product_id;
  DELETE FROM purchase_order_items WHERE product_id = p_product_id;
  DELETE FROM goods_receipt_items WHERE product_id = p_product_id;
  DELETE FROM credit_note_items WHERE product_id = p_product_id;
  DELETE FROM recurring_invoice_items WHERE product_id = p_product_id;
  DELETE FROM product_bundle_components WHERE component_product_id = p_product_id;
  DELETE FROM delivery_note_items WHERE product_id = p_product_id;
  DELETE FROM quotation_items WHERE product_id = p_product_id;
  UPDATE online_order_items SET product_id = NULL WHERE product_id = p_product_id;
  DELETE FROM products WHERE id = p_product_id;
END $function$;
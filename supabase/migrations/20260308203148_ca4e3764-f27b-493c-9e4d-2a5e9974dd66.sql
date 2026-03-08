
-- Function to safely delete a product by cleaning up references first
CREATE OR REPLACE FUNCTION public.safe_delete_product(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_has_sales boolean;
BEGIN
  -- Check if user is admin
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can delete products';
  END IF;

  -- Check if product has been used in completed sales (pos_sale_items, invoice_items)
  SELECT EXISTS(
    SELECT 1 FROM pos_sale_items WHERE product_id = p_product_id
    UNION ALL
    SELECT 1 FROM invoice_items WHERE product_id = p_product_id
  ) INTO v_has_sales;

  IF v_has_sales THEN
    RAISE EXCEPTION 'Cannot delete product: it has been used in sales or invoices. Consider deactivating it instead.';
  END IF;

  -- Delete from tables that reference this product
  DELETE FROM product_branches WHERE product_id = p_product_id;
  DELETE FROM product_suppliers WHERE product_id = p_product_id;
  DELETE FROM stock_movements WHERE product_id = p_product_id;
  DELETE FROM inventory_valuations WHERE product_id = p_product_id;
  DELETE FROM discount_approval_requests WHERE product_id = p_product_id;
  DELETE FROM custom_field_values WHERE entity_type = 'product' AND entity_id = p_product_id::text;
  DELETE FROM credit_note_items WHERE product_id = p_product_id;
  DELETE FROM delivery_note_items WHERE product_id = p_product_id;
  DELETE FROM quotation_items WHERE product_id = p_product_id;
  DELETE FROM goods_receipt_items WHERE product_id = p_product_id;

  -- Now delete the product
  DELETE FROM products WHERE id = p_product_id;
END;
$$;

-- Function to safely delete a branch by cleaning up references first
CREATE OR REPLACE FUNCTION public.safe_delete_branch(p_branch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_has_sales boolean;
BEGIN
  -- Check if user is admin
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can delete branches';
  END IF;

  -- Check if branch has sales
  SELECT EXISTS(
    SELECT 1 FROM pos_sales WHERE branch_id = p_branch_id
  ) INTO v_has_sales;

  IF v_has_sales THEN
    RAISE EXCEPTION 'Cannot delete branch: it has associated sales. Consider deactivating it instead.';
  END IF;

  -- Delete from referencing tables
  DELETE FROM user_branches WHERE branch_id = p_branch_id;
  DELETE FROM product_branches WHERE branch_id = p_branch_id;
  DELETE FROM stock_movements WHERE branch_id = p_branch_id;
  DELETE FROM expenses WHERE branch_id = p_branch_id;
  DELETE FROM branch_reports WHERE branch_id = p_branch_id;
  DELETE FROM branch_grades WHERE branch_id = p_branch_id;
  DELETE FROM audit_visits WHERE branch_id = p_branch_id;
  DELETE FROM employee_time_entries WHERE branch_id = p_branch_id;
  DELETE FROM activity_logs WHERE branch_id = p_branch_id;
  DELETE FROM company_settings WHERE branch_id = p_branch_id;

  -- Now delete the branch
  DELETE FROM branches WHERE id = p_branch_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.safe_delete_invoice(p_invoice_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t uuid := public.get_user_tenant_id(auth.uid());
BEGIN
  IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'owner')) THEN
    RAISE EXCEPTION 'Only admins can delete invoices';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM invoices WHERE id = p_invoice_id AND tenant_id = t) THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;
  DELETE FROM credit_note_items WHERE credit_note_id IN (SELECT id FROM credit_notes WHERE invoice_id = p_invoice_id);
  DELETE FROM credit_notes WHERE invoice_id = p_invoice_id;
  DELETE FROM journal_entry_lines WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE reference_id IN (SELECT id FROM payments WHERE invoice_id = p_invoice_id) OR reference_id = p_invoice_id);
  DELETE FROM journal_entries WHERE reference_id IN (SELECT id FROM payments WHERE invoice_id = p_invoice_id) OR reference_id = p_invoice_id;
  DELETE FROM payments WHERE invoice_id = p_invoice_id;
  DELETE FROM delivery_note_items WHERE delivery_note_id IN (SELECT id FROM delivery_notes WHERE invoice_id = p_invoice_id);
  DELETE FROM delivery_notes WHERE invoice_id = p_invoice_id;
  DELETE FROM custom_field_values WHERE entity_type = 'invoice' AND entity_id = p_invoice_id;
  DELETE FROM invoice_items WHERE invoice_id = p_invoice_id;
  DELETE FROM invoices WHERE id = p_invoice_id;
END $$;
GRANT EXECUTE ON FUNCTION public.safe_delete_invoice(uuid) TO authenticated;
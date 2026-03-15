-- Update RLS policies on secondary tables to include tenant_id filtering

-- Helper: drop and recreate policies for tables that still use old is_staff()/has_role() without tenant_id

-- approval_thresholds
DROP POLICY IF EXISTS "Admins can manage approval thresholds" ON public.approval_thresholds;
DROP POLICY IF EXISTS "Staff can view approval thresholds" ON public.approval_thresholds;
CREATE POLICY "Tenant admins can manage approval thresholds" ON public.approval_thresholds FOR ALL TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Tenant staff can view approval thresholds" ON public.approval_thresholds FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()) AND is_staff());

-- document_templates
DROP POLICY IF EXISTS "Admins can manage document templates" ON public.document_templates;
DROP POLICY IF EXISTS "Staff can view document templates" ON public.document_templates;
CREATE POLICY "Tenant admins can manage document templates" ON public.document_templates FOR ALL TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Tenant staff can view document templates" ON public.document_templates FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()) AND is_staff());

-- purchase_orders
DROP POLICY IF EXISTS "Staff can manage purchase orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Staff can view purchase orders" ON public.purchase_orders;
CREATE POLICY "Tenant staff can manage purchase orders" ON public.purchase_orders FOR ALL TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()) AND is_staff());
CREATE POLICY "Tenant staff can view purchase orders" ON public.purchase_orders FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));

-- credit_notes
DROP POLICY IF EXISTS "Staff can manage credit notes" ON public.credit_notes;
DROP POLICY IF EXISTS "Staff can view credit notes" ON public.credit_notes;
CREATE POLICY "Tenant staff can manage credit notes" ON public.credit_notes FOR ALL TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()) AND is_staff());
CREATE POLICY "Tenant members can view credit notes" ON public.credit_notes FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));

-- credit_note_items
DROP POLICY IF EXISTS "Staff can manage credit note items" ON public.credit_note_items;
DROP POLICY IF EXISTS "Staff can view credit note items" ON public.credit_note_items;
CREATE POLICY "Tenant staff can manage credit note items" ON public.credit_note_items FOR ALL TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()) AND is_staff());
CREATE POLICY "Tenant members can view credit note items" ON public.credit_note_items FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));

-- goods_receipts
DROP POLICY IF EXISTS "Staff can manage goods receipts" ON public.goods_receipts;
DROP POLICY IF EXISTS "Staff can view goods receipts" ON public.goods_receipts;
CREATE POLICY "Tenant staff can manage goods receipts" ON public.goods_receipts FOR ALL TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()) AND is_staff());
CREATE POLICY "Tenant members can view goods receipts" ON public.goods_receipts FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));

-- invoice_items
DROP POLICY IF EXISTS "Staff can manage invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Staff can view invoice items" ON public.invoice_items;
CREATE POLICY "Tenant staff can manage invoice items" ON public.invoice_items FOR ALL TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()) AND is_staff());
CREATE POLICY "Tenant members can view invoice items" ON public.invoice_items FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));

-- quotation_items
DROP POLICY IF EXISTS "Staff can manage quotation items" ON public.quotation_items;
DROP POLICY IF EXISTS "Staff can view quotation items" ON public.quotation_items;
CREATE POLICY "Tenant staff can manage quotation items" ON public.quotation_items FOR ALL TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()) AND is_staff());
CREATE POLICY "Tenant members can view quotation items" ON public.quotation_items FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));

-- exchange_rates
DROP POLICY IF EXISTS "Staff can manage exchange rates" ON public.exchange_rates;
DROP POLICY IF EXISTS "Staff can view exchange rates" ON public.exchange_rates;
CREATE POLICY "Tenant staff can manage exchange rates" ON public.exchange_rates FOR ALL TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()) AND is_staff());
CREATE POLICY "Tenant members can view exchange rates" ON public.exchange_rates FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));

-- product_suppliers
DROP POLICY IF EXISTS "Staff can manage product suppliers" ON public.product_suppliers;
DROP POLICY IF EXISTS "Staff can view product suppliers" ON public.product_suppliers;
CREATE POLICY "Tenant staff can manage product suppliers" ON public.product_suppliers FOR ALL TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()) AND is_staff());
CREATE POLICY "Tenant members can view product suppliers" ON public.product_suppliers FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));

-- branch_grades
DROP POLICY IF EXISTS "Admins can manage branch grades" ON public.branch_grades;
DROP POLICY IF EXISTS "Staff can view branch grades" ON public.branch_grades;
CREATE POLICY "Tenant admins can manage branch grades" ON public.branch_grades FOR ALL TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Tenant staff can view branch grades" ON public.branch_grades FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()) AND is_staff());

-- bank_accounts
DROP POLICY IF EXISTS "Admins can manage bank accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Staff can view bank accounts" ON public.bank_accounts;
CREATE POLICY "Tenant admins can manage bank accounts" ON public.bank_accounts FOR ALL TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Tenant staff can view bank accounts" ON public.bank_accounts FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()) AND is_staff());

-- bank_transactions
DROP POLICY IF EXISTS "Admins can manage bank transactions" ON public.bank_transactions;
DROP POLICY IF EXISTS "Staff can view bank transactions" ON public.bank_transactions;
CREATE POLICY "Tenant admins can manage bank transactions" ON public.bank_transactions FOR ALL TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Tenant staff can view bank transactions" ON public.bank_transactions FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()) AND is_staff());

-- vendor_bill_items
DROP POLICY IF EXISTS "Staff can manage vendor bill items" ON public.vendor_bill_items;
DROP POLICY IF EXISTS "Staff can view vendor bill items" ON public.vendor_bill_items;
CREATE POLICY "Tenant staff can manage vendor bill items" ON public.vendor_bill_items FOR ALL TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()) AND is_staff());
CREATE POLICY "Tenant members can view vendor bill items" ON public.vendor_bill_items FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));

-- product_branches
DROP POLICY IF EXISTS "Staff can manage their branch inventory" ON public.product_branches;
DROP POLICY IF EXISTS "Staff can view product branches" ON public.product_branches;
CREATE POLICY "Tenant staff can manage branch inventory" ON public.product_branches FOR ALL TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()) AND is_staff() AND (has_role(auth.uid(), 'admin'::app_role) OR EXISTS (SELECT 1 FROM user_branches WHERE user_branches.user_id = auth.uid() AND user_branches.branch_id = product_branches.branch_id)));
CREATE POLICY "Tenant members can view product branches" ON public.product_branches FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));

-- inventory_adjustment_items
DROP POLICY IF EXISTS "Staff can manage inventory adjustment items" ON public.inventory_adjustment_items;
DROP POLICY IF EXISTS "Staff can view inventory adjustment items" ON public.inventory_adjustment_items;
CREATE POLICY "Tenant staff can manage inventory adjustment items" ON public.inventory_adjustment_items FOR ALL TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()) AND is_staff());
CREATE POLICY "Tenant members can view inventory adjustment items" ON public.inventory_adjustment_items FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));

-- product_bundles
DROP POLICY IF EXISTS "Staff can manage product bundles" ON public.product_bundles;
DROP POLICY IF EXISTS "Staff can view product bundles" ON public.product_bundles;
CREATE POLICY "Tenant staff can manage product bundles" ON public.product_bundles FOR ALL TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()) AND is_staff());
CREATE POLICY "Tenant members can view product bundles" ON public.product_bundles FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));

-- product_bundle_components
DROP POLICY IF EXISTS "Staff can manage bundle components" ON public.product_bundle_components;
DROP POLICY IF EXISTS "Staff can view bundle components" ON public.product_bundle_components;
CREATE POLICY "Tenant staff can manage bundle components" ON public.product_bundle_components FOR ALL TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()) AND is_staff());
CREATE POLICY "Tenant members can view bundle components" ON public.product_bundle_components FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));

-- stock_transfer_items
DROP POLICY IF EXISTS "Staff can manage stock transfer items" ON public.stock_transfer_items;
DROP POLICY IF EXISTS "Staff can view stock transfer items" ON public.stock_transfer_items;
CREATE POLICY "Tenant staff can manage stock transfer items" ON public.stock_transfer_items FOR ALL TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()) AND is_staff());
CREATE POLICY "Tenant members can view stock transfer items" ON public.stock_transfer_items FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));

-- employee_time_entries (add tenant_id check)
DROP POLICY IF EXISTS "Users can view their own time entries" ON public.employee_time_entries;
DROP POLICY IF EXISTS "Users can insert their own time entries" ON public.employee_time_entries;
DROP POLICY IF EXISTS "Users can update their own time entries" ON public.employee_time_entries;
DROP POLICY IF EXISTS "Admins can delete time entries" ON public.employee_time_entries;
CREATE POLICY "Tenant users can view time entries" ON public.employee_time_entries FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()) AND (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Tenant users can insert time entries" ON public.employee_time_entries FOR INSERT TO authenticated WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND auth.uid() = user_id);
CREATE POLICY "Tenant users can update time entries" ON public.employee_time_entries FOR UPDATE TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()) AND (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Tenant admins can delete time entries" ON public.employee_time_entries FOR DELETE TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- employee_breaks (add tenant_id check)
DROP POLICY IF EXISTS "Users can manage their own breaks" ON public.employee_breaks;
CREATE POLICY "Tenant users can manage breaks" ON public.employee_breaks FOR ALL TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()) AND EXISTS (SELECT 1 FROM employee_time_entries WHERE employee_time_entries.id = employee_breaks.time_entry_id AND (employee_time_entries.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))));

-- chart_of_accounts
DROP POLICY IF EXISTS "Admins can manage chart of accounts" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "Staff can view chart of accounts" ON public.chart_of_accounts;
CREATE POLICY "Tenant admins can manage chart of accounts" ON public.chart_of_accounts FOR ALL TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Tenant staff can view chart of accounts" ON public.chart_of_accounts FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()) AND is_staff());

-- tax_returns
DROP POLICY IF EXISTS "Staff can manage tax returns" ON public.tax_returns;
DROP POLICY IF EXISTS "Staff can view tax returns" ON public.tax_returns;
CREATE POLICY "Tenant staff can manage tax returns" ON public.tax_returns FOR ALL TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()) AND is_staff());
CREATE POLICY "Tenant members can view tax returns" ON public.tax_returns FOR SELECT TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()));

-- invitations
DROP POLICY IF EXISTS "Admins can manage invitations" ON public.invitations;
CREATE POLICY "Tenant admins can manage invitations" ON public.invitations FOR ALL TO authenticated USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

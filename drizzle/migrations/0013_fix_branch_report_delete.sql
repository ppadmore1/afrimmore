DROP POLICY IF EXISTS "HQ deletes branch reports" ON public.branch_reports;
CREATE POLICY "HQ deletes branch reports" ON public.branch_reports FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'owner')));
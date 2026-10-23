CREATE OR REPLACE FUNCTION public.is_hq(p_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role IN ('admin','owner','executive','accountant'))
$$;

CREATE OR REPLACE FUNCTION public.can_access_branch(p_user_id uuid, p_branch_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role IN ('admin','owner','executive','accountant'))
      OR EXISTS (SELECT 1 FROM public.user_branches WHERE user_id = p_user_id AND branch_id = p_branch_id)
$$;

-- Branch reports: branch staff see only their branch; HQ sees all; only HQ approves
DROP POLICY IF EXISTS "Staff can view and submit branch reports" ON public.branch_reports;
DROP POLICY IF EXISTS "Admins can manage branch reports" ON public.branch_reports;
CREATE POLICY "Branch reports visible to branch or HQ" ON public.branch_reports FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND can_access_branch(auth.uid(), branch_id));
CREATE POLICY "Branch staff submit own branch reports" ON public.branch_reports FOR INSERT TO authenticated
  WITH CHECK (is_staff() AND tenant_id = get_user_tenant_id(auth.uid()) AND can_access_branch(auth.uid(), branch_id) AND submitted_by = auth.uid());
CREATE POLICY "HQ manages branch reports" ON public.branch_reports FOR UPDATE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND (is_hq(auth.uid()) OR (submitted_by = auth.uid() AND status = 'submitted')));
CREATE POLICY "HQ deletes branch reports" ON public.branch_reports FOR DELETE TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(),'admin') OR has_role(auth.uid(),'owner'));

-- Shifts: own, branch manager of that branch, or HQ
DROP POLICY IF EXISTS "Staff can view own shifts" ON public.pos_shifts;
CREATE POLICY "Staff can view own shifts" ON public.pos_shifts FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_hq(auth.uid())
    OR (has_role(auth.uid(),'branch_manager') AND can_access_branch(auth.uid(), branch_id)));

-- POS sales: HQ sees all; others only their branches
DROP POLICY IF EXISTS "Tenant members can view pos sales" ON public.pos_sales;
CREATE POLICY "Tenant members can view pos sales" ON public.pos_sales FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid())
    AND (is_hq(auth.uid()) OR branch_id IS NULL OR can_access_branch(auth.uid(), branch_id) OR created_by = auth.uid()));
DROP POLICY IF EXISTS "Tenant staff can manage pos sales" ON public.pos_sales;
CREATE POLICY "Tenant staff can manage pos sales" ON public.pos_sales FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND is_staff()
    AND (is_hq(auth.uid()) OR branch_id IS NULL OR can_access_branch(auth.uid(), branch_id) OR created_by = auth.uid()));

REVOKE EXECUTE ON FUNCTION public.is_hq(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_hq(uuid) TO authenticated;
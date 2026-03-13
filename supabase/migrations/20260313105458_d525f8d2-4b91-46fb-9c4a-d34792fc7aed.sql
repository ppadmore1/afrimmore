
-- Update handle_new_user to create a tenant and link user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_plan_id uuid;
  v_company_name text;
  v_slug text;
BEGIN
  -- Get the starter plan
  SELECT id INTO v_plan_id FROM public.subscription_plans WHERE slug = 'starter' LIMIT 1;
  
  -- Use company name from metadata or default
  v_company_name := COALESCE(NEW.raw_user_meta_data ->> 'company_name', 
                              (NEW.raw_user_meta_data ->> 'full_name') || '''s Business');
  
  -- Generate slug from email prefix + random suffix
  v_slug := LOWER(REPLACE(SPLIT_PART(NEW.email, '@', 1), '.', '-')) || '-' || SUBSTR(gen_random_uuid()::text, 1, 8);
  
  -- Create tenant
  INSERT INTO public.tenants (name, slug, owner_id, plan, max_users, max_branches)
  VALUES (v_company_name, v_slug, NEW.id, 'starter', 2, 1)
  RETURNING id INTO v_tenant_id;
  
  -- Create tenant subscription (14-day trial)
  IF v_plan_id IS NOT NULL THEN
    INSERT INTO public.tenant_subscriptions (tenant_id, plan_id, status, trial_ends_at)
    VALUES (v_tenant_id, v_plan_id, 'trial', now() + interval '14 days');
  END IF;
  
  -- Link user to tenant as owner
  INSERT INTO public.tenant_users (tenant_id, user_id, role, is_owner)
  VALUES (v_tenant_id, NEW.id, 'owner', true);
  
  -- Create profile with tenant_id
  INSERT INTO public.profiles (id, full_name, email, tenant_id)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name', NEW.email, v_tenant_id);
  
  -- Assign default 'admin' role (they're the first user / owner)
  INSERT INTO public.user_roles (user_id, role, tenant_id)
  VALUES (NEW.id, 'admin', v_tenant_id);
  
  -- Create a default branch for the tenant
  INSERT INTO public.branches (name, code, tenant_id)
  VALUES ('Main Branch', 'MAIN', v_tenant_id);
  
  -- Assign user to the default branch
  INSERT INTO public.user_branches (user_id, branch_id, is_default, tenant_id)
  SELECT NEW.id, id, true, v_tenant_id
  FROM public.branches WHERE tenant_id = v_tenant_id AND code = 'MAIN' LIMIT 1;
  
  -- Create default company settings
  INSERT INTO public.company_settings (company_name, tenant_id)
  VALUES (v_company_name, v_tenant_id);
  
  RETURN NEW;
END;
$$;

-- Now update RLS on the most critical tables to be tenant-aware
-- We'll use get_user_tenant_id() to filter by tenant

-- BRANCHES: Drop old policies and create tenant-aware ones
DROP POLICY IF EXISTS "Admins can manage branches" ON public.branches;
DROP POLICY IF EXISTS "Staff can view branches" ON public.branches;

CREATE POLICY "Tenant members can view branches"
  ON public.branches FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant admins can manage branches"
  ON public.branches FOR ALL
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'));

-- PRODUCTS: Drop old and create tenant-aware
DROP POLICY IF EXISTS "Staff can manage products" ON public.products;
DROP POLICY IF EXISTS "Staff can view products" ON public.products;

CREATE POLICY "Tenant members can view products"
  ON public.products FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant staff can manage products"
  ON public.products FOR ALL
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND is_staff());

-- CUSTOMERS
DROP POLICY IF EXISTS "Staff can manage customers" ON public.customers;
DROP POLICY IF EXISTS "Staff can view customers" ON public.customers;

CREATE POLICY "Tenant members can view customers"
  ON public.customers FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant staff can manage customers"
  ON public.customers FOR ALL
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND is_staff());

-- INVOICES
DROP POLICY IF EXISTS "Staff can manage invoices" ON public.invoices;
DROP POLICY IF EXISTS "Staff can view invoices" ON public.invoices;

CREATE POLICY "Tenant members can view invoices"
  ON public.invoices FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant staff can manage invoices"
  ON public.invoices FOR ALL
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND is_staff());

-- POS_SALES
DROP POLICY IF EXISTS "Staff can manage pos sales" ON public.pos_sales;
DROP POLICY IF EXISTS "Staff can view pos sales" ON public.pos_sales;

CREATE POLICY "Tenant members can view pos sales"
  ON public.pos_sales FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant staff can manage pos sales"
  ON public.pos_sales FOR ALL
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND is_staff());

-- PAYMENTS
DROP POLICY IF EXISTS "Staff can manage payments" ON public.payments;
DROP POLICY IF EXISTS "Staff can view payments" ON public.payments;

CREATE POLICY "Tenant members can view payments"
  ON public.payments FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant staff can manage payments"
  ON public.payments FOR ALL
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND is_staff());

-- EXPENSES
DROP POLICY IF EXISTS "Staff can manage expenses" ON public.expenses;
DROP POLICY IF EXISTS "Staff can view expenses" ON public.expenses;

CREATE POLICY "Tenant members can view expenses"
  ON public.expenses FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant staff can manage expenses"
  ON public.expenses FOR ALL
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND is_staff());

-- SUPPLIERS
DROP POLICY IF EXISTS "Staff can manage suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Staff can view suppliers" ON public.suppliers;

CREATE POLICY "Tenant members can view suppliers"
  ON public.suppliers FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant staff can manage suppliers"
  ON public.suppliers FOR ALL
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND is_staff());

-- USER_ROLES: tenant-aware
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own role" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

CREATE POLICY "Tenant members can view roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'));

-- USER_BRANCHES: tenant-aware
DROP POLICY IF EXISTS "Admins can manage branch assignments" ON public.user_branches;
DROP POLICY IF EXISTS "Users can view their branch assignments" ON public.user_branches;

CREATE POLICY "Tenant members can view branch assignments"
  ON public.user_branches FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant admins can manage branch assignments"
  ON public.user_branches FOR ALL
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'));

-- COMPANY_SETTINGS: tenant-aware
DROP POLICY IF EXISTS "Admins can manage company settings" ON public.company_settings;
DROP POLICY IF EXISTS "Staff can view company settings" ON public.company_settings;

CREATE POLICY "Tenant members can view company settings"
  ON public.company_settings FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));

CREATE POLICY "Tenant admins can manage company settings"
  ON public.company_settings FOR ALL
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'));

-- PROFILES: update to be tenant-aware
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Tenant admins can view all tenant profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

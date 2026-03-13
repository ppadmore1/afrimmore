
-- 1. Create tenants table
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  owner_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  plan text NOT NULL DEFAULT 'starter',
  max_users integer NOT NULL DEFAULT 2,
  max_branches integer NOT NULL DEFAULT 1,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create subscription_plans table
CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  price_monthly numeric NOT NULL DEFAULT 0,
  price_yearly numeric NOT NULL DEFAULT 0,
  max_users integer NOT NULL DEFAULT 2,
  max_branches integer NOT NULL DEFAULT 1,
  max_products integer,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Create tenant_subscriptions table
CREATE TABLE public.tenant_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id),
  status text NOT NULL DEFAULT 'trial',
  trial_ends_at timestamptz DEFAULT (now() + interval '14 days'),
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz,
  activated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Create tenant_users junction table (links users to tenants)
CREATE TABLE public.tenant_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  is_owner boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

-- 5. Create security definer function to get user's tenant_id
CREATE OR REPLACE FUNCTION public.get_user_tenant_id(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.tenant_users WHERE user_id = p_user_id LIMIT 1
$$;

-- 6. Create helper to check tenant membership
CREATE OR REPLACE FUNCTION public.is_tenant_member(p_user_id uuid, p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = p_user_id AND tenant_id = p_tenant_id
  )
$$;

-- 7. Create helper to check if user is tenant owner
CREATE OR REPLACE FUNCTION public.is_tenant_owner(p_user_id uuid, p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_users
    WHERE user_id = p_user_id AND tenant_id = p_tenant_id AND is_owner = true
  )
$$;

-- 8. Enable RLS on all new tables
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;

-- 9. RLS for tenants
CREATE POLICY "Users can view their own tenant"
  ON public.tenants FOR SELECT
  TO authenticated
  USING (is_tenant_member(auth.uid(), id));

CREATE POLICY "Tenant owners can update their tenant"
  ON public.tenants FOR UPDATE
  TO authenticated
  USING (is_tenant_owner(auth.uid(), id));

-- 10. RLS for subscription_plans (public read)
CREATE POLICY "Anyone can view active plans"
  ON public.subscription_plans FOR SELECT
  USING (is_active = true);

-- 11. RLS for tenant_subscriptions
CREATE POLICY "Tenant members can view their subscription"
  ON public.tenant_subscriptions FOR SELECT
  TO authenticated
  USING (is_tenant_member(auth.uid(), tenant_id));

-- 12. RLS for tenant_users
CREATE POLICY "Tenant members can view their team"
  ON public.tenant_users FOR SELECT
  TO authenticated
  USING (is_tenant_member(auth.uid(), tenant_id));

CREATE POLICY "Tenant owners can manage team"
  ON public.tenant_users FOR ALL
  TO authenticated
  USING (is_tenant_owner(auth.uid(), tenant_id));

-- 13. Updated_at trigger for tenants
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 14. Updated_at trigger for tenant_subscriptions
CREATE TRIGGER update_tenant_subscriptions_updated_at
  BEFORE UPDATE ON public.tenant_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

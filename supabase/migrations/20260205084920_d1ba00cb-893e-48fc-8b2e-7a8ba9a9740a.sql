-- =============================================
-- 1. AUDIT TRAIL / ACTIVITY LOGS
-- =============================================
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- 'create', 'update', 'delete', 'login', 'logout', etc.
  entity_type TEXT NOT NULL, -- 'product', 'invoice', 'customer', 'pos_sale', etc.
  entity_id UUID,
  entity_name TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_entity ON public.activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_action ON public.activity_logs(action);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all activity logs"
  ON public.activity_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can view their own activity logs"
  ON public.activity_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Staff can insert activity logs"
  ON public.activity_logs FOR INSERT
  WITH CHECK (is_staff());

-- =============================================
-- 2. DISCOUNT CODES & PROMOTIONS
-- =============================================
CREATE TYPE public.discount_type AS ENUM ('percentage', 'fixed_amount');
CREATE TYPE public.promotion_status AS ENUM ('active', 'inactive', 'expired', 'scheduled');

CREATE TABLE public.discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  discount_type discount_type NOT NULL DEFAULT 'percentage',
  discount_value NUMERIC NOT NULL DEFAULT 0,
  min_purchase_amount NUMERIC DEFAULT 0,
  max_discount_amount NUMERIC,
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  per_customer_limit INTEGER DEFAULT 1,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  applicable_products UUID[] DEFAULT '{}',
  applicable_categories UUID[] DEFAULT '{}',
  applicable_branches UUID[] DEFAULT '{}',
  status promotion_status NOT NULL DEFAULT 'active',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_discount_codes_code ON public.discount_codes(code);
CREATE INDEX idx_discount_codes_status ON public.discount_codes(status);
CREATE INDEX idx_discount_codes_valid ON public.discount_codes(valid_from, valid_until);

ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view discount codes"
  ON public.discount_codes FOR SELECT
  USING (is_staff());

CREATE POLICY "Admins can manage discount codes"
  ON public.discount_codes FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Discount code usage tracking
CREATE TABLE public.discount_code_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_code_id UUID REFERENCES public.discount_codes(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  pos_sale_id UUID REFERENCES public.pos_sales(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  discount_amount NUMERIC NOT NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.discount_code_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view discount usage"
  ON public.discount_code_usage FOR SELECT
  USING (is_staff());

CREATE POLICY "Staff can insert discount usage"
  ON public.discount_code_usage FOR INSERT
  WITH CHECK (is_staff());

-- =============================================
-- 3. CUSTOM FIELDS
-- =============================================
CREATE TYPE public.field_type AS ENUM ('text', 'number', 'date', 'boolean', 'select', 'multiselect', 'textarea');

CREATE TABLE public.custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL, -- 'product', 'customer', 'invoice', etc.
  field_name TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type field_type NOT NULL DEFAULT 'text',
  options JSONB DEFAULT '[]', -- For select/multiselect fields
  is_required BOOLEAN DEFAULT false,
  default_value TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(entity_type, field_name)
);

ALTER TABLE public.custom_field_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view custom field definitions"
  ON public.custom_field_definitions FOR SELECT
  USING (is_staff());

CREATE POLICY "Admins can manage custom field definitions"
  ON public.custom_field_definitions FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE TABLE public.custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_definition_id UUID REFERENCES public.custom_field_definitions(id) ON DELETE CASCADE NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  value TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(field_definition_id, entity_id)
);

CREATE INDEX idx_custom_field_values_entity ON public.custom_field_values(entity_type, entity_id);

ALTER TABLE public.custom_field_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view custom field values"
  ON public.custom_field_values FOR SELECT
  USING (is_staff());

CREATE POLICY "Staff can manage custom field values"
  ON public.custom_field_values FOR ALL
  USING (is_staff());

-- =============================================
-- 4. EMPLOYEE TIME TRACKING
-- =============================================
CREATE TYPE public.clock_status AS ENUM ('clocked_in', 'clocked_out', 'on_break');

CREATE TABLE public.employee_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  break_minutes INTEGER DEFAULT 0,
  total_hours NUMERIC GENERATED ALWAYS AS (
    CASE 
      WHEN clock_out IS NOT NULL 
      THEN ROUND(EXTRACT(EPOCH FROM (clock_out - clock_in)) / 3600 - (break_minutes::NUMERIC / 60), 2)
      ELSE NULL 
    END
  ) STORED,
  status clock_status NOT NULL DEFAULT 'clocked_in',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_time_entries_user ON public.employee_time_entries(user_id);
CREATE INDEX idx_time_entries_branch ON public.employee_time_entries(branch_id);
CREATE INDEX idx_time_entries_clock_in ON public.employee_time_entries(clock_in DESC);

ALTER TABLE public.employee_time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own time entries"
  ON public.employee_time_entries FOR SELECT
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert their own time entries"
  ON public.employee_time_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own time entries"
  ON public.employee_time_entries FOR UPDATE
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete time entries"
  ON public.employee_time_entries FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- Break tracking
CREATE TABLE public.employee_breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id UUID REFERENCES public.employee_time_entries(id) ON DELETE CASCADE NOT NULL,
  break_start TIMESTAMPTZ NOT NULL,
  break_end TIMESTAMPTZ,
  break_type TEXT DEFAULT 'regular', -- 'regular', 'lunch', etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_breaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own breaks"
  ON public.employee_breaks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.employee_time_entries 
      WHERE id = time_entry_id AND (user_id = auth.uid() OR has_role(auth.uid(), 'admin'))
    )
  );

-- Function to log activities
CREATE OR REPLACE FUNCTION public.log_activity(
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID DEFAULT NULL,
  p_entity_name TEXT DEFAULT NULL,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
  v_branch_id UUID;
BEGIN
  -- Get user's default branch
  SELECT branch_id INTO v_branch_id
  FROM user_branches
  WHERE user_id = auth.uid() AND is_default = true
  LIMIT 1;

  INSERT INTO activity_logs (
    user_id, branch_id, action, entity_type, entity_id, 
    entity_name, old_values, new_values, metadata
  ) VALUES (
    auth.uid(), v_branch_id, p_action, p_entity_type, p_entity_id,
    p_entity_name, p_old_values, p_new_values, p_metadata
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- Trigger to update discount code usage count
CREATE OR REPLACE FUNCTION public.update_discount_usage_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE discount_codes
  SET usage_count = usage_count + 1
  WHERE id = NEW.discount_code_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_discount_usage
AFTER INSERT ON public.discount_code_usage
FOR EACH ROW
EXECUTE FUNCTION public.update_discount_usage_count();

-- Update timestamps triggers
CREATE TRIGGER update_discount_codes_updated_at
BEFORE UPDATE ON public.discount_codes
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_field_definitions_updated_at
BEFORE UPDATE ON public.custom_field_definitions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_custom_field_values_updated_at
BEFORE UPDATE ON public.custom_field_values
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employee_time_entries_updated_at
BEFORE UPDATE ON public.employee_time_entries
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
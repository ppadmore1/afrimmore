
-- POS Shifts table for cashier shift tracking
CREATE TABLE public.pos_shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  branch_id UUID REFERENCES public.branches(id),
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  opening_float NUMERIC NOT NULL DEFAULT 0,
  expected_cash NUMERIC NOT NULL DEFAULT 0,
  actual_cash NUMERIC,
  cash_difference NUMERIC,
  total_sales NUMERIC NOT NULL DEFAULT 0,
  total_transactions INTEGER NOT NULL DEFAULT 0,
  cash_sales NUMERIC NOT NULL DEFAULT 0,
  card_sales NUMERIC NOT NULL DEFAULT 0,
  mobile_money_sales NUMERIC NOT NULL DEFAULT 0,
  bank_transfer_sales NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  closed_by UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add shift_id to pos_sales
ALTER TABLE public.pos_sales ADD COLUMN shift_id UUID REFERENCES public.pos_shifts(id);

-- Manager override log for voids, refunds, discounts
CREATE TABLE public.manager_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id UUID REFERENCES public.pos_shifts(id),
  sale_id UUID REFERENCES public.pos_sales(id),
  action_type TEXT NOT NULL, -- 'void', 'refund', 'discount_override', 'price_override'
  manager_id UUID NOT NULL,
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Manager PIN on profiles
ALTER TABLE public.profiles ADD COLUMN manager_pin TEXT;

-- Enable RLS
ALTER TABLE public.pos_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manager_overrides ENABLE ROW LEVEL SECURITY;

-- RLS for pos_shifts
CREATE POLICY "Staff can view own shifts" ON public.pos_shifts
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can open shifts" ON public.pos_shifts
  FOR INSERT TO authenticated WITH CHECK (is_staff());

CREATE POLICY "Staff can close own shifts, admins can close any" ON public.pos_shifts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

-- RLS for manager_overrides
CREATE POLICY "Staff can view overrides" ON public.manager_overrides
  FOR SELECT TO authenticated USING (is_staff());

CREATE POLICY "Managers can create overrides" ON public.manager_overrides
  FOR INSERT TO authenticated WITH CHECK (is_staff());

-- Function to verify manager PIN
CREATE OR REPLACE FUNCTION public.verify_manager_pin(p_pin TEXT)
RETURNS TABLE(manager_id UUID, manager_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.full_name
  FROM profiles p
  JOIN user_roles ur ON ur.user_id = p.id
  WHERE ur.role IN ('admin')
    AND p.manager_pin = p_pin
    AND p.manager_pin IS NOT NULL
  LIMIT 1;
END;
$$;

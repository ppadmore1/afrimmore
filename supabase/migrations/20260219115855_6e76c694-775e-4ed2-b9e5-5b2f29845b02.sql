
-- Add min_discount_percent to products for admin-controlled discount floor
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS min_discount_percent numeric DEFAULT 0;

-- Add discount_approval_requests table for agent -> admin approval flow
CREATE TABLE IF NOT EXISTS public.discount_approval_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  requested_discount numeric NOT NULL,
  min_allowed_discount numeric NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.discount_approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can create discount requests"
ON public.discount_approval_requests FOR INSERT
WITH CHECK (is_staff());

CREATE POLICY "Staff can view own requests, admins can view all"
ON public.discount_approval_requests FOR SELECT
USING (
  auth.uid() = requested_by OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update discount requests"
ON public.discount_approval_requests FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Expenses table for tracking business expenses
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_number text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text DEFAULT 'cash',
  reference text,
  vendor text,
  branch_id uuid REFERENCES public.branches(id),
  created_by uuid,
  receipt_url text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage expenses"
ON public.expenses FOR ALL
USING (is_staff());

CREATE POLICY "Staff can view expenses"
ON public.expenses FOR SELECT
USING (is_staff());

-- Trigger for updated_at on expenses
CREATE OR REPLACE FUNCTION public.update_expenses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_expenses_updated_at
BEFORE UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.update_expenses_updated_at();

-- Stock addition tracking - add a column to stock_movements for cost info
ALTER TABLE public.stock_movements
ADD COLUMN IF NOT EXISTS unit_cost numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_cost numeric DEFAULT 0;

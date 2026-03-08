
-- Vendor Bills / Accounts Payable
CREATE TABLE public.vendor_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  bill_number text NOT NULL,
  supplier_name text NOT NULL,
  bill_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date,
  subtotal numeric NOT NULL DEFAULT 0,
  tax_total numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  payment_method text,
  reference text,
  notes text,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.vendor_bill_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES public.vendor_bills(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_cost numeric NOT NULL DEFAULT 0,
  tax_rate numeric DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.vendor_bill_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES public.vendor_bills(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text NOT NULL DEFAULT 'cash',
  reference text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vendor_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_bill_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_bill_payments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Staff can manage vendor bills" ON public.vendor_bills FOR ALL USING (is_staff());
CREATE POLICY "Staff can view vendor bills" ON public.vendor_bills FOR SELECT USING (is_staff());
CREATE POLICY "Staff can manage vendor bill items" ON public.vendor_bill_items FOR ALL USING (is_staff());
CREATE POLICY "Staff can view vendor bill items" ON public.vendor_bill_items FOR SELECT USING (is_staff());
CREATE POLICY "Staff can manage vendor bill payments" ON public.vendor_bill_payments FOR ALL USING (is_staff());
CREATE POLICY "Staff can view vendor bill payments" ON public.vendor_bill_payments FOR SELECT USING (is_staff());

-- Updated at trigger
CREATE TRIGGER update_vendor_bills_updated_at BEFORE UPDATE ON public.vendor_bills
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

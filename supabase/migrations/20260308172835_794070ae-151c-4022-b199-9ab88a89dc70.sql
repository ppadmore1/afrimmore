
-- Batch/Lot tracking for products
CREATE TABLE public.product_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  batch_number text NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  remaining_quantity integer NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  manufacture_date date,
  expiry_date date,
  received_date date NOT NULL DEFAULT CURRENT_DATE,
  supplier_id uuid REFERENCES public.suppliers(id),
  purchase_order_id uuid REFERENCES public.purchase_orders(id),
  branch_id uuid REFERENCES public.branches(id),
  notes text,
  status text NOT NULL DEFAULT 'active',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view product batches" ON public.product_batches FOR SELECT USING (is_staff());
CREATE POLICY "Staff can manage product batches" ON public.product_batches FOR ALL USING (is_staff());

-- Add batch_id reference to stock_movements for traceability
ALTER TABLE public.stock_movements ADD COLUMN batch_id uuid REFERENCES public.product_batches(id);

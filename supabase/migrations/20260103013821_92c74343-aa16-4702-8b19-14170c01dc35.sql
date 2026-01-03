-- Create table for tracking goods receiving history
CREATE TABLE public.goods_receipts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  received_by UUID REFERENCES auth.users(id),
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for receipt line items
CREATE TABLE public.goods_receipt_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  goods_receipt_id UUID NOT NULL REFERENCES public.goods_receipts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity_received INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receipt_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for goods_receipts
CREATE POLICY "Staff can manage goods receipts"
ON public.goods_receipts FOR ALL USING (is_staff());

CREATE POLICY "Staff can view goods receipts"
ON public.goods_receipts FOR SELECT USING (is_staff());

-- RLS policies for goods_receipt_items
CREATE POLICY "Staff can manage goods receipt items"
ON public.goods_receipt_items FOR ALL USING (is_staff());

CREATE POLICY "Staff can view goods receipt items"
ON public.goods_receipt_items FOR SELECT USING (is_staff());
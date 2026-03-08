
-- =============================================
-- 1. WAREHOUSE LOCATIONS (bin/shelf tracking)
-- =============================================
CREATE TABLE public.warehouse_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  zone TEXT,
  aisle TEXT,
  shelf TEXT,
  bin TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.warehouse_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view warehouse locations" ON public.warehouse_locations
  FOR SELECT TO authenticated USING (is_staff());

CREATE POLICY "Staff can manage warehouse locations" ON public.warehouse_locations
  FOR ALL TO authenticated USING (is_staff());

-- Add location_id to product_branches for bin assignment
ALTER TABLE public.product_branches ADD COLUMN location_id UUID REFERENCES public.warehouse_locations(id);

-- =============================================
-- 2. STOCK TRANSFERS
-- =============================================
CREATE TABLE public.stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_number TEXT NOT NULL UNIQUE,
  from_branch_id UUID NOT NULL REFERENCES public.branches(id),
  to_branch_id UUID NOT NULL REFERENCES public.branches(id),
  status TEXT NOT NULL DEFAULT 'draft',
  requested_by UUID REFERENCES auth.users(id),
  approved_by UUID,
  shipped_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.stock_transfer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity_requested INT NOT NULL DEFAULT 0,
  quantity_shipped INT DEFAULT 0,
  quantity_received INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfer_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view stock transfers" ON public.stock_transfers
  FOR SELECT TO authenticated USING (is_staff());
CREATE POLICY "Staff can manage stock transfers" ON public.stock_transfers
  FOR ALL TO authenticated USING (is_staff());

CREATE POLICY "Staff can view stock transfer items" ON public.stock_transfer_items
  FOR SELECT TO authenticated USING (is_staff());
CREATE POLICY "Staff can manage stock transfer items" ON public.stock_transfer_items
  FOR ALL TO authenticated USING (is_staff());

-- =============================================
-- 3. INVENTORY ADJUSTMENTS
-- =============================================
CREATE TABLE public.inventory_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_number TEXT NOT NULL UNIQUE,
  branch_id UUID NOT NULL REFERENCES public.branches(id),
  reason TEXT NOT NULL DEFAULT 'stock_count',
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  adjusted_by UUID REFERENCES auth.users(id),
  approved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.inventory_adjustment_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_id UUID NOT NULL REFERENCES public.inventory_adjustments(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  current_quantity INT NOT NULL DEFAULT 0,
  new_quantity INT NOT NULL DEFAULT 0,
  difference INT NOT NULL DEFAULT 0,
  unit_cost NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_adjustment_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view inventory adjustments" ON public.inventory_adjustments
  FOR SELECT TO authenticated USING (is_staff());
CREATE POLICY "Staff can manage inventory adjustments" ON public.inventory_adjustments
  FOR ALL TO authenticated USING (is_staff());

CREATE POLICY "Staff can view inventory adjustment items" ON public.inventory_adjustment_items
  FOR SELECT TO authenticated USING (is_staff());
CREATE POLICY "Staff can manage inventory adjustment items" ON public.inventory_adjustment_items
  FOR ALL TO authenticated USING (is_staff());

-- =============================================
-- 4. PRODUCT BUNDLES / COMPOSITE ITEMS
-- =============================================
CREATE TABLE public.product_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  auto_deduct_stock BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(parent_product_id)
);

CREATE TABLE public.product_bundle_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id UUID NOT NULL REFERENCES public.product_bundles(id) ON DELETE CASCADE,
  component_product_id UUID NOT NULL REFERENCES public.products(id),
  quantity NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.product_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_bundle_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view product bundles" ON public.product_bundles
  FOR SELECT TO authenticated USING (is_staff());
CREATE POLICY "Staff can manage product bundles" ON public.product_bundles
  FOR ALL TO authenticated USING (is_staff());

CREATE POLICY "Staff can view bundle components" ON public.product_bundle_components
  FOR SELECT TO authenticated USING (is_staff());
CREATE POLICY "Staff can manage bundle components" ON public.product_bundle_components
  FOR ALL TO authenticated USING (is_staff());

-- Add is_bundle flag to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_bundle BOOLEAN DEFAULT false;

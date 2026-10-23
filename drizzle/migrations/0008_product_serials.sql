CREATE TABLE public.product_serials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  serial_number text NOT NULL,
  status text NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_stock','sold','returned','damaged')),
  pos_sale_id uuid REFERENCES public.pos_sales(id) ON DELETE SET NULL,
  sold_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, serial_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_serials TO authenticated;
GRANT ALL ON public.product_serials TO service_role;
ALTER TABLE public.product_serials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members view serials" ON public.product_serials FOR SELECT TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant staff manage serials" ON public.product_serials FOR ALL TO authenticated
  USING (tenant_id = get_user_tenant_id(auth.uid()) AND is_staff())
  WITH CHECK (tenant_id = get_user_tenant_id(auth.uid()) AND is_staff());
CREATE TRIGGER trg_set_tenant_id BEFORE INSERT ON public.product_serials FOR EACH ROW EXECUTE FUNCTION set_tenant_id_default();
CREATE INDEX idx_product_serials_product ON public.product_serials(product_id);
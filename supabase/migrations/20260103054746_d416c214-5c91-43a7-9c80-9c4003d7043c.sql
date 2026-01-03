-- Create receipts table for standalone receipt generation
CREATE TABLE public.receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text NOT NULL,
  customer_id uuid REFERENCES public.customers(id),
  customer_name text NOT NULL,
  customer_email text,
  customer_address text,
  invoice_id uuid REFERENCES public.invoices(id),
  payment_method payment_method NOT NULL DEFAULT 'cash',
  subtotal numeric NOT NULL DEFAULT 0,
  tax_total numeric NOT NULL DEFAULT 0,
  discount_total numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  amount_received numeric NOT NULL DEFAULT 0,
  change_amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  branch_id uuid REFERENCES public.branches(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create receipt items table
CREATE TABLE public.receipt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  description text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  discount numeric DEFAULT 0,
  tax_rate numeric DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create company settings table for template customization
CREATE TABLE public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES public.branches(id),
  company_name text NOT NULL DEFAULT 'My Company',
  logo_url text,
  address text,
  city text,
  country text,
  phone text,
  email text,
  website text,
  tax_id text,
  header_text text,
  footer_text text,
  primary_color text DEFAULT '#3B82F6',
  secondary_color text DEFAULT '#1E40AF',
  font_family text DEFAULT 'Helvetica',
  currency_symbol text DEFAULT '$',
  currency_code text DEFAULT 'USD',
  date_format text DEFAULT 'MM/dd/yyyy',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(branch_id)
);

-- Enable RLS
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for receipts
CREATE POLICY "Staff can manage receipts" ON public.receipts
FOR ALL USING (is_staff());

CREATE POLICY "Staff can view receipts" ON public.receipts
FOR SELECT USING (is_staff());

-- RLS policies for receipt items
CREATE POLICY "Staff can manage receipt items" ON public.receipt_items
FOR ALL USING (is_staff());

CREATE POLICY "Staff can view receipt items" ON public.receipt_items
FOR SELECT USING (is_staff());

-- RLS policies for company settings
CREATE POLICY "Staff can view company settings" ON public.company_settings
FOR SELECT USING (is_staff());

CREATE POLICY "Admins can manage company settings" ON public.company_settings
FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Add trigger for updated_at
CREATE TRIGGER update_receipts_updated_at
  BEFORE UPDATE ON public.receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default company settings
INSERT INTO public.company_settings (company_name, address, city, country, phone, email)
VALUES ('AfrimMore', '123 Business Street', 'Lagos', 'Nigeria', '+234 123 456 7890', 'info@afrimmore.com');
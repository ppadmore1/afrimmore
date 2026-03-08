
-- Bank Reconciliation tables
CREATE TABLE public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  account_number text,
  bank_name text,
  currency_code text NOT NULL DEFAULT 'USD',
  opening_balance numeric NOT NULL DEFAULT 0,
  current_balance numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view bank accounts" ON public.bank_accounts FOR SELECT USING (is_staff());
CREATE POLICY "Admins can manage bank accounts" ON public.bank_accounts FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  type text NOT NULL DEFAULT 'debit',
  reference text,
  matched_entity_type text,
  matched_entity_id uuid,
  status text NOT NULL DEFAULT 'unmatched',
  imported_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view bank transactions" ON public.bank_transactions FOR SELECT USING (is_staff());
CREATE POLICY "Staff can manage bank transactions" ON public.bank_transactions FOR ALL USING (is_staff());

-- Multi-Currency tables
CREATE TABLE public.currencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  symbol text NOT NULL DEFAULT '$',
  is_base boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view currencies" ON public.currencies FOR SELECT USING (is_staff());
CREATE POLICY "Admins can manage currencies" ON public.currencies FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency text NOT NULL,
  to_currency text NOT NULL,
  rate numeric NOT NULL DEFAULT 1,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view exchange rates" ON public.exchange_rates FOR SELECT USING (is_staff());
CREATE POLICY "Staff can manage exchange rates" ON public.exchange_rates FOR ALL USING (is_staff());

-- Inventory Valuation table
CREATE TABLE public.inventory_valuations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  valuation_method text NOT NULL DEFAULT 'weighted_average',
  unit_cost numeric NOT NULL DEFAULT 0,
  total_quantity integer NOT NULL DEFAULT 0,
  total_value numeric NOT NULL DEFAULT 0,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_valuations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view inventory valuations" ON public.inventory_valuations FOR SELECT USING (is_staff());
CREATE POLICY "Staff can manage inventory valuations" ON public.inventory_valuations FOR ALL USING (is_staff());

-- Tax Configuration tables
CREATE TABLE public.tax_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  rate numeric NOT NULL DEFAULT 0,
  tax_type text NOT NULL DEFAULT 'VAT',
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view tax rates" ON public.tax_rates FOR SELECT USING (is_staff());
CREATE POLICY "Admins can manage tax rates" ON public.tax_rates FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.tax_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start date NOT NULL,
  period_end date NOT NULL,
  tax_type text NOT NULL DEFAULT 'VAT',
  total_output_tax numeric NOT NULL DEFAULT 0,
  total_input_tax numeric NOT NULL DEFAULT 0,
  net_tax numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  filed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tax_returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view tax returns" ON public.tax_returns FOR SELECT USING (is_staff());
CREATE POLICY "Staff can manage tax returns" ON public.tax_returns FOR ALL USING (is_staff());

-- Seed base currency
INSERT INTO public.currencies (code, name, symbol, is_base) VALUES ('USD', 'US Dollar', '$', true);

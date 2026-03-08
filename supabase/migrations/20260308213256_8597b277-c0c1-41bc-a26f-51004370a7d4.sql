
-- =============================================
-- CHART OF ACCOUNTS
-- =============================================
CREATE TYPE public.account_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');
CREATE TYPE public.account_subtype AS ENUM (
  'current_asset', 'fixed_asset', 'other_asset',
  'current_liability', 'long_term_liability',
  'owner_equity', 'retained_earnings',
  'operating_revenue', 'other_revenue',
  'cost_of_goods_sold', 'operating_expense', 'other_expense'
);

CREATE TABLE public.chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_code TEXT NOT NULL UNIQUE,
  account_name TEXT NOT NULL,
  account_type account_type NOT NULL,
  account_subtype account_subtype,
  parent_account_id UUID REFERENCES public.chart_of_accounts(id),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_system BOOLEAN NOT NULL DEFAULT false,
  opening_balance NUMERIC NOT NULL DEFAULT 0,
  current_balance NUMERIC NOT NULL DEFAULT 0,
  normal_balance TEXT NOT NULL DEFAULT 'debit',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view chart of accounts" ON public.chart_of_accounts FOR SELECT TO authenticated USING (is_staff());
CREATE POLICY "Admins can manage chart of accounts" ON public.chart_of_accounts FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- FISCAL PERIODS
-- =============================================
CREATE TABLE public.fiscal_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  closed_by UUID,
  closed_at TIMESTAMPTZ,
  retained_earnings_entry_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.fiscal_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view fiscal periods" ON public.fiscal_periods FOR SELECT TO authenticated USING (is_staff());
CREATE POLICY "Admins can manage fiscal periods" ON public.fiscal_periods FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- JOURNAL ENTRIES
-- =============================================
CREATE TABLE public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number TEXT NOT NULL UNIQUE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  fiscal_period_id UUID REFERENCES public.fiscal_periods(id),
  status TEXT NOT NULL DEFAULT 'draft',
  is_auto_generated BOOLEAN NOT NULL DEFAULT false,
  posted_by UUID,
  posted_at TIMESTAMPTZ,
  created_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id),
  description TEXT,
  debit NUMERIC NOT NULL DEFAULT 0,
  credit NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view journal entries" ON public.journal_entries FOR SELECT TO authenticated USING (is_staff());
CREATE POLICY "Staff can manage journal entries" ON public.journal_entries FOR ALL TO authenticated USING (is_staff());

CREATE POLICY "Staff can view journal entry lines" ON public.journal_entry_lines FOR SELECT TO authenticated USING (is_staff());
CREATE POLICY "Staff can manage journal entry lines" ON public.journal_entry_lines FOR ALL TO authenticated USING (is_staff());

-- =============================================
-- SEED DEFAULT CHART OF ACCOUNTS (IFRS-aligned)
-- =============================================
INSERT INTO public.chart_of_accounts (account_code, account_name, account_type, account_subtype, normal_balance, is_system, description) VALUES
-- Assets
('1000', 'Cash and Cash Equivalents', 'asset', 'current_asset', 'debit', true, 'All cash on hand and bank accounts'),
('1010', 'Petty Cash', 'asset', 'current_asset', 'debit', false, 'Petty cash fund'),
('1100', 'Accounts Receivable', 'asset', 'current_asset', 'debit', true, 'Amounts owed by customers'),
('1200', 'Inventory', 'asset', 'current_asset', 'debit', true, 'Goods held for sale'),
('1300', 'Prepaid Expenses', 'asset', 'current_asset', 'debit', false, 'Expenses paid in advance'),
('1500', 'Property, Plant & Equipment', 'asset', 'fixed_asset', 'debit', false, 'Tangible fixed assets'),
('1510', 'Accumulated Depreciation', 'asset', 'fixed_asset', 'credit', false, 'Contra-asset for depreciation'),
('1900', 'Other Assets', 'asset', 'other_asset', 'debit', false, 'Miscellaneous assets'),
-- Liabilities
('2000', 'Accounts Payable', 'liability', 'current_liability', 'credit', true, 'Amounts owed to suppliers'),
('2100', 'Accrued Expenses', 'liability', 'current_liability', 'credit', false, 'Expenses incurred but not yet paid'),
('2200', 'Sales Tax Payable', 'liability', 'current_liability', 'credit', true, 'Tax collected on behalf of government'),
('2300', 'Short-term Loans', 'liability', 'current_liability', 'credit', false, 'Loans due within 12 months'),
('2500', 'Long-term Loans', 'liability', 'long_term_liability', 'credit', false, 'Loans due after 12 months'),
-- Equity
('3000', 'Owner''s Equity / Capital', 'equity', 'owner_equity', 'credit', true, 'Owner investment in business'),
('3100', 'Retained Earnings', 'equity', 'retained_earnings', 'credit', true, 'Accumulated profits'),
('3200', 'Drawings / Distributions', 'equity', 'owner_equity', 'debit', false, 'Owner withdrawals'),
-- Revenue
('4000', 'Sales Revenue', 'revenue', 'operating_revenue', 'credit', true, 'Income from product/service sales'),
('4100', 'Service Revenue', 'revenue', 'operating_revenue', 'credit', false, 'Income from services'),
('4500', 'Other Income', 'revenue', 'other_revenue', 'credit', false, 'Non-operating income'),
('4600', 'Discount Allowed', 'revenue', 'operating_revenue', 'debit', false, 'Discounts given to customers'),
('4700', 'Foreign Exchange Gains', 'revenue', 'other_revenue', 'credit', false, 'Gains from currency conversion'),
-- Expenses
('5000', 'Cost of Goods Sold', 'expense', 'cost_of_goods_sold', 'debit', true, 'Direct cost of products sold'),
('6000', 'Salaries & Wages', 'expense', 'operating_expense', 'debit', false, 'Employee compensation'),
('6100', 'Rent Expense', 'expense', 'operating_expense', 'debit', false, 'Rental costs'),
('6200', 'Utilities Expense', 'expense', 'operating_expense', 'debit', false, 'Electricity, water, internet'),
('6300', 'Office Supplies', 'expense', 'operating_expense', 'debit', false, 'Stationery and office materials'),
('6400', 'Marketing & Advertising', 'expense', 'operating_expense', 'debit', false, 'Promotional expenses'),
('6500', 'Insurance Expense', 'expense', 'operating_expense', 'debit', false, 'Business insurance premiums'),
('6600', 'Depreciation Expense', 'expense', 'operating_expense', 'debit', false, 'Periodic asset depreciation'),
('6700', 'Bank Charges & Fees', 'expense', 'operating_expense', 'debit', false, 'Banking service fees'),
('6800', 'Travel & Transport', 'expense', 'operating_expense', 'debit', false, 'Business travel costs'),
('6900', 'Repairs & Maintenance', 'expense', 'operating_expense', 'debit', false, 'Asset upkeep costs'),
('7000', 'Professional Fees', 'expense', 'operating_expense', 'debit', false, 'Legal, accounting, consulting'),
('7500', 'Foreign Exchange Losses', 'expense', 'other_expense', 'debit', false, 'Losses from currency conversion'),
('7900', 'Miscellaneous Expense', 'expense', 'other_expense', 'debit', false, 'Uncategorized expenses');

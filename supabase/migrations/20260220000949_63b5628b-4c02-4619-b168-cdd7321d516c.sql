
-- Approval thresholds table (configurable by admin)
CREATE TABLE IF NOT EXISTS public.approval_thresholds (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action_type text NOT NULL DEFAULT 'purchase',
  label text NOT NULL,
  min_amount numeric NOT NULL DEFAULT 0,
  max_amount numeric,
  approver_role text NOT NULL DEFAULT 'admin',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.approval_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage approval thresholds"
  ON public.approval_thresholds FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can view approval thresholds"
  ON public.approval_thresholds FOR SELECT
  USING (is_staff());

-- Branch reports table
CREATE TABLE IF NOT EXISTS public.branch_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id uuid NOT NULL,
  report_type text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  total_sales numeric NOT NULL DEFAULT 0,
  total_expenses numeric NOT NULL DEFAULT 0,
  total_profit numeric NOT NULL DEFAULT 0,
  stock_movements_count integer NOT NULL DEFAULT 0,
  notes text,
  submitted_by uuid,
  submitted_at timestamp with time zone,
  approved_by uuid,
  approved_at timestamp with time zone,
  data jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.branch_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage branch reports"
  ON public.branch_reports FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can view and submit branch reports"
  ON public.branch_reports FOR ALL
  USING (is_staff());

-- Branch grades table
CREATE TABLE IF NOT EXISTS public.branch_grades (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id uuid NOT NULL,
  period_type text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  revenue_score numeric DEFAULT 0,
  expense_score numeric DEFAULT 0,
  stock_score numeric DEFAULT 0,
  attendance_score numeric DEFAULT 0,
  overall_score numeric DEFAULT 0,
  grade text DEFAULT 'N/A',
  notes text,
  graded_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.branch_grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage branch grades"
  ON public.branch_grades FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can view branch grades"
  ON public.branch_grades FOR SELECT
  USING (is_staff());

-- Audit visits table
CREATE TABLE IF NOT EXISTS public.audit_visits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id uuid NOT NULL,
  auditor_id uuid NOT NULL,
  visit_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'in_progress',
  stock_ok boolean,
  cash_ok boolean,
  staff_ok boolean,
  reports_ok boolean,
  stock_notes text,
  cash_notes text,
  staff_notes text,
  reports_notes text,
  overall_notes text,
  overall_score integer,
  is_surprise boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage audits"
  ON public.audit_visits FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default approval thresholds
INSERT INTO public.approval_thresholds (action_type, label, min_amount, max_amount, approver_role) VALUES
  ('purchase', 'Small Purchase (up to $100)', 0, 100, 'staff'),
  ('purchase', 'Medium Purchase ($100–$500)', 100, 500, 'admin'),
  ('purchase', 'Large Purchase (above $500)', 500, NULL, 'admin');

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION public.update_branch_reports_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER update_branch_reports_updated_at
  BEFORE UPDATE ON public.branch_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_branch_reports_updated_at();

CREATE TRIGGER update_branch_grades_updated_at
  BEFORE UPDATE ON public.branch_grades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_audit_visits_updated_at
  BEFORE UPDATE ON public.audit_visits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_approval_thresholds_updated_at
  BEFORE UPDATE ON public.approval_thresholds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

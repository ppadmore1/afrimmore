ALTER TABLE public.pos_shifts
  ADD COLUMN IF NOT EXISTS counted_usd numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS counted_lrd numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lrd_rate numeric DEFAULT 195,
  ADD COLUMN IF NOT EXISTS counted_mobile_money numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mobile_money_difference numeric DEFAULT 0;

CREATE TABLE public.email_report_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL DEFAULT public.get_user_tenant_id(auth.uid()),
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  recipients text[] NOT NULL DEFAULT '{}',
  send_time text NOT NULL DEFAULT '20:00',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX email_report_settings_uniq ON public.email_report_settings (tenant_id, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_report_settings TO authenticated;
GRANT ALL ON public.email_report_settings TO service_role;
ALTER TABLE public.email_report_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant admins manage report settings" ON public.email_report_settings
  FOR ALL TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()) AND public.has_role(auth.uid(), 'admin'));
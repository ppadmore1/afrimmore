CREATE TABLE public.insight_forecast_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid DEFAULT get_user_tenant_id(auth.uid()),
  product_id uuid NOT NULL,
  branch_scope text NOT NULL DEFAULT 'all',
  predicted_daily numeric NOT NULL,
  history_days integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.insight_forecast_snapshots TO authenticated;
GRANT ALL ON public.insight_forecast_snapshots TO service_role;
ALTER TABLE public.insight_forecast_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members read forecasts" ON public.insight_forecast_snapshots FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE POLICY "Tenant members save forecasts" ON public.insight_forecast_snapshots FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant_id(auth.uid()));
CREATE INDEX insight_forecast_snapshots_lookup ON public.insight_forecast_snapshots (tenant_id, product_id, created_at DESC);
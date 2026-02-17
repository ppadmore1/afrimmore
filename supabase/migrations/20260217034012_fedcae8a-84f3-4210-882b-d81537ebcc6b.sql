
-- Add optional project_code to invoices and quotations
ALTER TABLE public.invoices ADD COLUMN project_code text DEFAULT NULL;
ALTER TABLE public.quotations ADD COLUMN project_code text DEFAULT NULL;

-- Add quotation_id to invoices to link invoice to a quotation
ALTER TABLE public.invoices ADD COLUMN quotation_id uuid DEFAULT NULL REFERENCES public.quotations(id);

-- Create index for quotation_id lookup
CREATE INDEX idx_invoices_quotation_id ON public.invoices(quotation_id);
CREATE INDEX idx_invoices_project_code ON public.invoices(project_code);
CREATE INDEX idx_quotations_project_code ON public.quotations(project_code);

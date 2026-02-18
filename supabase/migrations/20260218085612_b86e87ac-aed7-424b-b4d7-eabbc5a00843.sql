
-- Create document_templates table
CREATE TABLE public.document_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN ('invoice', 'quotation', 'delivery_note', 'receipt')),
  template_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  field_positions JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.document_templates ENABLE ROW LEVEL SECURITY;

-- Admins can manage templates
CREATE POLICY "Admins can manage document templates"
ON public.document_templates
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Staff can view active templates
CREATE POLICY "Staff can view document templates"
ON public.document_templates
FOR SELECT
USING (is_staff());

-- Updated at trigger
CREATE TRIGGER update_document_templates_updated_at
BEFORE UPDATE ON public.document_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create templates storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('document-templates', 'document-templates', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for document-templates bucket
CREATE POLICY "Admins can upload document templates"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'document-templates' AND is_staff());

CREATE POLICY "Admins can update document templates"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'document-templates' AND is_staff());

CREATE POLICY "Admins can delete document templates"
ON storage.objects
FOR DELETE
USING (bucket_id = 'document-templates' AND is_staff());

CREATE POLICY "Anyone can view document templates"
ON storage.objects
FOR SELECT
USING (bucket_id = 'document-templates');

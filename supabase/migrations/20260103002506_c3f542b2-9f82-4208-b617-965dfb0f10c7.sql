-- Create branches table
CREATE TABLE public.branches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  address TEXT,
  city TEXT,
  phone TEXT,
  email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_branches table to assign users to branches
CREATE TABLE public.user_branches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, branch_id)
);

-- Create product_branches table for branch-specific inventory
CREATE TABLE public.product_branches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, branch_id)
);

-- Add branch_id to pos_sales
ALTER TABLE public.pos_sales ADD COLUMN branch_id UUID REFERENCES public.branches(id);

-- Add branch_id to stock_movements
ALTER TABLE public.stock_movements ADD COLUMN branch_id UUID REFERENCES public.branches(id);

-- Enable RLS on new tables
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_branches ENABLE ROW LEVEL SECURITY;

-- Branches policies
CREATE POLICY "Staff can view branches" ON public.branches
FOR SELECT USING (is_staff());

CREATE POLICY "Admins can manage branches" ON public.branches
FOR ALL USING (has_role(auth.uid(), 'admin'));

-- User branches policies
CREATE POLICY "Users can view their branch assignments" ON public.user_branches
FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage branch assignments" ON public.user_branches
FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Product branches policies (staff can view/manage their branch's inventory)
CREATE POLICY "Staff can view product branches" ON public.product_branches
FOR SELECT USING (is_staff());

CREATE POLICY "Staff can manage their branch inventory" ON public.product_branches
FOR ALL USING (
  is_staff() AND (
    has_role(auth.uid(), 'admin') OR
    EXISTS (
      SELECT 1 FROM public.user_branches 
      WHERE user_id = auth.uid() AND branch_id = product_branches.branch_id
    )
  )
);

-- Create function to get user's accessible branches
CREATE OR REPLACE FUNCTION public.get_user_branches(p_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT branch_id FROM public.user_branches WHERE user_id = p_user_id
$$;

-- Create function to check if user can access a branch
CREATE OR REPLACE FUNCTION public.can_access_branch(p_user_id UUID, p_branch_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM public.user_branches WHERE user_id = p_user_id AND branch_id = p_branch_id
  )
$$;

-- Trigger for updated_at on branches
CREATE TRIGGER update_branches_updated_at
BEFORE UPDATE ON public.branches
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updated_at on product_branches
CREATE TRIGGER update_product_branches_updated_at
BEFORE UPDATE ON public.product_branches
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create a default "Main" branch
INSERT INTO public.branches (name, code, is_active)
VALUES ('Main Branch', 'MAIN', true);
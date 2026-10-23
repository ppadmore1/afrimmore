-- 1. Plan limits (server-enforced)
CREATE OR REPLACE FUNCTION public.enforce_plan_limits() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_t tenants%ROWTYPE; v_max_products int; v_count int;
BEGIN
  IF NEW.tenant_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_t FROM tenants WHERE id = NEW.tenant_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'branches' THEN
    SELECT count(*) INTO v_count FROM branches WHERE tenant_id = NEW.tenant_id;
    IF v_t.max_branches IS NOT NULL AND v_count >= v_t.max_branches THEN
      RAISE EXCEPTION 'Your % plan allows % branch(es). Upgrade your plan to add more.', v_t.plan, v_t.max_branches;
    END IF;
  ELSIF TG_TABLE_NAME = 'tenant_users' THEN
    SELECT count(*) INTO v_count FROM tenant_users WHERE tenant_id = NEW.tenant_id;
    IF v_t.max_users IS NOT NULL AND v_count >= v_t.max_users THEN
      RAISE EXCEPTION 'Your % plan allows % user(s). Upgrade your plan to add more.', v_t.plan, v_t.max_users;
    END IF;
  ELSIF TG_TABLE_NAME = 'products' THEN
    SELECT p.max_products INTO v_max_products FROM tenant_subscriptions s JOIN subscription_plans p ON p.id = s.plan_id
      WHERE s.tenant_id = NEW.tenant_id ORDER BY s.created_at DESC LIMIT 1;
    SELECT count(*) INTO v_count FROM products WHERE tenant_id = NEW.tenant_id AND is_active;
    IF v_max_products IS NOT NULL AND v_count >= v_max_products THEN
      RAISE EXCEPTION 'Your plan allows % products. Upgrade your plan to add more.', v_max_products;
    END IF;
  END IF;
  RETURN NEW;
END $$;
-- Must run after tenant_id is filled (trigger name sorts after trg_set_tenant_id)
CREATE TRIGGER trg_zz_plan_limit BEFORE INSERT ON public.branches FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_limits();
CREATE TRIGGER trg_zz_plan_limit BEFORE INSERT ON public.products FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_limits();
CREATE TRIGGER trg_zz_plan_limit BEFORE INSERT ON public.tenant_users FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_limits();

-- 2. Invited users join the inviting company instead of creating a new one
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_tenant_id uuid; v_plan_id uuid; v_company_name text; v_slug text; v_inv invitations%ROWTYPE;
BEGIN
  SELECT * INTO v_inv FROM public.invitations
   WHERE lower(email) = lower(NEW.email) AND status = 'pending' AND expires_at > now() AND tenant_id IS NOT NULL
   ORDER BY created_at DESC LIMIT 1;

  IF FOUND THEN
    INSERT INTO public.tenant_users (tenant_id, user_id, role, is_owner) VALUES (v_inv.tenant_id, NEW.id, 'member', false);
    INSERT INTO public.profiles (id, full_name, email, tenant_id) VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name', NEW.email, v_inv.tenant_id);
    INSERT INTO public.user_roles (user_id, role, tenant_id) VALUES (NEW.id, v_inv.role, v_inv.tenant_id);
    INSERT INTO public.user_branches (user_id, branch_id, is_default, tenant_id)
      SELECT NEW.id, b, row_number() OVER () = 1, v_inv.tenant_id FROM unnest(v_inv.branch_ids) b
      WHERE EXISTS (SELECT 1 FROM branches WHERE id = b AND tenant_id = v_inv.tenant_id);
    UPDATE public.invitations SET status = 'accepted' WHERE id = v_inv.id;
    RETURN NEW;
  END IF;

  SELECT id INTO v_plan_id FROM public.subscription_plans WHERE slug = 'starter' LIMIT 1;
  v_company_name := COALESCE(NEW.raw_user_meta_data ->> 'company_name', (NEW.raw_user_meta_data ->> 'full_name') || '''s Business', 'My Business');
  v_slug := LOWER(REGEXP_REPLACE(SPLIT_PART(NEW.email, '@', 1), '[^a-zA-Z0-9]+', '-', 'g')) || '-' || SUBSTR(gen_random_uuid()::text, 1, 8);
  INSERT INTO public.tenants (name, slug, owner_id, plan, max_users, max_branches)
  VALUES (v_company_name, v_slug, NEW.id, 'starter', 2, 1) RETURNING id INTO v_tenant_id;
  IF v_plan_id IS NOT NULL THEN
    INSERT INTO public.tenant_subscriptions (tenant_id, plan_id, status, trial_ends_at) VALUES (v_tenant_id, v_plan_id, 'trial', now() + interval '14 days');
  END IF;
  INSERT INTO public.tenant_users (tenant_id, user_id, role, is_owner) VALUES (v_tenant_id, NEW.id, 'owner', true);
  INSERT INTO public.profiles (id, full_name, email, tenant_id) VALUES (NEW.id, NEW.raw_user_meta_data ->> 'full_name', NEW.email, v_tenant_id);
  INSERT INTO public.user_roles (user_id, role, tenant_id) VALUES (NEW.id, 'admin', v_tenant_id);
  INSERT INTO public.branches (name, code, tenant_id) VALUES ('Main Branch', 'MAIN', v_tenant_id);
  INSERT INTO public.user_branches (user_id, branch_id, is_default, tenant_id)
    SELECT NEW.id, id, true, v_tenant_id FROM public.branches WHERE tenant_id = v_tenant_id AND code = 'MAIN' LIMIT 1;
  INSERT INTO public.company_settings (company_name, tenant_id) VALUES (v_company_name, v_tenant_id);
  -- Copy a standard chart of accounts from the system template (first tenant that has one)
  INSERT INTO public.chart_of_accounts (account_code, account_name, account_type, account_subtype, normal_balance, is_system, tenant_id)
    SELECT account_code, account_name, account_type, account_subtype, normal_balance, true, v_tenant_id
    FROM public.chart_of_accounts WHERE tenant_id = (SELECT tenant_id FROM public.chart_of_accounts WHERE tenant_id IS NOT NULL LIMIT 1);
  RETURN NEW;
END;
$function$;

-- 3. Lock finalised transactions
CREATE OR REPLACE FUNCTION public.lock_finalized_records() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'invoices' THEN
    IF TG_OP = 'DELETE' AND OLD.status IN ('paid','approved') THEN
      RAISE EXCEPTION 'Invoice % is finalised and cannot be deleted. Issue a credit note or cancel it instead.', OLD.invoice_number;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.status = 'paid' AND (NEW.total <> OLD.total OR NEW.customer_id IS DISTINCT FROM OLD.customer_id OR NEW.invoice_number <> OLD.invoice_number) THEN
      RAISE EXCEPTION 'Invoice % is paid and locked. Issue a credit note to correct it.', OLD.invoice_number;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Completed % records cannot be deleted. Record a refund or reversal instead.', replace(TG_TABLE_NAME,'_',' ');
  ELSIF TG_TABLE_NAME = 'pos_sales' AND (NEW.total <> OLD.total OR NEW.amount_paid <> OLD.amount_paid) THEN
    RAISE EXCEPTION 'Completed sales cannot be edited. Record a refund instead.';
  ELSIF TG_TABLE_NAME = 'payments' AND NEW.amount <> OLD.amount THEN
    RAISE EXCEPTION 'Recorded payments cannot be edited. Record a reversal instead.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER trg_lock_invoice BEFORE UPDATE OR DELETE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.lock_finalized_records();
CREATE TRIGGER trg_lock_pos_sale BEFORE UPDATE OR DELETE ON public.pos_sales FOR EACH ROW EXECUTE FUNCTION public.lock_finalized_records();
CREATE TRIGGER trg_lock_payment BEFORE UPDATE OR DELETE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.lock_finalized_records();

-- 4. Automatic double-entry journals
CREATE OR REPLACE FUNCTION public.post_auto_journal(p_tenant uuid, p_ref_type text, p_ref_id uuid, p_desc text, p_lines jsonb, p_user uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_je uuid; l jsonb; v_acc uuid;
BEGIN
  IF p_tenant IS NULL OR EXISTS (SELECT 1 FROM journal_entries WHERE reference_type = p_ref_type AND reference_id = p_ref_id) THEN RETURN; END IF;
  -- Skip silently if the company has no chart of accounts yet
  FOR l IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    IF NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE tenant_id = p_tenant AND account_code = l->>'code') THEN RETURN; END IF;
  END LOOP;
  INSERT INTO journal_entries (entry_number, description, reference_type, reference_id, status, is_auto_generated, posted_by, posted_at, created_by, tenant_id)
  VALUES ('AJ-' || to_char(now(),'YYMMDD') || '-' || substr(gen_random_uuid()::text,1,6), p_desc, p_ref_type, p_ref_id, 'posted', true, p_user, now(), p_user, p_tenant)
  RETURNING id INTO v_je;
  FOR l IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    IF coalesce((l->>'debit')::numeric,0) = 0 AND coalesce((l->>'credit')::numeric,0) = 0 THEN CONTINUE; END IF;
    SELECT id INTO v_acc FROM chart_of_accounts WHERE tenant_id = p_tenant AND account_code = l->>'code';
    INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit, credit, tenant_id)
    VALUES (v_je, v_acc, p_desc, coalesce((l->>'debit')::numeric,0), coalesce((l->>'credit')::numeric,0), p_tenant);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.auto_journal_trigger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cash text;
BEGIN
  IF TG_TABLE_NAME = 'pos_sales' THEN
    PERFORM post_auto_journal(NEW.tenant_id, 'pos_sale', NEW.id, 'POS sale ' || NEW.sale_number, jsonb_build_array(
      jsonb_build_object('code','1000','debit',NEW.total),
      jsonb_build_object('code','4000','credit',NEW.total - coalesce(NEW.tax_total,0)),
      jsonb_build_object('code','2200','credit',coalesce(NEW.tax_total,0))), NEW.created_by);
  ELSIF TG_TABLE_NAME = 'invoices' THEN
    IF NEW.status IN ('pending','approved','paid') AND (TG_OP = 'INSERT' OR OLD.status IN ('draft')) THEN
      PERFORM post_auto_journal(NEW.tenant_id, 'invoice', NEW.id, 'Invoice ' || NEW.invoice_number, jsonb_build_array(
        jsonb_build_object('code','1100','debit',NEW.total),
        jsonb_build_object('code','4000','credit',NEW.total - coalesce(NEW.tax_total,0)),
        jsonb_build_object('code','2200','credit',coalesce(NEW.tax_total,0))), NEW.created_by);
    END IF;
  ELSIF TG_TABLE_NAME = 'payments' THEN
    IF NEW.invoice_id IS NOT NULL THEN
      PERFORM post_auto_journal(NEW.tenant_id, 'payment', NEW.id, 'Payment ' || coalesce(NEW.payment_number,''), jsonb_build_array(
        jsonb_build_object('code','1000','debit',NEW.amount),
        jsonb_build_object('code','1100','credit',NEW.amount)), NEW.created_by);
    END IF;
  ELSIF TG_TABLE_NAME = 'expenses' THEN
    PERFORM post_auto_journal(NEW.tenant_id, 'expense', NEW.id, 'Expense ' || coalesce(NEW.expense_number,'') || ' ' || coalesce(NEW.description,''), jsonb_build_array(
      jsonb_build_object('code', CASE lower(NEW.category) WHEN 'rent' THEN '6100' WHEN 'utilities' THEN '6200' WHEN 'salaries' THEN '6000'
        WHEN 'office' THEN '6300' WHEN 'marketing' THEN '6400' WHEN 'transport' THEN '6800' WHEN 'travel' THEN '6800' WHEN 'maintenance' THEN '6900' ELSE '7900' END, 'debit', NEW.amount),
      jsonb_build_object('code','1000','credit',NEW.amount)), NEW.created_by);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_auto_journal AFTER INSERT ON public.pos_sales FOR EACH ROW EXECUTE FUNCTION public.auto_journal_trigger();
CREATE TRIGGER trg_auto_journal AFTER INSERT OR UPDATE OF status ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.auto_journal_trigger();
CREATE TRIGGER trg_auto_journal AFTER INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION public.auto_journal_trigger();
CREATE TRIGGER trg_auto_journal AFTER INSERT ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.auto_journal_trigger();

-- Backfill journals for existing sales/invoices/payments/expenses
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT * FROM pos_sales LOOP
    PERFORM post_auto_journal(r.tenant_id,'pos_sale',r.id,'POS sale '||r.sale_number, jsonb_build_array(
      jsonb_build_object('code','1000','debit',r.total), jsonb_build_object('code','4000','credit',r.total-coalesce(r.tax_total,0)), jsonb_build_object('code','2200','credit',coalesce(r.tax_total,0))), r.created_by);
  END LOOP;
  FOR r IN SELECT * FROM invoices WHERE status IN ('pending','approved','paid') LOOP
    PERFORM post_auto_journal(r.tenant_id,'invoice',r.id,'Invoice '||r.invoice_number, jsonb_build_array(
      jsonb_build_object('code','1100','debit',r.total), jsonb_build_object('code','4000','credit',r.total-coalesce(r.tax_total,0)), jsonb_build_object('code','2200','credit',coalesce(r.tax_total,0))), r.created_by);
  END LOOP;
  FOR r IN SELECT * FROM payments WHERE invoice_id IS NOT NULL LOOP
    PERFORM post_auto_journal(r.tenant_id,'payment',r.id,'Payment '||coalesce(r.payment_number,''), jsonb_build_array(
      jsonb_build_object('code','1000','debit',r.amount), jsonb_build_object('code','1100','credit',r.amount)), r.created_by);
  END LOOP;
END $$;
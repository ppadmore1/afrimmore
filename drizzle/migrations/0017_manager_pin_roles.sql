CREATE OR REPLACE FUNCTION public.set_manager_pin(p_user_id uuid, p_pin text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'You can only set your own PIN';
  END IF;
  IF NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'owner') OR has_role(auth.uid(),'branch_manager')) THEN
    RAISE EXCEPTION 'Only owners, admins and branch managers can set a manager PIN';
  END IF;
  IF length(p_pin) < 4 OR length(p_pin) > 6 OR p_pin !~ '^\d+$' THEN
    RAISE EXCEPTION 'PIN must be 4-6 digits';
  END IF;
  UPDATE profiles SET manager_pin = extensions.crypt(p_pin, extensions.gen_salt('bf', 8)), updated_at = now()
  WHERE id = p_user_id;
END $$;
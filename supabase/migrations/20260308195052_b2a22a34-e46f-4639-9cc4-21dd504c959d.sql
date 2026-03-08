
-- Enable pgcrypto in extensions schema
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- Create a table to track failed PIN attempts for brute-force protection
CREATE TABLE IF NOT EXISTS public.pin_attempt_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hint text,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pin_attempt_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only via security definer" ON public.pin_attempt_log
  FOR ALL TO authenticated
  USING (false);

-- Function to set/update manager PIN (stores hashed via bcrypt)
CREATE OR REPLACE FUNCTION public.set_manager_pin(p_user_id uuid, p_pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public, extensions'
AS $$
BEGIN
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Can only set your own PIN';
  END IF;
  
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can set manager PINs';
  END IF;

  IF length(p_pin) < 4 OR length(p_pin) > 6 OR p_pin !~ '^\d+$' THEN
    RAISE EXCEPTION 'Invalid PIN: Must be 4-6 digits';
  END IF;

  UPDATE profiles
  SET manager_pin = extensions.crypt(p_pin, extensions.gen_salt('bf', 8)),
      updated_at = now()
  WHERE id = p_user_id;
END;
$$;

-- Replace verify_manager_pin with bcrypt comparison and rate limiting
CREATE OR REPLACE FUNCTION public.verify_manager_pin(p_pin text)
RETURNS TABLE(manager_id uuid, manager_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public, extensions'
AS $$
DECLARE
  v_recent_attempts int;
BEGIN
  -- Rate limiting: max 5 attempts per minute
  SELECT count(*) INTO v_recent_attempts
  FROM pin_attempt_log
  WHERE attempted_at > now() - interval '1 minute';

  IF v_recent_attempts >= 5 THEN
    RAISE EXCEPTION 'Too many PIN attempts. Please wait a moment before trying again.';
  END IF;

  -- Log attempt
  INSERT INTO pin_attempt_log (ip_hint) VALUES ('auth:' || auth.uid()::text);

  -- Clean old attempts
  DELETE FROM pin_attempt_log WHERE attempted_at < now() - interval '5 minutes';

  -- Verify PIN using bcrypt comparison
  RETURN QUERY
  SELECT p.id, p.full_name
  FROM profiles p
  JOIN user_roles ur ON ur.user_id = p.id
  WHERE ur.role IN ('admin')
    AND p.manager_pin IS NOT NULL
    AND p.manager_pin = extensions.crypt(p_pin, p.manager_pin)
  LIMIT 1;
END;
$$;

-- Migrate any existing plain-text PINs to hashed
UPDATE profiles
SET manager_pin = extensions.crypt(manager_pin, extensions.gen_salt('bf', 8))
WHERE manager_pin IS NOT NULL
  AND manager_pin !~ '^\$2[aby]?\$';

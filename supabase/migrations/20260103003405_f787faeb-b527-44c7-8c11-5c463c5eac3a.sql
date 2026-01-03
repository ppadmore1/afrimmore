-- Add unique constraint on user_id for user_roles to support upsert
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);
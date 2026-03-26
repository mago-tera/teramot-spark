
ALTER TABLE public.lists
  ADD COLUMN IF NOT EXISTS enviados integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS respondidos integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conversiones integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS copy_sugerido text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS filtros_compartidos jsonb NOT NULL DEFAULT '{}'::jsonb;

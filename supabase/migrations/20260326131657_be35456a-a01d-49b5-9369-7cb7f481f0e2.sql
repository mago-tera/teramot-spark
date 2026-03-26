
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS enviado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS respondido boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS conversion boolean NOT NULL DEFAULT false;

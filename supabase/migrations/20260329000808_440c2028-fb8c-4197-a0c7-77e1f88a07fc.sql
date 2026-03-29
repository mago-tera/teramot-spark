
-- Create outreaches table (child of lists)
CREATE TABLE public.outreaches (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id uuid NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  responsable text,
  canal text,
  filtros_compartidos jsonb NOT NULL DEFAULT '{}'::jsonb,
  copy_sugerido text NOT NULL DEFAULT '',
  copy_sugerido_subject text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.outreaches ENABLE ROW LEVEL SECURITY;

-- Policies: campaign owner can do everything
CREATE POLICY "Campaign owner can manage outreaches"
  ON public.outreaches FOR ALL
  TO authenticated
  USING (is_campaign_accessible(campaign_id, auth.uid()))
  WITH CHECK (is_campaign_owner(campaign_id, auth.uid()));

-- Anyone in the campaign can read outreaches
CREATE POLICY "Users can see outreaches of accessible campaigns"
  ON public.outreaches FOR SELECT
  TO authenticated
  USING (is_campaign_accessible(campaign_id, auth.uid()));

-- Migrate existing shared lists into outreaches
INSERT INTO public.outreaches (list_id, campaign_id, name, responsable, canal, filtros_compartidos, copy_sugerido, copy_sugerido_subject, created_at)
SELECT 
  l.id,
  l.campaign_id,
  l.name,
  l.filtros_compartidos->>'responsable',
  l.filtros_compartidos->>'canal',
  l.filtros_compartidos,
  l.copy_sugerido,
  l.copy_sugerido_subject,
  l.created_at
FROM public.lists l
WHERE l.shared = true;

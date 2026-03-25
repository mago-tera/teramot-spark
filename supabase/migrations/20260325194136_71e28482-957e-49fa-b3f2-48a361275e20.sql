
CREATE TABLE public.communications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  linkedin text NOT NULL DEFAULT '',
  email_asunto text NOT NULL DEFAULT '',
  email_cuerpo text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see communications of accessible campaigns"
  ON public.communications FOR SELECT TO authenticated
  USING (is_campaign_accessible(campaign_id, auth.uid()));

CREATE POLICY "Users can insert communications to own campaigns"
  ON public.communications FOR INSERT TO authenticated
  WITH CHECK (is_campaign_owner(campaign_id, auth.uid()));

CREATE POLICY "Users can update communications of own campaigns"
  ON public.communications FOR UPDATE TO authenticated
  USING (is_campaign_owner(campaign_id, auth.uid()))
  WITH CHECK (is_campaign_owner(campaign_id, auth.uid()));

CREATE POLICY "Users can delete communications of own campaigns"
  ON public.communications FOR DELETE TO authenticated
  USING (is_campaign_owner(campaign_id, auth.uid()));

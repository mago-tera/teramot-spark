
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS calificacion text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS responsable text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS canal text DEFAULT NULL;

CREATE POLICY "Users can update leads of own campaigns"
ON public.leads
FOR UPDATE
TO authenticated
USING (is_campaign_owner(campaign_id, auth.uid()))
WITH CHECK (is_campaign_owner(campaign_id, auth.uid()));

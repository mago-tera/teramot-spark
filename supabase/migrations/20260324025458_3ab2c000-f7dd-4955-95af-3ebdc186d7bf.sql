
-- Fix leads RLS
DROP POLICY IF EXISTS "Allow all access to leads" ON public.leads;

CREATE POLICY "Users can see leads of own/shared campaigns" ON public.leads
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_id AND (
        c.user_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.campaign_members cm WHERE cm.campaign_id = c.id AND cm.user_id = auth.uid())
      )
    )
  );

CREATE POLICY "Users can insert leads to own campaigns" ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.campaigns WHERE id = campaign_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can delete leads of own campaigns" ON public.leads
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.campaigns WHERE id = campaign_id AND user_id = auth.uid())
  );

-- Fix lists RLS
DROP POLICY IF EXISTS "Allow all access to lists" ON public.lists;
DROP POLICY IF EXISTS "Allow insert lists" ON public.lists;
DROP POLICY IF EXISTS "Allow update lists" ON public.lists;

CREATE POLICY "Users can see lists of own/shared campaigns" ON public.lists
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_id AND (
        c.user_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.campaign_members cm WHERE cm.campaign_id = c.id AND cm.user_id = auth.uid())
      )
    )
  );

CREATE POLICY "Users can insert lists to own campaigns" ON public.lists
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.campaigns WHERE id = campaign_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can update lists of own campaigns" ON public.lists
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.campaigns WHERE id = campaign_id AND user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.campaigns WHERE id = campaign_id AND user_id = auth.uid()));

CREATE POLICY "Users can delete lists of own campaigns" ON public.lists
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.campaigns WHERE id = campaign_id AND user_id = auth.uid())
  );

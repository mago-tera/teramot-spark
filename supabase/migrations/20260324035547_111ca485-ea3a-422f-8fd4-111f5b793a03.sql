
-- Helper: check if user can access a campaign (owner, campaign member, or project member/owner)
CREATE OR REPLACE FUNCTION public.is_campaign_accessible(_campaign_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = _campaign_id
      AND (
        c.user_id = _user_id
        OR EXISTS (SELECT 1 FROM public.campaign_members cm WHERE cm.campaign_id = _campaign_id AND cm.user_id = _user_id)
        OR (c.project_id IS NOT NULL AND (
          public.is_project_owner(c.project_id, _user_id)
          OR public.is_project_member(c.project_id, _user_id)
        ))
      )
  );
$$;

-- Helper: check if user owns a campaign
CREATE OR REPLACE FUNCTION public.is_campaign_owner(_campaign_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = _campaign_id AND c.user_id = _user_id
  );
$$;

-- Fix campaigns policies
DROP POLICY IF EXISTS "Users can see own and shared campaigns" ON public.campaigns;
CREATE POLICY "Users can see own and shared campaigns"
ON public.campaigns FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR is_campaign_accessible(id, auth.uid())
);

DROP POLICY IF EXISTS "Users can insert campaigns in own projects" ON public.campaigns;
CREATE POLICY "Users can insert campaigns in own projects"
ON public.campaigns FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (project_id IS NULL OR is_project_owner(project_id, auth.uid()) OR is_project_member(project_id, auth.uid()))
);

DROP POLICY IF EXISTS "Users can update own campaigns" ON public.campaigns;
CREATE POLICY "Users can update own campaigns"
ON public.campaigns FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own campaigns" ON public.campaigns;
CREATE POLICY "Users can delete own campaigns"
ON public.campaigns FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- Fix lists policies (they reference campaigns which causes recursion)
DROP POLICY IF EXISTS "Users can see lists of own/shared campaigns" ON public.lists;
CREATE POLICY "Users can see lists of own/shared campaigns"
ON public.lists FOR SELECT TO authenticated
USING (is_campaign_accessible(campaign_id, auth.uid()));

DROP POLICY IF EXISTS "Users can insert lists to own campaigns" ON public.lists;
CREATE POLICY "Users can insert lists to own campaigns"
ON public.lists FOR INSERT TO authenticated
WITH CHECK (is_campaign_owner(campaign_id, auth.uid()));

DROP POLICY IF EXISTS "Users can update lists of own campaigns" ON public.lists;
CREATE POLICY "Users can update lists of own campaigns"
ON public.lists FOR UPDATE TO authenticated
USING (is_campaign_owner(campaign_id, auth.uid()))
WITH CHECK (is_campaign_owner(campaign_id, auth.uid()));

DROP POLICY IF EXISTS "Users can delete lists of own campaigns" ON public.lists;
CREATE POLICY "Users can delete lists of own campaigns"
ON public.lists FOR DELETE TO authenticated
USING (is_campaign_owner(campaign_id, auth.uid()));

-- Fix leads policies
DROP POLICY IF EXISTS "Users can see leads of own/shared campaigns" ON public.leads;
CREATE POLICY "Users can see leads of own/shared campaigns"
ON public.leads FOR SELECT TO authenticated
USING (is_campaign_accessible(campaign_id, auth.uid()));

DROP POLICY IF EXISTS "Users can insert leads to own campaigns" ON public.leads;
CREATE POLICY "Users can insert leads to own campaigns"
ON public.leads FOR INSERT TO authenticated
WITH CHECK (is_campaign_owner(campaign_id, auth.uid()));

DROP POLICY IF EXISTS "Users can delete leads of own campaigns" ON public.leads;
CREATE POLICY "Users can delete leads of own campaigns"
ON public.leads FOR DELETE TO authenticated
USING (is_campaign_owner(campaign_id, auth.uid()));

-- Fix campaign_members policies
DROP POLICY IF EXISTS "Campaign owner can manage members" ON public.campaign_members;
CREATE POLICY "Campaign owner can manage members"
ON public.campaign_members FOR ALL TO authenticated
USING (is_campaign_owner(campaign_id, auth.uid()))
WITH CHECK (is_campaign_owner(campaign_id, auth.uid()));

DROP POLICY IF EXISTS "Users can see their memberships" ON public.campaign_members;
CREATE POLICY "Users can see their memberships"
ON public.campaign_members FOR SELECT TO authenticated
USING (user_id = auth.uid() OR is_campaign_owner(campaign_id, auth.uid()));

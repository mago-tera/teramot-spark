
-- Fix projects SELECT policy: project_members.project_id was compared to project_members.id instead of projects.id
DROP POLICY IF EXISTS "Users can see own and shared projects" ON public.projects;
CREATE POLICY "Users can see own and shared projects" ON public.projects
  FOR SELECT TO authenticated
  USING (
    (user_id = auth.uid()) OR 
    (EXISTS (
      SELECT 1 FROM project_members 
      WHERE project_members.project_id = projects.id 
        AND project_members.user_id = auth.uid()
    ))
  );

-- Fix campaigns SELECT policy: same bug with campaign_members
DROP POLICY IF EXISTS "Users can see own and shared campaigns" ON public.campaigns;
CREATE POLICY "Users can see own and shared campaigns" ON public.campaigns
  FOR SELECT TO authenticated
  USING (
    (user_id = auth.uid()) OR 
    (EXISTS (
      SELECT 1 FROM campaign_members 
      WHERE campaign_members.campaign_id = campaigns.id 
        AND campaign_members.user_id = auth.uid()
    )) OR 
    (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM projects p 
      WHERE p.id = campaigns.project_id 
        AND (p.user_id = auth.uid() OR EXISTS (
          SELECT 1 FROM project_members pm 
          WHERE pm.project_id = p.id AND pm.user_id = auth.uid()
        ))
    ))
  );

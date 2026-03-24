
-- Projects table
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Project members for sharing
CREATE TABLE public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Add project_id to campaigns
ALTER TABLE public.campaigns ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE;

-- RLS for projects
CREATE POLICY "Users can see own and shared projects" ON public.projects
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.project_members WHERE project_id = id AND user_id = auth.uid())
  );

CREATE POLICY "Users can insert own projects" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own projects" ON public.projects
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own projects" ON public.projects
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- RLS for project_members
CREATE POLICY "Users can see memberships of their projects" ON public.project_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  );

CREATE POLICY "Project owner can manage members" ON public.project_members
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  );

-- Update campaigns RLS to also allow project-based access
DROP POLICY IF EXISTS "Users can see own and shared campaigns" ON public.campaigns;
CREATE POLICY "Users can see own and shared campaigns" ON public.campaigns
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.campaign_members WHERE campaign_id = id AND user_id = auth.uid()) OR
    (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND (
        p.user_id = auth.uid() OR
        EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = p.id AND pm.user_id = auth.uid())
      )
    ))
  );

-- Update campaigns insert to allow project members
DROP POLICY IF EXISTS "Users can insert own campaigns" ON public.campaigns;
CREATE POLICY "Users can insert campaigns in own projects" ON public.campaigns
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    (project_id IS NULL OR EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid()))
  );

-- Update campaigns update
DROP POLICY IF EXISTS "Users can update own campaigns" ON public.campaigns;
CREATE POLICY "Users can update own campaigns" ON public.campaigns
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

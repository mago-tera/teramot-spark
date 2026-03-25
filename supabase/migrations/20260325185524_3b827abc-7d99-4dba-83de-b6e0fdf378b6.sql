
-- 1. Create list_members table
CREATE TABLE public.list_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(list_id, user_id)
);

ALTER TABLE public.list_members ENABLE ROW LEVEL SECURITY;

-- 2. is_list_accessible function
CREATE OR REPLACE FUNCTION public.is_list_accessible(_list_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.list_members lm
    WHERE lm.list_id = _list_id AND lm.user_id = _user_id
  );
$$;

-- 3. Update is_campaign_accessible to also check list_members
CREATE OR REPLACE FUNCTION public.is_campaign_accessible(_campaign_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
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
        OR EXISTS (
          SELECT 1 FROM public.lists l
          JOIN public.list_members lm ON lm.list_id = l.id
          WHERE l.campaign_id = _campaign_id AND lm.user_id = _user_id
        )
      )
  );
$$;

-- 4. RLS for list_members
CREATE POLICY "Campaign owner can manage list members" ON public.list_members
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.lists l
    JOIN public.campaigns c ON c.id = l.campaign_id
    WHERE l.id = list_members.list_id AND c.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.lists l
    JOIN public.campaigns c ON c.id = l.campaign_id
    WHERE l.id = list_members.list_id AND c.user_id = auth.uid()
  )
);

CREATE POLICY "Users can see their list memberships" ON public.list_members
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
);

-- 5. Update lists SELECT policy to also allow list_members
DROP POLICY IF EXISTS "Users can see lists of own/shared campaigns" ON public.lists;
CREATE POLICY "Users can see lists of own/shared campaigns or as member" ON public.lists
FOR SELECT TO authenticated
USING (
  is_campaign_accessible(campaign_id, auth.uid())
  OR is_list_accessible(id, auth.uid())
);

-- 6. Update projects SELECT to include campaign_members and list_members
DROP POLICY IF EXISTS "Users can see own and shared projects" ON public.projects;
CREATE POLICY "Users can see own and shared projects" ON public.projects
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR is_project_member(id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.project_id = projects.id
    AND (
      EXISTS (SELECT 1 FROM public.campaign_members cm WHERE cm.campaign_id = c.id AND cm.user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.lists l
        JOIN public.list_members lm ON lm.list_id = l.id
        WHERE l.campaign_id = c.id AND lm.user_id = auth.uid()
      )
    )
  )
);

-- 7. Update leads SELECT to also allow list_members
DROP POLICY IF EXISTS "Users can see leads of own/shared campaigns" ON public.leads;
CREATE POLICY "Users can see leads of accessible campaigns or lists" ON public.leads
FOR SELECT TO authenticated
USING (
  is_campaign_accessible(campaign_id, auth.uid())
  OR (list_id IS NOT NULL AND is_list_accessible(list_id, auth.uid()))
);

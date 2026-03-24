-- Break RLS recursion between projects and project_members
create or replace function public.is_project_owner(_project_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = _project_id
      and p.user_id = _user_id
  );
$$;

create or replace function public.is_project_member(_project_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members pm
    where pm.project_id = _project_id
      and pm.user_id = _user_id
  );
$$;

-- Recreate policies using security definer helpers
DROP POLICY IF EXISTS "Users can see own and shared projects" ON public.projects;
CREATE POLICY "Users can see own and shared projects"
ON public.projects
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_project_member(id, auth.uid())
);

DROP POLICY IF EXISTS "Project owner can manage members" ON public.project_members;
CREATE POLICY "Project owner can manage members"
ON public.project_members
FOR ALL
TO authenticated
USING (public.is_project_owner(project_id, auth.uid()))
WITH CHECK (public.is_project_owner(project_id, auth.uid()));

DROP POLICY IF EXISTS "Users can see memberships of their projects" ON public.project_members;
CREATE POLICY "Users can see memberships of their projects"
ON public.project_members
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_project_owner(project_id, auth.uid())
);
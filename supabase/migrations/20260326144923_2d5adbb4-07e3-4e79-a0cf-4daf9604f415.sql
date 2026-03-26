
-- Add shared flag to lists
ALTER TABLE public.lists ADD COLUMN IF NOT EXISTS shared boolean NOT NULL DEFAULT false;

-- Allow any authenticated user to SELECT shared lists
CREATE POLICY "Anyone can see shared lists"
ON public.lists FOR SELECT TO authenticated
USING (shared = true);

-- Allow any authenticated user to SELECT leads of shared lists
CREATE POLICY "Anyone can see leads of shared lists"
ON public.leads FOR SELECT TO authenticated
USING (list_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.lists l WHERE l.id = leads.list_id AND l.shared = true
));

-- Allow any authenticated user to UPDATE lead metrics on shared lists
CREATE POLICY "Anyone can update leads of shared lists"
ON public.leads FOR UPDATE TO authenticated
USING (list_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.lists l WHERE l.id = leads.list_id AND l.shared = true
))
WITH CHECK (list_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.lists l WHERE l.id = leads.list_id AND l.shared = true
));

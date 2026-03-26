
-- Allow anon to SELECT shared lists
CREATE POLICY "Anon can see shared lists"
ON public.lists FOR SELECT TO anon
USING (shared = true);

-- Allow anon to SELECT leads of shared lists
CREATE POLICY "Anon can see leads of shared lists"
ON public.leads FOR SELECT TO anon
USING (list_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.lists l WHERE l.id = leads.list_id AND l.shared = true
));

-- Allow anon to UPDATE lead tracking fields on shared lists
CREATE POLICY "Anon can update leads of shared lists"
ON public.leads FOR UPDATE TO anon
USING (list_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.lists l WHERE l.id = leads.list_id AND l.shared = true
))
WITH CHECK (list_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.lists l WHERE l.id = leads.list_id AND l.shared = true
));

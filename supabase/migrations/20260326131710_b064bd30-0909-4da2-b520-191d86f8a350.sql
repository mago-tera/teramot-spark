
CREATE POLICY "Shared users can update lead metrics"
ON public.leads
FOR UPDATE
TO authenticated
USING (
  list_id IS NOT NULL AND is_list_accessible(list_id, auth.uid())
)
WITH CHECK (
  list_id IS NOT NULL AND is_list_accessible(list_id, auth.uid())
);

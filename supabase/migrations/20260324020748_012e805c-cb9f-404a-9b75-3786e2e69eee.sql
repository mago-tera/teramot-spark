
CREATE TABLE public.lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL DEFAULT '',
  profile text NOT NULL,
  geo_mix jsonb NOT NULL DEFAULT '{}'::jsonb,
  quantity integer NOT NULL DEFAULT 50,
  frequency text NOT NULL DEFAULT 'once',
  lead_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to lists" ON public.lists FOR SELECT TO public USING (true);
CREATE POLICY "Allow insert lists" ON public.lists FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow update lists" ON public.lists FOR UPDATE TO public USING (true) WITH CHECK (true);

ALTER TABLE public.leads ADD COLUMN list_id uuid REFERENCES public.lists(id) ON DELETE CASCADE;

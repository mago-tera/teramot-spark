-- Create campaigns table
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  profile TEXT NOT NULL,
  geo_mix JSONB NOT NULL DEFAULT '{}',
  quantity INTEGER NOT NULL DEFAULT 50,
  frequency TEXT NOT NULL DEFAULT 'once',
  status TEXT NOT NULL DEFAULT 'configuracion',
  loom_links JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create leads table
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  title TEXT,
  company TEXT,
  industry TEXT,
  country TEXT,
  seniority TEXT,
  email TEXT,
  linkedin_url TEXT,
  headcount INTEGER DEFAULT 0,
  score INTEGER DEFAULT 0,
  quartile TEXT,
  messages JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Public access policies (no auth in v1)
CREATE POLICY "Allow all access to campaigns" ON public.campaigns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to leads" ON public.leads FOR ALL USING (true) WITH CHECK (true);
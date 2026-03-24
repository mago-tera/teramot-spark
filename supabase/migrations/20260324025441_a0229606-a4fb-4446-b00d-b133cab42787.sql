
-- Profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add user_id to campaigns
ALTER TABLE public.campaigns ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Campaign members for sharing
CREATE TABLE public.campaign_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, user_id)
);

ALTER TABLE public.campaign_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their memberships" ON public.campaign_members
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Campaign owner can manage members" ON public.campaign_members
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.campaigns WHERE id = campaign_id AND user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.campaigns WHERE id = campaign_id AND user_id = auth.uid())
  );

-- Update campaigns RLS to be user-aware
DROP POLICY IF EXISTS "Allow all access to campaigns" ON public.campaigns;

CREATE POLICY "Users can see own and shared campaigns" ON public.campaigns
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.campaign_members WHERE campaign_id = id AND user_id = auth.uid())
  );

CREATE POLICY "Users can insert own campaigns" ON public.campaigns
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own campaigns" ON public.campaigns
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own campaigns" ON public.campaigns
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

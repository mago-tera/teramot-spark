
CREATE OR REPLACE FUNCTION public.prevent_duplicate_lead_in_project()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project_id uuid;
BEGIN
  -- Get the project_id from the campaign
  SELECT c.project_id INTO _project_id
  FROM public.campaigns c
  WHERE c.id = NEW.campaign_id;

  -- If no project, allow (standalone campaign)
  IF _project_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check for duplicate by email within the same project
  IF NEW.email IS NOT NULL AND NEW.email <> '' THEN
    IF EXISTS (
      SELECT 1
      FROM public.leads l
      JOIN public.campaigns c ON c.id = l.campaign_id
      WHERE c.project_id = _project_id
        AND l.email = NEW.email
        AND l.id IS DISTINCT FROM NEW.id
    ) THEN
      RAISE EXCEPTION 'Lead con email "%" ya existe en este proyecto', NEW.email;
    END IF;
  END IF;

  -- Check for duplicate by linkedin_url within the same project
  IF NEW.linkedin_url IS NOT NULL AND NEW.linkedin_url <> '' THEN
    IF EXISTS (
      SELECT 1
      FROM public.leads l
      JOIN public.campaigns c ON c.id = l.campaign_id
      WHERE c.project_id = _project_id
        AND l.linkedin_url = NEW.linkedin_url
        AND l.id IS DISTINCT FROM NEW.id
    ) THEN
      RAISE EXCEPTION 'Lead con LinkedIn "%" ya existe en este proyecto', NEW.linkedin_url;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_duplicate_lead
  BEFORE INSERT OR UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_duplicate_lead_in_project();

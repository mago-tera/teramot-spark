
CREATE OR REPLACE FUNCTION public.sync_list_metrics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Update the list counters based on actual lead data
  IF TG_OP = 'DELETE' THEN
    UPDATE public.lists SET
      lead_count = (SELECT COUNT(*) FROM public.leads WHERE list_id = OLD.list_id),
      enviados = (SELECT COUNT(*) FROM public.leads WHERE list_id = OLD.list_id AND enviado = true),
      respondidos = (SELECT COUNT(*) FROM public.leads WHERE list_id = OLD.list_id AND respondido = true),
      conversiones = (SELECT COUNT(*) FROM public.leads WHERE list_id = OLD.list_id AND conversion = true)
    WHERE id = OLD.list_id;
    RETURN OLD;
  ELSE
    UPDATE public.lists SET
      lead_count = (SELECT COUNT(*) FROM public.leads WHERE list_id = NEW.list_id),
      enviados = (SELECT COUNT(*) FROM public.leads WHERE list_id = NEW.list_id AND enviado = true),
      respondidos = (SELECT COUNT(*) FROM public.leads WHERE list_id = NEW.list_id AND respondido = true),
      conversiones = (SELECT COUNT(*) FROM public.leads WHERE list_id = NEW.list_id AND conversion = true)
    WHERE id = NEW.list_id;
    RETURN NEW;
  END IF;
END;
$function$;

CREATE TRIGGER sync_list_metrics_on_lead_change
AFTER INSERT OR UPDATE OF enviado, respondido, conversion OR DELETE
ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.sync_list_metrics();

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const COMPOSIO_API_KEY = Deno.env.get("COMPOSIO_API_KEY");

  // List Apollo tools
  const slug = (await req.json()).slug || "APOLLO_PEOPLE_SEARCH";
  const res = await fetch(`https://backend.composio.dev/api/v3/tools/${slug}`, {
    headers: { "x-api-key": COMPOSIO_API_KEY! },
  });
  const data = await res.json();
  return new Response(JSON.stringify({
    slug: data.slug,
    params: data.input_parameters,
    response: data.response_schema,
  }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

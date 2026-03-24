import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const COMPOSIO_BASE = "https://backend.composio.dev/api/v3";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const COMPOSIO_API_KEY = Deno.env.get("COMPOSIO_API_KEY");
    if (!COMPOSIO_API_KEY) throw new Error("COMPOSIO_API_KEY is not configured");

    const { profile, geoMix, quantity } = await req.json();

    const titleMap: Record<string, string[]> = {
      "Data Analyst": ["Data Analyst", "BI Analyst", "Analytics Analyst", "Business Intelligence Analyst"],
      "Data Leader / CDO / Head of BI": ["Head of Data", "CDO", "Chief Data Officer", "Head of Analytics", "Head of BI", "Data Manager", "VP Data"],
      "Ambos": ["Data Analyst", "BI Analyst", "Head of Data", "CDO", "Chief Data Officer", "Head of Analytics", "Analytics Lead", "Data Manager"],
    };

    const personTitles = titleMap[profile] || titleMap["Ambos"];

    const allLeads: any[] = [];

    for (const [country, pct] of Object.entries(geoMix)) {
      if ((pct as number) <= 0) continue;
      const qty = Math.round(((pct as number) / 100) * quantity);
      if (qty <= 0) continue;

      const response = await fetch(`${COMPOSIO_BASE}/tools/execute/APOLLO_PEOPLE_SEARCH`, {
        method: "POST",
        headers: {
          "x-api-key": COMPOSIO_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          entity_id: "pg-test-053c2a3a-372c-4246-bc7c-a447eeb7d606",
          arguments: {
            person_titles: personTitles,
            person_locations: [country],
            per_page: Math.min(qty, 100),
            page: 1,
          },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`Apollo search error for ${country}:`, response.status, errText);
        continue;
      }

      const result = await response.json();
      // Log full response keys for debugging
      console.log(`Apollo keys for ${country}:`, JSON.stringify(Object.keys(result)));
      console.log(`Apollo response for ${country}:`, JSON.stringify(result).slice(0, 1500));

      const people = result?.data?.people || result?.response_data?.people || result?.people || [];

      for (const p of people.slice(0, qty)) {
        allLeads.push({
          id: crypto.randomUUID(),
          firstName: p.first_name || "",
          lastName: p.last_name || "",
          title: p.title || "",
          company: p.organization?.name || p.organization_name || "",
          industry: p.organization?.industry || "",
          country: country,
          seniority: p.seniority || "",
          email: p.email || "",
          linkedinUrl: p.linkedin_url || "",
          headcount: p.organization?.estimated_num_employees || 0,
          apolloId: p.id || "",
        });
      }
    }

    return new Response(JSON.stringify({ leads: allLeads, total: allLeads.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("search-apollo error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

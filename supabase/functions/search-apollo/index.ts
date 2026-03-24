import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY");
    if (!APOLLO_API_KEY) throw new Error("APOLLO_API_KEY is not configured");

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

      // Call Apollo API directly
      const response = await fetch("https://api.apollo.io/api/v1/mixed_people/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": APOLLO_API_KEY,
        },
        body: JSON.stringify({
          person_titles: personTitles,
          person_locations: [country],
          per_page: Math.min(qty, 100),
          page: 1,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`Apollo search error for ${country}:`, response.status, errText);
        continue;
      }

      const result = await response.json();
      const people = result?.people || [];
      console.log(`Apollo ${country}: ${people.length} people found`);

      for (const p of people.slice(0, qty)) {
        allLeads.push({
          id: crypto.randomUUID(),
          firstName: p.first_name || "",
          lastName: p.last_name || "",
          title: p.title || "",
          company: p.organization?.name || "",
          industry: p.organization?.industry || "",
          country,
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

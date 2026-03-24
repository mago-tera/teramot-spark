import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function bulkEnrich(apolloIds: string[], apiKey: string): Promise<Record<string, { email: string; linkedinUrl: string }>> {
  const result: Record<string, { email: string; linkedinUrl: string }> = {};
  
  try {
    const response = await fetch("https://api.apollo.io/api/v1/people/bulk_match", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify({
        details: apolloIds.map(id => ({ id })),
        reveal_personal_emails: false,
        reveal_phone_number: false,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Bulk enrich error:", response.status, errText);
      return result;
    }

    const data = await response.json();
    const matches = data?.matches || [];
    
    for (const match of matches) {
      if (match?.id) {
        result[match.id] = {
          email: match.email || "",
          linkedinUrl: match.linkedin_url || "",
        };
      }
    }
  } catch (e) {
    console.error("Bulk enrich exception:", e);
  }
  
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY");
    if (!APOLLO_API_KEY) throw new Error("APOLLO_API_KEY is not configured");

    const { profile, geoMix, quantity } = await req.json();

    const titleMap: Record<string, string[]> = {
      "Data Analyst": ["Data Analyst", "BI Analyst", "Analytics Analyst", "Business Intelligence Analyst"],
      "BI Analyst": ["BI Analyst", "Business Intelligence Analyst", "BI Developer", "BI Engineer"],
      "Data Leader / CDO / Head of BI": ["Head of Data", "CDO", "Chief Data Officer", "Head of Analytics", "Head of BI", "Data Manager", "VP Data"],
    };

    const personTitles = titleMap[profile] || [profile];

    const allLeads: any[] = [];

    for (const [country, pct] of Object.entries(geoMix)) {
      if ((pct as number) <= 0) continue;
      const qty = Math.round(((pct as number) / 100) * quantity);
      if (qty <= 0) continue;

      const response = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
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
          company: p.organization?.name || p.employment_history?.[0]?.organization_name || "",
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

    // Enrich in batches of 10
    const leadsToEnrich = allLeads.filter(l => l.apolloId && (!l.email || !l.linkedinUrl));
    console.log(`Enriching ${leadsToEnrich.length} leads in batches of 10...`);

    for (let i = 0; i < leadsToEnrich.length; i += 10) {
      const batch = leadsToEnrich.slice(i, i + 10);
      const ids = batch.map(l => l.apolloId);
      const enriched = await bulkEnrich(ids, APOLLO_API_KEY);

      for (const lead of allLeads) {
        if (lead.apolloId && enriched[lead.apolloId]) {
          const data = enriched[lead.apolloId];
          if (data.email && !lead.email) lead.email = data.email;
          if (data.linkedinUrl && !lead.linkedinUrl) lead.linkedinUrl = data.linkedinUrl;
        }
      }
      console.log(`Batch ${Math.floor(i / 10) + 1}: enriched ${Object.keys(enriched).length} contacts`);
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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY");
    if (!APOLLO_API_KEY) throw new Error("APOLLO_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { campaignId } = await req.json();
    if (!campaignId) throw new Error("campaignId is required");

    const { data: leads, error: fetchErr } = await supabase
      .from("leads")
      .select("*")
      .eq("campaign_id", campaignId);

    if (fetchErr) throw fetchErr;
    if (!leads || leads.length === 0) {
      return new Response(JSON.stringify({ enriched: 0, message: "No leads found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${leads.length} leads to enrich`);
    let enrichedCount = 0;

    for (const lead of leads) {
      if (lead.email && lead.linkedin_url && lead.last_name) continue;

      try {
        const matchResponse = await fetch("https://api.apollo.io/api/v1/people/match", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Api-Key": APOLLO_API_KEY,
          },
          body: JSON.stringify({
            first_name: lead.first_name,
            last_name: lead.last_name || undefined,
            organization_name: lead.company,
            reveal_personal_emails: false,
          }),
        });

        if (!matchResponse.ok) {
          const errText = await matchResponse.text();
          console.error(`Match error for ${lead.first_name}: ${matchResponse.status} ${errText}`);
          continue;
        }

        const matchData = await matchResponse.json();
        const person = matchData?.person;

        if (!person) {
          console.log(`No match for ${lead.first_name} at ${lead.company}`);
          continue;
        }

        const updates: Record<string, string | number> = {};
        if (person.email && !lead.email) updates.email = person.email;
        if (person.linkedin_url && !lead.linkedin_url) updates.linkedin_url = person.linkedin_url;
        if (person.last_name && !lead.last_name) updates.last_name = person.last_name;
        if (person.title && !lead.title) updates.title = person.title;
        if (person.organization?.estimated_num_employees && !lead.headcount) updates.headcount = person.organization.estimated_num_employees;
        if (person.seniority && !lead.seniority) updates.seniority = person.seniority;
        if (person.organization?.industry && !lead.industry) updates.industry = person.organization.industry;

        if (Object.keys(updates).length > 0) {
          const { error: updateErr } = await supabase
            .from("leads")
            .update(updates)
            .eq("id", lead.id);

          if (updateErr) {
            console.error(`Update error for ${lead.id}:`, updateErr);
          } else {
            enrichedCount++;
            console.log(`Enriched ${lead.first_name}: +${Object.keys(updates).join(", ")}`);
          }
        }

        await new Promise(r => setTimeout(r, 300));
      } catch (e) {
        console.error(`Error enriching ${lead.first_name}:`, e);
      }
    }

    return new Response(JSON.stringify({ enriched: enrichedCount, total: leads.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("enrich-leads error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
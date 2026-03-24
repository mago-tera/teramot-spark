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

// Try to extract last name from linkedin URL slug
function extractLastNameFromLinkedin(url: string, firstName: string): string {
  if (!url || !firstName) return "";
  try {
    const slug = url.split("/in/")[1]?.replace(/[-/]/g, " ").trim();
    if (!slug) return "";
    const parts = slug.split(" ").filter(Boolean);
    const firstLower = firstName.toLowerCase();
    // Find the part after first name
    const idx = parts.findIndex(p => p.toLowerCase().startsWith(firstLower));
    if (idx >= 0 && idx < parts.length - 1) {
      const candidate = parts[idx + 1];
      if (candidate && candidate.length > 1 && !/^\d+$/.test(candidate)) {
        return candidate.charAt(0).toUpperCase() + candidate.slice(1);
      }
    }
  } catch (_) {}
  return "";
}

function isLeadComplete(lead: any): boolean {
  return !!(
    lead.firstName &&
    lead.lastName &&
    lead.title &&
    lead.company &&
    lead.email &&
    lead.linkedinUrl
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY");
    if (!APOLLO_API_KEY) throw new Error("APOLLO_API_KEY is not configured");

    const { profile, geoMix, quantity, page = 1, excludeEmails = [], excludeLinkedins = [] } = await req.json();

    const titleMap: Record<string, string[]> = {
      "Data Analyst": ["Data Analyst", "BI Analyst", "Analytics Analyst", "Business Intelligence Analyst"],
      "BI Analyst": ["BI Analyst", "Business Intelligence Analyst", "BI Developer", "BI Engineer"],
      "Data Leader / CDO / Head of BI": ["Head of Data", "CDO", "Chief Data Officer", "Head of Analytics", "Head of BI", "Data Manager", "VP Data"],
    };

    const personTitles = titleMap[profile] || [profile];
    const excludeEmailSet = new Set(excludeEmails);
    const excludeLinkedinSet = new Set(excludeLinkedins);

    const allLeads: any[] = [];

    for (const [country, pct] of Object.entries(geoMix)) {
      if ((pct as number) <= 0) continue;
      const targetQty = Math.round(((pct as number) / 100) * quantity);
      if (targetQty <= 0) continue;

      // Overfetch 3x to compensate for incomplete leads
      const fetchQty = Math.min(targetQty * 3, 100);

      const response = await fetch("https://api.apollo.io/api/v1/mixed_people/api_search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": APOLLO_API_KEY,
        },
        body: JSON.stringify({
          person_titles: personTitles,
          person_locations: [country],
          per_page: fetchQty,
          page: page,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`Apollo search error for ${country}:`, response.status, errText);
        continue;
      }

      const result = await response.json();
      const people = result?.people || [];
      console.log(`Apollo ${country}: ${people.length} people found (need ${targetQty})`);

      let countryLeads = 0;
      for (const p of people) {
        if (countryLeads >= targetQty) break;

        let lastName = p.last_name || "";
        const firstName = p.first_name || "";
        const email = p.email || "";
        const linkedinUrl = p.linkedin_url || "";

        // Try to infer last name from LinkedIn if missing
        if (!lastName && linkedinUrl && firstName) {
          lastName = extractLastNameFromLinkedin(linkedinUrl, firstName);
        }

        // Skip leads missing required fields
        if (!firstName || !lastName || !p.title || !(p.organization?.name || p.employment_history?.[0]?.organization_name)) {
          continue;
        }

        // Skip if no email AND no linkedin
        if (!email && !linkedinUrl) continue;

        // Skip duplicates
        if (email && excludeEmailSet.has(email)) continue;
        if (linkedinUrl && excludeLinkedinSet.has(linkedinUrl)) continue;

        const lead = {
          id: crypto.randomUUID(),
          firstName,
          lastName,
          title: p.title || "",
          company: p.organization?.name || p.employment_history?.[0]?.organization_name || "",
          industry: p.organization?.industry || "",
          country,
          seniority: p.seniority || "",
          email,
          linkedinUrl,
          headcount: p.organization?.estimated_num_employees || 0,
          apolloId: p.id || "",
        };

        allLeads.push(lead);
        countryLeads++;
      }

      console.log(`${country}: kept ${countryLeads} complete leads out of ${people.length}`);
    }

    // Enrich leads that are missing email or linkedin
    const leadsToEnrich = allLeads.filter(l => l.apolloId && (!l.email || !l.linkedinUrl));
    if (leadsToEnrich.length > 0) {
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
    }

    // Final filter: only return fully complete leads
    const completeLeads = allLeads.filter(isLeadComplete);
    console.log(`Final: ${completeLeads.length} complete leads out of ${allLeads.length} total`);

    return new Response(JSON.stringify({ leads: completeLeads, total: completeLeads.length }), {
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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function enrichSingle(apolloId: string, firstName: string, lastName: string, company: string, apiKey: string): Promise<{ email: string; linkedinUrl: string } | null> {
  try {
    const body: Record<string, string> = {
      id: apolloId,
      reveal_personal_emails: "false",
      reveal_phone_number: "false",
    };
    if (firstName) body.first_name = firstName;
    if (lastName) body.last_name = lastName;
    if (company) body.organization_name = company;

    const response = await fetch("https://api.apollo.io/api/v1/people/match", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Enrich error for ${apolloId}:`, response.status, errText);
      return null;
    }

    const data = await response.json();
    const person = data?.person;
    if (!person) return null;

    return {
      email: person.email || "",
      linkedinUrl: person.linkedin_url || "",
    };
  } catch (e) {
    console.error(`Enrich exception for ${apolloId}:`, e);
    return null;
  }
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

      const response = await fetch("https://api.apollo.io/api/v1/mixed_people/search", {
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

      console.log(`${country}: kept ${countryLeads} leads out of ${people.length}`);
    }

    // Enrich leads that are missing email or linkedin (one by one)
    const leadsToEnrich = allLeads.filter(l => l.apolloId && (!l.email || !l.linkedinUrl));
    if (leadsToEnrich.length > 0) {
      console.log(`Enriching ${leadsToEnrich.length} leads individually...`);
      let enrichedCount = 0;

      for (const lead of leadsToEnrich) {
        const data = await enrichSingle(lead.apolloId, lead.firstName, lead.lastName, lead.company, APOLLO_API_KEY);
        if (data) {
          if (data.email && !lead.email) lead.email = data.email;
          if (data.linkedinUrl && !lead.linkedinUrl) lead.linkedinUrl = data.linkedinUrl;
          enrichedCount++;
        }
        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 200));
      }
      console.log(`Enriched ${enrichedCount} out of ${leadsToEnrich.length} leads`);
    }

    const returnedLeads = allLeads.slice(0, quantity);
    console.log(`Final: ${returnedLeads.length} leads returned out of ${allLeads.length} total`);

    return new Response(JSON.stringify({ leads: returnedLeads, total: returnedLeads.length }), {
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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const COMPOSIO_BASE = "https://backend.composio.dev/api/v3";
const ENTITY_ID = "pg-test-053c2a3a-372c-4246-bc7c-a447eeb7d606";

interface SequenceLead {
  apolloId: string;
  email: string;
  firstName: string;
  lastName: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const COMPOSIO_API_KEY = Deno.env.get("COMPOSIO_API_KEY");
    if (!COMPOSIO_API_KEY) throw new Error("COMPOSIO_API_KEY is not configured");

    const { campaignName, leads } = await req.json() as {
      campaignName: string;
      leads: SequenceLead[];
    };

    if (!leads?.length) throw new Error("No leads provided");

    // Step 1: Create contacts in Apollo for leads that have apolloId
    const contactIds: string[] = [];
    for (const lead of leads.slice(0, 50)) {
      if (!lead.apolloId) continue;

      // Create contact from person
      const createRes = await fetch(`${COMPOSIO_BASE}/tools/execute/APOLLO_CREATE_CONTACT`, {
        method: "POST",
        headers: {
          "x-api-key": COMPOSIO_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          entity_id: ENTITY_ID,
          arguments: {
            first_name: lead.firstName,
            last_name: lead.lastName,
            email: lead.email,
            person_id: lead.apolloId,
          },
        }),
      });

      const createResult = await createRes.json();
      const contactId = createResult?.data?.contact?.id;
      if (contactId) {
        contactIds.push(contactId);
      } else {
        console.log(`Could not create contact for ${lead.firstName}:`, JSON.stringify(createResult).slice(0, 200));
      }
    }

    console.log(`Created ${contactIds.length} contacts in Apollo`);

    // Step 2: Search for an existing sequence or create workflow note
    // Note: Apollo's API doesn't have a "create sequence" endpoint via API key auth.
    // Sequences must be managed in the Apollo UI. We add contacts which can then
    // be enrolled manually or via Apollo's automation.

    return new Response(JSON.stringify({
      success: true,
      contactsCreated: contactIds.length,
      message: `${contactIds.length} contactos creados en Apollo. Abrí Apollo para enrollarlos en una secuencia.`,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-apollo-sequence error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

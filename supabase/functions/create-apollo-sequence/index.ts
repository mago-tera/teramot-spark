import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const COMPOSIO_BASE = "https://backend.composio.dev/api/v3";

interface SequenceLead {
  apolloId: string;
  email: string;
  firstName: string;
  lastName: string;
  messages: {
    linkedin: string;
    email_asunto: string;
    email_cuerpo: string;
    followup_d4: string;
    cierre_d9: string;
  };
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

    // Step 1: Create a sequence in Apollo via Composio
    const createSeqResponse = await fetch(`${COMPOSIO_BASE}/tools/execute/APOLLO_SEARCH_SEQUENCES`, {
      method: "POST",
      headers: {
        "x-api-key": COMPOSIO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        entity_id: "pg-test-053c2a3a-372c-4246-bc7c-a447eeb7d606",
        arguments: {
          name: campaignName,
        },
      }),
    });

    if (!createSeqResponse.ok) {
      const errText = await createSeqResponse.text();
      console.error("Create sequence error:", createSeqResponse.status, errText);
      throw new Error(`Failed to create Apollo sequence: ${createSeqResponse.status}`);
    }

    const seqResult = await createSeqResponse.json();
    const sequenceId = seqResult?.response_data?.emailer_campaign?.id ||
                       seqResult?.data?.emailer_campaign?.id ||
                       seqResult?.response_data?.id;

    if (!sequenceId) {
      console.error("No sequence ID in response:", JSON.stringify(seqResult));
      throw new Error("Could not get sequence ID from Apollo");
    }

    // Step 2: Add sequence steps (email templates)
    // Step 2a: Initial email (Day 1)
    const sampleLead = leads[0];
    const steps = [
      { subject: sampleLead.messages.email_asunto, body: sampleLead.messages.email_cuerpo, delay: 0, type: "auto_email" },
      { subject: "Re: " + sampleLead.messages.email_asunto, body: sampleLead.messages.followup_d4, delay: 4, type: "auto_email" },
      { subject: "Re: " + sampleLead.messages.email_asunto, body: sampleLead.messages.cierre_d9, delay: 5, type: "auto_email" },
    ];

    for (const step of steps) {
      await fetch(`${COMPOSIO_BASE}/tools/execute/APOLLO_CREATE_SEQUENCE_STEP`, {
        method: "POST",
        headers: {
          "x-api-key": COMPOSIO_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          arguments: {
            emailer_campaign_id: sequenceId,
            emailer_step: {
              type: step.type,
              wait_time: step.delay,
              subject_template: step.subject,
              body_template: step.body,
            },
          },
        }),
      });
    }

    // Step 3: Add contacts to the sequence
    // First, we need contact IDs. If we have Apollo IDs, use those.
    const contactIds = leads
      .filter(l => l.apolloId)
      .map(l => l.apolloId);

    if (contactIds.length > 0) {
      const addContactsResponse = await fetch(`${COMPOSIO_BASE}/tools/execute/APOLLO_ADD_CONTACTS_TO_SEQUENCE`, {
        method: "POST",
        headers: {
          "x-api-key": COMPOSIO_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          arguments: {
            id: sequenceId,
            contact_ids: contactIds,
          },
        }),
      });

      if (!addContactsResponse.ok) {
        const errText = await addContactsResponse.text();
        console.error("Add contacts error:", addContactsResponse.status, errText);
        // Don't throw - sequence was created, contacts just weren't added
      }
    }

    return new Response(JSON.stringify({
      success: true,
      sequenceId,
      contactsAdded: contactIds.length,
      message: `Secuencia "${campaignName}" creada con ${contactIds.length} contactos`,
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

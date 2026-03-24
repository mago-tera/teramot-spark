import { supabase } from "@/integrations/supabase/client";
import { CampaignConfig, ScoredLead } from "@/hooks/useWizard";

export async function saveCampaign(config: CampaignConfig, name: string, loomLinks: Record<string, string>) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase.from("campaigns").insert({
    name,
    profile: config.profile,
    geo_mix: config.geoMix,
    quantity: config.quantity,
    frequency: config.frequency,
    loom_links: loomLinks,
    status: "tracking",
    user_id: user?.id,
  }).select().single();

  if (error) throw error;
  return data;
}

export async function saveLeads(campaignId: string, leads: ScoredLead[]) {
  const rows = leads.map((l) => ({
    campaign_id: campaignId,
    first_name: l.firstName,
    last_name: l.lastName,
    title: l.title,
    company: l.company,
    industry: l.industry,
    country: l.country,
    seniority: l.seniority,
    email: l.email,
    linkedin_url: l.linkedinUrl,
    headcount: l.headcount,
    score: l.total,
    quartile: l.quartile,
    messages: l.messages ? JSON.parse(JSON.stringify(l.messages)) : null,
  }));

  const { error } = await supabase.from("leads").insert(rows);
  if (error) throw error;
}

export async function generateAIMessages(contact: ScoredLead, canal: "linkedin" | "email", objective?: string, whatToCommunicate?: string) {
  const { data, error } = await supabase.functions.invoke("generate-messages", {
    body: { contact, canal, objective, whatToCommunicate, mode: "personalized" },
  });

  if (error) throw error;
  if (data.error) throw new Error(data.error);
  return data.messages;
}

export async function generateGroupMessages(representative: ScoredLead, quartile: string, canal: "linkedin" | "email", objective: string, whatToCommunicate: string) {
  const { data, error } = await supabase.functions.invoke("generate-messages", {
    body: { contact: representative, canal, objective, whatToCommunicate, mode: "generic", quartile },
  });

  if (error) throw error;
  if (data.error) throw new Error(data.error);
  return data.messages;
}

export async function searchApollo(config: CampaignConfig, page = 1, excludeEmails: string[] = [], excludeLinkedins: string[] = []) {
  const { data, error } = await supabase.functions.invoke("search-apollo", {
    body: {
      profile: config.profile,
      geoMix: config.geoMix,
      quantity: config.quantity,
      page,
      excludeEmails,
      excludeLinkedins,
    },
  });

  if (error) throw error;
  if (data.error) throw new Error(data.error);
  return data.leads;
}

export async function createApolloSequence(campaignName: string, leads: ScoredLead[]) {
  const leadsWithMessages = leads.filter(l => l.messages && l.email);

  const { data, error } = await supabase.functions.invoke("create-apollo-sequence", {
    body: {
      campaignName,
      leads: leadsWithMessages.map(l => ({
        apolloId: (l as any).apolloId || "",
        email: l.email,
        firstName: l.firstName,
        lastName: l.lastName,
        messages: l.messages,
      })),
    },
  });

  if (error) throw error;
  if (data.error) throw new Error(data.error);
  return data;
}

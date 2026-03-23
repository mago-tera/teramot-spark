import { supabase } from "@/integrations/supabase/client";
import { CampaignConfig, ScoredLead } from "@/hooks/useWizard";

export async function saveCampaign(config: CampaignConfig, name: string, loomLinks: Record<string, string>) {
  const { data, error } = await supabase.from("campaigns").insert({
    name,
    profile: config.profile,
    geo_mix: config.geoMix,
    quantity: config.quantity,
    frequency: config.frequency,
    loom_links: loomLinks,
    status: "tracking",
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

export async function generateAIMessages(contact: ScoredLead, canal: "linkedin" | "email") {
  const { data, error } = await supabase.functions.invoke("generate-messages", {
    body: { contact, canal },
  });

  if (error) throw error;
  if (data.error) throw new Error(data.error);
  return data.messages;
}

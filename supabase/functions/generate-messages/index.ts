import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { contact, canal } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Sos experto en outreach B2B técnico para Teramot, una plataforma de modelado, limpieza y sanitización de datos empresariales con IA.

Reglas:
- Tono: directo, técnico, sin hype ni frases genéricas
- No mencionar "solución innovadora" ni "transformación digital"
- Personalizar con industria y cargo del prospecto
- Conectar con dolor real de datos sucios o mal modelados
- Canal: ${canal}`;

    const userPrompt = `Generá 5 piezas de outreach para:
Nombre: ${contact.firstName}
Empresa: ${contact.company}
Cargo: ${contact.title}
Industria: ${contact.industry}
Cuartil: ${contact.quartile}
Score: ${contact.total}
Canal: ${canal}

Devolvé SOLO las 5 piezas.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-5",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_outreach",
              description: "Generate outreach messages for a B2B prospect",
              parameters: {
                type: "object",
                properties: {
                  linkedin: { type: "string", description: "LinkedIn message, max 300 chars" },
                  email_asunto: { type: "string", description: "Email subject line" },
                  email_cuerpo: { type: "string", description: "Email body, max 150 words" },
                  followup_d4: { type: "string", description: "Follow-up day 4, max 80 words" },
                  cierre_d9: { type: "string", description: "Closing day 9, max 60 words" },
                },
                required: ["linkedin", "email_asunto", "email_cuerpo", "followup_d4", "cierre_d9"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_outreach" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Intentá de nuevo en unos segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos agotados. Agregá fondos en Settings > Workspace > Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Error del gateway de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error("No tool call in response:", JSON.stringify(data));
      return new Response(JSON.stringify({ error: "No se generaron mensajes" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messages = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ messages }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-messages error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BRAND_CONTEXT = `
=== CONTEXTO DE MARCA TERAMOT ===

PROPUESTA DE VALOR:
Teramot es la mejor forma de trabajar con datos. Descubre esquemas, corrige problemas de calidad, asesora, escribe transformaciones y despliega pipelines SQL listos para producción.

CLAIM PRINCIPAL: "Teramot is the best way to work with data."
SUBCLAIM: "Built to make data analysts incredibly productive."

ANALOGÍA: Teramot es el Cursor para equipos de datos.

CATEGORÍA: AI for Business Data

MENSAJES CLAVE:
- "The AI for Data Infrastructure"
- "Converse. Structure. Deploy your data with AI."
- "From business question to deployed data."

TONALIDAD DE MARCA:
- Directo, técnico, sin hype de marketing
- NO usar: "solución innovadora", "transformación digital", "revolucionario", "cutting-edge"
- SÍ usar: lenguaje concreto, técnico, orientado a resultados medibles
`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { contact, canal, objective, whatToCommunicate, mode, quartile } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Use whatToCommunicate as the main prompt (objective and whatToCommunicate are now the same single prompt)
    const userPrompt = whatToCommunicate || objective || "";

    const systemPrompt = `Sos experto en outreach B2B técnico para Teramot.

${BRAND_CONTEXT}

REGLAS DE GENERACIÓN:
- Tono: directo, técnico, sin hype ni frases genéricas.
- Este es un mensaje GENÉRICO para toda una lista de prospectos. No personalices por nombre ni empresa. Usá placeholders como [Nombre] y [Empresa] si hace falta.
- NO hagas referencia a la industria o empresa específica del prospecto. El mensaje tiene que funcionar para todos.
- LinkedIn: máximo 300 caracteres. Conciso y directo.
- Email: asunto que genere curiosidad sin clickbait. Cuerpo máximo 150 palabras.
- El prompt del usuario es el eje central del mensaje.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generá un mensaje de LinkedIn y un email basado en esto:\n\n${userPrompt}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_outreach",
              description: "Generate outreach messages",
              parameters: {
                type: "object",
                properties: {
                  linkedin: { type: "string", description: "LinkedIn message, max 300 chars" },
                  email_asunto: { type: "string", description: "Email subject line" },
                  email_cuerpo: { type: "string", description: "Email body, max 150 words" },
                },
                required: ["linkedin", "email_asunto", "email_cuerpo"],
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
        return new Response(JSON.stringify({ error: "Créditos agotados." }), {
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

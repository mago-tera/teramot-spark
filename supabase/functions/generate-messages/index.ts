import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Brand context extracted from Teramot's Notion one-pagers
const BRAND_CONTEXT = `
=== CONTEXTO DE MARCA TERAMOT ===

PROPUESTA DE VALOR:
Teramot es la mejor forma de trabajar con datos. Descubre esquemas, corrige problemas de calidad, asesora, escribe transformaciones y despliega pipelines SQL listos para producción.

CLAIM PRINCIPAL: "Teramot is the best way to work with data."
SUBCLAIM: "Built to make data analysts incredibly productive."

ANALOGÍA: Teramot es el Cursor para equipos de datos. Así como Cursor permite que los desarrolladores escriban software mucho más rápido, Teramot permite que los equipos de datos conviertan requerimientos de negocio en sistemas de datos operativos a una velocidad completamente distinta.

CATEGORÍA: AI for Business Data — No es una herramienta de analytics ni un chatbot de datos. Es un sistema diseñado para convertir necesidades de negocio en infraestructura de datos en producción.

ATRIBUTOS CLAVE:
- Inteligente: Analiza la estructura de los datos y asesora cómo modelarlos para responder mejor las preguntas del negocio.
- Confiable: Trabaja directamente sobre las bases de datos y genera queries transparentes y auditables.
- Rápida: Automatiza la limpieza, transformación y construcción de infraestructura de datos.
- Única: Tecnología patentada que permite a LLMs trabajar en forma directa con Bases de Datos reales y complejas.

MENSAJES CLAVE:
- "The AI for Data Infrastructure"
- "Converse. Structure. Deploy your data with AI."
- "Build data infrastructure through conversation."
- "From business question to deployed data."
- "Turn questions into data systems."

PAIN POINTS DEL PROSPECTO:
- Gran parte del tiempo se pierde preparando datos en lugar de analizarlos
- Cada análisis requiere escribir SQL desde cero
- Mucho trabajo manual de limpieza y normalización
- Falta de adopción de IA en procesos de modelado de datos
- Convertir preguntas ambiguas del negocio en estructuras de datos correctas

DIFERENCIADOR: De "pedir y ejecutar" a "pensar y construir juntos". Un sistema que acompaña el proceso de razonamiento técnico y ejecuta cuando hay claridad.

RESULTADO: Equipos de datos convierten requerimientos de negocio en infraestructura de datos en producción en horas en lugar de semanas. x30 más rápido.

TONALIDAD DE MARCA:
- Directo, técnico, sin hype de marketing
- NO usar: "solución innovadora", "transformación digital", "revolucionario", "cutting-edge"
- SÍ usar: lenguaje concreto, técnico, orientado a resultados medibles
- Conectar con dolores reales de equipos de datos
`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { contact, canal } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `Sos experto en outreach B2B técnico para Teramot.

${BRAND_CONTEXT}

REGLAS DE GENERACIÓN:
- Tono: directo, técnico, sin hype ni frases genéricas. Seguí la tonalidad de marca.
- Personalizá con la industria y cargo del prospecto, conectando con sus pain points reales.
- Usá los mensajes clave y la propuesta de valor de Teramot de forma natural, sin sonar robótico.
- Conectá con el dolor real de datos sucios, mal modelados, o procesos manuales de infraestructura de datos.
- Adaptá la intensidad según el cuartil: Q1 (Top Fit) = más agresivo y directo, Q4 (Fit Bajo) = más exploratorio.
- Canal: ${canal}
- Si es LinkedIn, máximo 300 caracteres. Sé conciso y directo.
- Si es email, el asunto debe generar curiosidad sin clickbait.`;

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

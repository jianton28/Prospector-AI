import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { GoogleGenAI, Type } from "@google/genai";

const profileResponseSchema = {
  type: Type.OBJECT,
  properties: {
    full_name: { type: Type.STRING },
    tech_stack: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    services_offered: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING },
          starting_price_usd: { type: Type.NUMBER },
          typical_turnaround_days: { type: Type.NUMBER },
        },
        required: ["name", "description"],
      },
    },
    portfolio_highlights: { type: Type.STRING },
    communication_tone: { type: Type.STRING },
  },
  required: [
    "full_name",
    "tech_stack",
    "services_offered",
    "portfolio_highlights",
    "communication_tone",
  ],
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Verificar sesión de Supabase
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "No autorizado. Inicia sesión primero." },
        { status: 401 }
      );
    }

    // 2. Extraer archivo y/o texto del FormData
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const rawText = formData.get("rawText") as string | null;

    if (!file && (!rawText || !rawText.trim())) {
      return NextResponse.json(
        { error: "Debes subir un archivo PDF o ingresar texto de tu CV/LinkedIn." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Falta configurar GEMINI_API_KEY en .env.local." },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // 3. Preparar prompt estructurado
    const promptInstructions = `Eres un asistente de alta dirección especializado en consultoría B2B y prospección tecnológica.
Analiza la información proporcionada (Currículum Vitae en PDF o texto de LinkedIn/portafolio) y extrae/estructura el perfil del consultor comercial.

Reglas para cada campo:
1. "full_name": Nombre completo del profesional o marca personal comercial.
2. "tech_stack": Lista exhaustiva de herramientas, plataformas, lenguajes o tecnologías en las que tiene experiencia real (ej: ["Next.js", "React", "Supabase", "Python", "n8n", "Make", "WhatsApp Business API", "Tailwind CSS", "Flutter", "FastAPI"]).
3. "services_offered": Infiere y paquetiza de 2 a 5 servicios comerciales concretos que este profesional puede vender a empresas y comercios locales para resolver cuellos de botella operativos (ej: "Automatización de WhatsApp y Agenda", "Landing Page Comercial de Alta Conversión", "Flujos de Integración n8n / Make", "Desarrollo de MVP / App Web").
   - name: Nombre claro y comercial.
   - description: Qué dolor operativo concreto resuelve en el negocio del cliente.
   - starting_price_usd: Precio base estimado en dólares (USD), número realista (ej: 250, 400, 600, 1000).
   - typical_turnaround_days: Días hábiles habituales para entrega (ej: 5, 7, 14, 21).
4. "portfolio_highlights": Redacta un extracto de 2 a 3 líneas con sus logros más contundentes, proyectos destacados o métricas pasadas para proyectar máxima autoridad ante dueños de negocio.
5. "communication_tone": Estilo de comunicación sugerido (ej: "Directo, consultivo y enfocado en resultados operativos").

Si algún dato no aparece explícito, haz una inferencia profesional coherente con su nivel de experiencia y tecnologías dominadas.`;

    // 4. Armar el contenido multimodal para Gemini
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: any[] = [];

    if (file && file.size > 0) {
      const arrayBuffer = await file.arrayBuffer();
      const base64Data = Buffer.from(arrayBuffer).toString("base64");
      parts.push({
        inlineData: {
          data: base64Data,
          mimeType: file.type || "application/pdf",
        },
      });
    }

    let finalPrompt = promptInstructions;
    if (rawText && rawText.trim()) {
      finalPrompt += `\n\n--- TEXTO / PERFIL DE LINKEDIN SUMINISTRADO ---\n${rawText.trim()}`;
    }

    parts.push({
      text: finalPrompt,
    });

    // 5. Llamada a Gemini 3.8 Flash
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: parts,
      config: {
        temperature: 0.2,
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json",
        responseSchema: profileResponseSchema,
      },
    });

    const outputText = response.text;
    if (!outputText) {
      return NextResponse.json(
        { error: "Gemini no devolvió contenido al analizar el perfil." },
        { status: 502 }
      );
    }

    const parsedData = JSON.parse(outputText);
    return NextResponse.json(parsedData);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error inesperado procesando el perfil";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

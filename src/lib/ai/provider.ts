import { GoogleGenAI } from "@google/genai";
import { AuditAIOutput } from "@/prompts/auditPrompt";

// Modelo principal con razonamiento profundo y búsqueda web para análisis exhaustivo B2B
const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const FALLBACK_MODEL = "gemini-3.1-flash-lite";

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Falta GEMINI_API_KEY en el archivo .env.local");
  }
  return new GoogleGenAI({ apiKey });
}

function cleanJsonString(str: string): string {
  let cleaned = str.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  return cleaned.trim();
}

export async function generateProspectAudit(
  prompt: string
): Promise<AuditAIOutput> {
  const ai = getGeminiClient();

  // Ejecución sin límite artificial corto: prioriza completar la investigación real completa
  let response;
  try {
    // 1. Intento primario: gemini-3.8-flash con Google Search Grounding y razonamiento
    response = await ai.models.generateContent({
      model: PRIMARY_MODEL,
      contents: prompt,
      config: {
        temperature: 0.35,
        maxOutputTokens: 2500,
        thinkingConfig: { thinkingBudget: 1024 },
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }],
      },
    });
  } catch (searchError) {
    console.warn(
      "Llamada con Google Search no completada (posible límite de cuota de búsqueda), continuando con análisis profundo:",
      searchError instanceof Error ? searchError.message : searchError
    );

    try {
      // 2. Fallback intermedio: gemini-3.8-flash con razonamiento profundo sin tools
      response = await ai.models.generateContent({
        model: PRIMARY_MODEL,
        contents: prompt,
        config: {
          temperature: 0.35,
          maxOutputTokens: 2500,
          thinkingConfig: { thinkingBudget: 1024 },
          responseMimeType: "application/json",
        },
      });
    } catch (primaryError) {
      console.warn(
        "Fallo en modelo primario, ejecutando fallback de contingencia:",
        primaryError instanceof Error ? primaryError.message : primaryError
      );

      // 3. Fallback de contingencia: modelo ultra-rápido directo
      response = await ai.models.generateContent({
        model: FALLBACK_MODEL,
        contents: prompt,
        config: {
          temperature: 0.3,
          maxOutputTokens: 1500,
          thinkingConfig: { thinkingBudget: 0 },
          responseMimeType: "application/json",
        },
      });
    }
  }

  const rawText = response.text;
  if (!rawText) {
    throw new Error("El modelo no devolvió contenido en la respuesta.");
  }

  // Parseo del JSON
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let parsed: Record<string, any>;
  try {
    parsed = JSON.parse(cleanJsonString(rawText));
  } catch (parseError) {
    // Si hubo algún texto antes o después del bloque JSON, intentamos extraer el bloque {...}
    const match = rawText.match(/\{[\s\S]*\}/);
    if (match) {
      parsed = JSON.parse(match[0]);
    } else {
      throw parseError;
    }
  }

  const initialDraft = String(
    parsed.initial_proposal_draft || parsed.initial_draft || ""
  );

  const rawSeo = String(parsed.local_seo_visibility || "");
  let localSeoVisibility:
    | "Top 3 visible"
    | "Primera página (puestos 4-10)"
    | "No aparece en primeros resultados / Solo ficha Maps";

  if (rawSeo.toLowerCase().includes("top 3")) {
    localSeoVisibility = "Top 3 visible";
  } else if (
    rawSeo.toLowerCase().includes("primera página") ||
    rawSeo.toLowerCase().includes("4-10")
  ) {
    localSeoVisibility = "Primera página (puestos 4-10)";
  } else {
    localSeoVisibility = "No aparece en primeros resultados / Solo ficha Maps";
  }

  return {
    detected_pains: Array.isArray(parsed.detected_pains)
      ? parsed.detected_pains.map(String)
      : [],
    recommended_service: String(
      parsed.recommended_service || "Automatización y Captación Web"
    ),
    priority_level: ["alta", "media", "baja"].includes(parsed.priority_level)
      ? parsed.priority_level
      : "media",
    local_seo_visibility: localSeoVisibility,
    website_audit_findings: Array.isArray(parsed.website_audit_findings)
      ? parsed.website_audit_findings.map(String)
      : [],
    filter_questions: Array.isArray(parsed.filter_questions)
      ? parsed.filter_questions.map(String)
      : [],
    pitch_20s: String(parsed.pitch_20s || ""),
    initial_draft: initialDraft,
    initial_proposal_draft: initialDraft,
    estimated_range: String(parsed.estimated_range || "A definir según alcance"),
    full_diagnosis: {
      digital_presence_summary: String(
        parsed.full_diagnosis?.digital_presence_summary || ""
      ),
      operational_bottleneck: String(
        parsed.full_diagnosis?.operational_bottleneck || ""
      ),
      quick_win_angle: String(parsed.full_diagnosis?.quick_win_angle || ""),
    },
  };
}

export async function generateTextResponse(prompt: string): Promise<string> {
  const ai = getGeminiClient();

  let response;
  try {
    response = await ai.models.generateContent({
      model: PRIMARY_MODEL,
      contents: prompt,
      config: {
        temperature: 0.35,
        maxOutputTokens: 2000,
        thinkingConfig: { thinkingBudget: 512 },
      },
    });
  } catch {
    response = await ai.models.generateContent({
      model: FALLBACK_MODEL,
      contents: prompt,
      config: {
        temperature: 0.3,
        maxOutputTokens: 1500,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
  }

  const rawText = response.text;
  if (!rawText) {
    throw new Error("El modelo no devolvió contenido en la respuesta.");
  }

  return rawText.trim();
}

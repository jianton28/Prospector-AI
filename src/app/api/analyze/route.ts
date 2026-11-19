import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildAuditPrompt, WebVerificationResult } from "@/prompts/auditPrompt";
import { generateProspectAudit } from "@/lib/ai/provider";
import { ConsultantProfile, Prospect } from "@/types/prospector";

// Permite hasta 5 minutos de ejecución para auditorías profundas con razonamiento y búsqueda real
export const maxDuration = 300;

// Escáner técnico real con timeout de 7 segundos para auditoría profunda en vivo
async function inspectWebsiteSignals(
  websiteUrl?: string | null
): Promise<WebVerificationResult> {
  if (!websiteUrl || !websiteUrl.trim()) {
    return {
      has_website_in_maps: false,
      reachable: false,
      url_checked: null,
      status_code: null,
      title: null,
      meta_description: null,
      h1: null,
      has_viewport: false,
      uses_https: false,
      has_whatsapp_link: false,
      detected_chat_widgets: [],
      detected_booking_tools: [],
      has_forms: false,
      detected_social_links: [],
      clean_text_excerpt: "",
      signals_summary: ["Sin sitio web enlazado en Google Maps (Oportunidad Alta)"],
      details: "No tiene sitio web registrado en la ficha de Google Maps.",
    };
  }

  let targetUrl = websiteUrl.trim();
  if (!/^https?:\/\//i.test(targetUrl)) {
    targetUrl = `https://${targetUrl}`;
  }

  try {
    const res = await fetch(targetUrl, {
      signal: AbortSignal.timeout(7000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 ProspectorAI/2.0",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
      },
      redirect: "follow",
    });

    const isReachable = res.ok;
    const statusCode = res.status;

    let html = "";
    try {
      html = (await res.text()).slice(0, 500000);
    } catch {
      html = "";
    }

    const lowerHtml = html.toLowerCase();

    // 1. Título de la página
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : null;

    // 2. Meta description
    const descMatch =
      html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
    const metaDescription = descMatch ? descMatch[1].trim() : null;

    // 3. Encabezado <h1>
    const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const h1 = h1Match
      ? h1Match[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
      : null;

    // 4. Viewport móvil
    const hasViewport = /<meta[^>]*name=["']viewport["']/i.test(html);

    // 5. Enlaces directos a WhatsApp
    const hasWhatsappLink =
      /wa\.me|api\.whatsapp\.com|whatsapp:\/\/|chat\.whatsapp\.com/i.test(lowerHtml);

    // 6. Widgets de Chat o CRM conocidos
    const knownChatWidgets = [
      "tawk.to",
      "crisp.chat",
      "crisp.im",
      "intercom",
      "landbot",
      "manychat",
      "kommo",
      "hubspot",
      "botpress",
      "chatwoot",
      "tidio",
      "zendesk",
      "livechat",
      "zoho.salesiq",
      "jivochat",
    ];
    const detectedChatWidgets = knownChatWidgets.filter((w) =>
      lowerHtml.includes(w)
    );

    // 7. Sistemas de agendamiento online
    const knownBookingTools = [
      "calendly",
      "doctoralia",
      "acuity",
      "timify",
      "setmore",
      "simplybook",
      "reservio",
      "treatwell",
    ];
    const detectedBookingTools = knownBookingTools.filter((b) =>
      lowerHtml.includes(b)
    );

    // 8. Formularios en HTML
    const hasForms = lowerHtml.includes("<form");

    // 9. Detección de redes sociales
    const socialNetworks = ["instagram.com", "facebook.com", "tiktok.com", "linkedin.com"];
    const detectedSocialLinks = socialNetworks.filter((s) => lowerHtml.includes(s));

    // 10. Extracto de texto visible y limpio (primeros 2.000 caracteres)
    const cleanText = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, " ")
      .replace(/<head\b[^<]*(?:(?!<\/head>)<[^<]*)*<\/head>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    const cleanTextExcerpt = cleanText.slice(0, 2000);

    // Resumen estructurado
    const signalsSummary: string[] = [];
    if (isReachable) {
      signalsSummary.push(`Sitio web operativo (HTTP ${statusCode})`);
    } else {
      signalsSummary.push(`HTTP ${statusCode} - Posible error de carga`);
    }

    if (hasWhatsappLink) {
      signalsSummary.push("Enlace directo a WhatsApp en código");
    } else {
      signalsSummary.push("Sin enlace directo a WhatsApp detectado");
    }

    if (detectedChatWidgets.length > 0) {
      signalsSummary.push(`Chat/CRM: ${detectedChatWidgets.join(", ")}`);
    } else {
      signalsSummary.push("Sin widget de chat o CRM");
    }

    if (detectedBookingTools.length > 0) {
      signalsSummary.push(`Agenda online: ${detectedBookingTools.join(", ")}`);
    } else {
      signalsSummary.push("Sin motor de reservas online");
    }

    if (hasForms) signalsSummary.push("Formulario de captación web");
    if (!metaDescription) signalsSummary.push("Falta etiqueta meta description (SEO)");
    if (!hasViewport) signalsSummary.push("Sin viewport móvil responsive");

    return {
      has_website_in_maps: true,
      reachable: isReachable,
      url_checked: targetUrl,
      status_code: statusCode,
      title,
      meta_description: metaDescription,
      h1,
      has_viewport: hasViewport,
      uses_https: targetUrl.startsWith("https://"),
      has_whatsapp_link: hasWhatsappLink,
      detected_chat_widgets: detectedChatWidgets,
      detected_booking_tools: detectedBookingTools,
      has_forms: hasForms,
      detected_social_links: detectedSocialLinks,
      clean_text_excerpt: cleanTextExcerpt,
      signals_summary: signalsSummary,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Error de conexión";
    return {
      has_website_in_maps: true,
      reachable: false,
      url_checked: targetUrl,
      status_code: null,
      title: null,
      meta_description: null,
      h1: null,
      has_viewport: false,
      uses_https: targetUrl.startsWith("https://"),
      has_whatsapp_link: false,
      detected_chat_widgets: [],
      detected_booking_tools: [],
      has_forms: false,
      detected_social_links: [],
      clean_text_excerpt: "",
      signals_summary: [`Sitio web inaccesible (${errorMsg})`],
      details: errorMsg,
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    console.time("supabase-read");
    const supabase = await createClient();

    // 1. Verificar sesión autenticada
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      console.timeEnd("supabase-read");
      return NextResponse.json(
        { error: "No autorizado. Inicia sesión primero." },
        { status: 401 }
      );
    }

    // 2. Leer el ID del prospecto del body
    const body = await req.json().catch(() => ({}));
    const prospectId = body?.prospectId as string | undefined;

    if (!prospectId) {
      console.timeEnd("supabase-read");
      return NextResponse.json(
        { error: "Falta el campo prospectId en la petición." },
        { status: 400 }
      );
    }

    // 3. Obtener el prospecto
    const { data: prospect, error: prospectError } = await supabase
      .from("prospects")
      .select("*")
      .eq("id", prospectId)
      .single();

    if (prospectError || !prospect) {
      console.timeEnd("supabase-read");
      return NextResponse.json(
        { error: "Prospecto no encontrado o sin acceso." },
        { status: 404 }
      );
    }

    // 4. Obtener el perfil del consultor
    const { data: profile } = await supabase
      .from("consultant_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    console.timeEnd("supabase-read");

    // 5. Escaneo técnico real de presencia web (hasta 7 segundos)
    console.time("website-inspection");
    const webVerification = await inspectWebsiteSignals(prospect.website_url);
    console.timeEnd("website-inspection");

    // 6. Construir prompt enriquecido con evidencia técnica real y generar auditoría con IA
    console.time("gemini-audit");
    const prompt = buildAuditPrompt(
      prospect as Prospect,
      (profile as ConsultantProfile | null) ?? null,
      webVerification
    );
    const aiResult = await generateProspectAudit(prompt);
    console.timeEnd("gemini-audit");

    // 7. Guardar en Supabase (audits y proposals)
    console.time("supabase-write");
    const initialDraft =
      aiResult.initial_draft || aiResult.initial_proposal_draft || "";

    // Integramos web_verification y datos de SEO local dentro de full_diagnosis para persistencia
    const fullDiagnosis = {
      ...aiResult.full_diagnosis,
      web_verification: webVerification,
      local_seo_visibility: aiResult.local_seo_visibility,
      website_audit_findings: aiResult.website_audit_findings,
    };

    const { data: savedAudit, error: auditSaveError } = await supabase
      .from("audits")
      .upsert(
        {
          prospect_id: prospect.id,
          user_id: user.id,
          detected_pains: aiResult.detected_pains,
          recommended_service: aiResult.recommended_service,
          priority_level: aiResult.priority_level,
          filter_questions: aiResult.filter_questions,
          pitch_20s: aiResult.pitch_20s,
          full_diagnosis: fullDiagnosis,
        },
        { onConflict: "prospect_id" }
      )
      .select()
      .single();

    if (auditSaveError !== null || !savedAudit) {
      console.timeEnd("supabase-write");
      return NextResponse.json(
        {
          error: `Error guardando auditoría en base de datos: ${
            auditSaveError?.message || "Fallo de inserción o permisos RLS"
          }`,
        },
        { status: 500 }
      );
    }

    // 8. Guardar o actualizar el borrador inicial en 'proposals'
    const { data: savedProposal, error: proposalSaveError } = await supabase
      .from("proposals")
      .upsert(
        {
          prospect_id: prospect.id,
          user_id: user.id,
          initial_draft: initialDraft,
          estimated_range: aiResult.estimated_range,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "prospect_id" }
      )
      .select()
      .single();

    if (proposalSaveError !== null || !savedProposal) {
      console.timeEnd("supabase-write");
      return NextResponse.json(
        {
          error: `Error guardando propuesta inicial en base de datos: ${
            proposalSaveError?.message || "Fallo de inserción o permisos RLS"
          }`,
        },
        { status: 500 }
      );
    }

    // 9. Actualizar estado del prospecto si seguía en 'por_analizar'
    if (prospect.status === "por_analizar") {
      const { error: updateStatusError } = await supabase
        .from("prospects")
        .update({
          status: "listo_contactar",
          updated_at: new Date().toISOString(),
        })
        .eq("id", prospect.id);

      if (updateStatusError !== null) {
        console.timeEnd("supabase-write");
        return NextResponse.json(
          {
            error: `Error actualizando estado del prospecto: ${updateStatusError.message}`,
          },
          { status: 500 }
        );
      }
    }

    console.timeEnd("supabase-write");

    return NextResponse.json({
      audit: savedAudit,
      proposal: savedProposal,
      web_verification: webVerification,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error interno al analizar prospecto.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

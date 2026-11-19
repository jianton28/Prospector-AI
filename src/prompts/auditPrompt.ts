import { ConsultantProfile, Prospect } from "@/types/prospector";

export interface WebVerificationResult {
  has_website_in_maps: boolean;
  reachable: boolean;
  url_checked: string | null;
  status_code: number | null;
  title: string | null;
  meta_description: string | null;
  h1: string | null;
  has_viewport: boolean;
  uses_https: boolean;
  has_whatsapp_link: boolean;
  detected_chat_widgets: string[];
  detected_booking_tools: string[];
  has_forms: boolean;
  detected_social_links: string[];
  clean_text_excerpt: string;
  signals_summary: string[];
  details?: string;
}

export interface AuditAIOutput {
  detected_pains: string[];
  recommended_service: string;
  priority_level: "alta" | "media" | "baja";
  local_seo_visibility:
    | "Top 3 visible"
    | "Primera página (puestos 4-10)"
    | "No aparece en primeros resultados / Solo ficha Maps";
  website_audit_findings: string[];
  filter_questions: string[];
  pitch_20s: string;
  initial_draft: string;
  initial_proposal_draft?: string;
  estimated_range: string;
  full_diagnosis: {
    digital_presence_summary: string;
    operational_bottleneck: string;
    quick_win_angle: string;
    web_verification?: WebVerificationResult;
    local_seo_visibility?: string;
    website_audit_findings?: string[];
  };
}

export function buildAuditPrompt(
  prospect: Prospect,
  profile: ConsultantProfile | null,
  webVerification?: WebVerificationResult
): string {
  const servicesList = profile?.services_offered?.length
    ? profile.services_offered
        .map(
          (s) =>
            `${s.name} ($${s.starting_price_usd ?? 0} USD, ${
              s.typical_turnaround_days ?? 7
            }d): ${s.description}`
        )
        .join("; ")
    : "Landing page básica con WhatsApp directo ($60-$120 USD, 3d); Sitio web comercial multi-sección ($120-$220 USD, 7d); Automatización de WhatsApp y flujos n8n ($180-$320 USD, 5d)";

  let webSignals = "EVIDENCIA TÉCNICA REAL ESCANEADA:\n";
  if (!webVerification || !webVerification.has_website_in_maps) {
    webSignals += `- Web registrada en Maps: NO TIENE SITIO WEB ENLAZADO en su ficha de Google Maps.\n`;
    webSignals += `- Oportunidad Inmediata: Negocio sin presencia web propia indexada.\n`;
  } else {
    webSignals += `- URL analizada: ${webVerification.url_checked}\n`;
    webSignals += `- Estado HTTP: ${
      webVerification.reachable
        ? `Operativo (HTTP ${webVerification.status_code})`
        : `Inaccesible / Caído (${webVerification.details || "Error de conexión o timeout"})`
    }\n`;
    webSignals += `- Título (<title>): ${webVerification.title ? `"${webVerification.title}"` : "NO TIENE o está vacío"}\n`;
    webSignals += `- Meta Description: ${
      webVerification.meta_description
        ? `"${webVerification.meta_description}"`
        : "NO TIENE (grave para SEO local)"
    }\n`;
    webSignals += `- Encabezado H1: ${webVerification.h1 ? `"${webVerification.h1}"` : "NO TIENE etiqueta <h1> visible"}\n`;
    webSignals += `- Optimización móvil (<meta viewport>): ${
      webVerification.has_viewport ? "Presente" : "NO DETECTADA (no responsive)"
    }\n`;
    webSignals += `- Protocolo Seguro: ${webVerification.uses_https ? "HTTPS activo" : "HTTP sin certificado SSL"}\n`;
    webSignals += `- Botón / Enlace directo a WhatsApp en código: ${
      webVerification.has_whatsapp_link
        ? "SÍ DETECTADO (wa.me o api.whatsapp)"
        : "NO DETECTADO (pierden contactos directos desde móvil)"
    }\n`;
    webSignals += `- Widgets de Chat/CRM: ${
      webVerification.detected_chat_widgets.length > 0
        ? webVerification.detected_chat_widgets.join(", ")
        : "NINGUNO detectado en la web"
    }\n`;
    webSignals += `- Agendamiento / Citas online: ${
      webVerification.detected_booking_tools.length > 0
        ? webVerification.detected_booking_tools.join(", ")
        : "NINGUNO detectado (sin Calendly, Doctoralia, Acuity, etc.)"
    }\n`;
    webSignals += `- Formulario de captación: ${
      webVerification.has_forms ? "Presente en la página" : "Sin formularios detectados"
    }\n`;
    if (webVerification.detected_social_links.length > 0) {
      webSignals += `- Redes detectadas en web: ${webVerification.detected_social_links.join(", ")}\n`;
    }
    if (webVerification.clean_text_excerpt) {
      webSignals += `- Extracto real de contenido visible en su web (primeros 1.500 caracteres):\n"${webVerification.clean_text_excerpt.slice(
        0,
        1500
      )}"\n`;
    }
  }

  return `Eres un auditor técnico senior y consultor comercial B2B para negocios locales. Tu misión es analizar a fondo la presencia digital y operativa de este prospecto y preparar un diagnóstico incisivo, técnico y comercialmente demoledor para el consultor.

NEGOCIO PROSPECTO:
- Nombre del negocio: ${prospect.business_name}
- Nicho / Rubro: ${prospect.niche}
- Zona geográfica: ${prospect.zone || "No especificada"}
- Teléfono registrado: ${prospect.phone || "No indicado"}
- Canal preferido de contacto: ${prospect.preferred_channel}
- Notas de campo tomadas en la calle: ${prospect.raw_notes || "Sin notas adicionales"}

${webSignals}

CONSULTOR:
- Catálogo de servicios disponibles: ${servicesList}
- Tono de comunicación: ${profile?.communication_tone || "Directo, consultivo, pragmático y enfocado en retorno operativo"}

INVESTIGACIÓN DE VISIBILIDAD LOCAL Y SEO:
1. Realiza una búsqueda comercial con Google Search de "${prospect.niche} ${prospect.zone || ""}" y de "${prospect.business_name} ${prospect.zone || ""}".
2. Evalúa en qué posición real aparece el negocio en los resultados orgánicos/locales:
   - "Top 3 visible": si figura en el Local Pack de los 3 primeros de Google Maps o en las primeras 3 posiciones orgánicas.
   - "Primera página (puestos 4-10)": si aparece en la primera página pero fuera del top 3.
   - "No aparece en primeros resultados / Solo ficha Maps": si no aparece en primera página para búsquedas de su rubro en su zona, o si solo existe como ficha aislada sin tracción.

REGLAS ESTRICTAS DE CERO CLICHÉS Y CERO ALUCINACIONES:
1. PROHIBIDO usar lenguaje genérico de agencia de marketing ("optimizar tu presencia digital", "potenciar tus ventas", "crecer en redes", "mejorar conversión", "impulsar tu marca"). Toda observación debe señalar un hecho técnico o una fuga operativa concreta.
2. NUNCA inventes problemas que no se desprendan de la evidencia técnica real o de la búsqueda de Google.
3. LÓGICA CONDICIONAL DE SITIO WEB Y WHATSAPP:
   - Si el negocio NO tiene sitio web en Maps:
     * NUNCA recomiendes auditorías SEO on-page complejas ni sistemas avanzados de chat multiagente todavía.
     * Su dolor #1 es que un cliente interesado en Maps o en Google no tiene dónde consultar menú/servicios ni botón para abrir WhatsApp en 1 clic.
     * recommended_service: Debe ser la creación de una Landing Page de Alta Conversión con Botón Directo a WhatsApp y optimización de ficha en Maps.
     * priority_level: "alta".
   - Si el negocio TIENE sitio web:
     * NUNCA propongas "crear una página web desde cero" (eso espanta a dueños que ya pagaron por una).
     * Audita los fallos on-page detectados en la evidencia técnica real: si le falta <title> descriptivo, si no tiene meta description, si no tiene botón directo a WhatsApp (o está roto), si carece de agendador automático o si su tiempo de respuesta fuera de horario es nulo.
     * recommended_service: Ofrece el servicio del catálogo que solucione su brecha específica (ej: Automatización de WhatsApp / Bot de reservas, o Landing de conversión si la actual está obsoleta/rota).

CALIBRACIÓN DE PRECIOS REALISTAS PARA EL MERCADO LOCAL (VENEZUELA / PYMES LATAM):
El presupuesto estimado debe ser realista, accesible y con alta tasa de cierre para comercios locales, clínicas, tiendas y pymes venezolanas:
- Landing page básica + Botón directo a WhatsApp + Ficha Maps optimizada: $60 – $120 USD.
- Sitio web comercial multi-sección completo (catálogo/servicios o reservas): $120 – $220 USD.
- Automatización integral de WhatsApp / Bot interactivo / Flujos n8n o Make: $180 – $320 USD.
- PROHIBIDO cotizar montos inflados de $450–$700 USD para pymes locales tradicionales sin justificación de alcance técnico avanzado. Si el consultor tiene precios configurados en su perfil, adáptalos respetando estos rangos de mercado real.

ESTRUCTURA DE RESPUESTA:
- detected_pains: Exactamente 3 dolores técnicos u operativos concretos (máximo 1 línea cada uno).
- local_seo_visibility: Exactamente uno de: "Top 3 visible", "Primera página (puestos 4-10)", "No aparece en primeros resultados / Solo ficha Maps".
- website_audit_findings: Entre 2 y 4 observaciones técnicas concisas sobre su web o presencia local (ej: "Sin etiqueta meta description indexable", "Sin botón directo de WhatsApp para usuarios móviles", "Citas gestionadas por teléfono sin motor online", "Título no incluye nicho ni zona").
- filter_questions: Exactamente 3 preguntas abiertas de diagnóstico para hacerle al dueño sin sonar acusatorio (ej: "¿Cómo hacen cuando entra una consulta un domingo a las 9 de la noche? ¿Tienen forma de agendarla automáticamente?").
- pitch_20s: Guion verbal para decir cara a cara o por teléfono, de ENTRE 40 Y 55 PALABRAS. Debe citar un dato técnico real comprobado y cerrar con una pregunta de descubrimiento respetuosa.
- initial_proposal_draft: Borrador preliminar de propuesta de 100 a 140 palabras (Problema detectado, Solución sugerida del catálogo, Entregables tangibles y siguiente paso).
- estimated_range: Rango orientativo en USD adaptado al mercado local según alcance (ej: "$80 - $120 USD", "$120 - $180 USD" o "$180 - $250 USD").
- full_diagnosis:
  * digital_presence_summary: 2 frases describiendo objetivamente cómo se ve hoy el negocio en internet.
  * operational_bottleneck: La principal fuga de clientes o tiempo en su día a día.
  * quick_win_angle: La demostración en vivo de 3 minutos que el consultor le puede mostrar en su propio celular para impactarlo.

Devuelve ÚNICAMENTE un JSON con esta estructura exacta:
{
  "priority_level": "alta",
  "recommended_service": "...",
  "local_seo_visibility": "Top 3 visible",
  "website_audit_findings": ["...", "..."],
  "detected_pains": ["...", "...", "..."],
  "pitch_20s": "...",
  "filter_questions": ["...", "...", "..."],
  "full_diagnosis": {
    "digital_presence_summary": "...",
    "operational_bottleneck": "...",
    "quick_win_angle": "..."
  },
  "initial_proposal_draft": "...",
  "estimated_range": "..."
}`;
}

import { ConsultantProfile, Prospect, Proposal } from "@/types/prospector";

export function buildExpandProposalPrompt(params: {
  prospect: Prospect;
  profile: ConsultantProfile | null;
  proposal: Proposal;
  meetingNotes: string;
  estimatedRange?: string;
}): string {
  const { prospect, profile, proposal, meetingNotes, estimatedRange } = params;

  const consultantInfo = profile
    ? `
PERFIL DEL CONSULTOR:
- Nombre / Marca: ${profile.full_name}
- Stack técnico: ${profile.tech_stack.join(", ") || "Desarrollo web, automatización y apps"}
- Servicios ofrecidos: ${JSON.stringify(profile.services_offered)}
- Portafolio / Casos relevantes: ${profile.portfolio_highlights || "Proyectos web, automatizaciones y sistemas a medida"}
- Tono de comunicación: ${profile.communication_tone}
`
    : `
PERFIL DEL CONSULTOR:
- Servicios: Desarrollo web, flujos automatizados y aplicaciones a medida.
- Tono: Claro, consultivo, práctico y orientado a impacto de negocio.
`;

  return `Eres un consultor senior especializado en redactar propuestas comerciales claras, convincentes y accionables para negocios locales y empresas medianas, a partir de conversaciones reales con los tomadores de decisión.

Tu misión es tomar el BORRADOR INICIAL de la propuesta y las NOTAS DE LA CONVERSACIÓN / REUNIÓN con el cliente para generar una PROPUESTA AMPLIADA y lista para enviar o revisar con el cliente.

${consultantInfo}

DATOS DEL PROSPECTO:
- Negocio: ${prospect.business_name}
- Rubro: ${prospect.niche}
- Zona: ${prospect.zone || "No especificada"}
- Canal de contacto: ${prospect.preferred_channel}
- Estado actual: ${prospect.status}

BORRADOR INICIAL EXISTENTE:
${proposal.initial_draft || "(No había borrador inicial previo; construye una propuesta completa desde cero)"}

RANGO ESTIMADO INDICADO:
${estimatedRange || proposal.estimated_range || "A definir según alcance"}

NOTAS REALES RECOGIDAS TRAS CONTACTAR / REUNIRSE CON EL CLIENTE:
${meetingNotes}

REGLAS PARA LA PROPUESTA AMPLIADA:
1. Prioriza lo que el cliente dijo o mostró interés real en la conversación; descarta o ajusta supuestos del borrador inicial que ya no apliquen.
2. Redacta en lenguaje de negocio (resultados, ahorro de tiempo, captura de clientes, control operativo, orden), evitando tecnicismos innecesarios salvo cuando aporten claridad.
3. Estructura la propuesta en secciones claras en Markdown:
   - Resumen ejecutivo y contexto del negocio
   - Objetivos y problemas a resolver (basados en la conversación)
   - Alcance recomendado por fases (por ejemplo: Fase 1 de impacto rápido / MVP y Fase 2 de expansión o automatización avanzada)
   - Entregables concretos por fase
   - Inversión estimada y tiempos orientativos
   - Supuestos clave y próximos pasos para cerrar
4. Si falta algún dato crítico para cerrar el alcance exacto (por ejemplo, volumen de pedidos, accesos actuales o fecha límite), incluye al final una breve lista de preguntas pendientes de confirmar.

Devuelve ÚNICAMENTE el texto de la propuesta ampliada en Markdown limpio (sin rodearlo de bloques de código \`\`\`markdown).`;
}
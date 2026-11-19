export type ProspectStatus =
  | "por_analizar"
  | "listo_contactar"
  | "contactado"
  | "reunion_pendiente"
  | "reunion"
  | "propuesta_enviada"
  | "seguimiento"
  | "cerrado"
  | "descartado";

export type PreferredChannel = "presencial" | "whatsapp" | "llamada" | "correo";

export type PriorityLevel = "alta" | "media" | "baja";

export interface ServiceOffering {
  name: string;
  description: string;
  starting_price_usd?: number;
  typical_turnaround_days?: number;
}

export interface ConsultantProfile {
  id: string;
  user_id: string;
  full_name: string;
  tech_stack: string[];
  services_offered: ServiceOffering[];
  portfolio_highlights: string | null;
  communication_tone: string;
  created_at: string;
  updated_at: string;
}

export interface Prospect {
  id: string;
  user_id: string;
  business_name: string;
  niche: string;
  zone: string | null;
  maps_url: string | null;
  website_url: string | null;
  social_url: string | null;
  phone: string | null;
  preferred_channel: PreferredChannel;
  raw_notes: string | null;
  next_action?: string | null;
  follow_up_date?: string | null;
  status: ProspectStatus;
  created_at: string;
  updated_at: string;
}

/**
 * Helper para extraer de forma resiliente la próxima acción y fecha de seguimiento
 * ya sea de las columnas dedicadas o del bloque serializado en raw_notes.
 */
export function getProspectFollowUp(prospect: Prospect): {
  nextAction: string;
  followUpDate: string;
} {
  const columnNextAction = (prospect.next_action || "").trim();
  const columnDate = (prospect.follow_up_date || "").trim();

  if (columnNextAction || columnDate) {
    return {
      nextAction: columnNextAction,
      followUpDate: columnDate,
    };
  }

  // Fallback: parsear desde raw_notes si aún no se migraron las columnas
  if (prospect.raw_notes) {
    const match = prospect.raw_notes.match(
      /\[SEGUIMIENTO:\s*Próxima acción:\s*(.*?)\s*\|\s*Fecha:\s*(.*?)\]/i
    );
    if (match) {
      return {
        nextAction: (match[1] || "").trim(),
        followUpDate: (match[2] || "").trim(),
      };
    }
  }

  return { nextAction: "", followUpDate: "" };
}

export interface Audit {
  id: string;
  prospect_id: string;
  user_id: string;
  detected_pains: string[];
  recommended_service: string | null;
  priority_level: PriorityLevel;
  filter_questions: string[];
  pitch_20s: string | null;
  full_diagnosis: Record<string, unknown>;
  created_at: string;
}

export interface Proposal {
  id: string;
  prospect_id: string;
  user_id: string;
  initial_draft: string | null;
  meeting_notes: string | null;
  expanded_proposal: string | null;
  estimated_range: string | null;
  created_at: string;
  updated_at: string;
}
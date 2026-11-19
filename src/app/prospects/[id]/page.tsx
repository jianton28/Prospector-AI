"use client";

import { useEffect, useState, Suspense, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { AuthChangeEvent } from "@supabase/supabase-js";
import {
  Audit,
  Proposal,
  Prospect,
  ProspectStatus,
  PriorityLevel,
  getProspectFollowUp,
} from "@/types/prospector";

const STATUS_OPTIONS: { value: ProspectStatus; label: string }[] = [
  { value: "por_analizar", label: "Por analizar" },
  { value: "listo_contactar", label: "Listo para contactar" },
  { value: "contactado", label: "Contactado" },
  { value: "reunion_pendiente", label: "Reunión pendiente" },
  { value: "reunion", label: "En reunión" },
  { value: "propuesta_enviada", label: "Propuesta enviada" },
  { value: "seguimiento", label: "Seguimiento / Por decidir" },
  { value: "cerrado", label: "Cerrado / Ganado" },
  { value: "descartado", label: "Descartado" },
];

const PRIORITY_BADGES: Record<
  PriorityLevel,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  alta: {
    label: "Prioridad Alta",
    bg: "bg-red-950/40",
    text: "text-red-300",
    border: "border-red-800/80",
    dot: "bg-red-400 animate-pulse",
  },
  media: {
    label: "Prioridad Media",
    bg: "bg-amber-950/40",
    text: "text-amber-300",
    border: "border-amber-800/80",
    dot: "bg-amber-400",
  },
  baja: {
    label: "Prioridad Baja",
    bg: "bg-neutral-900",
    text: "text-neutral-400",
    border: "border-neutral-800",
    dot: "bg-neutral-500",
  },
};

const CHANNEL_LABELS: Record<string, string> = {
  presencial: "📍 Presencial (Cara a cara)",
  whatsapp: "💬 WhatsApp",
  llamada: "📞 Llamada",
  correo: "✉️ Correo",
};

interface FullDiagnosisData {
  digital_presence_summary?: string;
  operational_bottleneck?: string;
  quick_win_angle?: string;
  web_verification?: {
    has_website_in_maps?: boolean;
    reachable?: boolean;
    url_checked?: string | null;
    status_code?: number | null;
    title?: string | null;
    meta_description?: string | null;
    h1?: string | null;
    has_viewport?: boolean;
    uses_https?: boolean;
    has_whatsapp_link?: boolean;
    detected_chat_widgets?: string[];
    detected_booking_tools?: string[];
    has_forms?: boolean;
    detected_social_links?: string[];
    clean_text_excerpt?: string;
    signals_summary?: string[];
    details?: string;
  };
  local_seo_visibility?: string;
  website_audit_findings?: string[];
}

function getFollowUpStatus(dateStr: string): {
  label: string;
  badgeClass: string;
  dotClass: string;
} | null {
  if (!dateStr) return null;
  const today = new Date().toISOString().split("T")[0];
  if (dateStr < today) {
    return {
      label: `Vencido (${dateStr})`,
      badgeClass: "bg-red-950/60 text-red-300 border-red-800/80",
      dotClass: "bg-red-400",
    };
  }
  if (dateStr === today) {
    return {
      label: "Seguimiento HOY",
      badgeClass: "bg-amber-950/60 text-amber-200 border-amber-600/80 animate-pulse",
      dotClass: "bg-amber-300",
    };
  }
  return {
    label: `Próximo: ${dateStr}`,
    badgeClass: "bg-neutral-900 text-neutral-300 border-neutral-700/80",
    dotClass: "bg-neutral-400",
  };
}

function ProspectDetailContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const prospectId = params.id;

  const [loading, setLoading] = useState(true);
  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [audit, setAudit] = useState<Audit | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);

  const [status, setStatus] = useState<ProspectStatus>("por_analizar");
  const [meetingNotes, setMeetingNotes] = useState("");
  const [estimatedRange, setEstimatedRange] = useState("");

  // Estados de seguimiento y próxima acción
  const [nextAction, setNextAction] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [whatsappTemplate, setWhatsappTemplate] = useState<"propuesta" | "reunion" | "decision">("propuesta");
  const [customWhatsappMsg, setCustomWhatsappMsg] = useState("");

  const [analyzing, setAnalyzing] = useState(false);
  const [analysisSeconds, setAnalysisSeconds] = useState(0);
  const [expanding, setExpanding] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  useEffect(() => {
    if (!analyzing) return;
    const startTime = Date.now();
    const interval = setInterval(() => {
      setAnalysisSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [analyzing]);

  useEffect(() => {
    let isMounted = true;

    async function loadDetail() {
      try {
        const supabase = createClient();
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (!isMounted) return;

        if (userError || !user) {
          router.replace("/login");
          return;
        }

        const [prospectRes, auditRes, proposalRes] = await Promise.all([
          supabase.from("prospects").select("*").eq("id", prospectId).single(),
          supabase.from("audits").select("*").eq("prospect_id", prospectId).maybeSingle(),
          supabase.from("proposals").select("*").eq("prospect_id", prospectId).maybeSingle(),
        ]);

        if (!isMounted) return;

        if (prospectRes.error || !prospectRes.data) {
          router.replace("/dashboard");
          return;
        }

        const p = prospectRes.data as Prospect;
        setProspect(p);
        setStatus(p.status);

        const followUpInfo = getProspectFollowUp(p);
        setNextAction(followUpInfo.nextAction);
        setFollowUpDate(followUpInfo.followUpDate);

        if (auditRes.data) {
          setAudit(auditRes.data as Audit);
        }

        if (proposalRes.data) {
          const prop = proposalRes.data as Proposal;
          setProposal(prop);
          setMeetingNotes(prop.meeting_notes || "");
          setEstimatedRange(prop.estimated_range || "");
        }
      } catch (err) {
        console.error("Error al cargar detalle del prospecto:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    if (prospectId) {
      loadDetail();
    }

    // Listener de sesión controlado: solo reacciona a SIGNED_OUT sin router.refresh()
    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event: AuthChangeEvent) => {
      if (!isMounted) return;
      if (event === "SIGNED_OUT") {
        router.replace("/login");
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [prospectId, router]);

  async function handleStatusChange(newStatus: ProspectStatus) {
    setStatus(newStatus);
    if (!prospect) return;

    const supabase = createClient();
    const { error } = await supabase
      .from("prospects")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", prospect.id);

    if (error) {
      setFeedback({ type: "err", text: `No se pudo actualizar estado: ${error.message}` });
    } else {
      setProspect({ ...prospect, status: newStatus });
      setFeedback({ type: "ok", text: "Estado del prospecto actualizado." });
    }
  }

  async function handleSaveFollowUp() {
    if (!prospect) return;
    setSavingFollowUp(true);
    setFeedback(null);

    const supabase = createClient();
    const nowIso = new Date().toISOString();
    const targetNextAction = nextAction.trim() || null;
    const targetFollowUpDate = followUpDate.trim() || null;

    // Intento 1: Guardar en columnas dedicadas (si ya se corrió la migración en DB)
    const { error: colError } = await supabase
      .from("prospects")
      .update({
        next_action: targetNextAction,
        follow_up_date: targetFollowUpDate,
        updated_at: nowIso,
      })
      .eq("id", prospect.id);

    if (!colError) {
      setProspect({
        ...prospect,
        next_action: targetNextAction,
        follow_up_date: targetFollowUpDate,
        updated_at: nowIso,
      });
      setFeedback({
        type: "ok",
        text: "✓ Próxima acción y fecha de seguimiento guardadas correctamente.",
      });
      setSavingFollowUp(false);
      return;
    }

    // Fallback resiliente: guardar en raw_notes si la columna no existe aún en la base de datos
    console.warn("Columnas no detectadas en DB, usando guardado resiliente en raw_notes:", colError.message);
    let cleanedNotes = (prospect.raw_notes || "")
      .replace(/\n*\[SEGUIMIENTO:.*?\]/gi, "")
      .trim();

    if (targetNextAction || targetFollowUpDate) {
      cleanedNotes = `${cleanedNotes}\n\n[SEGUIMIENTO: Próxima acción: ${targetNextAction || "Pendiente"} | Fecha: ${targetFollowUpDate || "Sin fecha"}]`.trim();
    }

    const { error: notesError } = await supabase
      .from("prospects")
      .update({
        raw_notes: cleanedNotes || null,
        updated_at: nowIso,
      })
      .eq("id", prospect.id);

    setSavingFollowUp(false);

    if (notesError) {
      setFeedback({
        type: "err",
        text: `No se pudo guardar seguimiento: ${notesError.message}`,
      });
    } else {
      setProspect({
        ...prospect,
        raw_notes: cleanedNotes || null,
        next_action: targetNextAction,
        follow_up_date: targetFollowUpDate,
        updated_at: nowIso,
      });
      setFeedback({
        type: "ok",
        text: "✓ Próxima acción guardada de forma segura.",
      });
    }
  }

  function setQuickDate(daysAhead: number) {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    setFollowUpDate(d.toISOString().split("T")[0]);
  }

  function getGeneratedWhatsappText(): string {
    if (customWhatsappMsg) return customWhatsappMsg;
    const name = prospect?.business_name || "su negocio";
    const service = audit?.recommended_service || "la solución digital conversada";

    if (whatsappTemplate === "propuesta") {
      return `¡Hola! Espero que todo vaya excelente por ${name}. Te escribo para consultar si tuvieron oportunidad de revisar la propuesta que les envié sobre ${service}. Si les quedó alguna duda técnica o sobre la inversión, con gusto la aclaramos en 5 minutos. Quedo muy atento a tus comentarios. ¡Un saludo!`;
    }

    if (whatsappTemplate === "reunion") {
      return `¡Hola! Un gusto saludarte. Quería dar seguimiento a la reunión que dejamos pendiente para mostrarles cómo solucionar las consultas fuera de horario en ${name}. ¿Qué tal te viene coordinar una breve llamada de 10 minutos para mañana o pasado? Avísame qué horario te resulta más cómodo.`;
    }

    // Template "decision" / seguimiento general
    return `¡Hola! Quería saludarte y saber cómo avanzaron evaluando la propuesta para ${name}. Me quedé pensando en lo que conversamos sobre las consultas que se pierden los fines de semana y tengo una idea puntual que les puede ayudar a arrancar sin complicaciones. ¿Cuándo te viene bien que retomemos contacto?`;
  }

  function getWhatsAppUrl(phone: string | null | undefined, text: string): string | null {
    if (!phone) return null;
    let clean = phone.replace(/[^0-9]/g, "");
    if (clean.startsWith("0")) {
      clean = "58" + clean.substring(1);
    }
    return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
  }

  async function handleReAnalyze() {
    if (!prospect) return;
    setAnalyzing(true);
    setAnalysisSeconds(0);
    setFeedback(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId: prospect.id }),
      });
      const data = await res.json();

      if (!res.ok) {
        setFeedback({ type: "err", text: data.error || "Error al auditar prospecto." });
        setAnalyzing(false);
        return;
      }

      setAudit(data.audit as Audit);
      const updatedProp = data.proposal as Proposal;
      setProposal(updatedProp);
      if (!estimatedRange && updatedProp.estimated_range) {
        setEstimatedRange(updatedProp.estimated_range);
      }
      if (status === "por_analizar") {
        setStatus("listo_contactar");
      }
      setFeedback({
        type: "ok",
        text: "Auditoría técnica real, visibilidad local y propuesta generadas con éxito.",
      });
    } catch {
      setFeedback({ type: "err", text: "Fallo de conexión con /api/analyze." });
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleExpandProposal(e: FormEvent) {
    e.preventDefault();
    if (!prospect || !meetingNotes.trim()) return;

    setExpanding(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/expand-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prospectId: prospect.id,
          meetingNotes: meetingNotes.trim(),
          estimatedRange: estimatedRange.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setFeedback({
          type: "err",
          text: data.error || "No se pudo expandir la propuesta.",
        });
        setExpanding(false);
        return;
      }

      setProposal(data.proposal as Proposal);
      setFeedback({
        type: "ok",
        text: "Propuesta comercial ampliada y lista para enviar por WhatsApp o correo.",
      });
    } catch {
      setFeedback({ type: "err", text: "Fallo de conexión con /api/expand-proposal." });
    } finally {
      setExpanding(false);
    }
  }

  function copyToClipboard(key: string, text: string | null | undefined) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  }

  if (loading || !prospect) {
    return (
      <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-400 flex items-center justify-center text-neutral-950 font-black text-xl animate-pulse">
          ⚡
        </div>
        <p className="text-sm text-neutral-400">Cargando ficha del negocio...</p>
      </main>
    );
  }

  const diagnosis = audit?.full_diagnosis as FullDiagnosisData | undefined;
  const webVerification = diagnosis?.web_verification;
  const localSeo = diagnosis?.local_seo_visibility || "No evaluado";
  const auditFindings = diagnosis?.website_audit_findings || [];
  const followUpStatus = getFollowUpStatus(followUpDate);

  const priorityStyle = audit?.priority_level
    ? PRIORITY_BADGES[audit.priority_level]
    : null;

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-4 sm:p-6 selection:bg-emerald-500/20 selection:text-emerald-300">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Cabecera Principal / Street Header */}
        <header className="rounded-2xl border border-neutral-800/90 bg-neutral-900/60 backdrop-blur-md p-5 sm:p-6 space-y-4 shadow-xl shadow-black/50">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800/80 pb-4">
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard"
                className="text-xs font-medium text-neutral-400 hover:text-white px-2.5 py-1.5 rounded-lg border border-neutral-800 hover:border-neutral-700 bg-neutral-950 transition flex items-center gap-1.5"
              >
                <span>←</span>
                <span>Dashboard</span>
              </Link>
              <span className="text-neutral-700">/</span>
              <span className="text-xs font-medium text-neutral-300 px-2 py-0.5 rounded-md bg-neutral-800/80">
                {prospect.niche}
              </span>
              {priorityStyle && (
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${priorityStyle.bg} ${priorityStyle.text} ${priorityStyle.border}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${priorityStyle.dot}`} />
                  <span>{priorityStyle.label}</span>
                </span>
              )}
            </div>

            {/* Selector de Estado y Botón de Auditoría */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <select
                  value={status}
                  onChange={(e) => handleStatusChange(e.target.value as ProspectStatus)}
                  className="rounded-xl border border-neutral-700/80 bg-neutral-950 px-3.5 py-2 text-xs font-medium text-neutral-200 focus:border-emerald-500 focus:outline-none transition cursor-pointer"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      Estado: {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleReAnalyze}
                disabled={analyzing}
                className="rounded-xl bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 text-neutral-950 font-semibold text-xs px-4 py-2 shadow-md shadow-emerald-500/20 disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5"
              >
                {analyzing ? (
                  <>
                    <svg
                      className="animate-spin h-3.5 w-3.5"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span>Investigando en vivo ({analysisSeconds}s)...</span>
                  </>
                ) : (
                  <>
                    <span>⚡</span>
                    <span>{audit ? "Re-auditar con IA" : "Auditar con IA"}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Información del negocio y accesos rápidos */}
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {prospect.business_name}
            </h1>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-neutral-400">
              <span className="text-neutral-300">
                {CHANNEL_LABELS[prospect.preferred_channel] || prospect.preferred_channel}
              </span>

              {prospect.zone && (
                <span className="text-neutral-300">📍 {prospect.zone}</span>
              )}

              {prospect.phone && (
                <a
                  href={`tel:${prospect.phone}`}
                  className="text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <span>📞 {prospect.phone}</span>
                </a>
              )}

              {prospect.maps_url && (
                <a
                  href={prospect.maps_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-cyan-400 hover:text-cyan-300 hover:underline font-medium flex items-center gap-1"
                >
                  <span>Abrir en Google Maps ↗</span>
                </a>
              )}

              {prospect.website_url && (
                <a
                  href={prospect.website_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-neutral-400 hover:text-white hover:underline flex items-center gap-1"
                >
                  <span>Sitio Web / RRSS ↗</span>
                </a>
              )}
            </div>

            {prospect.raw_notes && (
              <div className="pt-2">
                <p className="text-xs text-neutral-400 bg-neutral-950/80 rounded-xl p-3 border border-neutral-800/80 leading-relaxed">
                  <span className="font-semibold text-neutral-300">Notas de calle: </span>
                  {prospect.raw_notes}
                </p>
              </div>
            )}
          </div>
        </header>

        {/* Indicador discreto de progreso en investigación profunda */}
        {analyzing && (
          <div className="p-3.5 rounded-xl border border-cyan-800/80 bg-cyan-950/40 text-xs text-cyan-200 flex flex-wrap items-center justify-between gap-2 animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping shrink-0" />
              <span>
                Investigando presencia web real, visibilidad local en Google y estructurando auditoría... ({analysisSeconds}s transcurridos)
              </span>
            </div>
            <span className="text-[11px] text-cyan-300/90 font-mono font-medium hidden sm:inline-block">
              Investigación profunda en progreso
            </span>
          </div>
        )}

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-center justify-between animate-in fade-in ${
              feedback.type === "ok"
                ? "text-emerald-300 bg-emerald-950/40 border-emerald-900/80"
                : "text-red-300 bg-red-950/40 border-red-900/80"
            }`}
          >
            <span>{feedback.text}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-neutral-400 hover:text-white ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* Panel de Próxima Acción & Seguimiento Comercial */}
        <section className="rounded-2xl border border-amber-900/40 bg-gradient-to-br from-neutral-900/90 via-neutral-900/60 to-amber-950/20 backdrop-blur-md p-5 sm:p-6 space-y-5 shadow-xl shadow-black/40">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800/80 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-300 text-sm font-bold">
                🎯
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-white tracking-tight">
                    Próxima Acción y Seguimiento Comercial
                  </h2>
                  {followUpStatus && (
                    <span
                      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${followUpStatus.badgeClass}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${followUpStatus.dotClass}`} />
                      <span>{followUpStatus.label}</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-400">
                  Registra el próximo compromiso, fecha límite y genera mensajes de contacto para WhatsApp.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveFollowUp}
              disabled={savingFollowUp}
              className="rounded-xl bg-gradient-to-r from-amber-400 to-yellow-300 hover:from-amber-300 hover:to-yellow-200 text-neutral-950 font-semibold text-xs px-4 py-2 shadow-md shadow-amber-500/20 disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5"
            >
              {savingFollowUp ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <span>💾</span>
                  <span>Guardar seguimiento</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Columna Izquierda: Definición del Siguiente Paso & Fecha */}
            <div className="lg:col-span-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-200 block">
                  Próximo paso o tarea con el prospecto
                </label>

                {/* Presets rápidos */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    "Escribir por WhatsApp",
                    "Reagendar reunión",
                    "Enviar recordatorio de propuesta",
                    "Llamar / pasar por el local",
                    "Esperar respuesta del cliente",
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setNextAction(preset)}
                      className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                        nextAction === preset
                          ? "bg-amber-500/20 text-amber-200 border-amber-500/40"
                          : "bg-neutral-950/80 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border-neutral-800"
                      }`}
                    >
                      + {preset}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={2}
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  placeholder="Ej: Llamar a las 3:00 PM para confirmar si el dueño aprobó la landing con WhatsApp..."
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3.5 py-2.5 text-xs sm:text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-amber-500 focus:outline-none transition leading-relaxed"
                />
              </div>

              {/* Selector de Fecha con accesos rápidos */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-200 block">
                  Fecha límite de seguimiento
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="rounded-xl border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-xs sm:text-sm text-neutral-200 focus:border-amber-500 focus:outline-none transition cursor-pointer"
                  />

                  {/* Botones rápidos de fecha */}
                  <div className="flex items-center gap-1">
                    {[
                      { label: "Hoy", days: 0 },
                      { label: "Mañana", days: 1 },
                      { label: "+2 días", days: 2 },
                      { label: "+7 días", days: 7 },
                    ].map((btn) => (
                      <button
                        key={btn.label}
                        type="button"
                        onClick={() => setQuickDate(btn.days)}
                        className="text-[11px] font-medium px-2.5 py-1.5 rounded-lg bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-300 transition cursor-pointer"
                      >
                        {btn.label}
                      </button>
                    ))}
                    {followUpDate && (
                      <button
                        type="button"
                        onClick={() => setFollowUpDate("")}
                        className="text-[11px] text-neutral-500 hover:text-red-400 px-2 py-1 transition cursor-pointer"
                        title="Limpiar fecha"
                      >
                        ✕ Quitar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Columna Derecha: Generador de Mensaje Rápido para WhatsApp */}
            <div className="lg:col-span-6 space-y-3 rounded-xl border border-neutral-800/80 bg-neutral-950/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800/80 pb-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-400">💬</span>
                  <span className="text-xs font-semibold text-neutral-200">
                    Mensaje de Seguimiento para WhatsApp
                  </span>
                </div>

                {/* Tabs de tipo de mensaje */}
                <div className="flex items-center gap-1">
                  {[
                    { id: "propuesta", label: "Propuesta" },
                    { id: "reunion", label: "Reunión" },
                    { id: "decision", label: "En decisión" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setWhatsappTemplate(tab.id as "propuesta" | "reunion" | "decision");
                        setCustomWhatsappMsg("");
                      }}
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-md transition cursor-pointer ${
                        whatsappTemplate === tab.id
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <textarea
                  rows={4}
                  value={customWhatsappMsg || getGeneratedWhatsappText()}
                  onChange={(e) => setCustomWhatsappMsg(e.target.value)}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-900/90 p-3 text-xs text-neutral-200 placeholder:text-neutral-600 focus:border-emerald-500 focus:outline-none transition leading-relaxed font-sans"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard("whatsapp_followup", customWhatsappMsg || getGeneratedWhatsappText())
                  }
                  className={`text-xs font-semibold rounded-xl px-3.5 py-1.5 transition flex items-center gap-1.5 cursor-pointer ${
                    copiedKey === "whatsapp_followup"
                      ? "bg-emerald-400 text-neutral-950 font-bold"
                      : "border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200"
                  }`}
                >
                  {copiedKey === "whatsapp_followup" ? "✓ Mensaje Copiado" : "📋 Copiar mensaje"}
                </button>

                {prospect.phone && (
                  <a
                    href={
                      getWhatsAppUrl(
                        prospect.phone,
                        customWhatsappMsg || getGeneratedWhatsappText()
                      ) || "#"
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold rounded-xl px-3.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 transition flex items-center gap-1.5"
                  >
                    <span>💬</span>
                    <span>Abrir en WhatsApp directo ↗</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Tarjeta de Presencia Web, WhatsApp & SEO Local (Escaneo Técnico Real) */}
        {audit && (
          <section className="rounded-2xl border border-neutral-800/90 bg-neutral-900/60 backdrop-blur-md p-5 space-y-4 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800/80 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-base">📡</span>
                <h2 className="text-sm font-bold text-white tracking-tight">
                  Evidencia Técnica Real & Visibilidad SEO Local
                </h2>
              </div>
              <span className="text-[11px] font-medium text-neutral-400 bg-neutral-950 px-2.5 py-1 rounded-lg border border-neutral-800">
                Verificación de código y Google en vivo
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Señal 1: Sitio Web y Certificado SSL */}
              <div className="p-3.5 rounded-xl border border-neutral-800/80 bg-neutral-950/70 space-y-2">
                <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">
                  Presencia Web & Protocolo
                </span>
                {webVerification?.has_website_in_maps ? (
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${
                          webVerification.reachable
                            ? "bg-emerald-950/50 text-emerald-300 border-emerald-800/60"
                            : "bg-red-950/50 text-red-300 border-red-800/60"
                        }`}
                      >
                        {webVerification.reachable
                          ? `Web Online (HTTP ${webVerification.status_code || 200})`
                          : "Web Inaccesible / Caída"}
                      </span>
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-md border ${
                          webVerification.uses_https
                            ? "bg-neutral-900 text-neutral-300 border-neutral-800"
                            : "bg-amber-950/50 text-amber-300 border-amber-800/60"
                        }`}
                      >
                        {webVerification.uses_https ? "HTTPS ✓" : "Sin SSL ⚠️"}
                      </span>
                    </div>
                    {webVerification.url_checked && (
                      <a
                        href={webVerification.url_checked}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-cyan-400 hover:underline truncate block"
                      >
                        {webVerification.url_checked} ↗
                      </a>
                    )}
                    {webVerification.title && (
                      <p className="text-[11px] text-neutral-400 line-clamp-1">
                        <span className="text-neutral-500">Title:</span> {webVerification.title}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md border bg-amber-950/40 text-amber-300 border-amber-800/60 inline-block">
                      Sin Sitio Web en Ficha Maps
                    </span>
                    <p className="text-[11px] text-neutral-400 leading-snug">
                      Oportunidad inmediata: crear Landing de captación directa con botón WhatsApp.
                    </p>
                  </div>
                )}
              </div>

              {/* Señal 2: Canal de WhatsApp y Motores */}
              <div className="p-3.5 rounded-xl border border-neutral-800/80 bg-neutral-950/70 space-y-2">
                <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">
                  Captación por WhatsApp & Herramientas
                </span>
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${
                        webVerification?.has_whatsapp_link
                          ? "bg-emerald-950/50 text-emerald-300 border-emerald-800/60"
                          : "bg-red-950/40 text-red-300 border-red-900/60"
                      }`}
                    >
                      {webVerification?.has_whatsapp_link
                        ? "Botón WhatsApp Detectado ✓"
                        : "Sin Botón Directo WhatsApp ✕"}
                    </span>
                  </div>

                  <div className="text-[11px] text-neutral-400 space-y-0.5">
                    <p>
                      <span className="text-neutral-500">Chat / CRM: </span>
                      {webVerification?.detected_chat_widgets?.length
                        ? webVerification.detected_chat_widgets.join(", ")
                        : "Ninguno detectado"}
                    </p>
                    <p>
                      <span className="text-neutral-500">Agenda Citas: </span>
                      {webVerification?.detected_booking_tools?.length
                        ? webVerification.detected_booking_tools.join(", ")
                        : "Sin agendador online"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Señal 3: Visibilidad SEO Local */}
              <div className="p-3.5 rounded-xl border border-neutral-800/80 bg-neutral-950/70 space-y-2">
                <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">
                  Visibilidad SEO Local (Rubro + Zona)
                </span>
                <div className="space-y-1.5">
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-lg border inline-flex items-center gap-1.5 ${
                      localSeo.includes("Top 3")
                        ? "bg-emerald-950/50 text-emerald-300 border-emerald-800/80"
                        : localSeo.includes("Primera página")
                        ? "bg-cyan-950/50 text-cyan-300 border-cyan-800/80"
                        : "bg-neutral-900 text-neutral-300 border-neutral-800"
                    }`}
                  >
                    <span>{localSeo.includes("Top 3") ? "🏆" : localSeo.includes("Primera página") ? "🔍" : "📉"}</span>
                    <span>{localSeo}</span>
                  </span>
                  <p className="text-[11px] text-neutral-400 leading-snug">
                    Búsqueda auditada para {prospect.niche} en {prospect.zone || "su zona"}.
                  </p>
                </div>
              </div>
            </div>

            {/* Hallazgos Puntuales de Auditoría On-Page / SEO */}
            {auditFindings.length > 0 && (
              <div className="rounded-xl border border-neutral-800/80 bg-neutral-950/90 p-3.5 space-y-2">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                  Puntos Críticos para Argumentar con el Dueño:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {auditFindings.map((finding, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 bg-neutral-900/60 p-2 rounded-lg border border-neutral-800/50 text-neutral-300"
                    >
                      <span className="text-cyan-400 font-bold shrink-0">›</span>
                      <span>{finding}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resumen de Presencia Digital */}
            {diagnosis?.digital_presence_summary && (
              <p className="text-xs text-neutral-300 bg-neutral-950/50 p-3 rounded-xl border border-neutral-800/60 leading-relaxed">
                <span className="font-semibold text-neutral-200">Diagnóstico de presencia: </span>
                {diagnosis.digital_presence_summary}
              </p>
            )}
          </section>
        )}

        {/* Bloque 1: Pitch de 20s y Auditoría Operativa */}
        {!audit ? (
          <section className="rounded-2xl border border-dashed border-neutral-800 p-8 sm:p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-neutral-900 flex items-center justify-center text-xl mx-auto text-emerald-400">
              ⚡
            </div>
            <h2 className="text-base font-semibold text-white">
              Este negocio aún no tiene auditoría express
            </h2>
            <p className="text-xs text-neutral-400 max-w-md mx-auto leading-relaxed">
              Pulsa el botón &ldquo;Auditar con IA&rdquo; para analizar sus posibles fugas operativas,
              generar tu guion de apertura verbal de 20 segundos y estructurar el borrador inicial.
            </p>
            <div className="pt-2">
              <button
                onClick={handleReAnalyze}
                disabled={analyzing}
                className="rounded-xl bg-white hover:bg-neutral-200 text-neutral-950 font-semibold text-xs px-5 py-2.5 shadow-md shadow-white/5 transition cursor-pointer"
              >
                {analyzing
                  ? `Investigando en vivo (${analysisSeconds}s)...`
                  : "Generar Auditoría Ahora"}
              </button>
            </div>
          </section>
        ) : (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Guion de Apertura Presencial (CRUCIAL PARA LA CALLE) */}
            <div className="lg:col-span-7 rounded-2xl border border-emerald-900/40 bg-neutral-900/60 backdrop-blur-sm p-5 space-y-4 shadow-lg shadow-emerald-950/20">
              <div className="flex items-center justify-between border-b border-neutral-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-base">🎙️</span>
                  <div>
                    <h2 className="text-sm font-bold text-white tracking-tight">
                      Guion de Apertura Verbal (20 Segundos)
                    </h2>
                    <span className="text-[10px] text-emerald-400 font-medium">
                      Para leer antes de cruzar la puerta
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => copyToClipboard("pitch", audit.pitch_20s)}
                  className={`text-xs font-semibold rounded-xl px-3.5 py-1.5 transition flex items-center gap-1.5 cursor-pointer ${
                    copiedKey === "pitch"
                      ? "bg-emerald-400 text-neutral-950 font-bold"
                      : "border border-neutral-700 bg-neutral-950 hover:bg-neutral-800 text-neutral-200"
                  }`}
                >
                  {copiedKey === "pitch" ? "✓ Copiado" : "Copiar guion"}
                </button>
              </div>

              {/* Guion destacado en tamaño grande para lectura en la calle */}
              <div className="rounded-xl border border-emerald-800/40 bg-neutral-950/90 p-4 sm:p-5 relative">
                <p className="text-sm sm:text-base text-neutral-100 font-normal leading-relaxed italic">
                  &ldquo;{audit.pitch_20s}&rdquo;
                </p>
              </div>

              {/* Servicio sugerido y Gancho rápido */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3.5 rounded-xl border border-neutral-800 bg-neutral-950 space-y-1">
                  <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">
                    Servicio de entrada sugerido
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-emerald-300">
                    {audit.recommended_service || "No especificado"}
                  </p>
                </div>

                {diagnosis?.quick_win_angle && (
                  <div className="p-3.5 rounded-xl border border-neutral-800 bg-neutral-950 space-y-1">
                    <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">
                      Gancho rápido (5 minutos)
                    </span>
                    <p className="text-xs text-cyan-300 leading-snug">
                      {diagnosis.quick_win_angle}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Dolores Detectados & Preguntas Filtro */}
            <div className="lg:col-span-5 rounded-2xl border border-neutral-800/90 bg-neutral-900/50 p-5 space-y-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-neutral-800/80 pb-2">
                  <span className="text-sm">⚠️</span>
                  <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-wider">
                    Dolores Operativos Detectados
                  </h3>
                </div>
                <ul className="space-y-2 text-xs">
                  {(audit.detected_pains || []).map((pain, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 bg-neutral-950/70 p-2.5 rounded-xl border border-neutral-800/60 text-neutral-300"
                    >
                      <span className="text-amber-400 font-bold shrink-0 mt-0.5">!</span>
                      <span className="leading-relaxed">{pain}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-3 pt-2 border-t border-neutral-800/80">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🎯</span>
                  <h3 className="text-xs font-bold text-neutral-200 uppercase tracking-wider">
                    Preguntas Filtro para el Dueño
                  </h3>
                </div>
                <ul className="space-y-2 text-xs">
                  {(audit.filter_questions || []).map((q, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 bg-neutral-950/70 p-2.5 rounded-xl border border-neutral-800/60 text-neutral-300"
                    >
                      <span className="text-emerald-400 font-bold shrink-0 mt-0.5">?</span>
                      <span className="leading-relaxed">{q}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {diagnosis?.operational_bottleneck && (
                <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800/80 space-y-1">
                  <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider block">
                    Cuello de botella principal
                  </span>
                  <p className="text-xs text-neutral-300 leading-relaxed">
                    {diagnosis.operational_bottleneck}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Bloque 2: Propuesta Inicial y Ampliación Post-Conversación */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Borrador Inicial */}
          <div className="rounded-2xl border border-neutral-800/90 bg-neutral-900/50 p-5 space-y-3 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b border-neutral-800/80 pb-3">
                <div>
                  <h2 className="text-sm font-semibold text-white tracking-tight">
                    Propuesta Inicial (Borrador Pre-Reunión)
                  </h2>
                  {proposal?.estimated_range && (
                    <span className="text-xs text-emerald-400 font-medium">
                      Inversión estimada: {proposal.estimated_range}
                    </span>
                  )}
                </div>

                {proposal?.initial_draft && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard("initial", proposal.initial_draft)}
                    className={`text-xs font-semibold rounded-xl px-3 py-1.5 transition cursor-pointer ${
                      copiedKey === "initial"
                        ? "bg-emerald-400 text-neutral-950 font-bold"
                        : "border border-neutral-700 bg-neutral-950 hover:bg-neutral-800 text-neutral-200"
                    }`}
                  >
                    {copiedKey === "initial" ? "✓ Copiado" : "Copiar borrador"}
                  </button>
                )}
              </div>

              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-xs text-neutral-300 whitespace-pre-wrap max-h-96 overflow-y-auto leading-relaxed font-mono">
                {proposal?.initial_draft ||
                  "Genera primero la auditoría con IA para obtener el borrador preliminar de propuesta."}
              </div>
            </div>

            <p className="text-[11px] text-neutral-500 pt-2">
              Estructura previa para tener claras las soluciones y tarifas antes de hablar con el cliente.
            </p>
          </div>

          {/* Formulario Post-Reunión para Ampliar Propuesta */}
          <div className="rounded-2xl border border-neutral-800/90 bg-neutral-900/50 p-5 space-y-4">
            <div className="border-b border-neutral-800/80 pb-3 space-y-1">
              <h2 className="text-sm font-semibold text-white tracking-tight">
                Ampliar propuesta tras hablar con el cliente
              </h2>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Anota lo que te contó el encargado o dueño al salir del local (problemas reales,
                plazos urgentes o presupuesto aproximado) para generar la propuesta definitiva.
              </p>
            </div>

            <form onSubmit={handleExpandProposal} className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-neutral-300">
                  Notas de la conversación comercial *
                </label>
                <textarea
                  rows={6}
                  required
                  value={meetingNotes}
                  onChange={(e) => setMeetingNotes(e.target.value)}
                  placeholder="Ej: Hablé con el encargado (José). Me confirmó que pierden consultas los fines de semana porque recepción no da abasto con WhatsApp. Tienen un presupuesto realista de $80 a $150 USD y quieren una landing rápida con botón directo a WhatsApp y optimización de su ficha de Google Maps..."
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3.5 text-xs sm:text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-500 focus:outline-none transition leading-relaxed"
                />
              </div>

              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="flex-1 space-y-1">
                    <label className="text-[10px] font-medium text-neutral-400">
                      Rango de inversión acordado u objetivo (Mercado Local)
                    </label>
                    <input
                      type="text"
                      value={estimatedRange}
                      onChange={(e) => setEstimatedRange(e.target.value)}
                      placeholder="Ej: $80 - $120 USD"
                      className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-xs sm:text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-500 focus:outline-none transition"
                    />
                  </div>

                  <div className="sm:self-end pt-2 sm:pt-0">
                    <button
                      type="submit"
                      disabled={expanding || !meetingNotes.trim()}
                      className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 text-neutral-950 font-semibold text-xs px-5 py-2.5 shadow-md shadow-emerald-500/20 disabled:opacity-50 transition cursor-pointer flex items-center justify-center gap-2"
                    >
                      {expanding ? (
                        <>
                          <svg
                            className="animate-spin h-3.5 w-3.5"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          <span>Generando propuesta...</span>
                        </>
                      ) : (
                        <>
                          <span>📄</span>
                          <span>Generar propuesta ampliada</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Accesos rápidos de rangos locales */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] text-neutral-500">Sugerencias:</span>
                  {[
                    { label: "$60 - $120 USD (Landing + WhatsApp)", value: "$60 - $120 USD" },
                    { label: "$120 - $220 USD (Web Comercial)", value: "$120 - $220 USD" },
                    { label: "$180 - $320 USD (Bot / n8n)", value: "$180 - $320 USD" },
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setEstimatedRange(preset.value)}
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-md border transition cursor-pointer ${
                        estimatedRange === preset.value
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : "bg-neutral-950 text-neutral-400 hover:text-neutral-200 border-neutral-800 hover:border-neutral-700"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
              </div>
            </form>
          </div>
        </section>

        {/* Bloque 3: Propuesta Ampliada Final */}
        {proposal?.expanded_proposal && (
          <section className="rounded-2xl border border-emerald-800/80 bg-neutral-900/80 backdrop-blur-md p-5 sm:p-6 space-y-4 shadow-2xl shadow-emerald-950/30">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <h2 className="text-base font-bold text-white tracking-tight">
                    Propuesta Ampliada (Lista para Enviar)
                  </h2>
                </div>
                <p className="text-xs text-neutral-400">
                  Documento comercial adaptado a las necesidades detectadas en tu reunión.
                </p>
              </div>

              <button
                type="button"
                onClick={() => copyToClipboard("expanded", proposal.expanded_proposal)}
                className={`text-xs font-semibold rounded-xl px-4 py-2 transition flex items-center gap-1.5 cursor-pointer shadow-md ${
                  copiedKey === "expanded"
                    ? "bg-white text-neutral-950 font-bold"
                    : "bg-emerald-400 hover:bg-emerald-300 text-neutral-950 shadow-emerald-500/20"
                }`}
              >
                {copiedKey === "expanded" ? (
                  <>
                    <span>✓</span>
                    <span>¡Propuesta Copiada!</span>
                  </>
                ) : (
                  <>
                    <span>📋</span>
                    <span>Copiar Propuesta Completa</span>
                  </>
                )}
              </button>
            </div>

            <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5 text-xs sm:text-sm text-neutral-200 whitespace-pre-wrap leading-relaxed font-sans shadow-inner">
              {proposal.expanded_proposal}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

export default function ProspectDetailPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-6 space-y-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-400 flex items-center justify-center text-neutral-950 font-black text-xl animate-pulse">
            ⚡
          </div>
          <p className="text-sm text-neutral-400">Cargando ficha del negocio...</p>
        </main>
      }
    >
      <ProspectDetailContent />
    </Suspense>
  );
}

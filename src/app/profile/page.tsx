"use client";

import { useEffect, useState, FormEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { AuthChangeEvent } from "@supabase/supabase-js";
import { ServiceOffering } from "@/types/prospector";

const EMPTY_SERVICE: ServiceOffering = {
  name: "",
  description: "",
  starting_price_usd: undefined,
  typical_turnaround_days: undefined,
};

const TONE_PRESETS = [
  "Directo, consultivo y enfocado en resultados operativos",
  "Estratégico, corporativo y enfocado en retorno de inversión",
  "Cercano, práctico y orientado a pequeños comercios",
];

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  const [userId, setUserId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [techStackInput, setTechStackInput] = useState("");
  const [portfolioHighlights, setPortfolioHighlights] = useState("");
  const [communicationTone, setCommunicationTone] = useState(
    "Directo, consultivo y enfocado en resultados operativos"
  );
  const [services, setServices] = useState<ServiceOffering[]>([{ ...EMPTY_SERVICE }]);

  // Estados para Importación desde CV (PDF) o LinkedIn
  const [importTab, setImportTab] = useState<"pdf" | "text">("pdf");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importText, setImportText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [importFeedback, setImportFeedback] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
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

        setUserId(user.id);

        const { data: profile } = await supabase
          .from("consultant_profiles")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!isMounted) return;

        if (profile) {
          setFullName(profile.full_name || "");
          setTechStackInput((profile.tech_stack || []).join(", "));
          setPortfolioHighlights(profile.portfolio_highlights || "");
          setCommunicationTone(
            profile.communication_tone ||
              "Directo, consultivo y enfocado en resultados operativos"
          );
          if (Array.isArray(profile.services_offered) && profile.services_offered.length > 0) {
            setServices(profile.services_offered);
          }
        }
      } catch (err) {
        console.error("Error al cargar perfil:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadProfile();

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
  }, [router]);

  function updateService(index: number, field: keyof ServiceOffering, value: string) {
    setServices((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        if (field === "starting_price_usd" || field === "typical_turnaround_days") {
          const parsed = value === "" ? undefined : Number(value);
          return { ...item, [field]: Number.isNaN(parsed) ? undefined : parsed };
        }
        return { ...item, [field]: value };
      })
    );
  }

  function addServiceRow() {
    setServices((prev) => [...prev, { ...EMPTY_SERVICE }]);
  }

  function removeServiceRow(index: number) {
    setServices((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  // Importar y autocompletar con Gemini 2.5 Flash
  async function handleParseProfile() {
    if (!importFile && (!importText || !importText.trim())) {
      setImportFeedback({
        type: "err",
        text: "Por favor sube un archivo PDF o pega texto de tu perfil de LinkedIn/CV.",
      });
      return;
    }

    setParsing(true);
    setImportFeedback(null);

    try {
      const formData = new FormData();
      if (importFile) {
        formData.append("file", importFile);
      }
      if (importText.trim()) {
        formData.append("rawText", importText.trim());
      }

      const res = await fetch("/api/parse-profile", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setImportFeedback({
          type: "err",
          text: data.error || "No se pudo procesar el perfil.",
        });
        setParsing(false);
        return;
      }

      // Rellenar automáticamente los campos del formulario
      if (data.full_name) {
        setFullName(data.full_name);
      }
      if (Array.isArray(data.tech_stack) && data.tech_stack.length > 0) {
        setTechStackInput(data.tech_stack.join(", "));
      }
      if (Array.isArray(data.services_offered) && data.services_offered.length > 0) {
        setServices(data.services_offered);
      }
      if (data.portfolio_highlights) {
        setPortfolioHighlights(data.portfolio_highlights);
      }
      if (data.communication_tone) {
        setCommunicationTone(data.communication_tone);
      }

      setImportFeedback({
        type: "ok",
        text: "✓ Perfil analizado y campos completados con IA. Revisa la información abajo y presiona 'Guardar Perfil de Consultor' para confirmar.",
      });
    } catch {
      setImportFeedback({
        type: "err",
        text: "Error de conexión al conectar con /api/parse-profile.",
      });
    } finally {
      setParsing(false);
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportFeedback(null);
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!userId) return;

    setSaving(true);
    setMessage(null);

    const cleanStack = techStackInput
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const cleanServices = services.filter((s) => s.name.trim() !== "");

    const supabase = createClient();
    const { error } = await supabase.from("consultant_profiles").upsert(
      {
        user_id: userId,
        full_name: fullName.trim(),
        tech_stack: cleanStack,
        services_offered: cleanServices,
        portfolio_highlights: portfolioHighlights.trim() || null,
        communication_tone: communicationTone.trim(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    setSaving(false);

    if (error) {
      setMessage({ type: "err", text: `Error al guardar: ${error.message}` });
      return;
    }

    setMessage({
      type: "ok",
      text: "Perfil guardado correctamente. La IA usará estos servicios y tarifas en tus próximas auditorías.",
    });
  }

  const stackChips = techStackInput
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-400 flex items-center justify-center text-neutral-950 font-black text-xl animate-pulse">
          ⚡
        </div>
        <p className="text-sm text-neutral-400">Cargando perfil de consultor...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-4 sm:p-6 selection:bg-emerald-500/20 selection:text-emerald-300">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800/80 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard"
                className="text-xs text-neutral-400 hover:text-white transition flex items-center gap-1"
              >
                <span>←</span>
                <span>Dashboard</span>
              </Link>
              <span className="text-neutral-700">/</span>
              <span className="text-xs font-medium text-emerald-400">Configuración</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Perfil del Consultor y Catálogo
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 max-w-xl">
              Configura tus paquetes de servicio, tarifas de entrada y estilo. La IA solo cotizará lo
              que tú realmente vendes.
            </p>
          </div>

          <Link
            href="/dashboard"
            className="text-xs sm:text-sm font-medium text-neutral-300 hover:text-white border border-neutral-800 hover:border-neutral-700 bg-neutral-900/60 rounded-xl px-4 py-2 transition"
          >
            Volver al Dashboard
          </Link>
        </header>

        {/* AI Alignment Notice */}
        <div className="rounded-2xl border border-emerald-900/40 bg-emerald-950/20 p-4 flex items-start gap-3">
          <span className="text-lg">💡</span>
          <div className="text-xs space-y-1">
            <span className="font-semibold text-emerald-300 block">
              Calibración automática de diagnósticos
            </span>
            <p className="text-neutral-300 leading-relaxed">
              Cuando audites un negocio en la calle, el motor de IA cruzará los cuellos de botella
              del cliente con los servicios que definas aquí, recomendando el paquete con mayor
              probabilidad de cierre.
            </p>
          </div>
        </div>

        {/* Bloque: Importar desde CV (PDF) o LinkedIn */}
        <section className="rounded-2xl border border-emerald-800/50 bg-gradient-to-br from-neutral-900/90 via-neutral-900/60 to-emerald-950/20 backdrop-blur-md p-5 sm:p-6 space-y-4 shadow-xl shadow-black/40">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-300 text-sm font-bold">
                ✨
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white tracking-tight">
                  Importar y Autocompletar desde CV (PDF) o LinkedIn
                </h2>
                <p className="text-xs text-neutral-400">
                  Gemini 2.5 Flash extraerá tu stack, servicios recomendados y casos de éxito al instante.
                </p>
              </div>
            </div>

            {/* Selector de modo */}
            <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-xs">
              <button
                type="button"
                onClick={() => setImportTab("pdf")}
                className={`px-3 py-1.5 rounded-lg transition font-medium cursor-pointer ${
                  importTab === "pdf"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                📄 Subir PDF (CV)
              </button>
              <button
                type="button"
                onClick={() => setImportTab("text")}
                className={`px-3 py-1.5 rounded-lg transition font-medium cursor-pointer ${
                  importTab === "text"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                ✍️ Pegar Texto / LinkedIn
              </button>
            </div>
          </div>

          {importTab === "pdf" ? (
            <div className="space-y-3">
              <div className="relative border-2 border-dashed border-neutral-800 hover:border-emerald-500/50 rounded-xl p-6 text-center transition bg-neutral-950/50">
                <input
                  type="file"
                  id="cv-file-upload"
                  accept=".pdf,application/pdf"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="space-y-2 pointer-events-none">
                  <div className="text-2xl">📑</div>
                  <div className="text-xs font-medium text-neutral-200">
                    {importFile ? (
                      <span className="text-emerald-400 font-semibold">
                        Archivo seleccionado: {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)
                      </span>
                    ) : (
                      <>
                        <span className="text-emerald-400 underline">Haz clic para subir</span> o arrastra tu CV en formato PDF
                      </>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-500">
                    Formatos aceptados: PDF (máx. 10MB)
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-neutral-400 block">
                Pega el texto de tu CV, resumen de perfil de LinkedIn o portafolio:
              </label>
              <textarea
                rows={4}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Pega aquí tu experiencia, tecnologías, proyectos y descripción de servicios ofrecidos..."
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-xs sm:text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-500 focus:outline-none transition leading-relaxed"
              />
            </div>
          )}

          {importFeedback && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center justify-between animate-in fade-in ${
                importFeedback.type === "ok"
                  ? "text-emerald-300 bg-emerald-950/50 border-emerald-800/80"
                  : "text-red-300 bg-red-950/50 border-red-800/80"
              }`}
            >
              <span>{importFeedback.text}</span>
              <button
                type="button"
                onClick={() => setImportFeedback(null)}
                className="text-neutral-400 hover:text-white ml-2"
              >
                ✕
              </button>
            </div>
          )}

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={handleParseProfile}
              disabled={parsing || (importTab === "pdf" && !importFile) || (importTab === "text" && !importText.trim())}
              className="rounded-xl bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 text-neutral-950 font-semibold text-xs px-5 py-2.5 shadow-md shadow-emerald-500/20 disabled:opacity-50 transition cursor-pointer flex items-center gap-2"
            >
              {parsing ? (
                <>
                  <svg
                    className="animate-spin h-3.5 w-3.5 text-neutral-950"
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
                  <span>Analizando con Gemini 2.5 Flash...</span>
                </>
              ) : (
                <>
                  <span>⚡</span>
                  <span>Extraer y Autocompletar Perfil</span>
                </>
              )}
            </button>
          </div>
        </section>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Datos Personales / Marca */}
          <section className="rounded-2xl border border-neutral-800/90 bg-neutral-900/50 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white tracking-tight border-b border-neutral-800/80 pb-2">
              Identidad del Consultor o Agencia
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-neutral-300">
                  Nombre o Marca Comercial *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ej: Jimmie Hamilton | Growth & Tech"
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3.5 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-500 focus:outline-none transition"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-neutral-300">
                  Stack tecnológico / Herramientas (separadas por coma)
                </label>
                <input
                  type="text"
                  value={techStackInput}
                  onChange={(e) => setTechStackInput(e.target.value)}
                  placeholder="Next.js, n8n, Make, Supabase, WhatsApp Business API"
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3.5 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-500 focus:outline-none transition"
                />
                {stackChips.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {stackChips.map((chip, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-300 border border-neutral-700/60"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="block text-xs font-medium text-neutral-300">
                Tono de comunicación comercial
              </label>
              <input
                type="text"
                value={communicationTone}
                onChange={(e) => setCommunicationTone(e.target.value)}
                placeholder="Ej: Directo, consultivo y enfocado en resultados operativos"
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3.5 py-2.5 text-sm text-neutral-100 focus:border-emerald-500 focus:outline-none transition"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {TONE_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCommunicationTone(preset)}
                    className="text-[10px] text-neutral-400 hover:text-white bg-neutral-800/80 hover:bg-neutral-800 px-2 py-1 rounded-md transition cursor-pointer"
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Catálogo de Servicios Ofrecidos */}
          <section className="rounded-2xl border border-neutral-800/90 bg-neutral-900/50 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800/80 pb-3">
              <div>
                <h2 className="text-sm font-semibold text-white tracking-tight">
                  Catálogo de Servicios Ofrecidos (Base para cotizaciones)
                </h2>
                <p className="text-xs text-neutral-400">
                  Agrega tus paquetes de entrada con sus precios mínimos y tiempos de entrega estimados.
                </p>
              </div>
              <button
                type="button"
                onClick={addServiceRow}
                className="text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-100 px-3.5 py-2 rounded-xl transition cursor-pointer flex items-center gap-1.5"
              >
                <span>+</span>
                <span>Añadir servicio</span>
              </button>
            </div>

            <div className="space-y-3">
              {services.map((service, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-neutral-800/80 bg-neutral-950 p-3.5 sm:p-4 space-y-3 transition-colors hover:border-neutral-700"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-400">
                      Servicio #{idx + 1}
                    </span>
                    {services.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeServiceRow(idx)}
                        className="text-xs text-neutral-500 hover:text-red-400 px-2 py-1 rounded transition cursor-pointer"
                      >
                        ✕ Eliminar fila
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-4 space-y-1">
                      <label className="text-[10px] font-medium text-neutral-400">
                        Nombre del servicio *
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Automatización de WhatsApp + CRM"
                        value={service.name}
                        onChange={(e) => updateService(idx, "name", e.target.value)}
                        className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-500 focus:outline-none transition"
                      />
                    </div>

                    <div className="md:col-span-4 space-y-1">
                      <label className="text-[10px] font-medium text-neutral-400">
                        Qué problema resuelve en el negocio
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Evita pérdida de citas y clientes desatendidos"
                        value={service.description}
                        onChange={(e) => updateService(idx, "description", e.target.value)}
                        className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-500 focus:outline-none transition"
                      />
                    </div>

                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[10px] font-medium text-neutral-400">
                        Precio base ($ USD)
                      </label>
                      <input
                        type="number"
                        min={0}
                        placeholder="Desde $ USD"
                        value={service.starting_price_usd ?? ""}
                        onChange={(e) =>
                          updateService(idx, "starting_price_usd", e.target.value)
                        }
                        className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-500 focus:outline-none transition"
                      />
                    </div>

                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[10px] font-medium text-neutral-400">
                        Plazo (días hábiles)
                      </label>
                      <input
                        type="number"
                        min={1}
                        placeholder="Ej: 7"
                        value={service.typical_turnaround_days ?? ""}
                        onChange={(e) =>
                          updateService(idx, "typical_turnaround_days", e.target.value)
                        }
                        className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-500 focus:outline-none transition"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Portafolio y Casos de Éxito */}
          <section className="rounded-2xl border border-neutral-800/90 bg-neutral-900/50 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-white tracking-tight">
              Casos de éxito y credenciales (para guiones de apertura)
            </h2>
            <p className="text-xs text-neutral-400">
              Menciona 1 o 2 resultados rápidos para dar autoridad al momento de hablar con el dueño.
            </p>
            <textarea
              rows={3}
              value={portfolioHighlights}
              onChange={(e) => setPortfolioHighlights(e.target.value)}
              placeholder="Ej: Implementé agenda automatizada para clínica dental reduciendo cancelaciones un 40%. Diseñé catálogo web para pizzería con 60 pedidos diarios en WhatsApp..."
              className="w-full rounded-xl border border-neutral-800 bg-neutral-950 p-3.5 text-xs sm:text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-500 focus:outline-none transition"
            />
          </section>

          {message && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-center justify-between animate-in fade-in ${
                message.type === "ok"
                  ? "text-emerald-300 bg-emerald-950/40 border-emerald-900/80"
                  : "text-red-300 bg-red-950/40 border-red-900/80"
              }`}
            >
              <span>{message.text}</span>
              <button
                type="button"
                onClick={() => setMessage(null)}
                className="text-neutral-400 hover:text-white ml-2"
              >
                ✕
              </button>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 text-neutral-950 font-semibold text-sm px-7 py-3 shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition cursor-pointer flex items-center gap-2"
            >
              {saving ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 text-neutral-950"
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
                  <span>Guardando Perfil...</span>
                </>
              ) : (
                <span>Guardar Perfil de Consultor</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

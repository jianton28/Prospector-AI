"use client";

import { useEffect, useState, useMemo, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { AuthChangeEvent } from "@supabase/supabase-js";
import {
  PreferredChannel,
  Prospect,
  ProspectStatus,
  ConsultantProfile,
  getProspectFollowUp,
} from "@/types/prospector";

const STATUS_CONFIG: Record<
  ProspectStatus,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  por_analizar: {
    label: "Por analizar",
    bg: "bg-amber-950/40",
    text: "text-amber-300",
    border: "border-amber-800/60",
    dot: "bg-amber-400",
  },
  listo_contactar: {
    label: "Listo para contactar",
    bg: "bg-emerald-950/40",
    text: "text-emerald-300",
    border: "border-emerald-800/60",
    dot: "bg-emerald-400",
  },
  contactado: {
    label: "Contactado",
    bg: "bg-sky-950/40",
    text: "text-sky-300",
    border: "border-sky-800/60",
    dot: "bg-sky-400",
  },
  reunion_pendiente: {
    label: "Reunión pendiente",
    bg: "bg-indigo-950/40",
    text: "text-indigo-300",
    border: "border-indigo-800/60",
    dot: "bg-indigo-400",
  },
  reunion: {
    label: "En reunión",
    bg: "bg-purple-950/40",
    text: "text-purple-300",
    border: "border-purple-800/60",
    dot: "bg-purple-400",
  },
  propuesta_enviada: {
    label: "Propuesta enviada",
    bg: "bg-blue-950/40",
    text: "text-blue-300",
    border: "border-blue-800/60",
    dot: "bg-blue-400",
  },
  seguimiento: {
    label: "Seguimiento / Por decidir",
    bg: "bg-amber-950/50",
    text: "text-amber-200",
    border: "border-amber-700/70",
    dot: "bg-amber-300 animate-pulse",
  },
  cerrado: {
    label: "Cerrado",
    bg: "bg-emerald-900/60",
    text: "text-emerald-200",
    border: "border-emerald-700",
    dot: "bg-emerald-300 animate-pulse",
  },
  descartado: {
    label: "Descartado",
    bg: "bg-neutral-900",
    text: "text-neutral-400",
    border: "border-neutral-800",
    dot: "bg-neutral-500",
  },
};

function getDashboardFollowUpBadge(followUpDate: string): {
  label: string;
  badgeClass: string;
  dotClass: string;
  isDue: boolean;
} | null {
  if (!followUpDate) return null;
  const today = new Date().toISOString().split("T")[0];
  if (followUpDate < today) {
    return {
      label: `Vencido (${followUpDate})`,
      badgeClass: "bg-red-950/50 text-red-300 border-red-800/70",
      dotClass: "bg-red-400",
      isDue: true,
    };
  }
  if (followUpDate === today) {
    return {
      label: "Seguimiento HOY",
      badgeClass: "bg-amber-950/60 text-amber-200 border-amber-600/80 animate-pulse",
      dotClass: "bg-amber-300",
      isDue: true,
    };
  }
  return {
    label: `Seguimiento: ${followUpDate}`,
    badgeClass: "bg-neutral-800/80 text-neutral-300 border-neutral-700/60",
    dotClass: "bg-neutral-400",
    isDue: false,
  };
}

const CHANNEL_ICONS: Record<PreferredChannel, string> = {
  presencial: "📍 Presencial",
  whatsapp: "💬 WhatsApp",
  llamada: "📞 Llamada",
  correo: "✉️ Correo",
};

interface RadarPlace {
  id: string;
  business_name: string;
  niche: string;
  zone: string | null;
  phone: string | null;
  website_url: string | null;
  maps_url: string | null;
  has_no_website: boolean;
  rating: number | null;
  user_rating_count: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<ConsultantProfile | null>(null);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtro y búsqueda en dashboard
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [onlyFollowUpDue, setOnlyFollowUpDue] = useState(false);

  // Estado del formulario de alta rápida
  const [businessName, setBusinessName] = useState("");
  const [niche, setNiche] = useState("");
  const [zone, setZone] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [preferredChannel, setPreferredChannel] = useState<PreferredChannel>("presencial");
  const [rawNotes, setRawNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analysisSeconds, setAnalysisSeconds] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!analyzingId) return;
    const startTime = Date.now();
    const interval = setInterval(() => {
      setAnalysisSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [analyzingId]);

  // Estados del Radar de Negocios Cercanos (Google Places)
  const [radarQuery, setRadarQuery] = useState("clínicas dentales");
  const [radarRadius, setRadarRadius] = useState<number>(2000);
  const [radarCoords, setRadarCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [radarSearching, setRadarSearching] = useState(false);
  const [radarResults, setRadarResults] = useState<RadarPlace[]>([]);
  const [selectedPlaceIds, setSelectedPlaceIds] = useState<Set<string>>(new Set());
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const [importingBatch, setImportingBatch] = useState(false);
  const [importingSingleId, setImportingSingleId] = useState<string | null>(null);
  const [radarError, setRadarError] = useState<string | null>(null);
  const [radarFeedback, setRadarFeedback] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardData() {
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
        setUserEmail(user.email ?? null);

        // Carga concurrente de prospectos y perfil de consultor
        const [prospectsRes, profileRes] = await Promise.all([
          supabase
            .from("prospects")
            .select("*")
            .order("created_at", { ascending: false }),
          supabase
            .from("consultant_profiles")
            .select("*")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

        if (!isMounted) return;

        if (prospectsRes.data) {
          setProspects(prospectsRes.data as Prospect[]);
        }

        if (profileRes?.data) {
          setProfile(profileRes.data as ConsultantProfile);
        }
      } catch (err) {
        console.error("Error al cargar datos del dashboard:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadDashboardData();

    // Listener de sesión controlado: solo reacciona a SIGNED_OUT, sin router.refresh()
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

  // Geolocalización del navegador
  function handleGetLocation() {
    if (!navigator.geolocation) {
      setRadarError("Tu navegador no soporta geolocalización.");
      return;
    }

    setGettingLocation(true);
    setRadarError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setRadarCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setGettingLocation(false);
        setRadarFeedback("✓ Ubicación GPS obtenida correctamente.");
      },
      (err) => {
        setRadarError(`No se pudo obtener tu ubicación: ${err.message}. Puedes buscar por texto.`);
        setGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  // Búsqueda en Google Places API (New)
  async function handleSearchRadar(e?: FormEvent) {
    if (e) e.preventDefault();
    if (!radarQuery.trim() && !radarCoords) {
      setRadarError("Ingresa un rubro comercial o activa tu ubicación actual.");
      return;
    }

    setRadarSearching(true);
    setRadarError(null);
    setRadarFeedback(null);

    try {
      const res = await fetch("/api/places/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: radarQuery.trim(),
          latitude: radarCoords?.latitude ?? null,
          longitude: radarCoords?.longitude ?? null,
          radiusMeters: radarRadius,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setRadarError(data.error || "Fallo al consultar Google Places API.");
        setRadarSearching(false);
        return;
      }

      const results = (data.places as RadarPlace[]) || [];
      setRadarResults(results);
      setSelectedPlaceIds(new Set());

      if (results.length === 0) {
        setRadarFeedback("No se encontraron comercios en este radio. Prueba ampliando el radio o cambiando el rubro.");
      } else {
        const noWebCount = results.filter((p) => p.has_no_website).length;
        setRadarFeedback(
          `✓ Se encontraron ${results.length} comercios (${noWebCount} sin sitio web = alta oportunidad comercial).`
        );
      }
    } catch {
      setRadarError("No se pudo conectar con el endpoint /api/places/search.");
    } finally {
      setRadarSearching(false);
    }
  }

  // Selección individual para lote
  function toggleSelectPlace(id: string) {
    setSelectedPlaceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // Seleccionar o deseleccionar todos
  function toggleSelectAll() {
    if (selectedPlaceIds.size === radarResults.length) {
      setSelectedPlaceIds(new Set());
    } else {
      setSelectedPlaceIds(new Set(radarResults.map((p) => p.id)));
    }
  }

  // Importar un comercio individual al pipeline
  async function handleImportSingle(place: RadarPlace) {
    if (!userId) return;

    setImportingSingleId(place.id);
    setRadarError(null);

    const supabase = createClient();
    const { data: created, error } = await supabase
      .from("prospects")
      .insert({
        user_id: userId,
        business_name: place.business_name,
        niche: place.niche,
        zone: place.zone,
        maps_url: place.maps_url,
        website_url: place.website_url,
        phone: place.phone,
        preferred_channel: "presencial",
        raw_notes: place.has_no_website
          ? "Detectado por Radar: Sin sitio web (alta oportunidad para web/WhatsApp)."
          : "Importado desde Radar de Google Maps.",
        status: "por_analizar",
      })
      .select()
      .single();

    setImportingSingleId(null);

    if (error || !created) {
      setRadarError(`Error al importar comercio: ${error?.message ?? "desconocido"}`);
      return;
    }

    setProspects((prev) => [created as Prospect, ...prev]);
    setImportedIds((prev) => new Set(prev).add(place.id));
    setRadarFeedback(`✓ "${place.business_name}" se importó al pipeline con éxito.`);
  }

  // Importar en lote los seleccionados
  async function handleImportBulk() {
    if (!userId) return;
    const toImport = radarResults.filter(
      (p) => selectedPlaceIds.has(p.id) && !importedIds.has(p.id)
    );

    if (toImport.length === 0) return;

    setImportingBatch(true);
    setRadarError(null);

    const rows = toImport.map((p) => ({
      user_id: userId,
      business_name: p.business_name,
      niche: p.niche,
      zone: p.zone,
      maps_url: p.maps_url,
      website_url: p.website_url,
      phone: p.phone,
      preferred_channel: "presencial" as PreferredChannel,
      raw_notes: p.has_no_website
        ? "Detectado por Radar: Sin sitio web (alta oportunidad)."
        : "Importado en lote desde Radar Google Maps.",
      status: "por_analizar" as ProspectStatus,
    }));

    const supabase = createClient();
    const { data: createdBatch, error } = await supabase
      .from("prospects")
      .insert(rows)
      .select();

    setImportingBatch(false);

    if (error || !createdBatch) {
      setRadarError(`Error al importar lote: ${error?.message ?? "desconocido"}`);
      return;
    }

    setProspects((prev) => [...(createdBatch as Prospect[]), ...prev]);
    setImportedIds((prev) => {
      const next = new Set(prev);
      toImport.forEach((p) => next.add(p.id));
      return next;
    });
    setSelectedPlaceIds(new Set());
    setRadarFeedback(`✓ Se importaron ${createdBatch.length} comercios al pipeline.`);
  }

  async function handleCreateProspect(e: FormEvent) {
    e.preventDefault();
    if (!userId || !businessName.trim() || !niche.trim()) return;

    setSubmitting(true);
    setFeedback(null);

    const supabase = createClient();
    const { data: created, error } = await supabase
      .from("prospects")
      .insert({
        user_id: userId,
        business_name: businessName.trim(),
        niche: niche.trim(),
        zone: zone.trim() || null,
        maps_url: mapsUrl.trim() || null,
        website_url: websiteUrl.trim() || null,
        phone: phone.trim() || null,
        preferred_channel: preferredChannel,
        raw_notes: rawNotes.trim() || null,
        status: "por_analizar",
      })
      .select()
      .single();

    setSubmitting(false);

    if (error || !created) {
      setFeedback(`Error al guardar prospecto: ${error?.message ?? "desconocido"}`);
      return;
    }

    setProspects((prev) => [created as Prospect, ...prev]);
    setBusinessName("");
    setNiche("");
    setZone("");
    setMapsUrl("");
    setWebsiteUrl("");
    setPhone("");
    setRawNotes("");
    setFeedback("✓ Prospecto guardado correctamente. Ya puedes auditarlo con IA.");
  }

  async function handleAnalyze(prospectId: string) {
    setAnalyzingId(prospectId);
    setAnalysisSeconds(0);
    setFeedback(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectId }),
      });
      const data = await res.json();

      if (!res.ok) {
        setFeedback(`Error en análisis: ${data.error || "fallo desconocido"}`);
        setAnalyzingId(null);
        return;
      }

      setProspects((prev) =>
        prev.map((p) =>
          p.id === prospectId && p.status === "por_analizar"
            ? { ...p, status: "listo_contactar" }
            : p
        )
      );
      setAnalyzingId(null);
      router.push(`/prospects/${prospectId}`);
    } catch {
      setFeedback("No se pudo conectar con /api/analyze.");
      setAnalyzingId(null);
    }
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Filtrado de prospectos en el pipeline
  const filteredProspects = useMemo(() => {
    return prospects.filter((p) => {
      const matchesSearch =
        p.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.niche.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.zone && p.zone.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      // Filtro especial rápido: Seguimiento Hoy o Vencido
      if (onlyFollowUpDue) {
        if (p.status === "cerrado" || p.status === "descartado") return false;
        const followUp = getProspectFollowUp(p);
        if (!followUp.followUpDate) return false;
        return followUp.followUpDate <= todayStr;
      }

      if (statusFilter === "all") return true;
      return p.status === statusFilter;
    });
  }, [prospects, searchTerm, statusFilter, onlyFollowUpDue, todayStr]);

  // Contadores para métricas
  const counts = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const followUpsDue = prospects.filter((p) => {
      if (p.status === "cerrado" || p.status === "descartado") return false;
      const followUp = getProspectFollowUp(p);
      return Boolean(followUp.followUpDate && followUp.followUpDate <= today);
    }).length;

    return {
      total: prospects.length,
      porAnalizar: prospects.filter((p) => p.status === "por_analizar").length,
      listos: prospects.filter((p) => p.status === "listo_contactar").length,
      followUpsDue,
      enNegociacion: prospects.filter(
        (p) =>
          p.status === "contactado" ||
          p.status === "reunion_pendiente" ||
          p.status === "reunion" ||
          p.status === "propuesta_enviada" ||
          p.status === "seguimiento"
      ).length,
      cerrados: prospects.filter((p) => p.status === "cerrado").length,
    };
  }, [prospects]);

  if (loading) {
    return (
      <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-400 flex items-center justify-center text-neutral-950 font-black text-xl animate-pulse">
          ⚡
        </div>
        <p className="text-sm text-neutral-400">Cargando consola de prospección...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-4 sm:p-6 selection:bg-emerald-500/20 selection:text-emerald-300">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Superior */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800/80 pb-5">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-neutral-950 font-black text-lg shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                ⚡
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                    Prospector<span className="text-emerald-400">AI</span>
                  </h1>
                  <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400">
                    Console
                  </span>
                </div>
                <p className="text-xs text-neutral-400 truncate max-w-[200px] sm:max-w-xs">
                  {profile?.full_name ? `${profile.full_name} (${userEmail})` : userEmail}
                </p>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/profile"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-neutral-200 hover:text-white border border-neutral-700/80 bg-neutral-900/60 hover:bg-neutral-800 rounded-xl px-3.5 py-2 transition shadow-sm"
            >
              <span>⚙️</span>
              <span>Mi Perfil y Servicios</span>
            </Link>
            <button
              onClick={handleLogout}
              className="text-xs sm:text-sm text-neutral-400 hover:text-white border border-neutral-800 hover:border-neutral-700 bg-neutral-950 rounded-xl px-3 py-2 cursor-pointer transition"
            >
              Salir
            </button>
          </div>
        </header>

        {/* Pipeline Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="rounded-xl border border-neutral-800/90 bg-neutral-900/40 p-3.5">
            <span className="text-xs text-neutral-500 font-medium">Total Negocios</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold text-white">{counts.total}</span>
              <span className="text-xs text-neutral-400">registrados</span>
            </div>
          </div>

          <div
            onClick={() => setOnlyFollowUpDue(!onlyFollowUpDue)}
            className={`rounded-xl border p-3.5 transition cursor-pointer select-none ${
              onlyFollowUpDue
                ? "border-amber-400 bg-amber-500/20 ring-1 ring-amber-400 shadow-md shadow-amber-500/10"
                : counts.followUpsDue > 0
                ? "border-amber-700/60 bg-amber-950/25 hover:border-amber-500/60"
                : "border-neutral-800/90 bg-neutral-900/40 hover:border-neutral-700"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-medium ${counts.followUpsDue > 0 ? "text-amber-300" : "text-neutral-500"}`}>
                Seguimiento Hoy
              </span>
              {counts.followUpsDue > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              )}
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className={`text-2xl font-bold ${counts.followUpsDue > 0 ? "text-amber-300" : "text-neutral-400"}`}>
                {counts.followUpsDue}
              </span>
              <span className={`text-[11px] ${counts.followUpsDue > 0 ? "text-amber-400/90 font-medium" : "text-neutral-500"}`}>
                {onlyFollowUpDue ? "filtrado ✓" : "vencido / hoy"}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-amber-900/30 bg-amber-950/10 p-3.5">
            <span className="text-xs text-amber-400/90 font-medium">Por Analizar</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold text-amber-300">{counts.porAnalizar}</span>
              <span className="text-[11px] text-amber-400/70">pendientes</span>
            </div>
          </div>

          <div className="rounded-xl border border-emerald-900/30 bg-emerald-950/10 p-3.5">
            <span className="text-xs text-emerald-400/90 font-medium">Listos para Contactar</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold text-emerald-300">{counts.listos}</span>
              <span className="text-[11px] text-emerald-400/70">con guion listo</span>
            </div>
          </div>

          <div className="rounded-xl border border-cyan-900/30 bg-cyan-950/10 p-3.5 col-span-2 sm:col-span-1">
            <span className="text-xs text-cyan-400/90 font-medium">Cerrados / Ganados</span>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-2xl font-bold text-cyan-300">{counts.cerrados}</span>
              <span className="text-[11px] text-cyan-400/70">éxitos</span>
            </div>
          </div>
        </div>

        {/* Radar de Negocios Cercanos (Google Places API) */}
        <section className="rounded-2xl border border-cyan-800/40 bg-gradient-to-br from-neutral-900/90 via-neutral-900/60 to-cyan-950/20 backdrop-blur-md p-5 sm:p-6 space-y-4 shadow-xl shadow-black/40">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300 text-sm font-bold">
                📡
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-white tracking-tight">
                    Radar de Negocios Cercanos (Google Maps)
                  </h2>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                    Places API
                  </span>
                </div>
                <p className="text-xs text-neutral-400">
                  Detecta comercios cercanos y filtra automáticamente los que no tienen sitio web (alta oportunidad comercial).
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGetLocation}
              disabled={gettingLocation}
              className={`text-xs font-medium px-3 py-1.5 rounded-xl border transition flex items-center gap-1.5 cursor-pointer ${
                radarCoords
                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                  : "bg-neutral-950 hover:bg-neutral-800 text-neutral-300 border-neutral-800"
              }`}
            >
              {gettingLocation ? (
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
                  <span>Obteniendo GPS...</span>
                </>
              ) : (
                <>
                  <span>📍</span>
                  <span>
                    {radarCoords
                      ? `GPS: ${radarCoords.latitude.toFixed(3)}, ${radarCoords.longitude.toFixed(3)}`
                      : "Usar mi ubicación actual"}
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Formulario del Radar */}
          <form onSubmit={handleSearchRadar} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-6 space-y-1">
              <label className="text-[11px] font-medium text-neutral-400 block">
                Rubro o tipo de negocio a rastrear
              </label>
              <input
                type="text"
                placeholder="Ej: clínicas dentales, restaurantes, talleres mecánicos, ferreterías"
                value={radarQuery}
                onChange={(e) => setRadarQuery(e.target.value)}
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-xs sm:text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-cyan-500 focus:outline-none transition"
              />
            </div>

            <div className="sm:col-span-3 space-y-1">
              <label className="text-[11px] font-medium text-neutral-400 block">
                Radio de búsqueda
              </label>
              <select
                value={radarRadius}
                onChange={(e) => setRadarRadius(Number(e.target.value))}
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs sm:text-sm text-neutral-200 focus:border-cyan-500 focus:outline-none transition cursor-pointer"
              >
                <option value={500}>500 metros (caminando)</option>
                <option value={1000}>1 km (alrededor)</option>
                <option value={3000}>3 km (zona comercial)</option>
                <option value={5000}>5 km (sector amplio)</option>
              </select>
            </div>

            <div className="sm:col-span-3">
              <button
                type="submit"
                disabled={radarSearching}
                className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-teal-300 hover:from-cyan-300 hover:to-teal-200 text-neutral-950 font-semibold text-xs sm:text-sm py-2.5 shadow-md shadow-cyan-500/20 disabled:opacity-50 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                {radarSearching ? (
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
                    <span>Rastreando Places...</span>
                  </>
                ) : (
                  <>
                    <span>🔍</span>
                    <span>Buscar negocios</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {radarError && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-900/60 text-xs text-red-300 flex items-center justify-between animate-in fade-in">
              <span>{radarError}</span>
              <button
                type="button"
                onClick={() => setRadarError(null)}
                className="text-neutral-400 hover:text-white ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {radarFeedback && !radarError && (
            <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800 text-xs text-cyan-300 flex items-center justify-between animate-in fade-in">
              <span>{radarFeedback}</span>
              <button
                type="button"
                onClick={() => setRadarFeedback(null)}
                className="text-neutral-400 hover:text-white ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {/* Resultados del Radar */}
          {radarResults.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-neutral-800/80">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-xs text-neutral-400 hover:text-white underline cursor-pointer"
                  >
                    {selectedPlaceIds.size === radarResults.length
                      ? "Deseleccionar todos"
                      : "Seleccionar todos"}
                  </button>
                  <span className="text-xs text-neutral-500">
                    ({selectedPlaceIds.size} de {radarResults.length} seleccionados)
                  </span>
                </div>

                {selectedPlaceIds.size > 0 && (
                  <button
                    type="button"
                    onClick={handleImportBulk}
                    disabled={importingBatch}
                    className="rounded-xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-semibold text-xs px-4 py-2 transition shadow-md shadow-cyan-500/20 cursor-pointer flex items-center gap-1.5"
                  >
                    {importingBatch ? (
                      <span>Importando lote...</span>
                    ) : (
                      <>
                        <span>+</span>
                        <span>Importar seleccionados ({selectedPlaceIds.size}) al pipeline</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Grid de tarjetas de resultados */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {radarResults.map((place) => {
                  const isSelected = selectedPlaceIds.has(place.id);
                  const isImported = importedIds.has(place.id);
                  const isImporting = importingSingleId === place.id;

                  return (
                    <div
                      key={place.id}
                      className={`rounded-xl border p-3.5 space-y-2.5 transition flex flex-col justify-between ${
                        isImported
                          ? "border-emerald-800/60 bg-emerald-950/20"
                          : isSelected
                          ? "border-cyan-500/60 bg-neutral-950"
                          : "border-neutral-800 bg-neutral-950/70 hover:border-neutral-700"
                      }`}
                    >
                      <div className="space-y-2">
                        {/* Cabecera de la tarjeta con checkbox y badge de oportunidad */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isImported}
                              onChange={() => toggleSelectPlace(place.id)}
                              className="mt-0.5 rounded border-neutral-700 text-cyan-500 focus:ring-cyan-500 cursor-pointer"
                            />
                            <div>
                              <h3 className="text-xs sm:text-sm font-semibold text-white leading-tight">
                                {place.business_name}
                              </h3>
                              <span className="text-[10px] text-neutral-400 block mt-0.5">
                                {place.niche}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Badges de Oportunidad */}
                        <div className="flex flex-wrap gap-1.5">
                          {place.has_no_website ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800/80 flex items-center gap-1">
                              <span>🔥</span>
                              <span>Sin sitio web (Alta Oportunidad)</span>
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700/60">
                              🌐 Con web
                            </span>
                          )}

                          {place.rating !== null && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-900 text-amber-300 border border-neutral-800">
                              ⭐ {place.rating} ({place.user_rating_count})
                            </span>
                          )}
                        </div>

                        {/* Datos de contacto y ubicación */}
                        <div className="text-[11px] text-neutral-400 space-y-1 pt-1">
                          {place.zone && (
                            <p className="line-clamp-2">📍 {place.zone}</p>
                          )}
                          {place.phone && (
                            <p className="text-neutral-300">📞 {place.phone}</p>
                          )}
                          <div className="flex items-center gap-3 pt-0.5">
                            {place.maps_url && (
                              <a
                                href={place.maps_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-cyan-400 hover:underline text-[10px]"
                              >
                                Google Maps ↗
                              </a>
                            )}
                            {place.website_url && (
                              <a
                                href={place.website_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-neutral-400 hover:text-white hover:underline text-[10px] truncate max-w-[120px]"
                              >
                                Web ↗
                              </a>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Botón de Importación */}
                      <div className="pt-2 border-t border-neutral-900">
                        {isImported ? (
                          <div className="text-center text-xs font-semibold py-1.5 rounded-lg bg-emerald-950/50 text-emerald-300 border border-emerald-800/80">
                            ✓ En el Pipeline
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleImportSingle(place)}
                            disabled={isImporting}
                            className="w-full text-xs font-medium py-1.5 rounded-lg border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            {isImporting ? (
                              <span>Importando...</span>
                            ) : (
                              <>
                                <span>+</span>
                                <span>Importar al pipeline</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Alta Rápida de Prospecto en Calle */}
        <section className="rounded-2xl border border-neutral-800/90 bg-neutral-900/50 backdrop-blur-sm p-4 sm:p-5 space-y-4 shadow-xl shadow-black/40">
          <div className="flex items-center justify-between border-b border-neutral-800/70 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <h2 className="text-sm font-semibold text-white tracking-tight">
                Alta rápida manual (Google Maps / Calle)
              </h2>
            </div>
            <span className="text-xs text-neutral-500 hidden sm:inline">
              Registro instantáneo para auditar en segundos
            </span>
          </div>

          <form onSubmit={handleCreateProspect} className="space-y-3.5">
            {/* Fila 1: Datos esenciales */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-neutral-400">
                  Nombre del comercio o negocio *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Panadería La Espiga Dorada"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-neutral-400">
                  Rubro o Nicho *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Panadería artesanal, Odontología, Taller"
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-neutral-400">
                  Zona / Sector comercial
                </label>
                <input
                  type="text"
                  placeholder="Ej: Calle 72, Centro, C.C. Plaza"
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-500 focus:outline-none transition"
                />
              </div>
            </div>

            {/* Fila 2: Enlaces y canal */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-neutral-400">
                  Enlace Google Maps
                </label>
                <input
                  type="url"
                  placeholder="https://maps.google.com/..."
                  value={mapsUrl}
                  onChange={(e) => setMapsUrl(e.target.value)}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs sm:text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-500 focus:outline-none transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-neutral-400">
                  Sitio web o Instagram
                </label>
                <input
                  type="url"
                  placeholder="https://negocio.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs sm:text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-500 focus:outline-none transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-neutral-400">
                  Teléfono / WhatsApp
                </label>
                <input
                  type="text"
                  placeholder="+58 412 1234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs sm:text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-500 focus:outline-none transition"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-neutral-400">
                  Canal de contacto planeado
                </label>
                <select
                  value={preferredChannel}
                  onChange={(e) => setPreferredChannel(e.target.value as PreferredChannel)}
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs sm:text-sm text-neutral-200 focus:border-emerald-500 focus:outline-none transition cursor-pointer"
                >
                  <option value="presencial">📍 Presencial (Cara a cara)</option>
                  <option value="whatsapp">💬 WhatsApp</option>
                  <option value="llamada">📞 Llamada telefónica</option>
                  <option value="correo">✉️ Correo electrónico</option>
                </select>
              </div>
            </div>

            {/* Fila 3: Observaciones rápidas */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-neutral-400">
                Observaciones iniciales (lo que viste en calle o reseñas)
              </label>
              <textarea
                rows={2}
                placeholder="Ej: Mucha gente esperando en caja, menú en papel deteriorado, en WhatsApp tienen mensaje de ausencia genérico..."
                value={rawNotes}
                onChange={(e) => setRawNotes(e.target.value)}
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-xs sm:text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-500 focus:outline-none transition"
              />
            </div>

            {feedback && (
              <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-emerald-300 flex items-center justify-between animate-in fade-in">
                <span>{feedback}</span>
                <button
                  type="button"
                  onClick={() => setFeedback(null)}
                  className="text-neutral-400 hover:text-white ml-2"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="flex items-center justify-end pt-1">
              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto rounded-xl bg-white hover:bg-neutral-200 text-neutral-950 font-semibold text-xs sm:text-sm px-5 py-2.5 shadow-md shadow-white/5 disabled:opacity-50 transition cursor-pointer flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <span>Guardando...</span>
                ) : (
                  <>
                    <span>+ Guardar prospecto</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* Buscador y Filtros */}
        <section className="space-y-3">
          {analyzingId && (
            <div className="p-3.5 rounded-xl border border-cyan-800/80 bg-cyan-950/40 text-xs text-cyan-200 flex flex-wrap items-center justify-between gap-2 animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping shrink-0" />
                <span>
                  Investigando presencia web real y generando auditoría técnica con IA... ({analysisSeconds}s transcurridos)
                </span>
              </div>
              <span className="text-[11px] text-cyan-300 font-mono font-medium hidden sm:inline-block">
                Análisis exhaustivo en progreso
              </span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-white tracking-tight">
                Prospectos registrados ({filteredProspects.length})
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Buscador */}
              <input
                type="text"
                placeholder="Buscar por nombre, nicho o zona..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="text-xs rounded-xl border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-neutral-200 placeholder:text-neutral-500 focus:border-neutral-600 focus:outline-none w-full sm:w-60"
              />

              {/* Filtro por estado */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs rounded-xl border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-neutral-300 focus:border-neutral-600 focus:outline-none cursor-pointer"
              >
                <option value="all">Todos los estados</option>
                <option value="por_analizar">Por analizar</option>
                <option value="listo_contactar">Listo para contactar</option>
                <option value="contactado">Contactado</option>
                <option value="reunion">Reunión</option>
                <option value="propuesta_enviada">Propuesta enviada</option>
                <option value="cerrado">Cerrado</option>
                <option value="descartado">Descartado</option>
              </select>
            </div>
          </div>

          {/* Lista de Prospectos */}
          {filteredProspects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-800/90 p-8 sm:p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-neutral-900 flex items-center justify-center text-xl mx-auto text-neutral-500">
                🔍
              </div>
              <p className="text-sm font-medium text-neutral-300">
                {prospects.length === 0
                  ? "Aún no has registrado ningún negocio."
                  : "No hay negocios que coincidan con tu búsqueda o filtro."}
              </p>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                {prospects.length === 0
                  ? "Usa el Radar de Google Maps arriba o el formulario manual para cargar el primer local comercial."
                  : "Prueba modificando el texto de búsqueda o seleccionando 'Todos los estados'."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredProspects.map((prospect) => {
                const statusStyle =
                  STATUS_CONFIG[prospect.status] || STATUS_CONFIG.por_analizar;
                const isAnalyzing = analyzingId === prospect.id;

                return (
                  <div
                    key={prospect.id}
                    className="group rounded-2xl border border-neutral-800/80 bg-neutral-900/40 hover:bg-neutral-900/70 hover:border-neutral-700/80 p-4 transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    {/* Info principal */}
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/prospects/${prospect.id}`}
                          className="font-semibold text-base text-white hover:text-emerald-300 transition truncate"
                        >
                          {prospect.business_name}
                        </Link>

                        <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700/60">
                          {prospect.niche}
                        </span>

                        <span
                          className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                          <span>{statusStyle.label}</span>
                        </span>
                      </div>

                      {/* Detalles secundarios */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-400">
                        <span className="flex items-center gap-1">
                          <span>{CHANNEL_ICONS[prospect.preferred_channel]}</span>
                        </span>

                        {prospect.zone && (
                          <span className="flex items-center gap-1 text-neutral-300">
                            <span>📍 {prospect.zone}</span>
                          </span>
                        )}

                        {prospect.phone && (
                          <span className="flex items-center gap-1 text-neutral-400">
                            <span>📞 {prospect.phone}</span>
                          </span>
                        )}

                        {prospect.maps_url && (
                          <a
                            href={prospect.maps_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1"
                          >
                            <span>Maps ↗</span>
                          </a>
                        )}

                        {prospect.website_url && (
                          <a
                            href={prospect.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-neutral-400 hover:text-white hover:underline truncate max-w-[150px]"
                          >
                            <span>Web ↗</span>
                          </a>
                        )}
                      </div>

                      {/* Observaciones si las hay */}
                      {prospect.raw_notes && (
                        <p className="text-xs text-neutral-500 italic line-clamp-1">
                          &ldquo;{prospect.raw_notes}&rdquo;
                        </p>
                      )}
                    </div>

                    {/* Acciones */}
                    <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-neutral-800/80">
                      <button
                        onClick={() => handleAnalyze(prospect.id)}
                        disabled={isAnalyzing}
                        className={`text-xs font-semibold rounded-xl px-4 py-2.5 transition flex items-center gap-1.5 cursor-pointer ${
                          prospect.status === "por_analizar"
                            ? "bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 text-neutral-950 shadow-md shadow-emerald-500/15"
                            : "bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
                        } disabled:opacity-50`}
                      >
                        {isAnalyzing ? (
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
                            <span>Investigando ({analysisSeconds}s)...</span>
                          </>
                        ) : (
                          <>
                            <span>⚡</span>
                            <span>
                              {prospect.status === "por_analizar"
                                ? "Auditar con IA"
                                : "Re-auditar"}
                            </span>
                          </>
                        )}
                      </button>

                      <Link
                        href={`/prospects/${prospect.id}`}
                        className="text-xs font-medium rounded-xl border border-neutral-800 hover:border-neutral-600 bg-neutral-900/80 hover:bg-neutral-800 text-neutral-200 px-3.5 py-2.5 transition"
                      >
                        Ver ficha →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

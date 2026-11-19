"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const checkedSessionRef = useRef(false);

  // Verificación controlada de sesión: evita bucles y re-renders infinitos
  useEffect(() => {
    if (checkedSessionRef.current) return;
    checkedSessionRef.current = true;

    let isMounted = true;
    const supabase = createClient();

    // 1. Comprobar si ya existe una sesión válida al entrar a /login
    supabase.auth.getSession().then((result) => {
      if (!isMounted) return;
      if (result.data.session?.user) {
        router.replace("/dashboard");
      }
    });

    // 2. Listener de autenticación controlado:
    // NUNCA llama a router.refresh() ni reacciona a INITIAL_SESSION o eventos repetitivos
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, session: Session | null) => {
        if (!isMounted) return;
        // Solo redirigir ante un login explícito exitoso
        if (event === "SIGNED_IN" && session?.user) {
          router.replace("/dashboard");
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      // Redirección controlada y limpia sin router.refresh() repetitivo
      if (data.session?.user) {
        router.replace("/dashboard");
      }
    } catch {
      setErrorMsg("No se pudo iniciar sesión. Revisa la configuración de Supabase.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-neutral-950 text-neutral-100 p-4 relative overflow-hidden selection:bg-emerald-500/20 selection:text-emerald-300">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-cyan-500/5 blur-[100px] rounded-full pointer-events-none" />

      {/* Back to landing link */}
      <div className="absolute top-6 left-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-medium text-neutral-400 hover:text-white px-3 py-1.5 rounded-lg border border-neutral-800/80 bg-neutral-900/40 hover:bg-neutral-900 transition"
        >
          <span>←</span>
          <span>Volver al inicio</span>
        </Link>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Brand header */}
        <div className="text-center space-y-2 mb-6">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-400 flex items-center justify-center text-neutral-950 font-black text-lg shadow-lg shadow-emerald-500/25 group-hover:scale-105 transition-transform">
              ⚡
            </div>
            <span className="text-2xl font-bold tracking-tight text-white">
              Prospector<span className="text-emerald-400">AI</span>
            </span>
          </Link>
          <p className="text-xs sm:text-sm text-neutral-400">
            Ingresa a tu consola privada de auditoría y guiones de prospección
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-neutral-800/90 bg-neutral-900/80 backdrop-blur-xl p-6 sm:p-8 shadow-2xl shadow-black/80 space-y-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-medium text-neutral-300">
                Correo electrónico
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="consultor@tuempresa.com"
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950/90 px-3.5 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/50 focus:outline-none transition"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-xs font-medium text-neutral-300">
                  Contraseña
                </label>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950/90 px-3.5 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/50 focus:outline-none transition"
                />
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-900/60 text-xs text-red-300 flex items-start gap-2 animate-in fade-in">
                <span className="text-red-400 font-bold">✕</span>
                <p className="leading-relaxed">{errorMsg}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 text-neutral-950 font-semibold text-sm py-3 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 disabled:opacity-50 transition cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
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
                  <span>Iniciando sesión...</span>
                </>
              ) : (
                <span>Ingresar al Sistema →</span>
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-neutral-800/80 text-center">
            <p className="text-[11px] text-neutral-500">
              Sesión segura cifrada con Supabase Auth.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

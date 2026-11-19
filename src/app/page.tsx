import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col selection:bg-emerald-500/20 selection:text-emerald-300">
      {/* Background glow effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-gradient-to-b from-emerald-500/15 via-cyan-500/5 to-transparent blur-3xl opacity-70" />
        <div className="absolute top-[40%] -left-32 w-96 h-96 bg-emerald-600/10 blur-3xl rounded-full" />
        <div className="absolute top-[60%] -right-32 w-96 h-96 bg-cyan-600/10 blur-3xl rounded-full" />
      </div>

      {/* Navigation Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-neutral-950/80 border-b border-neutral-800/80">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-neutral-950 font-black text-base shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              ⚡
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg tracking-tight text-white">Prospector</span>
              <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                AI
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm text-neutral-400">
            <a href="#proceso" className="hover:text-white transition">Flujo en 3 pasos</a>
            <a href="#caracteristicas" className="hover:text-white transition">Características</a>
            <a href="#demo" className="hover:text-white transition">Ficha en Vivo</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs sm:text-sm font-medium text-neutral-300 hover:text-white px-3.5 py-2 rounded-lg border border-neutral-800 hover:border-neutral-700 bg-neutral-900/50 hover:bg-neutral-900 transition"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/dashboard"
              className="text-xs sm:text-sm font-semibold text-neutral-950 bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 px-4 py-2 rounded-lg shadow-md shadow-emerald-500/20 transition cursor-pointer flex items-center gap-1.5"
            >
              <span>Ir al Dashboard</span>
              <span className="text-xs">→</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 relative z-10">
        {/* Hero Section */}
        <section className="pt-16 sm:pt-24 pb-16 sm:pb-20 px-4 sm:px-6 max-w-5xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/40 text-emerald-300 text-xs font-medium backdrop-blur-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Asistente de prospección B2B y cierre en terreno</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-[1.12]">
            Audita negocios en frío en{" "}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              15 segundos
            </span>{" "}
            y entra con el guion exacto para cerrar.
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-lg text-neutral-400 leading-relaxed">
            Convierte cualquier local comercial o ficha de Google Maps en un diagnóstico operativo
            con IA, un guion de apertura verbal de 20 segundos y una propuesta formal ajustada
            a tus servicios y tarifas reales.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-2">
            <Link
              href="/dashboard"
              className="w-full sm:w-auto text-sm font-semibold text-neutral-950 bg-white hover:bg-neutral-200 px-7 py-3.5 rounded-xl shadow-xl shadow-white/5 transition flex items-center justify-center gap-2 group cursor-pointer"
            >
              <span>Comenzar Prospección</span>
              <span className="group-hover:translate-x-0.5 transition-transform">→</span>
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto text-sm font-medium text-neutral-300 hover:text-white px-7 py-3.5 rounded-xl border border-neutral-800 bg-neutral-900/60 hover:bg-neutral-900 transition flex items-center justify-center gap-2"
            >
              <span>Acceso de Consultor</span>
            </Link>
          </div>

          <div className="pt-6 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs text-neutral-500">
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-bold">✓</span>
              <span>100% optimizado para móvil en calle</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-bold">✓</span>
              <span>Basado en tu catálogo de servicios</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 font-bold">✓</span>
              <span>Guiones directos sin tecnicismos</span>
            </div>
          </div>
        </section>

        {/* Live UI Mockup Preview Section */}
        <section id="demo" className="max-w-5xl mx-auto px-4 sm:px-6 pb-20">
          <div className="rounded-2xl border border-neutral-800/90 bg-neutral-900/70 backdrop-blur-xl p-4 sm:p-6 shadow-2xl shadow-black/80 space-y-4">
            {/* Mockup Window Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
                <span className="ml-2 text-xs font-mono text-neutral-400">
                  prospector-ai · ficha-express.preview
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-neutral-400">
                <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-900/80 font-medium">
                  Auditoría completada en 8.4s
                </span>
              </div>
            </div>

            {/* Mockup Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-2">
              {/* Left Column: Business & Street Pitch */}
              <div className="lg:col-span-7 space-y-4">
                <div className="bg-neutral-950 rounded-xl p-4 border border-neutral-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-white">
                          Centro Odontológico San Rafael
                        </h3>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-950/60 text-red-300 border border-red-900/60 font-semibold uppercase tracking-wider">
                          Prioridad Alta
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Clínica Dental · Zona Comercial Norte · Canal: Presencial
                      </p>
                    </div>
                  </div>

                  {/* 20-Second Pitch Box */}
                  <div className="rounded-lg bg-emerald-950/20 border border-emerald-800/40 p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                        <span>🎙️</span> Guion de apertura para calle (20 segundos)
                      </span>
                      <span className="text-[10px] text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded">
                        Listo para leer
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-neutral-100 italic leading-relaxed">
                      &ldquo;Hola, buen día. Vi en Maps que tienen más de 120 reseñas con 4.8 estrellas,
                      pero al intentar agendar por WhatsApp nadie responde en horas de la mañana.
                      Preparamos un flujo para clínicas que califica y agenda citas automáticamente
                      en 20 segundos sin saturar a recepción. ¿Quién gestiona la atención aquí?&rdquo;
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-neutral-900/70 p-2.5 rounded-lg border border-neutral-800">
                      <span className="text-neutral-500 block text-[11px]">Servicio sugerido</span>
                      <span className="font-medium text-emerald-300">WhatsApp Bot + Agenda</span>
                    </div>
                    <div className="bg-neutral-900/70 p-2.5 rounded-lg border border-neutral-800">
                      <span className="text-neutral-500 block text-[11px]">Gancho 5 minutos</span>
                      <span className="font-medium text-cyan-300">Demo interactiva en móvil</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Pains & Proposal snapshot */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-neutral-950 rounded-xl p-4 border border-neutral-800 space-y-3 h-full flex flex-col justify-between">
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                      Fugas operativas detectadas
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-start gap-2 text-neutral-300">
                        <span className="text-amber-400 font-bold">!</span>
                        <span>Pérdida de un 35% de consultas fuera del horario comercial.</span>
                      </div>
                      <div className="flex items-start gap-2 text-neutral-300">
                        <span className="text-amber-400 font-bold">!</span>
                        <span>Recepción anota citas en agenda física; no hay recordatorios por WhatsApp.</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-neutral-800/80 pt-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-neutral-400">Presupuesto sugerido:</span>
                      <span className="font-bold text-white">$120 - $220 USD</span>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href="/dashboard"
                        className="flex-1 text-center text-xs font-medium py-2 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition"
                      >
                        Auditar mis clientes →
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3-Step Workflow Section */}
        <section id="proceso" className="max-w-5xl mx-auto px-4 sm:px-6 py-16 border-t border-neutral-900">
          <div className="text-center max-w-xl mx-auto space-y-3 mb-12">
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">
              Flujo de Trabajo
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold text-white">
              De la acera al cierre en 3 pasos
            </h2>
            <p className="text-sm text-neutral-400">
              Diseñado para consultores y closers que prospectan a pie o con Google Maps.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 space-y-4 hover:border-neutral-700 transition">
              <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center text-base font-bold text-emerald-400">
                01
              </div>
              <h3 className="text-lg font-semibold text-white">Carga Express en Calle</h3>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Ingresa el nombre del negocio, rubro, zona y enlace de Maps en 15 segundos mientras
                caminas por la zona comercial o investigas en tu navegador.
              </p>
              <div className="text-xs text-neutral-500 border-t border-neutral-800/80 pt-3">
                📍 Compatible con Google Maps, Instagram y web.
              </div>
            </div>

            {/* Step 2 */}
            <div className="rounded-2xl border border-emerald-900/40 bg-neutral-900/70 p-6 space-y-4 hover:border-emerald-700/60 transition shadow-lg shadow-emerald-950/20">
              <div className="w-10 h-10 rounded-xl bg-emerald-950 text-emerald-300 border border-emerald-800/60 flex items-center justify-center text-base font-bold">
                02
              </div>
              <h3 className="text-lg font-semibold text-white">Auditoría IA & Guion de 20s</h3>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Antes de cruzar la puerta del local, la IA te entrega el pitch verbal para captar la
                atención del dueño, sus cuellos de botella y las preguntas filtro clave.
              </p>
              <div className="text-xs text-emerald-400/80 border-t border-neutral-800/80 pt-3">
                🎙️ Lenguaje directo y enfocado en dinero/tiempo.
              </div>
            </div>

            {/* Step 3 */}
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 space-y-4 hover:border-neutral-700 transition">
              <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center text-base font-bold text-cyan-400">
                03
              </div>
              <h3 className="text-lg font-semibold text-white">Propuesta a Medida y Cierre</h3>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Al salir del local, escribe notas rápidas de lo que dijo el dueño. La IA redacta la
                propuesta ampliada con entregables y cotización para enviar por WhatsApp en caliente.
              </p>
              <div className="text-xs text-neutral-500 border-t border-neutral-800/80 pt-3">
                💼 Apegada a tus precios base configurados.
              </div>
            </div>
          </div>
        </section>

        {/* Feature Cards Grid */}
        <section id="caracteristicas" className="max-w-5xl mx-auto px-4 sm:px-6 py-16 border-t border-neutral-900">
          <div className="text-center max-w-xl mx-auto space-y-3 mb-12">
            <span className="text-xs font-semibold text-cyan-400 uppercase tracking-widest">
              Ventaja Competitiva
            </span>
            <h2 className="text-2xl sm:text-4xl font-bold text-white">
              Construido para el mundo real, no para escritorios de oficina
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/40 space-y-2.5">
              <div className="text-2xl">📱</div>
              <h3 className="font-semibold text-white text-base">Modo Oscuro de Alto Contraste</h3>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Tipografía grande y fondos oscuros con contraste calibrado para leer sin esfuerzo en la
                pantalla de tu teléfono mientras caminas bajo la luz del sol.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/40 space-y-2.5">
              <div className="text-2xl">⚙️</div>
              <h3 className="font-semibold text-white text-base">Alineado a tus Servicios Reales</h3>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Configura en tu perfil tus paquetes (Next.js, automatizaciones n8n, chatbots WhatsApp)
                con precios mínimos y plazos. La IA nunca prometerá algo que tú no entregues.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/40 space-y-2.5">
              <div className="text-2xl">📋</div>
              <h3 className="font-semibold text-white text-base">Copiado en 1 Clic con Feedback</h3>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Botones de copiado instantáneo para pegar guiones en tu bloc de notas o propuestas
                en chats de WhatsApp Business sin perder formato.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-neutral-800 bg-neutral-900/40 space-y-2.5">
              <div className="text-2xl">🎯</div>
              <h3 className="font-semibold text-white text-base">Pipeline de Estado Visual</h3>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Visualiza tus prospectos desde &ldquo;Por analizar&rdquo; hasta &ldquo;Cerrado&rdquo; con
                badges distintivos y métricas de avance de tus visitas comerciales.
              </p>
            </div>
          </div>
        </section>

        {/* CTA Banner Section */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 py-20">
          <div className="relative rounded-3xl overflow-hidden border border-emerald-800/40 bg-gradient-to-br from-neutral-900 via-neutral-900 to-emerald-950/40 p-8 sm:p-12 text-center space-y-6">
            <div className="max-w-2xl mx-auto space-y-3">
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Listo para acelerar tu prospección B2B
              </h2>
              <p className="text-sm sm:text-base text-neutral-400 leading-relaxed">
                Entra a la aplicación, carga tus primeros comercios de tu zona y obtén tu primer guion
                de auditoría en menos de un minuto.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link
                href="/dashboard"
                className="w-full sm:w-auto text-sm font-semibold text-neutral-950 bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 px-8 py-3.5 rounded-xl shadow-lg shadow-emerald-500/25 transition cursor-pointer"
              >
                Abrir Dashboard
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto text-sm font-medium text-neutral-300 hover:text-white px-8 py-3.5 rounded-xl border border-neutral-800 bg-neutral-900/90 hover:bg-neutral-800 transition"
              >
                Iniciar Sesión
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-900 bg-neutral-950 py-8 px-4 sm:px-6 text-xs text-neutral-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-300">Prospector AI</span>
            <span>—</span>
            <span>Asistente de prospección B2B y cierre</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-neutral-300 transition">
              Login
            </Link>
            <Link href="/dashboard" className="hover:text-neutral-300 transition">
              Dashboard
            </Link>
            <Link href="/profile" className="hover:text-neutral-300 transition">
              Perfil de Consultor
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

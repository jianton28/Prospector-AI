import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

export function createClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local"
    );
  }

  // Patrón Singleton en navegador para evitar múltiples clientes compitiendo por cookies y listeners de auth
  if (typeof window !== "undefined") {
    if (!client) {
      client = createBrowserClient(supabaseUrl, supabaseAnonKey);
    }
    return client;
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

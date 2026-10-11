/** Datos públicos del proyecto de Supabase (van en .env.local y en Vercel). */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Sin estos datos no hay login: en desarrollo la app abre igual; en producción queda cerrada. */
export const authConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

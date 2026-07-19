// Configuração pública do Supabase — segura para o navegador.
// A URL do projeto e a chave "publishable/anon" NÃO são secretas
// (são protegidas pelo Row Level Security). Defina no .env com o prefixo VITE_:
//   VITE_SUPABASE_URL=https://xxxxx.supabase.co
//   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
//
// A chave secreta (service_role) fica SÓ no servidor, em
// SUPABASE_SERVICE_ROLE_KEY (sem prefixo VITE_), e é usada apenas
// na função de servidor que grava as fichas.

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
export const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

export function supabaseConfigurado(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

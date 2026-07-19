// Configuração pública do Supabase — segura para o navegador.
// A URL do projeto e a chave "anon" NÃO são secretas (são protegidas
// pelo Row Level Security). Defina no .env com o prefixo VITE_:
//   VITE_SUPABASE_URL=https://xxxxx.supabase.co
//   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
//
// A chave secreta (service_role) fica SÓ no servidor, em
// SUPABASE_SERVICE_ROLE_KEY (sem prefixo VITE_), e é usada apenas
// na função de servidor que grava as fichas.

// URL do projeto Supabase da Mavi (não é secreta). Pode ser sobrescrita
// por VITE_SUPABASE_URL, mas já vem preenchida para facilitar.
const URL_PADRAO = "https://jjkmgkorqzbroebhksca.supabase.co";

// Chave PÚBLICA (publishable/anon). É feita para ficar exposta — protegida
// pelo RLS. Project Settings > API Keys > "Publishable key".
const ANON_KEY_PADRAO = "sb_publishable_PNmCu11Hdy5YDOFDn2sedA_VcfLdppn";

export const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || URL_PADRAO;
export const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || ANON_KEY_PADRAO || undefined;

export function supabaseConfigurado(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

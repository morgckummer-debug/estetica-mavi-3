// Busca de endereço por CEP (ViaCEP) — preenche rua/bairro/cidade
// automaticamente pra cliente só completar número e complemento.

export type EnderecoPorCep = {
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
};

export async function buscarEnderecoPorCep(cep: string): Promise<EnderecoPorCep | null> {
  const digitos = cep.replace(/\D/g, "");
  if (digitos.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      erro?: boolean;
      logradouro?: string;
      bairro?: string;
      localidade?: string;
      uf?: string;
    };
    if (data.erro) return null;
    return {
      logradouro: data.logradouro ?? "",
      bairro: data.bairro ?? "",
      localidade: data.localidade ?? "",
      uf: data.uf ?? "",
    };
  } catch {
    return null;
  }
}

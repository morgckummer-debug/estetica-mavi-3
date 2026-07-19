// Máscaras de formatação usadas nas fichas (formulário) e no painel.

// (31)93998-3485 — aceita fixo (10 dígitos) e celular (11 dígitos)
export function mascaraTelefone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  const p = d.length;
  if (p === 0) return "";
  if (p <= 2) return `(${d}`;
  if (p <= 6) return `(${d.slice(0, 2)})${d.slice(2)}`;
  if (p <= 10) return `(${d.slice(0, 2)})${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)})${d.slice(2, 7)}-${d.slice(7)}`;
}

// 254.654.325-86
export function mascaraCpf(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  let out = d.slice(0, 3);
  if (d.length > 3) out += `.${d.slice(3, 6)}`;
  if (d.length > 6) out += `.${d.slice(6, 9)}`;
  if (d.length > 9) out += `-${d.slice(9, 11)}`;
  return out;
}

// 35700-000
export function mascaraCep(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length > 5) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return d;
}

export function aplicarMascara(mascara: "telefone" | "cpf" | "cep" | undefined, v: string): string {
  if (mascara === "telefone") return mascaraTelefone(v);
  if (mascara === "cpf") return mascaraCpf(v);
  if (mascara === "cep") return mascaraCep(v);
  return v;
}

// Valida o CPF pelos dígitos verificadores (algoritmo oficial da Receita) —
// pega tanto números incompletos/inventados quanto os repetidos clássicos
// (111.111.111-11 etc., que "passariam" no cálculo se não fossem barrados).
export function cpfValido(v: string): boolean {
  const d = v.replace(/\D/g, "");
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;

  const digitoVerificador = (base: string): number => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += parseInt(base[i], 10) * (base.length + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return (
    digitoVerificador(d.slice(0, 9)) === parseInt(d[9], 10) &&
    digitoVerificador(d.slice(0, 10)) === parseInt(d[10], 10)
  );
}

// Data de nascimento: "1977-12-30" (do <input type="date">) -> "30.12.1977"
export function formatarDataBR(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v.trim());
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  return v;
}

// Mesma conversão de formatarDataBR, mas com barras: "1977-12-30" -> "30/12/1977"
// (formato usado no contrato impresso).
export function formatarDataBRBarra(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v.trim());
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return v;
}

// Renderização dos campos de uma ficha de anamnese (Chip, Sim/Não, texto,
// seleção, múltipla escolha) — compartilhada entre o formulário público
// (/avaliacao/$tipo, preenchido pela cliente) e o cadastro manual no painel
// (/painel/nova, preenchido pela Marina a partir de uma ficha física).

import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { Campo, Respostas } from "@/data/anamnese";
import { aplicarMascara, cpfValido } from "@/lib/mascaras";
import { buscarEnderecoPorCep } from "@/lib/cep";

export function Chip({
  label,
  selected,
  onClick,
  alert,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  alert?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full border px-4 py-2 text-sm transition-colors max-w-full break-words",
        selected
          ? alert
            ? "bg-rose/15 border-rose text-rose"
            : "bg-lavender-soft border-lavender text-primary font-medium"
          : "bg-card border-border text-foreground/70 hover:border-primary/40",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

export function YesNo({
  value,
  onChange,
  alertOnYes,
}: {
  value: boolean | null | undefined;
  onChange: (v: boolean) => void;
  alertOnYes?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <Chip
        label="Sim"
        selected={value === true}
        onClick={() => onChange(true)}
        alert={alertOnYes}
      />
      <Chip label="Não" selected={value === false} onClick={() => onChange(false)} />
    </div>
  );
}

export const inputBase =
  "w-full rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export function CampoView({
  campo,
  respostas,
  set,
  compacto,
  mostrarErro,
}: {
  campo: Campo;
  respostas: Respostas;
  set: (id: string, v: string | boolean | null) => void;
  compacto?: boolean;
  mostrarErro?: boolean;
}) {
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [cepNaoEncontrado, setCepNaoEncontrado] = useState(false);

  if (campo.tipo === "texto") {
    // CEP: ao completar os 8 dígitos, busca o endereço (ViaCEP) e já
    // preenche rua/bairro/cidade — a cliente só completa número/complemento.
    const buscarCep = async () => {
      const digitos = (respostas[campo.id] as string | undefined)?.replace(/\D/g, "") ?? "";
      if (digitos.length !== 8) return;
      setCepNaoEncontrado(false);
      setBuscandoCep(true);
      try {
        const endereco = await buscarEnderecoPorCep(digitos);
        if (!endereco) {
          setCepNaoEncontrado(true);
          return;
        }
        if (endereco.logradouro) set("endereco", endereco.logradouro);
        if (endereco.bairro) set("bairro", endereco.bairro);
        if (endereco.localidade) {
          set(
            "cidade",
            endereco.uf ? `${endereco.localidade} - ${endereco.uf}` : endereco.localidade,
          );
        }
        // Já deixa o foco no Número — só o que falta a cliente preencher
        // à mão, já que rua/bairro/cidade acabaram de vir prontos do CEP.
        requestAnimationFrame(() => {
          document.getElementById("numero")?.focus();
        });
      } finally {
        setBuscandoCep(false);
      }
    };

    // CPF: avalia os dígitos verificadores assim que os 11 números são
    // digitados — mesma lógica usada pra bloquear o "Continuar" (campoValido
    // em anamnese.ts), só que aqui é feedback em tempo real pra cliente.
    const cpfDigitado = ((respostas[campo.id] as string) ?? "").replace(/\D/g, "");
    const cpfInvalido =
      campo.mascara === "cpf" && cpfDigitado.length === 11 && !cpfValido(cpfDigitado);

    return (
      <div>
        <label className="block text-sm font-medium mb-2">{campo.label}</label>
        {campo.multiline ? (
          <textarea
            value={(respostas[campo.id] as string) ?? ""}
            onChange={(e) => set(campo.id, e.target.value)}
            placeholder={campo.placeholder}
            rows={3}
            className={inputBase}
          />
        ) : (
          <div className="relative">
            <input
              id={campo.id}
              type={campo.inputMode === "date" ? "date" : "text"}
              inputMode={
                campo.inputMode === "tel"
                  ? "tel"
                  : campo.inputMode === "email"
                    ? "email"
                    : campo.inputMode === "numeric"
                      ? "numeric"
                      : undefined
              }
              value={(respostas[campo.id] as string) ?? ""}
              onChange={(e) => {
                set(campo.id, aplicarMascara(campo.mascara, e.target.value));
                if (campo.mascara === "cep") setCepNaoEncontrado(false);
              }}
              onBlur={campo.mascara === "cep" ? buscarCep : undefined}
              placeholder={campo.placeholder}
              className={[
                inputBase,
                campo.mascara === "cep" ? "pr-10" : "",
                cpfInvalido ? "border-rose focus:ring-rose/40" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            />
            {campo.mascara === "cep" && buscandoCep && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        )}
        {campo.mascara === "cep" && cepNaoEncontrado && (
          <p className="mt-1.5 text-xs text-rose">
            CEP não encontrado — preencha o endereço manualmente.
          </p>
        )}
        {cpfInvalido && (
          <p className="mt-1.5 text-xs text-rose">CPF inválido — confira os números.</p>
        )}
      </div>
    );
  }

  if (campo.tipo === "selecao") {
    const val = (respostas[campo.id] as string) ?? "";
    return (
      <div>
        <label className="block text-sm font-medium mb-2">{campo.label}</label>
        <div className="flex flex-wrap gap-2">
          {campo.opcoes.map((op) => (
            <Chip
              key={op}
              label={op}
              selected={val === op}
              onClick={() => set(campo.id, val === op ? null : op)}
            />
          ))}
        </div>
        {campo.especifique && val && (
          <textarea
            value={(respostas[`${campo.id}__detalhe`] as string) ?? ""}
            onChange={(e) => set(`${campo.id}__detalhe`, e.target.value)}
            placeholder={campo.especifiquePlaceholder ?? "Especifique"}
            rows={2}
            className={`${inputBase} mt-3`}
          />
        )}
      </div>
    );
  }

  if (campo.tipo === "multi") {
    const atual = String(respostas[campo.id] ?? "")
      .split(", ")
      .filter(Boolean);
    const toggle = (op: string) => {
      const novo = atual.includes(op) ? atual.filter((x) => x !== op) : [...atual, op];
      set(campo.id, novo.join(", "));
    };
    return (
      <div>
        <label className="block text-sm font-medium mb-2">{campo.label}</label>
        <div className="flex flex-wrap gap-2">
          {campo.opcoes.map((op) => (
            <Chip key={op} label={op} selected={atual.includes(op)} onClick={() => toggle(op)} />
          ))}
        </div>
      </div>
    );
  }

  // simnao
  const valor = respostas[campo.id] as boolean | null | undefined;
  const invalido = Boolean(mostrarErro) && valor !== true && valor !== false;
  return (
    <div className={compacto ? "flex items-center justify-between gap-3" : ""}>
      <label
        className={[
          compacto ? "text-sm font-medium" : "block text-sm font-medium mb-2",
          invalido ? "text-rose" : "",
        ].join(" ")}
      >
        {campo.label}
      </label>
      <div>
        <YesNo
          value={valor}
          onChange={(v) => set(campo.id, v)}
          alertOnYes={Boolean(campo.alertaSeSim)}
        />
        {invalido && <p className="mt-1 text-xs text-rose">Selecione uma opção</p>}
      </div>
      {!compacto && campo.especifique && valor === true && (
        <textarea
          value={(respostas[`${campo.id}__detalhe`] as string) ?? ""}
          onChange={(e) => set(`${campo.id}__detalhe`, e.target.value)}
          placeholder={campo.especifiquePlaceholder ?? "Especifique"}
          rows={2}
          className={`${inputBase} mt-3`}
        />
      )}
    </div>
  );
}

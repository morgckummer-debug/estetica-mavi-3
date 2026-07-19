import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL, WHATSAPP_URL, WHATSAPP_DISPLAY, CITY } from "@/data/services";
import { CONTRATADA_NOME, CONTRATADA_CNPJ } from "@/data/contrato";

export const Route = createFileRoute("/politica-de-privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade | MAVI Centro de Estética" },
      {
        name: "description",
        content: "Como a MAVI Centro de Estética coleta, usa e protege seus dados pessoais.",
      },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/politica-de-privacidade` }],
  }),
  component: PoliticaDePrivacidade,
});

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="font-display text-2xl text-primary mb-3">{titulo}</h2>
      <div className="space-y-3 text-muted-foreground leading-relaxed">{children}</div>
    </section>
  );
}

function PoliticaDePrivacidade() {
  return (
    <section className="py-16 lg:py-24 px-6">
      <div className="mx-auto max-w-3xl">
        <h1 className="font-display text-4xl lg:text-5xl text-primary leading-tight mb-3">
          Política de <em className="italic font-normal">Privacidade</em>
        </h1>
        <p className="text-sm text-muted-foreground mb-12">Última atualização: julho de 2026.</p>

        <Secao titulo="Quem trata os seus dados">
          <p>
            Esta política se aplica aos dados coletados pela{" "}
            <strong>MAVI Centro de Estética</strong> ({CONTRATADA_NOME}, CNPJ {CONTRATADA_CNPJ}), em{" "}
            {CITY}, através deste site, das fichas de avaliação e do atendimento na clínica.
          </p>
        </Secao>

        <Secao titulo="Quais dados coletamos">
          <p>Dependendo de como você interage com a gente, coletamos:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <strong>Dados de identificação e contato:</strong> nome, CPF, data de nascimento,
              telefone/WhatsApp, e-mail e endereço.
            </li>
            <li>
              <strong>Dados de saúde:</strong> as respostas da ficha de avaliação (anamnese) sobre
              histórico de saúde, hábitos e condições relevantes para o seu atendimento —
              necessários para um procedimento seguro.
            </li>
            <li>
              <strong>Histórico de atendimento:</strong> sessões realizadas, medidas, fotos (só com
              sua autorização) e observações da Marina.
            </li>
          </ul>
        </Secao>

        <Secao titulo="Por que coletamos esses dados">
          <p>Usamos seus dados para:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Realizar sua avaliação e prestar o serviço estético com segurança;</li>
            <li>Manter seu histórico de atendimento e acompanhar sua evolução;</li>
            <li>Entrar em contato sobre seus tratamentos, sessões e confirmações;</li>
            <li>Emitir contratos e cumprir obrigações legais/fiscais.</li>
          </ul>
        </Secao>

        <Secao titulo="Base legal">
          <p>
            Tratamos seus dados com base no seu <strong>consentimento</strong> (que você dá ao
            preencher a ficha), na <strong>execução do contrato</strong> de prestação de serviço e,
            no caso dos dados de saúde, na <strong>tutela da sua saúde</strong>, conforme a Lei
            Geral de Proteção de Dados (LGPD, Lei 13.709/2018).
          </p>
        </Secao>

        <Secao titulo="Com quem compartilhamos">
          <p>
            Não vendemos nem compartilhamos seus dados para fins de marketing de terceiros. Seus
            dados ficam armazenados em um banco de dados protegido (Supabase), que atua só como
            infraestrutura técnica — sem acesso próprio às informações. Só a Marina, autenticada,
            consegue visualizar seus dados.
          </p>
        </Secao>

        <Secao titulo="Por quanto tempo guardamos seus dados">
          <p>
            Mantemos seus dados enquanto durar seu relacionamento com a clínica, e pelo prazo
            adicional exigido por obrigações legais (fiscais/contábeis). Você pode pedir a exclusão
            antes disso, a qualquer momento, conforme abaixo.
          </p>
        </Secao>

        <Secao titulo="Como protegemos seus dados">
          <p>
            Seus dados ficam num banco protegido, com acesso restrito só à Marina (login com senha)
            — o formulário público nunca consegue ler dados de outras clientes, só enviar os seus
            próprios.
          </p>
        </Secao>

        <Secao titulo="Seus direitos">
          <p>A qualquer momento, você pode pedir para:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Acessar os dados que temos sobre você;</li>
            <li>Corrigir dados incompletos ou desatualizados;</li>
            <li>Excluir seus dados;</li>
            <li>Retirar seu consentimento (para uso de imagem, por exemplo).</li>
          </ul>
        </Secao>

        <Secao titulo="Fale conosco">
          <p>
            Para exercer qualquer um desses direitos, ou tirar dúvidas sobre seus dados, fale
            diretamente com a Marina pelo WhatsApp:{" "}
            <a
              href={WHATSAPP_URL}
              target="whatsapp"
              rel="noreferrer"
              className="text-primary underline"
            >
              {WHATSAPP_DISPLAY}
            </a>
            .
          </p>
        </Secao>

        <Secao titulo="Alterações desta política">
          <p>
            Podemos atualizar esta política de tempos em tempos. A data da última atualização sempre
            aparece no topo desta página.
          </p>
        </Secao>
      </div>
    </section>
  );
}

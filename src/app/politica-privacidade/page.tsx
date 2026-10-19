import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "Política de Privacidade — C4 Person",
  description: "Política de privacidade e proteção de dados do C4 Person conforme a LGPD (Lei 13.709/2018).",
};

export default function PoliticaPrivacidadePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-white transition-colors mb-8"
        >
          <ArrowLeft size={16} />
          Voltar
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-white font-bold text-sm">
            C4
          </div>
          <span className="font-bold text-white text-lg">C4 Person</span>
        </div>

        <h1 className="text-3xl font-black text-white mb-2">Política de Privacidade</h1>
        <p className="text-muted-foreground text-sm mb-10">
          Última atualização: outubro de 2026 · Conforme a LGPD — Lei nº 13.709/2018
        </p>

        <div className="prose prose-invert prose-sm max-w-none space-y-8 text-white/80 leading-relaxed">

          <section>
            <h2 className="text-white font-bold text-lg mb-3">1. Quem somos</h2>
            <p>
              O <strong className="text-white">C4 Person</strong> é um aplicativo SaaS de produtividade pessoal
              desenvolvido e operado por <strong className="text-white">Lucas Gabriel Nunes Machado</strong>
              (MEI — CNPJ 61.982.836/0001-23), com sede em Goiânia – GO.
            </p>
            <p className="mt-2">
              Contato do encarregado (DPO):{" "}
              <a href="mailto:c4hub@c4os.com.br" className="text-primary hover:underline">
                c4hub@c4os.com.br
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">2. Dados que coletamos</h2>
            <ul className="list-disc list-inside space-y-2">
              <li><strong className="text-white">Cadastro:</strong> nome completo, e-mail, senha (hash), CPF e data de nascimento.</li>
              <li><strong className="text-white">Uso do app:</strong> tarefas, hábitos, metas, notas, dados financeiros que você insere.</li>
              <li><strong className="text-white">Pagamento:</strong> CPF é enviado ao processador ASAAS para emissão de cobrança. Não armazenamos dados de cartão.</li>
              <li><strong className="text-white">Técnicos:</strong> endereço IP, tipo de dispositivo, logs de acesso e cookies essenciais.</li>
              <li><strong className="text-white">Analytics (com consentimento):</strong> páginas visitadas e eventos de uso, sem identificação individual.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">3. Finalidade e base legal</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-white py-2 pr-4">Finalidade</th>
                    <th className="text-left text-white py-2">Base legal (LGPD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {[
                    ["Autenticação e acesso à conta", "Execução de contrato (art. 7º, V)"],
                    ["Processamento de pagamentos", "Execução de contrato (art. 7º, V)"],
                    ["Armazenamento dos dados do app", "Execução de contrato (art. 7º, V)"],
                    ["Envio de e-mails transacionais", "Execução de contrato (art. 7º, V)"],
                    ["Prevenção a fraudes", "Legítimo interesse (art. 7º, IX)"],
                    ["Analytics de uso", "Consentimento (art. 7º, I)"],
                  ].map(([fin, base]) => (
                    <tr key={fin}>
                      <td className="py-2 pr-4">{fin}</td>
                      <td className="py-2 text-muted-foreground">{base}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">4. Compartilhamento de dados</h2>
            <p>Seus dados são compartilhados <strong className="text-white">apenas</strong> com:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li><strong className="text-white">Supabase</strong> (banco de dados e autenticação) — servidores na AWS us-east-1.</li>
              <li><strong className="text-white">ASAAS</strong> (processamento de pagamentos) — empresa brasileira regulada pelo Banco Central.</li>
              <li><strong className="text-white">Vercel</strong> (hospedagem da aplicação) — servidores no Brasil/EUA.</li>
            </ul>
            <p className="mt-2">Não vendemos nem alugamos dados a terceiros.</p>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">5. Cookies</h2>
            <p>Utilizamos dois tipos de cookies:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li><strong className="text-white">Essenciais:</strong> necessários para login e funcionamento do app. Não requerem consentimento.</li>
              <li><strong className="text-white">Analytics:</strong> coletam dados de uso de forma agregada e anônima. Ativados somente com seu consentimento.</li>
            </ul>
            <p className="mt-2">
              Você pode alterar suas preferências a qualquer momento limpando os dados do site no navegador.
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">6. Seus direitos (LGPD art. 18)</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Confirmar a existência de tratamento</li>
              <li>Acessar seus dados</li>
              <li>Corrigir dados incompletos ou desatualizados</li>
              <li>Solicitar anonimização, bloqueio ou eliminação</li>
              <li>Portabilidade dos dados</li>
              <li>Revogar consentimento a qualquer momento</li>
            </ul>
            <p className="mt-3">
              Para exercer seus direitos, envie e-mail para{" "}
              <a href="mailto:c4hub@c4os.com.br" className="text-primary hover:underline">
                c4hub@c4os.com.br
              </a>{" "}
              com o assunto <em>"LGPD — Meus Dados"</em>. Respondemos em até 15 dias úteis.
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">7. Retenção de dados</h2>
            <p>
              Mantemos seus dados enquanto sua conta estiver ativa. Após o encerramento da conta,
              os dados são excluídos em até 90 dias, exceto quando houver obrigação legal de retenção
              (ex.: dados fiscais — 5 anos, conforme legislação tributária).
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">8. Segurança</h2>
            <p>
              Adotamos criptografia em trânsito (TLS 1.2+), senhas armazenadas como hash (bcrypt),
              acesso ao banco de dados restrito por roles e monitoramento de acessos.
              Em caso de incidente de segurança, notificaremos a ANPD e os titulares afetados
              conforme exigido pela LGPD.
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">9. Menores de idade</h2>
            <p>
              O C4 Person não é destinado a menores de 18 anos. Não coletamos intencionalmente
              dados de menores. Se identificarmos tal situação, excluiremos os dados imediatamente.
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">10. Alterações nesta política</h2>
            <p>
              Podemos atualizar esta política periodicamente. Alterações relevantes serão comunicadas
              por e-mail ou via notificação no app com antecedência mínima de 15 dias.
            </p>
          </section>

          <section>
            <h2 className="text-white font-bold text-lg mb-3">11. Contato e DPO</h2>
            <p>
              Dúvidas ou solicitações relacionadas à privacidade:
            </p>
            <address className="not-italic mt-2 space-y-1">
              <p><strong className="text-white">C4 Person / C4Hub</strong></p>
              <p>
                <a href="mailto:c4hub@c4os.com.br" className="text-primary hover:underline">
                  c4hub@c4os.com.br
                </a>
              </p>
              <p>Goiânia – GO, Brasil</p>
            </address>
          </section>
        </div>
      </div>
    </div>
  );
}

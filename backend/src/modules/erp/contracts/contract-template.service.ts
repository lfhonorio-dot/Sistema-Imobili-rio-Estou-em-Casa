// Gerador de contrato HTML baseado no modelo oficial de Compromisso de Compra e Venda

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ContractTemplateService {
  constructor(private prisma: PrismaService) {}

  private fmt(value: unknown): string {
    if (!value) return '______________';
    return String(value);
  }

  private fmtCurrency(value: unknown): string {
    if (!value) return 'R$ ______________';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
  }

  private fmtDate(d: unknown): string {
    if (!d) return '______________';
    return new Date(d as string).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
  }

  private fmtArea(v: unknown): string {
    if (!v) return '______';
    return `${Number(v).toLocaleString('pt-BR')} m²`;
  }

  async generateSaleContract(workspaceId: string, contractId: string): Promise<string> {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, workspaceId, deletedAt: null },
      include: {
        property: true,
        owner: true,
        tenant: true,
      },
    });

    if (!contract) throw new Error('Contrato não encontrado');

    const owner = contract.owner as any;
    const buyer = contract.tenant as any;
    const prop = contract.property as any;

    const ownerName = this.fmt(owner?.name);
    const ownerCpf = this.fmt(owner?.cpf ? '***.***.***-**' : null); // LGPD: mascarado
    const ownerCity = this.fmt(owner?.city);
    const ownerState = this.fmt(owner?.state);
    const ownerAddress = owner?.street
      ? `${owner.street}${owner.number ? ', ' + owner.number : ''}${owner.neighborhood ? ' - ' + owner.neighborhood : ''}, ${ownerCity}/${ownerState}`
      : `${ownerCity}/${ownerState}`;

    const buyerName = this.fmt(buyer?.name);
    const buyerCpf = this.fmt(buyer?.cpf ? '***.***.***-**' : null);
    const buyerCity = this.fmt(buyer?.city);
    const buyerState = this.fmt(buyer?.state);
    const buyerAddress = buyer?.street
      ? `${buyer.street}${buyer.number ? ', ' + buyer.number : ''}${buyer.neighborhood ? ' - ' + buyer.neighborhood : ''}, ${buyerCity}/${buyerState}`
      : `${buyerCity}/${buyerState}`;

    const propAddress = [prop?.street, prop?.number].filter(Boolean).join(', ') || '______________';
    const propNeighborhood = this.fmt(prop?.neighborhood);
    const propCity = this.fmt(prop?.city);
    const propState = this.fmt(prop?.state);
    const propArea = this.fmtArea(prop?.totalArea);
    const propRegistration = this.fmt(prop?.registrationNumber);
    const propIptu = this.fmt(prop?.iptuNumber);

    const saleValue = this.fmtCurrency(contract.saleValue);
    const commissionRate = contract.commissionRate ? `${Number(contract.commissionRate)}%` : '______________';
    const startDate = this.fmtDate(contract.startDate);
    const deedDate = this.fmtDate(contract.deedDate ?? contract.endDate);
    const contractDate = this.fmtDate(contract.createdAt);
    const paymentMethod = contract.paymentMethod === 'FINANCING'
      ? 'recursos próprios, FGTS e crédito imobiliário junto à Caixa Econômica Federal'
      : contract.paymentMethod === 'INSTALLMENT'
        ? 'parcelamento conforme acordado entre as partes'
        : 'recursos próprios à vista';

    const customClauses = contract.customClauses
      ? `<h2 class="clause-title">CLÁUSULAS ADICIONAIS</h2><p class="clause-text">${contract.customClauses}</p>`
      : '';

    const notes = contract.notes
      ? `<p class="obs"><strong>Observações:</strong> ${contract.notes}</p>`
      : '';

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Compromisso de Compra e Venda — ${prop?.code ?? contractId}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 12pt;
    color: #000;
    max-width: 800px;
    margin: 0 auto;
    padding: 40px 60px;
    line-height: 1.6;
  }
  .header {
    text-align: center;
    margin-bottom: 32px;
  }
  .header h1 {
    font-size: 14pt;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
  }
  .header .valor {
    font-size: 13pt;
    font-weight: bold;
  }
  .preambulo {
    text-align: justify;
    margin-bottom: 24px;
  }
  .clause-title {
    font-size: 12pt;
    font-weight: bold;
    text-transform: uppercase;
    margin-top: 24px;
    margin-bottom: 8px;
  }
  .clause-text {
    text-align: justify;
    margin-bottom: 8px;
  }
  .paragrafo {
    text-align: justify;
    margin-top: 8px;
    margin-bottom: 8px;
    padding-left: 32px;
  }
  .bold { font-weight: bold; }
  .underline { text-decoration: underline; }
  .assinaturas {
    margin-top: 60px;
  }
  .ass-linha {
    display: flex;
    justify-content: space-around;
    margin-top: 40px;
    gap: 40px;
  }
  .ass-bloco {
    flex: 1;
    text-align: center;
  }
  .ass-linha-texto {
    border-top: 1px solid #000;
    padding-top: 4px;
    font-size: 11pt;
  }
  .testemunhas {
    margin-top: 40px;
  }
  .footer-doc {
    margin-top: 40px;
    font-size: 9pt;
    color: #666;
    border-top: 1px solid #ccc;
    padding-top: 8px;
    text-align: center;
  }
  .obs { margin-top: 16px; font-style: italic; }
  @media print {
    body { padding: 20px 40px; }
    .footer-doc { display: none; }
  }
</style>
</head>
<body>

<div class="header">
  <h1>Instrumento Particular de Compromisso de Compra e Venda</h1>
  <div class="valor">${saleValue}</div>
</div>

<p class="preambulo">
  Pelo presente instrumento particular de compromisso de compra e venda e na melhor forma de direito,
  que entre si fazem: de um lado, como <span class="bold">COMPROMITENTE VENDEDOR</span>:
</p>

<p class="clause-text">
  <span class="bold">${ownerName}</span>, brasileiro(a), residente e domiciliado(a) na
  ${ownerAddress}, inscrito(a) no CPF/MF sob o n.º ${ownerCpf},
  doravante denominado(a) simplesmente como <span class="bold">"VENDEDOR"</span>;
  e de outro, como <span class="bold">COMPROMISSÁRIO(A) COMPRADOR(A)</span>:
</p>

<p class="clause-text">
  <span class="bold">${buyerName}</span>, brasileiro(a), residente e domiciliado(a) na
  ${buyerAddress}, inscrito(a) no CPF/MF sob o n.º ${buyerCpf},
  doravante denominado(a) simplesmente como <span class="bold">"COMPRADOR(A)"</span>.
</p>

<p class="preambulo" style="margin-top:16px;">
  As partes acima qualificadas têm entre si como justos e contratados o que segue:
</p>

<h2 class="clause-title">Cláusula 1ª — Do Objeto</h2>
<p class="clause-text">
  Por meio deste instrumento particular, o <span class="bold">VENDEDOR</span> compromete-se a vender
  ao <span class="bold">COMPRADOR(A)</span> o imóvel adiante descrito, que deste se compromete a
  adquiri-lo, em caráter <em>Ad Corpus</em> e no estado em que se encontra, mediante as cláusulas e
  condições seguintes.
</p>
<p class="clause-text">
  O <span class="bold">VENDEDOR</span> declara, sob responsabilidade civil e criminal, ser senhor e
  legítimo possuidor/proprietário, livre de impostos e taxas em atraso de qualquer natureza, do
  seguinte imóvel: <span class="bold">${propAddress}</span>, situado no bairro
  <span class="bold">${propNeighborhood}</span>, na cidade de
  <span class="bold">${propCity}/${propState}</span>, com área de
  <span class="bold">${propArea}</span>${propRegistration && propRegistration !== '______________' ? `, objeto da matrícula n.º <span class="bold">${propRegistration}</span>` : ''}${propIptu && propIptu !== '______________' ? `, cadastro municipal (IPTU) n.º <span class="bold">${propIptu}</span>` : ''}.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo único:</span> As dimensões do imóvel são meramente enunciativas, consagrando os
  contratantes o negócio como sendo <em>Ad Corpus</em>, ou seja, do imóvel como um todo,
  independentemente de suas exatas limitações, não podendo, por conseguinte, o
  <span class="bold">COMPRADOR(A)</span> exigir complemento de área, reclamar rescisão ou abatimento
  proporcional do preço.
</p>

<h2 class="clause-title">Cláusula 2ª — Do Preço e Forma de Pagamento</h2>
<p class="clause-text">
  O <span class="bold">VENDEDOR</span> compromete-se a vender o imóvel ao
  <span class="bold">COMPRADOR(A)</span> pelo preço total, certo e ajustado de
  <span class="bold">${saleValue}</span>, que será pago por meio de
  <span class="bold">${paymentMethod}</span>.
</p>
${contract.paymentMethod === 'FINANCING' ? `
<p class="paragrafo">
  <span class="bold">Parágrafo 1.º:</span> O COMPRADOR(A) deverá protocolar junto ao agente financeiro toda
  a documentação exigida no prazo máximo de 90 (noventa) dias contados da assinatura deste instrumento,
  correndo por sua conta as taxas bancárias necessárias à aprovação do financiamento.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo 2.º:</span> O prazo definido no parágrafo anterior será prorrogado pelo mesmo
  número de dias de eventual atraso na entrega dos documentos por parte do VENDEDOR, caso o atraso
  seja causado por este.
</p>
` : ''}

<h2 class="clause-title">Cláusula 3ª — Da Documentação</h2>
<p class="clause-text">
  Para o bom andamento do negócio, compromete-se o <span class="bold">VENDEDOR</span> a apresentar,
  quando solicitado, a seguinte documentação:
</p>
<ul style="margin-left:32px;margin-bottom:8px;">
  <li>Cópia autenticada do RG e CPF;</li>
  <li>Cópia autenticada do comprovante de estado civil;</li>
  <li>Cópia autenticada de comprovante de residência atual;</li>
  <li>Certidão Negativa de Débitos de Tributos e Contribuições Federais;</li>
  <li>Certidão de inteiro teor da matrícula atualizada com negativa de ônus;</li>
  <li>Cópia da folha de rosto do carnê de IPTU do exercício corrente;</li>
  <li>Certidão Negativa de Débitos Municipais.</li>
</ul>

<h2 class="clause-title">Cláusula 4ª — Da Posse</h2>
<p class="clause-text">
  O <span class="bold">VENDEDOR</span> transferirá a posse do imóvel livre e desimpedido de coisas e
  pessoas ao <span class="bold">COMPRADOR(A)</span>
  ${contract.deedDate ? `no ato da escrituração definitiva, prevista para ${deedDate}` : 'na data estabelecida de comum acordo entre as partes'}.
  Caso não o faça, incorrerá em multa diária no valor de R$ 100,00 (cem reais).
</p>

<h2 class="clause-title">Cláusula 5ª — Das Despesas</h2>
<p class="clause-text">
  Correrão por conta do <span class="bold">COMPRADOR(A)</span> todas as despesas com o contrato,
  escritura pública, ITBI e posterior registro junto ao Cartório de Registro de Imóveis.
  As despesas com a averbação de eventuais diferenças junto ao Cartório de Registro de Imóveis
  correrão por conta exclusiva do <span class="bold">VENDEDOR</span>.
</p>

<h2 class="clause-title">Cláusula 6ª — Dos Tributos</h2>
<p class="clause-text">
  Todos os impostos, taxas, tarifas, multas, contribuições ou qualquer outro tributo incidente sobre o
  imóvel, até a data da posse, correm por conta do <span class="bold">VENDEDOR</span>, ficando por conta
  do <span class="bold">COMPRADOR(A)</span> o que for devido a partir da data da posse em diante,
  mesmo que ainda lançados em nome do <span class="bold">VENDEDOR</span>.
</p>

<h2 class="clause-title">Cláusula 7ª — Da Irretratabilidade</h2>
<p class="clause-text">
  Os contratantes renunciam expressamente a qualquer direito de arrependimento, sendo, portanto,
  obrigatória a outorga e aceitação da escritura, desde que cumpridas todas as exigências deste
  instrumento. Em caso de rescisão por culpa de qualquer das partes, a parte infratora pagará à outra
  a multa equivalente a 10% (dez por cento) do valor total do negócio.
</p>

${commissionRate !== '______________' ? `
<h2 class="clause-title">Cláusula 8ª — Da Comissão de Corretagem</h2>
<p class="clause-text">
  A comissão de corretagem, no percentual de <span class="bold">${commissionRate}</span> sobre o
  valor total da transação, será devida nos termos da legislação vigente (Lei n.º 6.530/78).
</p>
` : ''}

<h2 class="clause-title">Cláusula ${commissionRate !== '______________' ? '9ª' : '8ª'} — Do Foro</h2>
<p class="clause-text">
  As partes elegem o foro da comarca de <span class="bold">${propCity}/${propState}</span> para
  dirimir quaisquer controvérsias oriundas do presente instrumento, com renúncia expressa a qualquer
  outro, por mais privilegiado que seja.
</p>

${customClauses}
${notes}

<p class="clause-text" style="margin-top:24px;">
  E por estarem assim justos e contratados, firmam o presente instrumento em 02 (duas) vias de igual
  teor e forma, na presença das testemunhas abaixo.
</p>

<p class="clause-text" style="text-align:right;margin-top:16px;">
  ${propCity}, ${contractDate}.
</p>

<div class="assinaturas">
  <div class="ass-linha">
    <div class="ass-bloco">
      <div class="ass-linha-texto">
        <strong>${ownerName}</strong><br>
        VENDEDOR<br>
        CPF: ${ownerCpf}
      </div>
    </div>
    <div class="ass-bloco">
      <div class="ass-linha-texto">
        <strong>${buyerName}</strong><br>
        COMPRADOR(A)<br>
        CPF: ${buyerCpf}
      </div>
    </div>
  </div>
</div>

<div class="testemunhas">
  <p style="margin-bottom:8px;font-weight:bold;">Testemunhas:</p>
  <div class="ass-linha">
    <div class="ass-bloco">
      <div class="ass-linha-texto">
        Nome: __________________________<br>
        CPF: ___________________________
      </div>
    </div>
    <div class="ass-bloco">
      <div class="ass-linha-texto">
        Nome: __________________________<br>
        CPF: ___________________________
      </div>
    </div>
  </div>
</div>

<div class="footer-doc">
  Contrato gerado automaticamente · Código ${prop?.code ?? contractId} · ${new Date().toLocaleString('pt-BR')}
</div>

</body>
</html>`;
  }
}

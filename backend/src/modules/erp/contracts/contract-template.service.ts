// Gerador de contratos HTML — modelos oficiais (Compra e Venda e Locação)
// com cláusulas de split de pagamento e DIMOB.

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
    if (value === null || value === undefined || Number(value) === 0) return 'R$ ______________';
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

  private fmtPct(v: unknown): string {
    if (v === null || v === undefined) return '____%';
    return `${Number(v)}%`;
  }

  // Envelope HTML compartilhado (CSS + estrutura)
  private shell(title: string, body: string): string {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; color: #000; max-width: 800px; margin: 0 auto; padding: 40px 60px; line-height: 1.6; }
  .header { text-align: center; margin-bottom: 32px; }
  .header h1 { font-size: 14pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
  .header .valor { font-size: 13pt; font-weight: bold; }
  .preambulo { text-align: justify; margin-bottom: 24px; }
  .clause-title { font-size: 12pt; font-weight: bold; text-transform: uppercase; margin-top: 24px; margin-bottom: 8px; }
  .clause-text { text-align: justify; margin-bottom: 8px; }
  .paragrafo { text-align: justify; margin-top: 8px; margin-bottom: 8px; padding-left: 32px; }
  ul.clause-text { padding-left: 40px; }
  .bold { font-weight: bold; }
  .assinaturas { margin-top: 60px; }
  .ass-linha { display: flex; justify-content: space-around; margin-top: 40px; gap: 40px; }
  .ass-bloco { flex: 1; text-align: center; }
  .ass-linha-texto { border-top: 1px solid #000; padding-top: 4px; font-size: 11pt; }
  .testemunhas { margin-top: 40px; }
  .footer-doc { margin-top: 40px; font-size: 9pt; color: #666; border-top: 1px solid #ccc; padding-top: 8px; text-align: center; }
  .obs { margin-top: 16px; font-style: italic; }
  @media print { body { padding: 20px 40px; } .footer-doc { display: none; } }
</style>
</head>
<body>
${body}
<div class="footer-doc">Documento gerado eletronicamente pela Plataforma Imobiliária.</div>
</body>
</html>`;
  }

  // Busca contrato + imobiliária (workspace) + config fiscal + regras de split
  private async loadData(workspaceId: string, contractId: string) {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, workspaceId, deletedAt: null },
      include: {
        property: true,
        owner: true,
        tenant: true,
        splitRules: {
          where: { isActive: true },
          include: { recipient: { select: { name: true, document: true, documentType: true } } },
        },
      },
    });
    if (!contract) throw new Error('Contrato não encontrado');

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true, cnpj: true },
    });
    const taxConfig = await this.prisma.taxConfig.findFirst({
      where: { workspaceId },
      select: { cnpj: true, inscricaoMunicipal: true },
    }).catch(() => null);

    return { contract, workspace, taxConfig };
  }

  // Bloco de split (parágrafo 2º): lista beneficiários com % e valor
  private buildSplitBeneficiaries(splitRules: any[], commissionAmount: number, imobiliaria: { name: string; cnpj: string }) {
    let partnersPct = 0;
    const partnerLines = splitRules.map((r) => {
      const pct = Number(r.value);
      partnersPct += pct;
      const valor = (commissionAmount * pct) / 100;
      const doc = r.recipient?.document ? `${r.recipient.documentType ?? 'CPF/CNPJ'} n.º ${r.recipient.document}` : 'CPF/CNPJ n.º ______________';
      return `<li>${this.fmtCurrency(valor)} (${pct}% da comissão) ao CORRETOR PARCEIRO <span class="bold">${this.fmt(r.recipient?.name)}</span>, ${doc}, em conta bancária de sua titularidade;</li>`;
    }).join('');
    const agencyPct = Math.max(0, 100 - partnersPct);
    const agencyValor = (commissionAmount * agencyPct) / 100;
    const agencyLine = `<li>${this.fmtCurrency(agencyValor)} (${agencyPct}% da comissão) à IMOBILIÁRIA <span class="bold">${imobiliaria.name}</span>, CNPJ n.º ${imobiliaria.cnpj}, em conta bancária de sua titularidade;</li>`;
    return { partnerLines, agencyLine, agencyPct, agencyValor, partnersPct };
  }

  // ─────────────────────────────────────────────────────────────
  // Roteia pelo tipo de contrato
  async generate(workspaceId: string, contractId: string): Promise<string> {
    const { contract } = await this.loadData(workspaceId, contractId);
    if (contract.type === 'RENTAL_RESIDENTIAL' || contract.type === 'RENTAL_COMMERCIAL') {
      return this.generateRentalContract(workspaceId, contractId);
    }
    return this.generateSaleContract(workspaceId, contractId);
  }

  // ─────────────────────────────────────────────────────────────
  // CONTRATO DE COMPRA E VENDA (com split + DIMOB)
  async generateSaleContract(workspaceId: string, contractId: string): Promise<string> {
    const { contract, workspace, taxConfig } = await this.loadData(workspaceId, contractId);

    const owner = contract.owner as any;
    const buyer = contract.tenant as any;
    const prop = contract.property as any;

    const imobiliaria = {
      name: workspace?.name ?? '______________',
      cnpj: workspace?.cnpj ?? taxConfig?.cnpj ?? '______________',
    };

    const ownerName = this.fmt(owner?.name);
    const ownerCpf = this.fmt(owner?.cpf ? '***.***.***-**' : null);
    const ownerAddress = owner?.street
      ? `${owner.street}${owner.number ? ', ' + owner.number : ''}, ${this.fmt(owner?.city)}/${this.fmt(owner?.state)}`
      : `${this.fmt(owner?.city)}/${this.fmt(owner?.state)}`;

    const buyerName = this.fmt(buyer?.name);
    const buyerCpf = this.fmt(buyer?.cpf ? '***.***.***-**' : null);
    const buyerAddress = buyer?.street
      ? `${buyer.street}${buyer.number ? ', ' + buyer.number : ''}, ${this.fmt(buyer?.city)}/${this.fmt(buyer?.state)}`
      : `${this.fmt(buyer?.city)}/${this.fmt(buyer?.state)}`;

    const propAddress = [prop?.street, prop?.number].filter(Boolean).join(', ') || '______________';
    const propCity = this.fmt(prop?.city);
    const propState = this.fmt(prop?.state);
    const propArea = this.fmtArea(prop?.totalArea);
    const propRegistration = this.fmt(prop?.registrationNumber);

    const saleValue = this.fmtCurrency(contract.saleValue);
    const commissionRateStr = contract.commissionRate ? this.fmtPct(contract.commissionRate) : '____%';
    const commissionAmount = contract.saleValue && contract.commissionRate
      ? (Number(contract.saleValue) * Number(contract.commissionRate)) / 100
      : 0;
    const contractDate = this.fmtDate(contract.createdAt);
    const paymentMethod = contract.paymentMethod === 'FINANCING'
      ? 'recursos próprios, FGTS e crédito imobiliário obtido junto ao agente financeiro'
      : contract.paymentMethod === 'INSTALLMENT'
        ? 'parcelamento conforme acordado entre as partes'
        : 'recursos próprios à vista';

    const splitRules = (contract as any).splitRules ?? [];
    const { partnerLines, agencyLine } = this.buildSplitBeneficiaries(splitRules, commissionAmount, imobiliaria);
    const partnersNames = splitRules.length
      ? splitRules.map((r: any) => this.fmt(r.recipient?.name)).join(', ')
      : '______________';

    const customClauses = contract.customClauses
      ? `<h2 class="clause-title">Cláusulas Adicionais</h2><p class="clause-text">${contract.customClauses}</p>` : '';
    const notes = contract.notes ? `<p class="obs"><strong>Observações:</strong> ${contract.notes}</p>` : '';

    const body = `
<div class="header">
  <h1>Instrumento Particular de Compromisso de Compra e Venda</h1>
  <div class="valor">${saleValue}</div>
</div>

<p class="preambulo">
  Pelo presente instrumento particular de compromisso de compra e venda e na melhor forma de direito, que
  entre si fazem: de um lado, como <span class="bold">COMPROMITENTE VENDEDOR</span>:
</p>
<p class="clause-text">
  <span class="bold">${ownerName}</span>, brasileiro(a), residente e domiciliado(a) na ${ownerAddress},
  inscrito(a) no CPF/MF sob o n.º ${ownerCpf}, doravante designado(a) simplesmente como
  <span class="bold">"VENDEDOR"</span>; e de outro, como <span class="bold">COMPROMISSÁRIO(A) COMPRADOR(A)</span>:
</p>
<p class="clause-text">
  <span class="bold">${buyerName}</span>, brasileiro(a), residente e domiciliado(a) na ${buyerAddress},
  inscrito(a) no CPF/MF sob o n.º ${buyerCpf}, doravante designado(a) simplesmente como
  <span class="bold">"COMPRADOR(A)"</span>. As partes acima qualificadas têm entre si como justos e
  contratados o que segue:
</p>

<h2 class="clause-title">Cláusula 1ª — Do Objeto</h2>
<p class="clause-text">
  O <span class="bold">VENDEDOR</span> compromete-se a vender ao <span class="bold">COMPRADOR(A)</span>, em
  caráter "Ad Corpus" e no estado em que se encontra, o imóvel situado na ${propAddress}, na cidade de
  ${propCity}/${propState}, com área de ${propArea}, objeto da matrícula n.º ${propRegistration}, do qual
  o VENDEDOR declara ser legítimo possuidor/proprietário, livre de impostos e taxas em atraso.
</p>

<h2 class="clause-title">Cláusula 2ª — Do Preço e da Forma de Pagamento</h2>
<p class="clause-text">
  O preço total, certo e ajustado da presente venda é de <span class="bold">${saleValue}</span>, a ser pago
  através de ${paymentMethod}, na forma acordada entre as partes.
</p>

<h2 class="clause-title">Cláusula 3ª — Da Documentação</h2>
<p class="clause-text">
  O <span class="bold">VENDEDOR</span> compromete-se a apresentar toda a documentação pessoal e do imóvel
  exigida para a lavratura da escritura e/ou aprovação de financiamento, incluindo certidões negativas,
  matrícula atualizada e comprovantes fiscais do imóvel.
</p>

<h2 class="clause-title">Cláusula 4ª — Da Posse</h2>
<p class="clause-text">
  A posse do imóvel será transmitida livre e desimpedida de coisas e pessoas ao COMPRADOR(A) no ato da
  liquidação financeira da presente venda.
</p>

<h2 class="clause-title">Cláusula 5ª — Das Despesas</h2>
<p class="clause-text">
  Correrão por conta do <span class="bold">COMPRADOR(A)</span> todas as despesas com o contrato/escritura,
  ITBI e registro junto ao Cartório de Registro de Imóveis competente.
</p>

<h2 class="clause-title">Cláusula 6ª — Dos Tributos</h2>
<p class="clause-text">
  Todos os tributos incidentes sobre o imóvel até a data da posse correm por conta do VENDEDOR, ficando por
  conta do COMPRADOR(A) o que for devido a partir da posse em diante.
</p>

<h2 class="clause-title">Cláusula 7ª — Da Irretratabilidade</h2>
<p class="clause-text">
  O presente instrumento é celebrado em caráter <span class="bold">IRREVOGÁVEL e IRRETRATÁVEL</span>. Em caso
  de rescisão por culpa de qualquer das partes, a parte infratora pagará à outra a multa equivalente a 10%
  (dez por cento) do valor total do negócio.
</p>

<h2 class="clause-title">Cláusula 8ª — Da Intermediação, da Comissão de Corretagem e do Split de Pagamento</h2>
<p class="clause-text">
  A intermediação da presente compra e venda foi realizada por <span class="bold">${imobiliaria.name}</span>,
  pessoa jurídica inscrita no CNPJ sob n.º ${imobiliaria.cnpj} e registrada no CRECI sob n.º ______________
  ("IMOBILIÁRIA"), com a participação do(s) corretor(es) parceiro(s) <span class="bold">${partnersNames}</span>
  ("CORRETOR(ES) PARCEIRO(S)"), aos quais é devida comissão de corretagem no valor total de
  <span class="bold">${this.fmtCurrency(commissionAmount)}</span>, correspondente a
  <span class="bold">${commissionRateStr}</span> sobre o valor da venda, nos termos do art. 725 do Código Civil.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo primeiro</span> — A parcela do preço correspondente à comissão será paga
  diretamente à IMOBILIÁRIA e ao(s) CORRETOR(ES) PARCEIRO(S), simultaneamente à liquidação financeira da
  venda, mediante mecanismo de divisão automática de pagamento ("split de pagamento") operado por instituição
  de pagamento autorizada pelo Banco Central do Brasil, sem que os valores destinados à comissão transitem
  pela conta da parte pagadora ou de terceiros, o que desde já é expressamente autorizado por todas as partes.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo segundo</span> — Os valores e beneficiários do split de pagamento são os seguintes:
</p>
<ul class="clause-text">
  ${agencyLine}
  ${partnerLines || '<li>______________</li>'}
</ul>
<p class="paragrafo">
  Qualquer alteração desses valores ou beneficiários deverá ser formalizada por aditivo escrito, assinado por
  todas as partes, antes da liquidação financeira da venda.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo terceiro</span> — A autorização de pagamento direto configura indicação de
  pagamento a terceiro determinado, não implicando novação, cessão de crédito autônoma nem alteração do preço
  total, permanecendo os beneficiários como credores diretos e exclusivos dos respectivos valores a partir da
  liquidação via split.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo quarto</span> — A IMOBILIÁRIA e o(s) CORRETOR(ES) PARCEIRO(S), cada qual em
  relação à sua parcela, obrigam-se a: (i) emitir a respectiva nota fiscal de serviços ou recibo de pagamento
  a autônomo (RPA) correspondente ao valor efetivamente recebido; (ii) responder individualmente pelos tributos
  incidentes sobre sua própria receita de comissão, inclusive ISS e Imposto de Renda; e (iii) fornecer à
  IMOBILIÁRIA os documentos necessários ao cumprimento das obrigações acessórias.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo quinto</span> — Na eventualidade de indisponibilidade ou falha do mecanismo de
  split no momento da liquidação, o valor da comissão será retido pela parte pagadora e repassado à IMOBILIÁRIA
  e ao(s) CORRETOR(ES) PARCEIRO(S) no prazo de até 2 (dois) dias úteis, observadas as mesmas proporções e
  beneficiários acima.
</p>

<h2 class="clause-title">Cláusula 9ª — Da Declaração de Informações sobre Atividades Imobiliárias (DIMOB)</h2>
<p class="clause-text">
  Sem prejuízo do pagamento direto realizado por meio do split, a presente intermediação será informada,
  individualmente, pela IMOBILIÁRIA e, quando aplicável, por cada CORRETOR PARCEIRO pessoa jurídica, na DIMOB
  referente ao ano-calendário de celebração deste instrumento, nos termos da Instrução Normativa RFB n.º
  1.115/2010, cabendo a cada declarante informar exclusivamente o valor da venda e a parcela da comissão
  correspondente à sua respectiva participação.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo único</span> — Caso o CORRETOR PARCEIRO atue como pessoa física autônoma, sem
  inscrição em CNPJ, a integralidade do valor da venda e da comissão, incluindo a parcela a ele destinada por
  split, será declarada pela IMOBILIÁRIA na DIMOB correspondente, não sendo o corretor autônomo declarante da DIMOB.
</p>

<h2 class="clause-title">Cláusula 10ª — Do Foro</h2>
<p class="clause-text">
  As partes elegem o foro da comarca de <span class="bold">${propCity}/${propState}</span> para dirimir
  quaisquer controvérsias oriundas do presente instrumento, com renúncia expressa a qualquer outro.
</p>

${customClauses}
${notes}

<p class="clause-text" style="margin-top:24px;">
  E por estarem assim justos e contratados, firmam o presente instrumento em 03 (três) vias de igual teor e
  forma, na presença das testemunhas abaixo.
</p>
<p class="clause-text" style="text-align:right;margin-top:16px;">${propCity}, ${contractDate}.</p>

<div class="assinaturas">
  <div class="ass-linha">
    <div class="ass-bloco"><div class="ass-linha-texto"><strong>${ownerName}</strong><br>VENDEDOR<br>CPF: ${ownerCpf}</div></div>
    <div class="ass-bloco"><div class="ass-linha-texto"><strong>${buyerName}</strong><br>COMPRADOR(A)<br>CPF: ${buyerCpf}</div></div>
  </div>
  <div class="ass-linha">
    <div class="ass-bloco"><div class="ass-linha-texto"><strong>${imobiliaria.name}</strong><br>IMOBILIÁRIA<br>CNPJ: ${imobiliaria.cnpj}</div></div>
  </div>
</div>

<div class="testemunhas">
  <p style="margin-bottom:8px;font-weight:bold;">Testemunhas:</p>
  <div class="ass-linha">
    <div class="ass-bloco"><div class="ass-linha-texto">Nome: __________________________<br>CPF: ___________________________</div></div>
    <div class="ass-bloco"><div class="ass-linha-texto">Nome: __________________________<br>CPF: ___________________________</div></div>
  </div>
</div>`;

    return this.shell(`Compra e Venda — ${prop?.code ?? contractId}`, body);
  }

  // ─────────────────────────────────────────────────────────────
  // CONTRATO DE LOCAÇÃO RESIDENCIAL (com split + DIMOB)
  async generateRentalContract(workspaceId: string, contractId: string): Promise<string> {
    const { contract, workspace, taxConfig } = await this.loadData(workspaceId, contractId);

    const owner = contract.owner as any;   // LOCADOR
    const tenant = contract.tenant as any; // LOCATÁRIO
    const prop = contract.property as any;

    const imobiliaria = {
      name: workspace?.name ?? '______________',
      cnpj: workspace?.cnpj ?? taxConfig?.cnpj ?? '______________',
    };

    const locName = this.fmt(owner?.name);
    const locCpf = this.fmt(owner?.cpf ? '***.***.***-**' : null);
    const locAddress = owner?.street ? `${owner.street}${owner.number ? ', ' + owner.number : ''}, ${this.fmt(owner?.city)}/${this.fmt(owner?.state)}` : `${this.fmt(owner?.city)}/${this.fmt(owner?.state)}`;
    const tenName = this.fmt(tenant?.name);
    const tenCpf = this.fmt(tenant?.cpf ? '***.***.***-**' : null);

    const propAddress = [prop?.street, prop?.number].filter(Boolean).join(', ') || '______________';
    const propCity = this.fmt(prop?.city);
    const propState = this.fmt(prop?.state);
    const propRegistration = this.fmt(prop?.registrationNumber);

    const rentalValue = this.fmtCurrency(contract.rentalValue);
    const dueDay = contract.dueDay ? String(contract.dueDay) : '____';
    const adminRateStr = contract.commissionRate ? this.fmtPct(contract.commissionRate) : '____%';
    const adminAmount = contract.rentalValue && contract.commissionRate
      ? (Number(contract.rentalValue) * Number(contract.commissionRate)) / 100
      : 0;
    const startDate = this.fmtDate(contract.startDate);
    const endDate = this.fmtDate(contract.endDate);
    const contractDate = this.fmtDate(contract.createdAt);

    const splitRules = (contract as any).splitRules ?? [];
    const { partnerLines, agencyLine } = this.buildSplitBeneficiaries(splitRules, adminAmount, imobiliaria);

    const customClauses = contract.customClauses ? `<h2 class="clause-title">Cláusulas Adicionais</h2><p class="clause-text">${contract.customClauses}</p>` : '';
    const notes = contract.notes ? `<p class="obs"><strong>Observações:</strong> ${contract.notes}</p>` : '';

    const body = `
<div class="header">
  <h1>Contrato de Locação Residencial</h1>
  <div class="valor">Aluguel mensal: ${rentalValue}</div>
</div>

<h2 class="clause-title">Das Partes</h2>
<p class="clause-text">
  <span class="bold">LOCADOR(A):</span> ${locName}, brasileiro(a), portador(a) do CPF/MF n.º ${locCpf},
  residente e domiciliado(a) na ${locAddress}, doravante "LOCADOR";
</p>
<p class="clause-text">
  <span class="bold">LOCATÁRIO(A):</span> ${tenName}, brasileiro(a), portador(a) do CPF/MF n.º ${tenCpf},
  doravante "LOCATÁRIO";
</p>
<p class="clause-text">
  <span class="bold">ADMINISTRADORA/INTERVENIENTE ANUENTE:</span> ${imobiliaria.name}, pessoa jurídica inscrita
  no CNPJ sob n.º ${imobiliaria.cnpj} e registrada no CRECI sob n.º ______________, doravante "ADMINISTRADORA",
  responsável pela intermediação e/ou administração da presente locação.
</p>

<h2 class="clause-title">Cláusula 1ª — Do Objeto</h2>
<p class="clause-text">
  O LOCADOR dá em locação ao LOCATÁRIO, que aceita, o imóvel situado na ${propAddress}, na cidade de
  ${propCity}/${propState}, matrícula n.º ${propRegistration}, destinado exclusivamente a fins residenciais.
</p>

<h2 class="clause-title">Cláusula 2ª — Do Prazo</h2>
<p class="clause-text">
  A locação vigorará com início em <span class="bold">${startDate}</span> e término em
  <span class="bold">${endDate}</span>, prorrogando-se por prazo indeterminado, não havendo manifestação em
  contrário, nos termos do art. 46, §1º, da Lei n.º 8.245/1991.
</p>

<h2 class="clause-title">Cláusula 3ª — Do Aluguel e da Forma de Pagamento</h2>
<p class="clause-text">
  O aluguel mensal é fixado em <span class="bold">${rentalValue}</span>, a ser pago pelo LOCATÁRIO até o dia
  <span class="bold">${dueDay}</span> de cada mês, mediante boleto bancário ou meio eletrônico disponibilizado
  pela ADMINISTRADORA.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo primeiro</span> — Do valor pago mensalmente serão automaticamente deduzidos, no
  ato da liquidação financeira, mediante mecanismo de divisão automática de pagamento ("split de pagamento")
  operado por instituição de pagamento autorizada pelo Banco Central do Brasil: (i) a taxa de administração
  devida à ADMINISTRADORA, no percentual de <span class="bold">${adminRateStr}</span> sobre o valor do aluguel
  (${this.fmtCurrency(adminAmount)}); e, quando aplicável, (ii) a comissão devida a corretor(es) parceiro(s),
  cabendo ao LOCADOR receber diretamente o valor líquido remanescente, sem que a integralidade do aluguel
  transite pela conta da ADMINISTRADORA ou de terceiros.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo segundo</span> — Beneficiários da divisão automática, a cada vencimento:
</p>
<ul class="clause-text">
  ${agencyLine}
  ${partnerLines}
</ul>
<p class="paragrafo">
  <span class="bold">Parágrafo terceiro</span> — Em caso de indisponibilidade ou falha do split, o valor
  integral será retido pela ADMINISTRADORA e repassado ao LOCADOR, deduzida a taxa de administração, no prazo
  de até 2 (dois) dias úteis.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo quarto</span> — O atraso no pagamento sujeitará o LOCATÁRIO à multa de 10% sobre
  o valor em atraso, juros de mora de 1% ao mês e correção monetária.
</p>

<h2 class="clause-title">Cláusula 4ª — Do Reajuste</h2>
<p class="clause-text">
  O aluguel será reajustado anualmente, na menor periodicidade permitida em lei, pela variação acumulada do
  IGP-M/FGV ou índice oficial que venha a substituí-lo.
</p>

<h2 class="clause-title">Cláusula 5ª — Da Garantia Locatícia</h2>
<p class="clause-text">
  As partes elegem, como garantia desta locação, a modalidade de ______________ (caução / fiança /
  seguro-fiança), nos termos do art. 37 da Lei n.º 8.245/1991, vedada a cumulação de modalidades.
</p>

<h2 class="clause-title">Cláusula 6ª — Das Obrigações das Partes</h2>
<p class="clause-text">
  O LOCATÁRIO obriga-se a usar o imóvel para fins residenciais, pagar pontualmente o aluguel e encargos, e
  restituir o imóvel nas condições em que o recebeu. O LOCADOR obriga-se a entregar o imóvel em condições de
  uso e garantir o uso pacífico durante a locação.
</p>

<h2 class="clause-title">Cláusula 7ª — Da Intermediação, da Taxa de Administração e do Split</h2>
<p class="clause-text">
  Fica reconhecido que a presente locação foi intermediada e/ou é administrada pela ADMINISTRADORA, à qual é
  devida a taxa de administração/comissão prevista na Cláusula 3ª, §1º, com pagamento por split simultâneo ao
  recebimento do aluguel. A ADMINISTRADORA e o(s) corretor(es) parceiro(s) pessoa jurídica obrigam-se a emitir
  nota fiscal de serviços correspondente ao valor efetivamente recebido, respondendo cada qual pelos tributos
  incidentes sobre sua própria receita (inclusive ISS e Imposto de Renda).
</p>

<h2 class="clause-title">Cláusula 8ª — Da DIMOB</h2>
<p class="clause-text">
  A ADMINISTRADORA declarará mensalmente, na DIMOB relativa ao ano-calendário de vigência deste contrato (IN
  RFB n.º 1.115/2010): (i) o rendimento bruto pago pelo LOCATÁRIO no mês; (ii) o valor da taxa de administração/
  comissão auferida no mês; e (iii) o imposto retido na fonte, quando houver, independentemente de o repasse
  ao LOCADOR ter sido total, parcial ou via split.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo único</span> — Havendo parceria entre mais de uma pessoa jurídica, cada qual
  apresentará sua própria DIMOB, informando os valores proporcionais à sua participação (Solução de Consulta
  COSIT n.º 237/2019). Corretor parceiro pessoa física autônoma não é declarante da DIMOB.
</p>

<h2 class="clause-title">Cláusula 9ª — Do Foro</h2>
<p class="clause-text">
  Fica eleito o foro da comarca de <span class="bold">${propCity}/${propState}</span>, com renúncia a qualquer
  outro, para dirimir questões oriundas deste contrato.
</p>

${customClauses}
${notes}

<p class="clause-text" style="margin-top:24px;">
  E por estarem assim justos e contratados, firmam o presente instrumento em 02 (duas) vias de igual teor, na
  presença de duas testemunhas.
</p>
<p class="clause-text" style="text-align:right;margin-top:16px;">${propCity}, ${contractDate}.</p>

<div class="assinaturas">
  <div class="ass-linha">
    <div class="ass-bloco"><div class="ass-linha-texto"><strong>${locName}</strong><br>LOCADOR(A)<br>CPF: ${locCpf}</div></div>
    <div class="ass-bloco"><div class="ass-linha-texto"><strong>${tenName}</strong><br>LOCATÁRIO(A)<br>CPF: ${tenCpf}</div></div>
  </div>
  <div class="ass-linha">
    <div class="ass-bloco"><div class="ass-linha-texto"><strong>${imobiliaria.name}</strong><br>ADMINISTRADORA (interveniente anuente)<br>CNPJ: ${imobiliaria.cnpj}</div></div>
  </div>
</div>

<div class="testemunhas">
  <p style="margin-bottom:8px;font-weight:bold;">Testemunhas:</p>
  <div class="ass-linha">
    <div class="ass-bloco"><div class="ass-linha-texto">Nome: __________________________<br>CPF: ___________________________</div></div>
    <div class="ass-bloco"><div class="ass-linha-texto">Nome: __________________________<br>CPF: ___________________________</div></div>
  </div>
</div>`;

    return this.shell(`Locação Residencial — ${prop?.code ?? contractId}`, body);
  }
}

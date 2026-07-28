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

  // Formata CPF (000.000.000-00) e CNPJ (00.000.000/0000-00)
  private fmtDoc(v: unknown): string {
    const d = String(v ?? '').replace(/\D/g, '');
    if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    return v ? String(v) : '______________';
  }

  // Formata CEP (00000-000)
  private fmtZip(v: unknown): string {
    const d = String(v ?? '').replace(/\D/g, '');
    return d.length === 8 ? d.replace(/(\d{5})(\d{3})/, '$1-$2') : String(v ?? '');
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
    const prop = contract.property as any;

    // Modelo escolhido explicitamente no contrato tem precedência
    const key = (contract as any).templateKey as string | null;
    if (key === 'RENTAL_WAREHOUSE') return this.generateWarehouseRentalContract(workspaceId, contractId);
    if (key === 'RENTAL_COMMERCIAL_ROOM') return this.generateCommercialRoomRentalContract(workspaceId, contractId);

    if (contract.type === 'RENTAL_COMMERCIAL') {
      // Sem modelo definido: galpão/barracão pelo tipo do imóvel, senão sala comercial
      if (prop?.type === 'WAREHOUSE' || prop?.type === 'LAND' || prop?.type === 'RURAL') {
        return this.generateWarehouseRentalContract(workspaceId, contractId);
      }
      return this.generateCommercialRoomRentalContract(workspaceId, contractId);
    }
    if (contract.type === 'RENTAL_RESIDENTIAL') {
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

  // Qualificação de uma parte (PF ou PJ) para o preâmbulo do contrato
  private qualifyParty(c: any): string {
    if (!c) return '______________';
    const isCompany = c.type === 'COMPANY' || !!c.cnpj;
    const addr = [c.street, c.number].filter(Boolean).join(', ');
    const fullAddr = [addr, c.neighborhood, c.city && c.state ? `${c.city}/${c.state}` : c.city, c.zipCode ? `CEP ${this.fmtZip(c.zipCode)}` : null]
      .filter(Boolean).join(', ');
    if (isCompany) {
      return `<span class="bold">${this.fmt(c.name)}</span>, pessoa jurídica de direito privado, inscrita no CNPJ sob n.º ${this.fmtDoc(c.cnpj)}${
        fullAddr ? `, com sede à ${fullAddr}` : ''
      }`;
    }
    return `<span class="bold">${this.fmt(c.name)}</span>, portador(a) do CPF n.º ${this.fmtDoc(c.cpf)}${
      c.rg ? `, RG n.º ${this.fmt(c.rg)}` : ''
    }${fullAddr ? `, residente e domiciliado(a) à ${fullAddr}` : ''}`;
  }

  // Carrega os fiadores do contrato (Contact ids em guarantorIds)
  private async loadGuarantors(workspaceId: string, guarantorIds: string[]) {
    if (!guarantorIds?.length) return [];
    return this.prisma.contact.findMany({
      where: { id: { in: guarantorIds }, workspaceId, deletedAt: null },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // LOCAÇÃO NÃO RESIDENCIAL — BARRACÃO / GALPÃO
  // Modelo com encargos reembolsáveis (energia e água em nome do LOCADOR),
  // renovação automática e reajuste anual pelo índice do contrato.
  async generateWarehouseRentalContract(workspaceId: string, contractId: string): Promise<string> {
    const { contract, workspace, taxConfig } = await this.loadData(workspaceId, contractId);

    const owner = contract.owner as any;   // LOCADOR
    const tenant = contract.tenant as any; // LOCATÁRIO
    const prop = contract.property as any;

    const imobiliaria = {
      name: workspace?.name ?? '______________',
      cnpj: workspace?.cnpj ?? taxConfig?.cnpj ?? '______________',
    };

    const propAddress = [prop?.street, prop?.number, prop?.complement, prop?.neighborhood]
      .filter(Boolean).join(', ') || '______________';
    const propCity = this.fmt(prop?.city);
    const propState = this.fmt(prop?.state);
    const area = this.fmtArea(prop?.totalArea);

    const rentalValue = this.fmtCurrency(contract.rentalValue);
    const dueDay = contract.dueDay ? String(contract.dueDay).padStart(2, '0') : '____';
    const startDate = this.fmtDate(contract.startDate);
    const endDate = this.fmtDate(contract.endDate);
    const contractDate = this.fmtDate(contract.signedAt ?? contract.createdAt);
    const indexName = contract.adjustmentIndex === 'IPCA' ? 'IPCA/IBGE' : 'IGP-M/FGV';
    const lateFee = contract.lateFee ? this.fmtPct(contract.lateFee) : '10% (dez por cento)';

    // Primeiro vencimento: mês seguinte ao início, no dia de vencimento
    let firstDueText = '______________';
    if (contract.startDate && contract.dueDay) {
      const d = new Date(contract.startDate);
      d.setMonth(d.getMonth() + 1);
      d.setDate(contract.dueDay);
      firstDueText = this.fmtDate(d);
    }

    const customClauses = contract.customClauses
      ? `<h2 class="clause-title">Cláusulas Adicionais</h2><p class="clause-text">${contract.customClauses}</p>` : '';
    const notes = contract.notes ? `<p class="obs"><strong>Observações:</strong> ${contract.notes}</p>` : '';

    const body = `
<div class="header">
  <h1>Contrato de Locação de Imóvel Não Residencial</h1>
  <div class="valor">Aluguel mensal: ${rentalValue}</div>
</div>

<h2 class="clause-title">Locador</h2>
<p class="clause-text">${this.qualifyParty(owner)}, doravante denominado <span class="bold">LOCADOR</span>.</p>

<h2 class="clause-title">Locatário</h2>
<p class="clause-text">${this.qualifyParty(tenant)}, doravante denominado <span class="bold">LOCATÁRIO</span>.</p>

<p class="preambulo" style="margin-top:16px;">
  As partes acima identificadas têm entre si justo e contratado o presente <span class="bold">CONTRATO DE LOCAÇÃO
  DE IMÓVEL NÃO RESIDENCIAL</span>, que será regido pela Lei Federal n.º 8.245/91, pelo Código Civil e pelas
  cláusulas e condições seguintes:
</p>

<h2 class="clause-title">Cláusula Primeira – Do Objeto</h2>
<p class="clause-text">
  Constitui objeto do presente contrato a locação do imóvel com área de ${area}, localizado à ${propAddress},
  Município de ${propCity}/${propState}, destinando-se exclusivamente ao exercício das atividades empresariais
  do LOCATÁRIO.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Primeiro.</span> O LOCATÁRIO declara que vistoriou o imóvel, recebendo-o em
  perfeitas condições de uso, conservação e funcionamento, comprometendo-se a restituí-lo ao término da locação
  nas mesmas condições em que o recebeu, ressalvado o desgaste natural decorrente do uso normal.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Segundo.</span> Qualquer alteração na destinação do imóvel dependerá de
  autorização prévia e expressa do LOCADOR.
</p>

<h2 class="clause-title">Cláusula Segunda – Do Prazo</h2>
<p class="clause-text">
  O presente contrato é firmado com início em <span class="bold">${startDate}</span> e encerramento em
  <span class="bold">${endDate}</span>, independentemente de notificação ou interpelação judicial ou
  extrajudicial.
</p>

<h2 class="clause-title">Cláusula Terceira – Do Aluguel</h2>
<p class="clause-text">
  O aluguel mensal ajustado entre as partes será de <span class="bold">${rentalValue}</span>, vencendo-se todo
  dia ${dueDay} de cada mês, mediante depósito, transferência bancária, PIX ou outro meio indicado pelo LOCADOR.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Primeiro.</span> O primeiro aluguel vencerá em ${firstDueText}, vencendo-se os
  demais no mesmo dia dos meses subsequentes.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Segundo.</span> O aluguel será reajustado anualmente pela variação acumulada do
  ${indexName}, ou, na sua extinção, por outro índice oficial que venha a substituí-lo.
</p>

<h2 class="clause-title">Cláusula Quarta – Da Renovação Automática</h2>
<p class="clause-text">
  Findo o prazo estabelecido neste contrato, não havendo manifestação expressa de qualquer das partes, por
  escrito, com antecedência mínima de 30 (trinta) dias, o presente contrato será automaticamente renovado por
  iguais e sucessivos períodos de 12 (doze) meses, permanecendo em pleno vigor todas as suas cláusulas e
  condições, inclusive quanto aos reajustes do aluguel.
</p>

<h2 class="clause-title">Cláusula Quinta – Do Inadimplemento</h2>
<p class="clause-text">
  O atraso no pagamento do aluguel ou de qualquer obrigação pecuniária prevista neste contrato acarretará:
</p>
<ul class="clause-text">
  <li>I – multa moratória de ${lateFee} sobre o valor devido;</li>
  <li>II – juros de mora de 1% (um por cento) ao mês, calculados proporcionalmente aos dias de atraso;</li>
  <li>III – correção monetária pelo índice previsto para reajuste do aluguel.</li>
</ul>
<p class="paragrafo">
  <span class="bold">Parágrafo Único.</span> O inadimplemento autorizará o LOCADOR a promover as medidas
  judiciais cabíveis para cobrança dos valores devidos e eventual retomada do imóvel, nos termos da legislação
  aplicável.
</p>

<h2 class="clause-title">Cláusula Sexta – Dos Encargos da Locação</h2>
<p class="clause-text">
  Além do aluguel convencionado, correrão por conta do LOCATÁRIO todas as despesas decorrentes da utilização do
  imóvel durante a vigência deste contrato.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Primeiro.</span> As despesas referentes ao consumo de energia elétrica e água
  permanecerão cadastradas em nome do LOCADOR, que efetuará o pagamento dos respectivos vencimentos.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Segundo.</span> O LOCATÁRIO obriga-se a reembolsar integralmente o LOCADOR pelos
  valores despendidos com as contas de energia elétrica e água referentes ao período da locação, mediante
  cobrança em boleto bancário, emitido em conjunto com o boleto do aluguel do mês correspondente.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Terceiro.</span> O reembolso das despesas de energia elétrica e água vencerá na
  mesma data do aluguel e, para todos os fins deste contrato, integrará a obrigação mensal de pagamento do
  LOCATÁRIO.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Quarto.</span> O atraso no pagamento dos valores reembolsáveis previstos nesta
  cláusula sujeitará o LOCATÁRIO às mesmas penalidades aplicáveis ao aluguel, inclusive multa, juros de mora,
  correção monetária e demais encargos previstos neste contrato.
</p>

<h2 class="clause-title">Cláusula Sétima – Da Conservação do Imóvel</h2>
<p class="clause-text">
  O LOCATÁRIO obriga-se a conservar o imóvel em perfeitas condições de limpeza, higiene e utilização,
  responsabilizando-se pelos reparos decorrentes do uso normal ou inadequado durante a vigência da locação.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Primeiro.</span> Qualquer dano causado ao imóvel, por ato do LOCATÁRIO, seus
  empregados, prestadores de serviços, clientes ou terceiros sob sua responsabilidade, deverá ser integralmente
  reparado às suas expensas.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Segundo.</span> Caso o LOCATÁRIO deixe de executar os reparos necessários após
  notificação do LOCADOR, poderá este realizá-los diretamente, sendo os respectivos valores reembolsados pelo
  LOCATÁRIO, sem prejuízo das demais penalidades previstas neste contrato.
</p>

<h2 class="clause-title">Cláusula Oitava – Das Benfeitorias</h2>
<p class="clause-text">
  Nenhuma obra, reforma, adaptação, ampliação ou modificação poderá ser realizada no imóvel sem autorização
  prévia e expressa do LOCADOR.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Primeiro.</span> As benfeitorias úteis ou necessárias realizadas com autorização
  do LOCADOR incorporar-se-ão ao imóvel, sem direito de retenção ou indenização, salvo ajuste escrito em
  contrário.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Segundo.</span> As benfeitorias voluptuárias poderão ser retiradas pelo LOCATÁRIO
  ao término da locação, desde que sua retirada não cause danos ao imóvel, obrigando-se à recomposição integral
  das condições originais.
</p>

<h2 class="clause-title">Cláusula Nona – Da Devolução do Imóvel</h2>
<p class="clause-text">
  Encerrada a locação, o LOCATÁRIO deverá devolver o imóvel livre e desocupado, nas mesmas condições em que o
  recebeu, ressalvado apenas o desgaste natural decorrente do uso regular.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Primeiro.</span> A entrega das chaves somente produzirá efeitos após a realização
  da vistoria final pelo LOCADOR.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Segundo.</span> Constatados danos ou irregularidades, será concedido ao LOCATÁRIO
  prazo para sua regularização ou, a critério do LOCADOR, poderão ser executados os reparos necessários, sendo
  os respectivos custos suportados pelo LOCATÁRIO.
</p>

<h2 class="clause-title">Cláusula Décima – Da Responsabilidade</h2>
<p class="clause-text">
  O LOCATÁRIO responderá integralmente pelos danos causados ao imóvel, às suas instalações e equipamentos, bem
  como por prejuízos causados a terceiros em razão da utilização do imóvel durante a vigência deste contrato.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Único.</span> O LOCADOR não responderá por danos, furtos, roubos, perdas,
  acidentes ou quaisquer prejuízos sofridos pelo LOCATÁRIO, seus empregados, clientes, fornecedores ou terceiros
  no interior do imóvel, salvo quando decorrentes de comprovada culpa exclusiva do LOCADOR.
</p>

<h2 class="clause-title">Cláusula Décima Primeira – Da Cessão e Sublocação</h2>
<p class="clause-text">
  É vedado ao LOCATÁRIO ceder, transferir, emprestar, sublocar, total ou parcialmente, o imóvel objeto deste
  contrato, bem como transferir os direitos e obrigações dele decorrentes, sem a prévia e expressa autorização
  por escrito do LOCADOR.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Único.</span> A inobservância desta cláusula constituirá infração contratual,
  facultando ao LOCADOR considerar rescindido o presente contrato, independentemente de notificação judicial,
  sem prejuízo da cobrança da multa contratual e das perdas e danos eventualmente apurados.
</p>

<h2 class="clause-title">Cláusula Décima Segunda – Da Rescisão Contratual</h2>
<p class="clause-text">O presente contrato poderá ser rescindido:</p>
<ul class="clause-text">
  <li>I – por comum acordo entre as partes;</li>
  <li>II – por infração de qualquer cláusula contratual;</li>
  <li>III – por falta de pagamento dos aluguéis ou demais encargos assumidos pelo LOCATÁRIO;</li>
  <li>IV – nos demais casos previstos na Lei n.º 8.245/91.</li>
</ul>
<p class="paragrafo">
  <span class="bold">Parágrafo Primeiro.</span> Caso o LOCATÁRIO rescinda o contrato antes do término do prazo
  pactuado, sem motivo legal ou sem concordância do LOCADOR, ficará obrigado ao pagamento de multa
  correspondente a 03 (três) aluguéis vigentes, proporcional ao período restante do contrato, conforme disposto
  no art. 4º da Lei do Inquilinato.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Segundo.</span> A multa não será devida quando a rescisão ocorrer por acordo
  escrito entre as partes ou nas hipóteses expressamente previstas em lei.
</p>

<h2 class="clause-title">Cláusula Décima Terceira – Das Disposições Gerais</h2>
<p class="clause-text">
  A eventual tolerância de qualquer das partes quanto ao descumprimento de cláusulas deste contrato será
  considerada mera liberalidade, não constituindo novação, renúncia de direito ou alteração contratual.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Primeiro.</span> Qualquer modificação deste contrato somente terá validade se
  realizada por escrito e assinada por ambas as partes.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Segundo.</span> Caso qualquer disposição deste contrato seja considerada nula ou
  inexequível, as demais cláusulas permanecerão plenamente válidas e eficazes.
</p>

<h2 class="clause-title">Cláusula Décima Quarta – Das Comunicações</h2>
<p class="clause-text">
  Toda comunicação entre as partes referente ao presente contrato poderá ser realizada por escrito, mediante
  correspondência, e-mail, aplicativo de mensagens ou outro meio eletrônico que permita comprovar seu envio e
  recebimento.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Único.</span> Considerar-se-ão válidas as comunicações encaminhadas aos endereços
  físicos ou eletrônicos informados pelas partes, até que haja comunicação formal de eventual alteração.
</p>

<h2 class="clause-title">Cláusula Décima Quinta – Do Foro</h2>
<p class="clause-text">
  Fica eleito o foro da Comarca de ${propCity}/${propState}, com renúncia expressa de qualquer outro, por mais
  privilegiado que seja, para dirimir quaisquer dúvidas ou controvérsias oriundas deste contrato.
</p>

${customClauses}
${notes}

<p class="clause-text" style="margin-top:24px;">
  E, por estarem justos e contratados, assinam o presente instrumento em 02 (duas) vias de igual teor e forma,
  juntamente com duas testemunhas, para que produza todos os efeitos legais.
</p>
<p class="clause-text" style="text-align:right;margin-top:16px;">${propCity}/${propState}, ${contractDate}.</p>

<div class="assinaturas">
  <div class="ass-linha">
    <div class="ass-bloco"><div class="ass-linha-texto"><strong>${this.fmt(owner?.name)}</strong><br>LOCADOR</div></div>
    <div class="ass-bloco"><div class="ass-linha-texto"><strong>${this.fmt(tenant?.name)}</strong><br>LOCATÁRIO</div></div>
  </div>
</div>

<div class="testemunhas">
  <p style="margin-bottom:8px;font-weight:bold;">Testemunhas:</p>
  <div class="ass-linha">
    <div class="ass-bloco"><div class="ass-linha-texto">Nome: __________________________<br>CPF: ___________________________</div></div>
    <div class="ass-bloco"><div class="ass-linha-texto">Nome: __________________________<br>CPF: ___________________________</div></div>
  </div>
</div>`;

    return this.shell(`Locação Não Residencial (Barracão) — ${prop?.code ?? contractId}`, body);
  }

  // ─────────────────────────────────────────────────────────────
  // LOCAÇÃO NÃO RESIDENCIAL — SALA COMERCIAL
  // Modelo com fiadores solidários, condomínio/IPTU reembolsáveis, seguro
  // contra incêndio e direito de preferência na venda.
  async generateCommercialRoomRentalContract(workspaceId: string, contractId: string): Promise<string> {
    const { contract, workspace, taxConfig } = await this.loadData(workspaceId, contractId);
    const guarantors = await this.loadGuarantors(workspaceId, (contract as any).guarantorIds ?? []);

    const owner = contract.owner as any;   // LOCADOR
    const tenant = contract.tenant as any; // LOCATÁRIA
    const prop = contract.property as any;

    const imobiliaria = {
      name: workspace?.name ?? '______________',
      cnpj: workspace?.cnpj ?? taxConfig?.cnpj ?? '______________',
    };

    const propAddress = [prop?.street, prop?.number, prop?.complement, prop?.neighborhood]
      .filter(Boolean).join(', ') || '______________';
    const propCity = this.fmt(prop?.city);
    const propState = this.fmt(prop?.state);
    const propZip = prop?.zipCode ? `, CEP ${this.fmtZip(prop.zipCode)}` : '';

    const rentalValue = this.fmtCurrency(contract.rentalValue);
    const condoValue = prop?.condoMonthly ? this.fmtCurrency(prop.condoMonthly) : null;
    const dueDay = contract.dueDay ? String(contract.dueDay).padStart(2, '0') : '____';
    const startDate = this.fmtDate(contract.startDate);
    const endDate = this.fmtDate(contract.endDate);
    const contractDate = this.fmtDate(contract.signedAt ?? contract.createdAt);
    const indexName = contract.adjustmentIndex === 'IPCA' ? 'IPCA/IBGE' : 'IGP-M/FGV';
    const lateFee = contract.lateFee ? this.fmtPct(contract.lateFee) : '10% (dez por cento)';

    let firstDueText = '______________';
    if (contract.startDate && contract.dueDay) {
      const d = new Date(contract.startDate);
      d.setMonth(d.getMonth() + 1);
      d.setDate(contract.dueDay);
      firstDueText = this.fmtDate(d);
    }

    // Bloco dos fiadores (quando cadastrados no contrato)
    const guarantorBlock = guarantors.length
      ? `<h2 class="clause-title">Fiadores</h2>
<p class="clause-text">${guarantors.map((g: any) => this.qualifyParty(g)).join('; e ')}, doravante denominados
<span class="bold">FIADORES</span>.</p>`
      : `<h2 class="clause-title">Fiadores</h2>
<p class="clause-text">______________________________________________________, doravante denominados
<span class="bold">FIADORES</span>.</p>`;

    const guarantorNames = guarantors.length
      ? guarantors.map((g: any) => `<span class="bold">${this.fmt(g.name)}</span>`).join(' e ')
      : 'os FIADORES qualificados no preâmbulo';

    const guarantorSignatures = (guarantors.length ? guarantors : [null, null])
      .map((g: any, i: number) => `<div class="ass-bloco"><div class="ass-linha-texto"><strong>${
        g ? this.fmt(g.name) : '__________________________'
      }</strong><br>${i === 0 ? 'FIADOR(A)' : 'FIADOR(A)'}<br>CPF: ${g ? this.fmtDoc(g.cpf) : '_______________'}</div></div>`)
      .join('');

    const customClauses = contract.customClauses
      ? `<h2 class="clause-title">Cláusulas Adicionais</h2><p class="clause-text">${contract.customClauses}</p>` : '';
    const notes = contract.notes ? `<p class="obs"><strong>Observações:</strong> ${contract.notes}</p>` : '';

    const body = `
<div class="header">
  <h1>Contrato de Locação de Imóvel Não Residencial</h1>
  <div class="valor">Aluguel mensal: ${rentalValue}${condoValue ? ` + condomínio ${condoValue}` : ''}</div>
</div>

<h2 class="clause-title">Locador</h2>
<p class="clause-text">${this.qualifyParty(owner)}, doravante denominado <span class="bold">LOCADOR</span>.</p>

<h2 class="clause-title">Locatária</h2>
<p class="clause-text">${this.qualifyParty(tenant)}, doravante denominada <span class="bold">LOCATÁRIA</span>.</p>

${guarantorBlock}

<h2 class="clause-title">I – Do Objeto</h2>
<p class="clause-text">
  <span class="bold">Cláusula 1ª.</span> O objeto do presente contrato trata-se de imóvel não residencial,
  situado à ${propAddress}, ${propCity}/${propState}${propZip}.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Primeiro.</span> O imóvel objeto deste instrumento é locado exclusivamente para
  acomodar todas as instalações da LOCATÁRIA, que tem finalidade NÃO RESIDENCIAL, não podendo sua destinação ser
  alterada, substituída ou acrescida de qualquer outra, sem prévia e expressa anuência do LOCADOR.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Segundo.</span> Obriga-se a LOCATÁRIA, no curso da locação, a satisfazer todas as
  exigências dos Poderes Públicos a que der causa, obrigando-se ainda a preservar o ambiente em condições
  adequadas de higiene, segurança e convivência, sob pena de, a qualquer ocorrência, dar causa ao rompimento
  unilateral do contrato, independentemente de notificação.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Terceiro.</span> Obriga-se a LOCATÁRIA a adaptar o imóvel ao fim objetivado, às
  suas expensas e por sua conta e risco, junto aos órgãos competentes, inclusive Prefeitura, Corpo de Bombeiros,
  Vigilância Sanitária e demais órgãos públicos, providenciando todas as licenças, alvarás e autorizações
  necessárias ao exercício de sua atividade.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Quarto.</span> Fica vedada a sublocação, cessão, transferência deste contrato ou
  empréstimo, parcial ou total, do imóvel locado, sem a prévia e expressa autorização do LOCADOR.
</p>

<h2 class="clause-title">II – Do Prazo</h2>
<p class="clause-text">
  <span class="bold">Cláusula 2ª.</span> O prazo da locação inicia-se em <span class="bold">${startDate}</span> e
  encerra-se em <span class="bold">${endDate}</span>, devendo a LOCATÁRIA restituir o imóvel ao LOCADOR
  independentemente de aviso, notificação ou interpelação.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Único.</span> Findo o prazo estipulado, caso a LOCATÁRIA permaneça no imóvel por
  mais de 30 (trinta) dias sem oposição do LOCADOR, a locação será automaticamente prorrogada por prazo
  indeterminado, permanecendo em vigor todas as cláusulas e condições deste contrato, inclusive quanto ao
  reajuste anual do aluguel e demais encargos, nos termos da Lei n.º 8.245/91.
</p>

<h2 class="clause-title">III – Do Aluguel</h2>
<p class="clause-text">
  <span class="bold">Cláusula 3ª.</span> Fica estipulado aluguel no valor de
  <span class="bold">${rentalValue}</span> mensais.
</p>
${condoValue ? `<p class="clause-text">
  O condomínio terá valor inicial de <span class="bold">${condoValue}</span> mensais, podendo sofrer alterações
  de acordo com as despesas efetivamente apuradas pelo condomínio, independentemente de aditamento contratual,
  mediante comunicação prévia à LOCATÁRIA.
</p>` : ''}
<p class="clause-text">
  Os aluguéis serão pagos sempre de forma retroativa, vencendo todo dia ${dueDay} do mês subsequente ao período
  locado. O primeiro vencimento ocorrerá em ${firstDueText}.
</p>
<p class="clause-text">
  O aluguel será reajustado anualmente pela variação acumulada do ${indexName}, ou por outro índice oficial que
  venha a substituí-lo. Caso o índice apresente variação negativa, permanecerá vigente o último valor do aluguel.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Primeiro.</span> Todos os aluguéis deverão ser pagos mediante boleto bancário, ao
  qual serão acrescidos os valores referentes ao IPTU, consumo de água e esgoto, energia elétrica, condomínio e
  demais encargos incidentes sobre o imóvel, que permanecerão em nome do LOCADOR e serão reembolsados pela
  LOCATÁRIA.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Segundo.</span> Os boletos bancários serão enviados mensalmente à LOCATÁRIA por
  meio eletrônico, acompanhados do demonstrativo discriminado dos valores cobrados. A falta de recebimento do
  boleto não exime a LOCATÁRIA da obrigação de efetuar o pagamento no vencimento, devendo solicitar segunda via
  ao LOCADOR, caso necessário.
</p>

<p class="clause-text" style="margin-top:16px;">
  <span class="bold">Cláusula 4ª.</span> São acessórios da locação e deverão ser reembolsados pela LOCATÁRIA ao
  LOCADOR os valores referentes ao consumo de água e esgoto, energia elétrica, condomínio, IPTU, bem como
  quaisquer outros encargos, tributos ou despesas que incidam ou venham a incidir sobre o imóvel durante a
  vigência da locação.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Primeiro.</span> As contas de água, energia elétrica, IPTU e condomínio
  permanecerão em nome do LOCADOR, sendo seus respectivos valores acrescidos ao boleto mensal do aluguel,
  acompanhados do respectivo demonstrativo discriminado.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Segundo.</span> O LOCADOR não se responsabilizará, em nenhuma hipótese, por danos
  causados a terceiros em decorrência da atividade desenvolvida pela LOCATÁRIA, sejam danos materiais, morais,
  estéticos ou de qualquer outra natureza, inclusive avarias em veículos estacionados em área utilizada pela
  LOCATÁRIA.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Terceiro.</span> Em caso de inadimplemento de quaisquer acessórios da locação,
  será facultado ao LOCADOR recusar o recebimento parcial dos aluguéis, sujeitando-se a LOCATÁRIA ao pagamento
  dos encargos decorrentes da mora, independentemente da propositura de ação de despejo.
</p>

<p class="clause-text" style="margin-top:16px;">
  <span class="bold">Cláusula 5ª.</span> A impontualidade no pagamento do aluguel e/ou dos acessórios da locação
  implicará na atualização monetária do débito pela Tabela Prática do Tribunal de Justiça do Estado de
  ${propState}, acrescida de: multa moratória de ${lateFee} sobre o débito; e juros moratórios de 1% (um por
  cento) ao mês, calculados proporcionalmente aos dias de atraso.
</p>
<p class="clause-text">
  <span class="bold">Cláusula 6ª.</span> Havendo cobrança administrativa do débito, caberá à LOCATÁRIA o
  pagamento de honorários advocatícios correspondentes a 10% (dez por cento) sobre o valor atualizado da dívida.
</p>

<h2 class="clause-title">IV – Do Inadimplemento</h2>
<p class="clause-text">
  <span class="bold">Cláusula 7ª.</span> O descumprimento, total ou parcial, de qualquer cláusula ou condição
  deste contrato implicará sua imediata rescisão, sujeitando a parte infratora ao pagamento de multa equivalente
  a 03 (três) aluguéis vigentes à época da infração, sem prejuízo das perdas e danos.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Único.</span> O inadimplemento de um ou mais aluguéis e/ou encargos da locação
  autorizará o protesto do presente contrato, bem como a inscrição do nome da LOCATÁRIA e dos FIADORES nos
  cadastros de proteção ao crédito, sem prejuízo das demais medidas judiciais cabíveis.
</p>
<p class="clause-text">
  <span class="bold">Cláusula 8ª.</span> Sempre que for necessária a adoção de medidas judiciais para a defesa
  dos direitos decorrentes deste contrato, ficam desde já fixados honorários advocatícios em 20% (vinte por
  cento) sobre o valor da causa.
</p>

<h2 class="clause-title">V – Disposições Gerais</h2>
<p class="clause-text">
  <span class="bold">Cláusula 9ª.</span> O imóvel objeto da locação foi entregue à LOCATÁRIA nas condições
  descritas no Termo de Vistoria, anexo ao presente instrumento, obrigando-se a devolvê-lo, ao término da
  locação, nas mesmas condições em que o recebeu, ressalvado o desgaste natural decorrente do uso regular.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Único.</span> Havendo necessidade de realização de obras ou reparos decorrentes de
  danos causados pela LOCATÁRIA, o imóvel somente será considerado devolvido após a conclusão dos serviços ou
  quitação integral dos respectivos valores.
</p>
<p class="clause-text">
  <span class="bold">Cláusula 10.</span> É facultado ao LOCADOR vistoriar o imóvel sempre que julgar necessário,
  mediante comunicação prévia à LOCATÁRIA, em horário comercial ou outro previamente ajustado entre as partes.
</p>
<p class="clause-text">
  <span class="bold">Cláusula 11.</span> Obriga-se a LOCATÁRIA a manter o imóvel permanentemente limpo e em
  perfeitas condições de conservação, responsabilizando-se pela manutenção dos aparelhos sanitários, instalações
  elétricas e hidráulicas, pinturas, telhados, vidraças, portas, fechaduras, pias, torneiras, banheiros, ralos,
  calhas e demais acessórios existentes, conforme descrito no Termo de Vistoria.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Primeiro.</span> A LOCATÁRIA responderá pelos reparos necessários à conservação do
  imóvel decorrentes de seu uso, excetuando-se apenas aqueles provenientes do desgaste natural ou de problemas
  estruturais.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Segundo.</span> A LOCATÁRIA será responsável por eventuais multas decorrentes do
  descumprimento de leis, decretos, regulamentos ou normas administrativas relacionadas à utilização do imóvel.
</p>
<p class="clause-text">
  <span class="bold">Cláusula 12.</span> Obriga-se a LOCATÁRIA a respeitar todas as leis e regulamentos vigentes,
  bem como o direito de vizinhança, abstendo-se da prática de quaisquer atos que possam perturbar a
  tranquilidade, comprometer a segurança ou ameaçar a saúde pública.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Único.</span> O LOCADOR não se responsabilizará, em nenhuma hipótese, por danos
  causados a terceiros em decorrência das atividades desenvolvidas pela LOCATÁRIA no imóvel, sejam danos
  materiais, morais, estéticos ou de qualquer outra natureza.
</p>
<p class="clause-text">
  <span class="bold">Cláusula 13.</span> A LOCATÁRIA não poderá realizar no imóvel ou em suas dependências
  quaisquer obras, reformas ou benfeitorias sem a prévia e expressa autorização do LOCADOR.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Primeiro.</span> Quaisquer benfeitorias, úteis, necessárias ou voluptuárias, ainda
  que autorizadas, incorporar-se-ão ao imóvel, renunciando expressamente a LOCATÁRIA ao direito de retenção ou
  indenização.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Segundo.</span> A LOCATÁRIA responderá perante os órgãos públicos por qualquer
  irregularidade decorrente da execução de obras ou modificações realizadas no imóvel.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Terceiro.</span> Caso o LOCADOR não tenha interesse na permanência das
  benfeitorias realizadas, poderá exigir sua retirada às expensas da LOCATÁRIA, que deverá devolver o imóvel nas
  mesmas condições em que o recebeu, ressalvado o desgaste natural.
</p>
<p class="clause-text">
  <span class="bold">Cláusula 14.</span> Constatada eventual necessidade de reparos no imóvel em decorrência de
  uso inadequado pela LOCATÁRIA, o LOCADOR apresentará orçamento elaborado por profissional habilitado.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Único.</span> A LOCATÁRIA poderá optar pelo pagamento do orçamento apresentado ou
  executar os reparos por profissional de sua confiança, no prazo máximo de 10 (dez) dias, responsabilizando-se
  integralmente pela qualidade dos serviços realizados.
</p>
<p class="clause-text">
  <span class="bold">Cláusula 15.</span> É de responsabilidade da LOCATÁRIA a contratação e manutenção de seguro
  contra incêndio do imóvel locado, indicando o LOCADOR como beneficiário da apólice durante toda a vigência da
  locação.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Único.</span> A cópia da apólice deverá ser entregue ao LOCADOR sempre que
  solicitada.
</p>
<p class="clause-text">
  <span class="bold">Cláusula 16.</span> Encerrada a locação, fica a LOCATÁRIA obrigada a apresentar ao LOCADOR,
  sempre que solicitado, todos os comprovantes de quitação dos encargos da locação, especialmente das 05 (cinco)
  últimas contas de água e energia elétrica, bem como dos demais encargos reembolsados durante a vigência do
  contrato.
</p>
<p class="clause-text">
  <span class="bold">Cláusula 17 – Dos Fiadores.</span> ${guarantorNames} assumem responsabilidade solidária por
  todas as obrigações decorrentes deste contrato, respondendo pelo cumprimento integral das obrigações assumidas
  pela LOCATÁRIA até a efetiva entrega das chaves e quitação de todos os débitos.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Primeiro.</span> A responsabilidade dos FIADORES permanecerá íntegra mesmo na
  hipótese de prorrogação da locação por prazo indeterminado, renunciando expressamente ao benefício de ordem
  previsto no artigo 827 do Código Civil, na forma do artigo 828, inciso I, do mesmo diploma legal.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Segundo.</span> Em caso de falecimento, incapacidade, insolvência ou exoneração
  dos FIADORES, poderá o LOCADOR exigir a apresentação de nova garantia locatícia, no prazo de 15 (quinze) dias,
  sob pena de rescisão contratual.
</p>
<p class="clause-text">
  <span class="bold">Cláusula 18.</span> A eventual tolerância do LOCADOR quanto ao descumprimento de qualquer
  cláusula deste contrato constituirá mera liberalidade, não implicando novação, renúncia de direitos ou
  alteração das condições pactuadas.
</p>

<h2 class="clause-title">VI – Da Venda do Imóvel</h2>
<p class="clause-text">
  <span class="bold">Cláusula 19.</span> Caso o LOCADOR pretenda vender o imóvel durante a vigência deste
  contrato, a LOCATÁRIA compromete-se a permitir a visita de interessados, desde que previamente avisada quanto
  ao dia e horário.
</p>
<p class="paragrafo">
  <span class="bold">Parágrafo Único.</span> Na hipótese de venda do imóvel, será assegurado à LOCATÁRIA o
  direito de preferência, na forma da Lei n.º 8.245/91. Não exercido esse direito, caberá ao adquirente decidir
  pela manutenção ou rescisão da locação, observado o prazo legal para desocupação.
</p>

<h2 class="clause-title">VII – Do Foro</h2>
<p class="clause-text">
  <span class="bold">Cláusula 20.</span> Para dirimir quaisquer controvérsias oriundas deste contrato, as partes
  elegem o foro da Comarca de ${propCity}/${propState}, renunciando a qualquer outro, por mais privilegiado que
  seja.
</p>

${customClauses}
${notes}

<p class="clause-text" style="margin-top:24px;">
  E, por estarem justos e contratados, LOCADOR, LOCATÁRIA e FIADORES assinam o presente instrumento em 02 (duas)
  vias de igual teor e forma, para que produza todos os efeitos de direito.
</p>
<p class="clause-text" style="text-align:right;margin-top:16px;">${propCity}/${propState}, ${contractDate}.</p>

<div class="assinaturas">
  <div class="ass-linha">
    <div class="ass-bloco"><div class="ass-linha-texto"><strong>${this.fmt(owner?.name)}</strong><br>LOCADOR<br>${
      owner?.cnpj ? `CNPJ: ${this.fmtDoc(owner.cnpj)}` : `CPF: ${this.fmtDoc(owner?.cpf)}`
    }</div></div>
    <div class="ass-bloco"><div class="ass-linha-texto"><strong>${this.fmt(tenant?.name)}</strong><br>LOCATÁRIA<br>${
      tenant?.cnpj ? `CNPJ: ${this.fmtDoc(tenant.cnpj)}` : `CPF: ${this.fmtDoc(tenant?.cpf)}`
    }</div></div>
  </div>
  <div class="ass-linha">
    ${guarantorSignatures}
  </div>
</div>`;

    return this.shell(`Locação Não Residencial (Sala Comercial) — ${prop?.code ?? contractId}`, body);
  }
}

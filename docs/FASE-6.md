# FASE 6 — Nota Fiscal de Serviço (NFS-e) — Prefeitura de Franca

Branch: `feat/fase-6-nfse` · Construída **em cima da Fase 5** (`feat/fase-5-financeiro`).
**Ordem de merge:** #11 → #12 → #13 → #14 → #15 → #16 (Fase 5) → esta fase.

## Decisões do dono nesta fase
- **Provedor:** SIL Tecnologia, padrão ABRASF 2.04 (webservice da própria Prefeitura de Franca).
- **Integração direta com a SIL**, autorizada pelo dono como **exceção** à regra do plano ("não integrar direto
  com webservice de prefeitura"). O código continua no padrão de adaptador (`NfseProvider`): se um dia trocar por
  um emissor intermediário, muda só o adaptador.
- **Município de emissão:** só **Franca** (inscrição municipal única). Imóveis em Patrocínio Paulista entram
  normalmente na descrição do serviço.

## 1. O que foi feito (em linguagem simples)

### Configuração fiscal (Notas Fiscais → Configuração fiscal)
- Regime **Lucro Presumido** como padrão, dados do prestador (razão social, CNPJ, inscrição municipal), código do
  serviço (item da LC 116, ex.: 10.05), código de tributação do município, CNAE, série e numeração do RPS.
- **Todas as alíquotas em tela**, nenhuma fixa no código: ISS de Franca, PIS, COFINS, IRPJ, CSLL e as presunções.
- **Retenções na fonte** quando o tomador é **pessoa jurídica**: IR, PIS, COFINS e CSLL (percentuais editáveis),
  valor mínimo abaixo do qual não retém, e opção de ISS retido pelo tomador. **Confirme os percentuais com o contador.**
- **Certificado digital A1 (e-CNPJ, arquivo .pfx)**: enviado pela tela com a senha; fica **guardado criptografado**
  e nunca volta para a tela. O sistema confere se o CNPJ do certificado bate com o cadastrado e avisa o vencimento.
- **Ambiente:** começa em **homologação** (teste, sem valor fiscal). **Notas reais só depois de você autorizar**:
  botão "Autorizar notas reais", que exige digitar *AUTORIZO NOTAS REAIS* e só funciona depois de pelo menos uma
  nota de teste autorizada. Fica registrado quem autorizou e quando. Dá para voltar para homologação a qualquer hora.

### Emitir a nota
- Na conta a receber (**Financeiro → A Receber → Detalhes → "Emitir NF"**) aparece a prévia: tomador, descrição do
  serviço (editável), ISS, retenções e o **valor líquido**. Ao confirmar, o sistema monta o XML no padrão ABRASF,
  **assina com o certificado** e envia à prefeitura.
- **Emissão automática (opcional):** ligando a opção, toda comissão recebida a partir daquele momento gera a nota
  sozinha. Se faltar algo (ex.: cliente sem CPF/CNPJ), a nota aparece como **rejeitada com o motivo**.
- **Fila com novas tentativas:** se a prefeitura não responder, a nota fica "Na fila" e o sistema tenta de novo
  sozinho (1, 5, 15, 60 e 240 minutos). **Antes de reenviar, consulta a prefeitura** para nunca gerar nota em dobro.
  Depois de 6 tentativas vira "Falha de comunicação", com botão **Reenviar**.
- **Situação sempre visível:** Na fila, Processando, Autorizada, Rejeitada (com o motivo da prefeitura),
  Falha de comunicação, Cancelada. Rejeitou? Corrija o cadastro/configuração e clique **Reenviar** (usa o mesmo RPS).

### Retenções refletem no financeiro
- Quando a nota com retenção é autorizada, a conta a receber passa a esperar **só o valor líquido** (ex.: comissão
  de R$ 12.000 para uma construtora → espera R$ 11.262). O fluxo de caixa e o DRE usam o líquido.
- O valor retido fica registrado na nota (IR, PIS, COFINS, CSLL, ISS) para o contador.
- Se a nota for cancelada, a retenção é desfeita e a conta volta ao valor cheio.
- Se a conta já estava quitada pelo valor bruto, a nota sai normalmente e aparece um **aviso** para conferir com o contador.
- Com boleto/PIX ativo pelo valor bruto, a nota com retenção é recusada até cancelar a cobrança (para não cobrar o bruto).

### Tela "Notas Fiscais"
- Lista com filtros, **download do PDF e do XML**, **envio por e-mail** ao tomador (PDF + XML anexados; se o e-mail
  não estiver configurado, aparece o erro), **cancelamento** com o motivo oficial (1 erro na emissão, 2 serviço não
  prestado, 4 duplicidade) — cancela na prefeitura.
- XML e PDF ficam **guardados no sistema**. O PDF é um "espelho" da nota com número, código de verificação e o
  endereço do portal da prefeitura (o documento oficial é o do portal da SIL).
- **Relatório do contador** (mensal): notas emitidas e canceladas, base de cálculo, ISS, retenções, líquido e uma
  estimativa de PIS/COFINS/IRPJ/CSLL pelas alíquotas configuradas. **Exporta para Excel.**

### Outras mudanças
- As rotas antigas de NFS-e (Focus NFe, e um "cancelar" que só mudava a situação **sem ir à prefeitura**) foram removidas.
- Notas antigas marcadas como "emitidas" sem número continuam visíveis como **"Registro interno — não emitida"**.

### O que ficou de fora / atenção (importante)
- **Não consegui acessar o webservice da SIL daqui** (a rede deste ambiente bloqueia o endereço). Por isso o
  adaptador foi feito pelo **padrão oficial ABRASF 2.04** e testado contra uma **SIL simulada** que confere a
  assinatura digital. **A primeira nota em homologação vai confirmar os detalhes da SIL** (nomes das operações,
  formato da alíquota). Se a SIL usar algo diferente, o ajuste é pequeno e fica só no arquivo do adaptador.
- **Endereço de homologação da SIL:** a SIL/prefeitura precisa informar (normalmente pedido pelo contador ou no
  portal). Sem ele, a tela mostra "Falta: endereço do webservice de homologação".
- **Sem homologação = sem nota real.** Produção fica travada até você autorizar.
- Notificação "NF rejeitada" (sino/e-mail) é da Fase 7.

## 2. Arquivos alterados e migration

**Migration (só aditiva):** `backend/prisma/migrations/20261114220000_fase6_nfse/migration.sql` — colunas novas em
`tax_configs` (configuração fiscal/NFS-e, certificado criptografado, autorização de produção) e em `nfse_records`
(RPS, ambiente, tomador, base, ISS, retenções, líquido, fila, arquivos XML/PDF), índice de fila e RPS único por
imobiliária. Nada foi alterado ou removido.

**Backend (novo módulo `src/modules/erp/nfse/`):** `nfse-provider.ts` (interface), `sil-abrasf24.provider.ts`
(adaptador SIL), `abrasf-xml.ts` (XML e respostas), `xml-signer.ts` (certificado e assinatura), `nfse-tax.ts`
(ISS/retenções), `nfse-pdf.ts`, `nfse-config.service.ts`, `nfse.service.ts` (fila, emissão, cancelamento, e-mail,
relatório), `nfse.controller.ts`, `nfse.dto.ts`, `nfse.module.ts`; testes `nfse-core.spec.ts` e `nfse-queue.spec.ts`.
Alterados: `financial/payments.service.ts` (retenção), `files/files.service.ts`, `hub/email/*` (anexos),
`fiscal/fiscal.controller.ts` e `fiscal.service.ts` (rotas antigas removidas), `erp.module.ts`.
Novas dependências: `xml-crypto`, `node-forge`, `fast-xml-parser`, `pdf-lib`.

**Frontend:** `components/nfse/nfse-panel.tsx`, `components/nfse/issue-nfse-dialog.tsx`, `hooks/use-nfse.ts` (novos);
`app/(dashboard)/fiscal/page.tsx`, `app/(dashboard)/financial/page.tsx`, `components/finance/entry-detail.tsx`,
`hooks/use-finance.ts`, `hooks/use-fiscal.ts`.

**Testes:** `backend/test/api/fase6-nfse.mjs` (ponta a ponta com SIL simulada).

## 3. Variáveis de ambiente

**Nenhuma nova.** O certificado e a senha são criptografados com a `ENCRYPTION_KEY` que já existe no Railway —
**não troque essa chave** depois de instalar o certificado (se trocar, instale o certificado de novo).
A variável antiga `FOCUS_NFE_TOKEN`, se existir no Railway, **não é mais usada** e pode ser apagada
(Railway → serviço do backend → Variables → ⋮ ao lado de `FOCUS_NFE_TOKEN` → Remove).

## 4. Resultado do build e dos testes

| Verificação | Resultado |
|---|---|
| Backend `npm run build` / `tsc --noEmit` | OK |
| Backend `jest` | **154/154** (inclui 21 novos de NFS-e: retenções, XML, assinatura digital, respostas da prefeitura, fila) |
| Frontend `tsc --noEmit` / `npm run build` | OK |
| Migration em banco vazio e com dados | OK; drift só o índice antigo já conhecido |
| Ponta a ponta Fase 6 (API real + SIL simulada que confere a assinatura) | **38/38** |
| Regressão ponta a ponta Fases 4 e 5 | 33/33 e 79/79 |
| Teste de tela (navegador, login real) | **9/9** |

## 5. Roteiro de teste manual (homologação)

Antes: peça à SIL/prefeitura (ou ao contador) o **endereço do webservice de homologação** e confirme o **item da
LC 116** e o **código de tributação** da imobiliária. Tenha o **certificado A1 (.pfx)** e a senha.

1. **Notas Fiscais → Configuração fiscal:** confira "Lucro Presumido"; preencha razão social, CNPJ, inscrição
   municipal, item da LC 116, código de tributação, alíquota de ISS de Franca e as retenções (com o contador).
   Cole o endereço de homologação. **Salvar**.
2. Instale o **certificado** (.pfx + senha). Teste a senha errada: deve aparecer "Senha do certificado incorreta".
   Com a certa: aparece o nome do titular e a validade; a situação muda para **"Pronto para emitir"**.
3. Tente mudar para produção sem autorizar: não deixa.
4. **Emitir em homologação (pessoa física):** Financeiro → A Receber → conta de comissão de um cliente **com CPF** →
   Detalhes → **Emitir NF** → confira a prévia (sem retenções) → Emitir. Deve ficar **Autorizada** com número.
5. **Pessoa jurídica:** repita com um cliente **com CNPJ**. A prévia mostra IR/PIS/COFINS/CSLL retidos e o líquido.
   Depois de autorizar, a conta passa a mostrar **em aberto o valor líquido**.
6. Em **Notas Fiscais**: baixe o **PDF** e o **XML**; envie por **e-mail** (se o SMTP estiver configurado).
7. **Cancelar** a nota PJ (motivo 1) → fica Cancelada e a conta volta ao valor cheio.
8. **Relatório do contador:** escolha o mês e **Exporte o Excel**; confira os totais.
9. Se a prefeitura **rejeitar** alguma nota, leia o motivo, corrija (cadastro ou configuração) e clique **Reenviar**.
10. (Opcional) Ligue **"Emitir automaticamente"**, receba uma comissão e veja a nota aparecer sozinha em até 1–2 minutos.
11. **Só quando estiver tudo certo:** "Autorizar notas reais", digite *AUTORIZO NOTAS REAIS*. A partir daí as notas
    vão para o ambiente de produção da SIL de Franca. **Faça a primeira nota real acompanhando com o contador.**

## 6. Script de validação

Dê dois cliques em **`validar-fase-6.bat`** (com Git e Docker Desktop abertos). Ele baixa esta fase e roda, no
Docker (node:20-alpine), build + tipos + testes do backend e tipos do frontend. Não mexe no sistema que está no ar.

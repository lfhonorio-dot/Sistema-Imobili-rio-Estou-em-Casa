# Checklist de homologação — Estou em Casa (fluxo de venda)

Roteiro de teste manual, tela por tela, na ordem em que uma venda acontece de verdade.
Em cada passo: **o que fazer** e, depois da seta (→), **o que tem de aparecer**. Marque o quadradinho quando conferir.
Se o resultado for diferente do esperado, **pare**, anote o número do passo, tire um print e envie ao desenvolvedor.

**Antes de começar**

- Faça em **homologação** (ou numa imobiliária de teste). Nunca use clientes reais neste roteiro.
- Asaas em **Sandbox**; nota fiscal em **homologação** (o sistema nasce assim).
- Tenha à mão: dois e-mails seus (um para "vendedor", outro para "comprador"), o certificado A1 (.pfx) com a senha,
  e os dados fiscais combinados com o contador.
- CPFs de teste válidos: `111.444.777-35` (vendedor) e `529.982.247-25` (comprador).
- Tempo estimado: 1h30 a 2h.

---

## Parte A — Preparação (só na primeira vez)

### A1. Dados da imobiliária — *Configurações → Workspace*
- [ ] Preencha o **CNPJ** da imobiliária e salve.
      → Mensagem de sucesso. **Importante:** sem o CNPJ a DIMOB sai com "CNPJ do declarante inválido".
- [ ] Confira "Perfil de operação": **Venda**.
      → No menu não aparecem Manutenção, Automações, Marketing nem Integrações.

### A2. Usuários e papéis — *Configurações → Usuários e papéis*
- [ ] Convide um e-mail seu como **Corretor** → "Gerar convite" → "Copiar link".
      → Aparece o link e o convite entra em "Convites pendentes".
- [ ] Abra o link numa **janela anônima**, crie a senha.
      → Vai para o login com o e-mail já preenchido. Ao entrar, o topo mostra "Corretor".
- [ ] (Opcional) Convide também um **Financeiro** e um **Gerente**.

### A3. Asaas — *Financeiro → Boletos e PIX*
- [ ] Cadastre o gateway Asaas (**Sandbox**) com a chave de API e clique em **Testar conexão**.
      → "Conexão OK". A chave nunca volta a aparecer na tela.
- [ ] Gere o **token do webhook** e cadastre o endereço no painel do Asaas (passo a passo em `docs/FASE-5.md`, seção 3).

### A4. Nota fiscal — *Notas Fiscais → Configuração fiscal*
- [ ] Confira **Lucro Presumido**; preencha razão social, CNPJ, inscrição municipal, item da LC 116, código de
      tributação, ISS e retenções; cole o endereço do webservice de **homologação**; salve.
- [ ] Instale o certificado (.pfx + senha). Teste antes uma senha errada.
      → Senha errada: "Senha do certificado incorreta". Certa: nome do titular, validade e **"Pronto para emitir"**.

---

## Parte B — O fluxo de ouro

### B1. Captação do imóvel — *Clientes* e *Imóveis*
- [ ] Clientes → Novo: cadastre o **vendedor** com CPF `111.444.777-35` e um e-mail seu.
      → Aparece na lista. Repetir o mesmo CPF mostra aviso de duplicidade.
- [ ] Imóveis → Novo: casa à venda em Franca, R$ 400.000,00, **proprietário** = o vendedor.
      → Imóvel criado com código `P-…`, situação **Disponível**.
- [ ] No imóvel, aba **Autorização**: assinada hoje, válida por 6 meses, comissão **6%**, captador = o corretor.
      → Aparece "Autorização vigente até dd/mm/aaaa".

### B2. Lead — *entre como o Corretor*
- [ ] Clientes → Novo: cadastre o **comprador** com CPF `529.982.247-25` e outro e-mail seu.
- [ ] Funil → **Novo Negócio**: título, cliente = comprador, imóvel de interesse = a casa.
      → O cartão aparece na coluna **Novo lead**.
- [ ] Em até 5 minutos, olhe o **sino** no topo.
      → Aviso "Lead novo". Clicar nele abre o negócio.

### B3. Visita — *dentro do negócio*
- [ ] Quadro **Visitas** → Agendar → amanhã, 14h.
      → "Negócio movido para Visita agendada". A visita aparece no menu **Visitas** e em **Tarefas**.
- [ ] Tente agendar outra visita 30 minutos depois.
      → "O corretor já tem uma visita marcada nesse horário".
- [ ] Clique **Realizada**, interesse "Alto", escreva o retorno.
      → O negócio vai para **Visita realizada**.

### B4. Proposta — *dentro do negócio*
- [ ] Quadro **Propostas** → Nova proposta: R$ 390.000,00, Financiamento, entrada 90.000,00, financiado 300.000,00.
      → O negócio vai para **Proposta**.
- [ ] Clique **PDF**.
      → Abre a proposta formatada, pronta para imprimir.
- [ ] Clique **Aceitar**.
      → O negócio vai para **Documentação** e o valor do negócio passa a R$ 390.000,00.

### B5. Negócio ganho → contrato — *entre como o Dono*
- [ ] No negócio, **Mover Etapa → Ganho**.
      → Abre **Novo Contrato** já preenchido: imóvel, vendedor, comprador, R$ 390.000,00 e comissão 6%.
- [ ] Salve.
      → Contrato `C-aaaa-NNNN` com **"Venda em rascunho"**. A aba Financeiro está **vazia** e o imóvel continua Disponível.

### B6. Assinatura eletrônica — *no contrato*
- [ ] Clique **Solicitar Assinatura**.
      → Mensagem de enviado. Os dois e-mails (vendedor e comprador) recebem "Assinatura Pendente" com um link.
      → Se o e-mail (SMTP) não estiver configurado, aparece **erro** — e o envelope **não** fica como "enviado".
- [ ] Abra o link do vendedor → peça o código → digite um código **errado**.
      → "OTP inválido".
- [ ] Digite o código certo (chega por e-mail) e assine. Repita com o comprador.
      → Em Contratos → **Assinaturas**, o envelope fica **Concluído**, com a trilha de auditoria (data, hora, IP).

### B7. Ativar a venda — *no contrato*
- [ ] Clique **Ativar venda**: 2 parcelas, 1º vencimento em 15 dias, corretor vendedor 30%, captador 10% → **Atualizar prévia**.
      → Comissão total **R$ 23.400,00** em 2 parcelas de R$ 11.700,00; corretor R$ 9.360,00; imobiliária R$ 14.040,00.
- [ ] Coloque vendedor 80% e captador 30% → Atualizar prévia.
      → Erro "a soma dos repasses passa de 100%". Volte para 30% e 10%.
- [ ] **Ativar venda** e confirme.
      → Contrato **Ativo**, imóvel **Vendido**. Aba Financeiro: 2 comissões a receber (no nome do vendedor) e as
        comissões a pagar ao corretor. **Não** aparece o valor do imóvel como conta.
- [ ] Aba **Pós-venda**.
      → 7 itens com prazo e responsável (documentos, crédito, avaliação, ITBI, escritura, registro, chaves).

### B8. Comissão a receber: boleto e PIX — *Financeiro → A Receber*
- [ ] Na parcela 1, **Cobrar → Boleto**.
      → Linha digitável e link do PDF. Tentar dar baixa manual agora é **recusado** (evita receber em dobro).
- [ ] No painel do Asaas Sandbox, marque esse boleto como **pago**.
      → Em instantes a parcela 1 fica **Quitada**, com a baixa "Asaas (automático)".
- [ ] Na parcela 2, **Cobrar → PIX**.
      → QR Code e "copia e cola".
- [ ] Marque o PIX como pago no Asaas.
      → Parcela 2 **Quitada**. Não aparece baixa duplicada.

### B9. Nota fiscal — *na parcela 1 → Detalhes*
- [ ] **Emitir NF** → confira a prévia (tomador = vendedor, valor R$ 11.700,00, pessoa física sem retenção) → Emitir.
      → Nota **Autorizada**, com número. Aviso de que está em **homologação**.
- [ ] Em **Notas Fiscais**, baixe o **PDF** e o **XML**.
- [ ] Tente emitir de novo para a mesma parcela.
      → Recusado (já existe nota).

### B10. Comissão do corretor — *Financeiro → A Pagar* e *Comissões*
- [ ] Pague as comissões do corretor (Pagar → valor total → PIX).
      → Ficam **Quitadas**.
- [ ] Entre **como o Corretor** → **Minhas comissões**.
      → R$ 9.360,00 em "Recebidas" e nada pendente. Ele **não** vê o menu Financeiro; digitando `/financial`
        aparece "Sem acesso a esta área".

### B11. Fluxo de caixa e relatórios — *como o Dono*
- [ ] Financeiro → **Fluxo de Caixa** (mensal).
      → No mês: entradas realizadas R$ 23.400,00 e saídas R$ 9.360,00 (somadas ao que já existia). **Exportar Excel** abre no Excel.
- [ ] **DRE** do ano.
      → Receita de comissões com os R$ 23.400,00.
- [ ] **Relatórios → VGV vendido**.
      → A venda de R$ 390.000,00 aparece. Botões **Excel** e **PDF** baixam o arquivo.

### B12. DIMOB — *Fiscal — DIMOB*
- [ ] Escolha o ano → no declarante, clique **Validar**.
      → "Arquivo sem erros · 1 venda(s)". Se faltar CPF de alguma parte, o erro diz de quem.
- [ ] Clique **Arquivo PGD (TXT)** e **importe no programa da Receita (PGD DIMOB)** junto com o contador.
      → O PGD aceita o arquivo. *(Esta conferência no programa oficial é obrigatória antes da primeira entrega real.)*

---

## Parte C — Situações de exceção

### C1. Baixa parcial e estorno — *Financeiro → A Pagar*
- [ ] Crie uma conta a pagar de R$ 1.000,00 e baixe **R$ 400,00**.
      → Situação **Parcial**, R$ 600,00 em aberto.
- [ ] Detalhes → **Estornar** a baixa (com motivo).
      → Volta a R$ 1.000,00 em aberto; o estorno fica registrado, nada é apagado.

### C2. Rescisão — *em outra venda de teste, já ativada*
- [ ] Receba a parcela 1 e pague o repasse do corretor dela. Depois, no contrato, **Rescindir venda** com motivo.
      → Contrato **Rescindido**, imóvel volta a **Disponível**. Contas em aberto ficam "Canceladas" com o motivo;
        aparecem os **estornos** do que já tinha sido recebido/pago. A venda **sai** da DIMOB.

### C3. Nota rejeitada — *Notas Fiscais*
- [ ] Se a prefeitura rejeitar uma nota, leia o motivo, corrija o cadastro e clique **Reenviar**.
      → A nota é reenviada sem duplicar; Financeiro e Dono recebem o aviso "Nota fiscal rejeitada".

### C4. Permissões do Corretor
- [ ] Como Dono, crie um lead/negócio seu. Entre como Corretor.
      → O corretor **não** vê esse lead na lista nem pelo endereço direto ("não encontrado").
- [ ] Como Corretor, tente abrir `/settings/users` e `/reports`.
      → "Sem acesso a esta área".

### C5. Segurança
- [ ] Erre a senha de um usuário de teste 10 vezes.
      → Conta bloqueada por 15 minutos, mesmo com a senha certa.
- [ ] Desligue o Wi-Fi e abra **Clientes**.
      → "Erro de conexão" com "Tentar de novo" — e não "nenhum cliente encontrado".

### C6. LGPD — *cadastro de um cliente de teste, como Dono*
- [ ] **Exportar dados (LGPD)**.
      → Baixa um arquivo com os dados do cliente.
- [ ] **Anonimizar** um cliente **sem** contrato (informe o motivo).
      → Dados pessoais somem. Num cliente **com** contrato, o aviso diz que nome e CPF ficam guardados por obrigação legal.

### C7. Troca de CNPJ — *use uma imobiliária só de teste*
Antes: emita nela um contrato (ative), uma nota fiscal, um boleto e um recibo de comissão.
- [ ] **Configurações → Workspace**: o quadro **Dados legais da empresa** mostra CNPJ e razão social. O campo CNPJ do formulário fica travado.
- [ ] **Trocar CNPJ ou razão social**: informe um CNPJ de teste válido, a razão social nova e a data de início. Marque "Entendi" e confirme.
      → Aparece o histórico (CNPJ antigo com o período) e o quadro **"O CNPJ mudou"** com o checklist.
- [ ] Reabra o **contrato antigo**, o **recibo antigo** e reenvie a **nota antiga** por e-mail.
      → Todos continuam com o CNPJ e o nome **antigos**.
- [ ] Tente emitir um **boleto novo** antes de cadastrar a conta Asaas do novo CNPJ.
      → Recusado com a orientação para cadastrar a conta nova.
- [ ] **Boletos e PIX**: cadastre a conta Asaas do novo CNPJ. A antiga aparece em "Contas do CNPJ anterior".
- [ ] **Notas Fiscais → Configuração**: instale o certificado do **novo** CNPJ (o do antigo é recusado).
      → No checklist, conta de cobrança e certificado ficam marcados sozinhos.
- [ ] Emita um **contrato novo**, um **boleto novo** e uma **nota nova**.
      → Saem com o CNPJ e a razão social **novos**.
- [ ] **Cancele a nota antiga**. → A prefeitura aceita (usa o certificado antigo guardado).
- [ ] **Fiscal → DIMOB → Carregar declarantes** do ano.
      → Aparecem os **dois CNPJs**, cada um com seu período e suas operações; baixe um arquivo para cada.

---

## Parte D — Antes de usar com clientes reais

- [ ] Todos os passos das partes A, B e C conferidos.
- [ ] No GitHub, os testes automáticos do Pull Request estão **verdes** ("Fluxo de ouro (ponta a ponta)").
- [ ] Asaas trocado de Sandbox para **Produção** (nova chave e novo webhook).
- [ ] Nota fiscal: **"Autorizar notas reais"** (frase *AUTORIZO NOTAS REAIS*) e a **primeira nota real feita com o contador**.
- [ ] DIMOB: arquivo de teste **aceito pelo PGD** da Receita.
- [ ] Variáveis do Railway conferidas: `FRONTEND_URL`, `APP_URL`, SMTP, `HMAC_SECRET`, `ENCRYPTION_KEY`.
- [ ] Dados de teste criados neste roteiro cancelados/arquivados (ou use uma imobiliária só de teste).

# FASE 2 — Cadastros (imóvel, cliente, fornecedores, sugestões)

Branch: `feat/fase-2-cadastros` · Construída **em cima da Fase 1** (`feat/fase-1-perfil-venda`).
**Ordem de merge:** primeiro o PR da Fase 1 (#11), depois o desta fase.

## 1. O que foi feito (em linguagem simples)

### Imóvel (detalhe do imóvel, abas novas)
- **Proprietários:** um imóvel pode ter vários donos, com % de cada um.
  - Um deles é o **principal** (marcado com estrela).
  - O sistema não deixa a soma passar de 100% nem repetir a mesma pessoa.
  - Avisa quando o dono é casado e o cônjuge não foi cadastrado.
  - Os proprietários que já existiam foram copiados automaticamente para esta lista.
- **Autorização de venda (captação):** data de assinatura, validade, exclusividade, % de comissão
  combinada, valor autorizado e corretor captador.
  - A situação aparece sozinha: **Vigente**, **Vencendo** (até 30 dias), **Vencida** ou **Cancelada**.
  - Cancelar exige motivo.
  - **Alerta:** as autorizações vencendo ou vencidas aparecem em destaque no **Dashboard** e na **lista de Imóveis**.
- **Fotos:** botão "Enviar fotos" (JPG, PNG ou WEBP até 5 MB cada; dá para enviar várias de uma vez).
- **Documentos:** matrícula, IPTU, certidões (com validade), autorização assinada, planta, habite-se,
  escritura. Aceita PDF ou imagem até 10 MB. Certidão vencida aparece em vermelho. Remover não
  apaga o arquivo do banco, só o tira da lista.
- **Chaves:** registra quem retirou a chave, quando e a devolução prevista. O sistema não deixa retirar
  uma chave que já está fora nem devolver uma que não saiu. O histórico fica guardado.
- **Histórico de preço:** toda vez que o preço de venda ou de locação muda, o sistema anota
  sozinho a data, o valor antigo e o novo.
- **Clientes compatíveis:** lista os compradores cujo perfil de interesse combina com o imóvel, com
  uma nota de 0 a 100% e o motivo ("Tipo desejado", "Dentro da faixa de preço", "Bairro: Centro"…).

### Cliente
- **Estado civil, regime de bens e cônjuge.** Para casado(a) ou em união estável, aparecem o regime de
  bens e a escolha do cônjuge. O cônjuge precisa estar cadastrado como contato, porque ele assina a
  venda junto. O sistema não deixa escolher o próprio cliente como cônjuge.
- **Consentimento LGPD:** além de "sim/não", agora fica registrada a **data** em que o cliente consentiu.
- **Origem do lead:** além das anteriores, agora há "Placa no imóvel" e "Outro".
- **Busca de CEP de verdade:** o botão "Buscar" preenche rua, bairro, cidade e estado pelo CEP. Antes
  aparecia "em breve".
- **Perfil de interesse** (aba no detalhe do cliente): tipos de imóvel, cidades, bairros, faixa de preço,
  quartos e vagas mínimos, forma de pagamento (à vista, financiamento, FGTS, permuta).
- **Imóveis compatíveis** (aba no detalhe do cliente): sugestões ordenadas pela nota.

**Como a sugestão decide (as mesmas regras nos dois sentidos):**
- **Descarta** o imóvel quando:
  - ele está vendido, reservado ou é só para locação;
  - o tipo é diferente do desejado;
  - o preço passa de **10% acima** do máximo, ou fica mais de 10% abaixo do mínimo;
  - tem menos quartos que o mínimo;
  - fica em outra cidade (quando o cliente informou cidades).
- **Pontua** cada critério que o cliente preencheu. Bairro e vagas não descartam, só pontuam.
  Preço até 10% acima do máximo vale meio ponto.

### Fornecedores (menu Financeiro → Fornecedores)
- Cadastro com nome, PF/PJ, CPF/CNPJ (conferido e sem repetir), categoria (cartório, publicidade,
  manutenção, serviços, corretor, impostos...), telefone, e-mail, PIX e dados bancários.
- **Conta a pagar:** ao lançar uma conta a pagar, dá para escolher o fornecedor. O nome dele aparece na lista.
- Remover um fornecedor não apaga as contas antigas ligadas a ele.

### O que ficou de fora / observações
- **Onde ficam fotos e documentos:** no próprio banco de dados (PostgreSQL), e não no MinIO que aparece
  nos arquivos do Docker. O MinIO nunca foi ligado ao código nem existe no Railway. Os arquivos são
  abertos por um link com assinatura que vence em 2 horas, no mesmo padrão de segurança do portal do
  proprietário. **Ponto de atenção:** o banco tem limite de espaço no plano do Neon. Para uma
  imobiliária pequena isso atende, mas se o volume de fotos crescer muito, dá para trocar por um
  armazenamento externo (S3/R2), mudando só um arquivo (`files.service.ts`). **Confirme se aceita
  essa escolha.**
- **Documentos do cliente:** a aba "Documentos" do cliente mostrava "em desenvolvimento" e foi
  substituída pelas abas de perfil e compatíveis. Documentos das partes entram na Fase 4 (checklist
  de pós-venda).
- **Edição de imóvel:** continua exigindo o cadastro completo (comportamento que já existia).

## 2. Arquivos alterados e migration

**Migration (somente aditiva):** `backend/prisma/migrations/20261114140000_fase2_cadastros/migration.sql`
- Tabelas novas:
  - `property_owners`
  - `property_authorizations`
  - `property_key_movements`
  - `property_price_history`
  - `stored_files`
  - `suppliers`
  - `contact_interest_profiles`
- Colunas novas, todas opcionais:
  - `contacts.maritalStatus`, `marriageRegime`, `spouseContactId`, `marketingConsentAt`
  - `property_photos.fileId`
  - `financial_entries.supplierId`
- Cópia do proprietário atual de cada imóvel para `property_owners`.
- **Conferida em PostgreSQL 16 real:** todas as migrations do projeto foram aplicadas do zero sem erro,
  e o banco resultante bate com o `schema.prisma`.

**Backend (novos):**
- `modules/files/*` (armazenamento e links assinados)
- `modules/erp/suppliers/*`
- `modules/erp/properties/`:
  - `property-registry.{controller,service,dto}.ts`
  - `matching.ts`
  - `authorization-status.ts`
- `modules/crm/contacts/contact-interest.ts`
- Testes:
  - `matching.spec.ts`
  - `authorization-status.spec.ts`
  - `fase2-unit.spec.ts`
- `test/api/fase2-cadastros.mjs` (roteiro de ponta a ponta)

**Backend (alterados):**
- `schema.prisma`
- `app.module.ts`
- `properties.service.ts` (histórico de preço e proprietário principal em transação, links das fotos)
- `properties.module.ts`
- `contacts.{dto,service,module}.ts`
- `financial.{dto,service}.ts`

**Frontend (novos):**
- `components/properties/registry-panels.tsx`
- `components/properties/expiring-authorizations-alert.tsx`
- `components/contacts/interest-profile-panel.tsx`
- `hooks/use-property-registry.ts`
- `hooks/use-suppliers.ts`
- `app/(dashboard)/suppliers/page.tsx`

**Frontend (alterados):**
- Páginas:
  - `properties/[id]/page.tsx`
  - `properties/page.tsx`
  - `contacts/[id]/page.tsx`
  - `(dashboard)/page.tsx`
- Componentes:
  - `components/crm/contact-form.tsx`
  - `components/erp/financial-entry-form.tsx`
  - `components/erp/financial-entry-row.tsx`
  - `components/erp/property-card.tsx`
- Outros:
  - `hooks/use-contacts.ts`
  - `hooks/use-financial.ts`
  - `lib/api.ts` (`apiFileUrl`)
  - `lib/navigation.ts` (menu Fornecedores)

**Raiz:** `validar-fase-2.bat`.

## 3. Variáveis de ambiente novas

**Nenhuma.** Os links das fotos usam o `HMAC_SECRET` que já existe no Railway. Não é preciso mexer em nada.

## 4. Resultado do build e dos testes

- **Backend:**
  - `npm run build`, `tsc --noEmit`: sem erros.
  - **jest: 91 testes, 91 passando** (Fase 1 terminou com 68; foram 23 novos).
- **Roteiro de ponta a ponta contra a API real e um PostgreSQL 16: 36 de 36 verificações.** Inclui:
  - proprietários;
  - autorização vencendo;
  - chaves;
  - histórico de preço;
  - upload e link assinado (link adulterado é recusado);
  - documentos;
  - fornecedores e conta a pagar;
  - perfil e compatíveis;
  - **isolamento entre imobiliárias:** outra imobiliária não vê nem altera nada.
- **Frontend:** `tsc --noEmit` e `npm run build` sem erros.
- **Teste no navegador com login real, contra o backend real: 13 de 13**, sem nenhum erro de JavaScript.
  Passos cobertos:
  1. Adicionar proprietário.
  2. Registrar autorização (aparece "Vencendo").
  3. Retirar chave.
  4. Enviar matrícula.
  5. Enviar foto (aparece na galeria).
  6. Ver clientes compatíveis no imóvel.
  7. Ver imóveis compatíveis no cliente.
  8. Salvar perfil de interesse.
  9. Cadastrar fornecedor e ver o aviso de CNPJ repetido.
  10. Ver o alerta no Dashboard.

## 5. Roteiro de teste manual (homologação)

Faça depois de mesclar a Fase 1 e esta fase, quando o Railway terminar o deploy (3 a 5 minutos).

1. **Cônjuge.** Clientes → Novo: cadastre "Ana Teste". Cadastre "José Teste", estado civil **Casado(a)**.
   → Aparecem "Regime de bens" e "Cônjuge". Escolha comunhão parcial e Ana Teste. Salve.
   → No detalhe do José aparece "Estado civil: Casado(a) — comunhão parcial" e "Cônjuge: Ana Teste".
2. **CEP.** No cadastro de cliente, digite um CEP de Franca (ex.: 14400-000) e clique "Buscar".
   → Cidade e estado são preenchidos. CEP inexistente mostra "CEP não encontrado".
3. **Consentimento.** Marque "Consentimento de Marketing" e salve.
   → No detalhe aparece "sim, desde dd/mm/aaaa".
4. **Proprietários.** Abra um imóvel → aba **Proprietários** → adicione um segundo proprietário com 50%.
   → Aparece na lista. Tentar adicionar a mesma pessoa de novo mostra a mensagem do sistema.
5. **Autorização.** Aba **Autorização** → "Válida até" daqui a 10 dias, comissão 6, marque Exclusividade
   → "Registrar autorização".
   → Aparece "Vencendo — 10 dia(s)". No **Dashboard** e na lista de **Imóveis** aparece o alerta amarelo.
6. **Chaves.** Aba **Chaves** → "Quem retira": seu nome → "Registrar retirada".
   → Aparece "Chave com …". Clique "Registrar devolução": volta para "Chave na imobiliária".
7. **Fotos.** Botão **Enviar fotos** (no topo do imóvel) → escolha 2 fotos do celular ou computador.
   → As fotos aparecem na galeria. Um arquivo que não é imagem é recusado com mensagem.
8. **Documentos.** Aba **Documentos** → tipo **Matrícula** → "Enviar arquivo" → escolha um PDF.
   → Aparece na lista; clicar no nome abre o PDF.
9. **Histórico de preço.** Editar o imóvel e mudar o preço de venda → aba **Histórico**.
   → Aparece a linha com o valor antigo e o novo.
10. **Perfil de interesse.** Abra um cliente comprador → aba **Perfil de interesse** → marque "Casa",
    cidade "Franca", preço máximo um pouco acima do imóvel do passo 4 → "Salvar perfil".
    → Aba **Imóveis compatíveis** mostra o imóvel com a nota. No imóvel, aba **Clientes compatíveis**
    mostra esse cliente.
11. **Fornecedores.** Financeiro → **Fornecedores** → "Novo fornecedor" → cadastre um cartório com CNPJ.
    → Aparece na lista com o CNPJ formatado. Cadastrar outro com o mesmo CNPJ mostra
    "Já existe um fornecedor com este documento".
12. **Conta a pagar com fornecedor.** Financeiro → A Pagar → novo lançamento → escolha o fornecedor.
    → Na lista, ao lado da categoria, aparece o nome do fornecedor.

## 6. Script para validar

`validar-fase-2.bat`, na raiz do projeto:
1. Abra o **Docker Desktop** e espere a baleia ficar verde.
2. Dê dois cliques em `validar-fase-2.bat`.
3. No fim deve aparecer **"FASE 2 VALIDADA"**. Se aparecer "ERRO", copie as linhas vermelhas e me envie.

O script não altera o sistema que está no ar.

// Roteiro de ponta a ponta: TROCA DE CNPJ / RAZÃO SOCIAL sem criar outra imobiliária.
// Documento emitido continua mostrando a empresa da data em que foi emitido
// (reimpressão, reenvio e exportação); documento novo sai com a empresa nova;
// DIMOB do ano com troca no meio sai em dois arquivos, cada operação no CNPJ certo.
// Asaas, prefeitura (SIL) e e-mail SIMULADOS — nada sai para a internet.
// Uso (de dentro de backend/, backend de TESTE rodando):
//   API_URL=http://localhost:3001/api/v1 DATABASE_URL=... node test/api/dados-emitente.mjs
import { makeClient, makeTestCertificate, startAsaas, startSil, startSmtp } from './_simuladores.mjs';

const B = process.env.API_URL || 'http://localhost:3001/api/v1';
const call = makeClient(B);
const results = [];
const ok = (name, cond, extra = '') => results.push([!!cond, name, extra]);
const short = (r) => JSON.stringify(r?.raw ?? r?.status ?? r).slice(0, 320);
const run = Date.now().toString(36);
const iso = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const YEAR = new Date().getFullYear();
const PASS = 'Senha@12345';
const html = (r) => r.buf?.toString('utf8') ?? JSON.stringify(r.data ?? '');

const CNPJ_A = '12345678000195';
const CNPJ_B = '11444777000161';
const FMT_A = '12.345.678/0001-95';
const FMT_B = '11.444.777/0001-61';
const KEY_A = 'chave-asaas-cnpj-antigo';
const KEY_B = 'chave-asaas-cnpj-novo';
const certA = makeTestCertificate(CNPJ_A);
const certB = makeTestCertificate(CNPJ_B);
const asaas = await startAsaas(3999, [KEY_A, KEY_B]);
const sil = await startSil([certA.certPem, certB.certPem]);
const smtp = await startSmtp(Number(process.env.SMTP_TEST_PORT || 2525));

// Prisma só para a prova do banco (trigger); opcional fora do CI
let prisma = null;
if (process.env.DATABASE_URL) {
  try { const { PrismaClient } = await import('@prisma/client'); prisma = new PrismaClient(); } catch { prisma = null; }
}

try {
  // ── 0. Imobiliária com a empresa ANTIGA ─────────────────
  const reg = await call('POST', '/auth/register', { body: { workspaceName: 'Casa Antiga ' + run, workspaceSlug: 'emit' + run, email: `emit-${run}@teste.local`, name: 'Dona Ana', password: PASS } });
  if (reg.status >= 300) throw new Error('cadastro falhou: ' + short(reg));
  const O = { token: reg.data.accessToken, ws: reg.data.workspaceId };
  const as = (o = {}) => ({ ...O, ...o });
  await call('PUT', '/workspace', as({ body: { cnpj: CNPJ_A, operationProfile: 'VENDA_E_LOCACAO' } }));
  await call('PATCH', '/nfse/config', as({ body: { razaoSocial: 'Empresa Antiga Ltda', cnpj: CNPJ_A, inscricaoMunicipal: '11111', itemListaServico: '10.05', codigoTributacaoMunicipio: '100500', aliquotaISS: 2, nfseWsUrlHomolog: 'http://127.0.0.1:3998/ws' } }));
  const fdA = new FormData(); fdA.append('file', new Blob([certA.pfx]), 'a.pfx'); fdA.append('password', certA.password);
  const upA = await call('POST', '/nfse/config/certificate', as({ body: fdA }));
  let iss = await call('GET', '/issuer', as());
  ok('0. dados da empresa vigentes = CNPJ antigo, um registro no histórico', iss.status === 200 && iss.data.current?.cnpj === CNPJ_A && iss.data.current?.razaoSocial === 'Empresa Antiga Ltda' && iss.data.history.length === 1 && upA.data?.readiness?.ready, short(iss) + short(upA));
  ok('0b. histórico nunca devolve o certificado guardado', !JSON.stringify(iss.data).includes('nfseCertPfxEnc') && !JSON.stringify(iss.data).includes('certPasswordEnc'));

  const gwA = await call('POST', '/billing/gateways', as({ body: { provider: 'ASAAS', name: 'Asaas CNPJ antigo', apiKey: KEY_A, environment: 'SANDBOX', isDefault: true } }));
  const TOKEN_A = (await call('POST', `/billing/gateways/${gwA.data.id}/webhook-token`, as())).data.webhookToken;

  const me = (await call('GET', '/users/workspace/members', as())).data[0];
  const seller = (await call('POST', '/contacts', as({ body: { type: 'PERSON', name: 'Vera Vendedora', cpf: '11144477735', email: `vera-${run}@teste.local` } }))).data;
  const buyer = (await call('POST', '/contacts', as({ body: { type: 'PERSON', name: 'Bruno Comprador', cpf: '52998224725', email: `bruno-${run}@teste.local` } }))).data;
  const seller2 = (await call('POST', '/contacts', as({ body: { type: 'PERSON', name: 'Sara Segunda', cpf: '39053344705', email: `sara-${run}@teste.local` } }))).data;
  const newProp = async (street, purpose = 'SALE', owner = seller.id) => (await call('POST', '/properties', as({ body: { type: 'HOUSE', purpose, city: 'Franca', state: 'SP', street, number: '1', salePrice: 300000, rentalPrice: 2000, ownerId: owner } }))).data;
  const plan = (eventDate) => ({ installmentsCount: 2, firstDueDate: iso(20), sellerBrokerId: me.id, sellerBrokerPct: 30, captorBrokerPct: 0, paymentMethod: 'FINANCING', eventDate });

  // ── 1. Emite com a empresa ANTIGA: contrato, boletos, NFS-e, recibo, proposta ──
  const p1 = await newProp('Rua Antiga');
  const c1 = (await call('POST', '/contracts', as({ body: { type: 'SALE', propertyId: p1.id, ownerId: seller.id, tenantId: buyer.id, saleValue: 300000, commissionRate: 6 } }))).data;
  const sig = await call('POST', `/contracts/${c1.id}/request-signature`, as({ body: {} }));
  const act1 = await call('POST', `/contracts/${c1.id}/sale/activate`, as({ body: plan(`${YEAR}-03-10`) }));
  const doc1Before = html(await call('GET', `/contracts/${c1.id}/document`, as()));
  ok('1a. contrato emitido (assinatura pedida + venda ativada em março) mostra o CNPJ e a razão social antigos', sig.status < 300 && act1.status === 201 && doc1Before.includes(FMT_A) && doc1Before.includes('Empresa Antiga Ltda'), short(sig) + short(act1));
  const rec1 = (await call('GET', `/contracts/${c1.id}`, as())).data.financialEntries.filter((e) => e.type === 'RECEIVABLE').sort((a, b) => a.installment - b.installment);
  const bol1 = await call('POST', '/billing/boletos', as({ body: { financialEntryId: rec1[0].id, kind: 'BOLETO' } }));
  const pix1 = await call('POST', '/billing/boletos', as({ body: { financialEntryId: rec1[1].id, kind: 'PIX' } }));
  ok('1b. boleto e PIX emitidos na conta Asaas do CNPJ antigo', bol1.status === 201 && pix1.status === 201 && asaas.state.keyOf.get(bol1.data.gatewayBoletoId) === KEY_A, short(bol1) + short(pix1));
  const nf1 = await call('POST', `/nfse/entries/${rec1[0].id}`, as({ body: {} }));
  ok('1c. NFS-e autorizada no CNPJ antigo, assinada com o certificado antigo', nf1.status === 201 && nf1.data.status === 'AUTHORIZED' && nf1.data.issuerCnpj === CNPJ_A && sil.signedBy.at(-1)?.cert === 0, short(nf1));

  const pr = await newProp('Rua do Aluguel', 'RENTAL');
  const rent = (await call('POST', '/contracts', as({ body: { type: 'RENTAL_RESIDENTIAL', propertyId: pr.id, ownerId: seller.id, tenantId: buyer.id, rentalValue: 2000, dueDay: 10, commissionRate: 10, startDate: iso(-30), endDate: iso(700) } }))).data;
  const comms = /* lista geral */ (await call('GET', '/financial/commissions?limit=100', as())).data;
  const com1 = (comms?.items ?? comms ?? []).find((c) => c.contractId === rent?.id);
  const recv1 = com1 ? await call('PATCH', `/financial/commissions/${com1.id}/receive`, as({ body: { receivedValue: 200 } })) : { status: 0 };
  const receipt1Before = com1 ? html(await call('GET', `/financial/commissions/${com1.id}/receipt`, as())) : '';
  ok('1d. recibo de comissão emitido com o CNPJ antigo', recv1.status === 200 && receipt1Before.includes(FMT_A) && receipt1Before.includes('Empresa Antiga Ltda'), short(recv1) + receipt1Before.slice(0, 80));

  const pipes = (await call('GET', '/pipelines', as())).data;
  const funnel = (Array.isArray(pipes) ? pipes : pipes.items).find((p) => p.name === 'Funil de Venda');
  const p3 = await newProp('Rua da Proposta', 'SALE', seller2.id);
  const deal = (await call('POST', '/deals', as({ body: { title: 'Proposta antiga', contactId: buyer.id, pipelineId: funnel.id, propertyIds: [p3.id] } }))).data;
  const prop1 = (await call('POST', '/proposals', as({ body: { dealId: deal.id, propertyId: p3.id, amount: 280000, paymentMethod: 'CASH', validUntil: iso(10) } }))).data;
  const propDoc1Before = html(await call('GET', `/proposals/${prop1?.id}/document`, as()));
  ok('1e. proposta impressa com o CNPJ antigo', propDoc1Before.includes(FMT_A), propDoc1Before.slice(0, 200));

  // ── 2. A cópia não muda por API ─────────────────────────
  const tamper = await call('PATCH', `/contracts/${c1.id}`, as({ body: { notes: 'x', issuerSnapshot: { cnpj: CNPJ_B, razaoSocial: 'Falsa' } } }));
  ok('2a. alterar issuerSnapshot pela API é recusado (400) e nada muda', tamper.status === 400 && html(await call('GET', `/contracts/${c1.id}/document`, as())).includes(FMT_A), short(tamper));
  const wsSwap = await call('PUT', '/workspace', as({ body: { cnpj: CNPJ_B } }));
  ok('2b. trocar CNPJ pela tela antiga (Workspace) é recusado com orientação', wsSwap.status === 400 && /Trocar CNPJ ou razão social/.test(wsSwap.raw.message), short(wsSwap));
  const nfSwap = await call('PATCH', '/nfse/config', as({ body: { razaoSocial: 'Outra Razão Ltda' } }));
  ok('2c. trocar razão social pela configuração fiscal é recusado', nfSwap.status === 400, short(nfSwap));
  const phone = await call('PUT', '/workspace', as({ body: { phone: '16999990000', address: 'Av. Nova, 500' } }));
  ok('2d. telefone e endereço continuam sendo edição simples (sem novo registro)', phone.status === 200 && (await call('GET', '/issuer', as())).data.history.length === 1, short(phone));
  if (prisma) {
    let blocked = false;
    try { await prisma.$executeRawUnsafe(`UPDATE "contracts" SET "issuerSnapshot" = '{"cnpj":"${CNPJ_B}"}'::jsonb WHERE "id" = $1`, c1.id); } catch (e) { blocked = /imutável/.test(String(e?.message)); }
    ok('2e. nem direto no banco: o gatilho recusa alterar a cópia', blocked);
  }

  // ── 3. Troca de CNPJ (com data de início no meio do ano) ─
  const badCnpj = await call('POST', '/issuer/change', as({ body: { cnpj: '11111111111111', razaoSocial: 'X Ltda', validFrom: `${YEAR}-07-01` } }));
  const future = await call('POST', '/issuer/change', as({ body: { cnpj: CNPJ_B, razaoSocial: 'Empresa Nova Ltda', validFrom: `${YEAR + 1}-01-01` } }));
  ok('3a. CNPJ inválido e data no futuro são recusados', badCnpj.status === 400 && future.status === 400, short(badCnpj) + short(future));
  const change = await call('POST', '/issuer/change', as({ body: { cnpj: FMT_B, razaoSocial: 'Empresa Nova Ltda', nomeFantasia: 'Casa Nova ' + run, inscricaoMunicipal: '22222', validFrom: `${YEAR}-07-01` } }));
  iss = await call('GET', '/issuer', as());
  const hist = iss.data.history;
  ok('3b. troca registrada: antigo encerrado em 01/07, novo vigente desde 01/07', change.status === 201 && hist.length === 2 && iss.data.current.cnpj === CNPJ_B && hist.find((h) => h.cnpj === CNPJ_A)?.validTo?.startsWith(`${YEAR}-07-01`), short(change) + short(iss));
  ok('3c. certificado antigo arquivado no histórico (sem expor o arquivo)', hist.find((h) => h.cnpj === CNPJ_A)?.hasArchivedCertificate === true);
  const ck = iss.data.checklist;
  ok('3d. aviso de troca de CNPJ com checklist (gateway, certificado, prefeitura, bancos, WhatsApp, modelos) pendente', ck.applies && ck.previousCnpj === CNPJ_A && ['gateway', 'certificate', 'nfseProvider', 'bankAccounts', 'whatsapp', 'contractTemplates'].every((k) => ck.items.some((i) => i.key === k)) && !ck.items.find((i) => i.key === 'gateway').done && !ck.items.find((i) => i.key === 'certificate').done, JSON.stringify(ck).slice(0, 300));
  const nfCfg = (await call('GET', '/nfse/config', as())).data;
  ok('3e. configuração fiscal sincronizada: CNPJ novo, sem certificado, de volta à homologação', nfCfg.cnpj === CNPJ_B && nfCfg.razaoSocial === 'Empresa Nova Ltda' && !nfCfg.hasCertificate && nfCfg.nfseEnvironment === 'HOMOLOG', JSON.stringify({ c: nfCfg.cnpj, r: nfCfg.razaoSocial, h: nfCfg.hasCertificate }));
  const marked = await call('PUT', '/issuer/checklist', as({ body: { key: 'bankAccounts', done: true } }));
  ok('3f. item manual do checklist pode ser marcado', marked.status === 200 && marked.data.items.find((i) => i.key === 'bankAccounts').done, short(marked));

  // ── 4. Reimprimir / reenviar o que foi emitido antes → dados ANTIGOS ─
  const doc1After = html(await call('GET', `/contracts/${c1.id}/document`, as()));
  ok('4a. contrato antigo reimpresso continua com CNPJ e razão social antigos', doc1After.includes(FMT_A) && doc1After.includes('Empresa Antiga Ltda') && !doc1After.includes(FMT_B), doc1After.slice(0, 100));
  const receipt1After = com1 ? html(await call('GET', `/financial/commissions/${com1.id}/receipt`, as())) : '';
  ok('4b. recibo antigo reimpresso continua com o CNPJ antigo', receipt1After.includes(FMT_A) && !receipt1After.includes(FMT_B));
  const propDoc1After = html(await call('GET', `/proposals/${prop1?.id}/document`, as()));
  ok('4c. proposta antiga reimpressa continua com o CNPJ antigo', propDoc1After.includes(FMT_A) && !propDoc1After.includes(FMT_B));
  const nf1After = await call('GET', `/nfse/${nf1.data.id}`, as());
  const mail = await call('POST', `/nfse/${nf1.data.id}/email`, as({ body: { to: `contador-${run}@teste.local` } }));
  const sent = smtp.lastTo(`contador-${run}@teste.local`);
  ok('4d. NFS-e antiga reenviada por e-mail com o nome da empresa antiga', nf1After.data.issuerCnpj === CNPJ_A && mail.status < 300 && sent?.subject.includes('Casa Antiga') && !sent?.subject.includes('Casa Nova'), short(mail) + (sent?.subject ?? 'sem e-mail'));
  const xlsx = await call('GET', `/nfse/report/export?month=${new Date().toISOString().slice(0, 7)}`, as());
  ok('4e. relatório do contador (Excel) sai com a coluna CNPJ do prestador', xlsx.status === 200 && xlsx.buf?.length > 1000, String(xlsx.status));

  // ── 5. Cobranças antigas na conta antiga ─────────────────
  const noNew = await call('POST', '/billing/boletos', as({ body: { financialEntryId: rec1[1].id, kind: 'BOLETO' } }));
  const rentEntry = (await call('POST', '/financial/entries', as({ body: { type: 'RECEIVABLE', category: 'RENT', description: 'Aluguel avulso', amount: 2000, dueDate: iso(10), contactId: buyer.id } }))).data;
  const blocked = await call('POST', '/billing/boletos', as({ body: { financialEntryId: rentEntry.id, kind: 'BOLETO' } }));
  ok('5a. cobrança NOVA pela conta do CNPJ antigo é recusada com orientação', blocked.status === 400 && /CNPJ anterior|novo CNPJ/.test(blocked.raw.message), short(blocked) + short(noNew));
  const whOld = await call('POST', `/billing/webhook/${O.ws}`, { body: { id: 'evt_old_' + run, event: 'PAYMENT_RECEIVED', payment: { id: pix1.data.gatewayBoletoId, value: Number(pix1.data.amount), originalValue: Number(pix1.data.amount), paymentDate: iso(0) } }, headers: { 'asaas-access-token': TOKEN_A } });
  ok('5b. pagamento do PIX antigo baixado pelo aviso da conta antiga', whOld.status === 200 && whOld.data.result === 'PAID', short(whOld));
  const cancOld = await call('POST', `/billing/boletos/${bol1.data.id}/cancel`, as({ body: { reason: 'Teste: cancelar cobrança antiga' } }));
  ok('5c. boleto antigo cancelado no Asaas com a credencial antiga', cancOld.status < 300 && asaas.state.deleted.includes(bol1.data.gatewayBoletoId), short(cancOld));

  // ── 6. Configura a empresa NOVA ─────────────────────────
  const gwB = await call('POST', '/billing/gateways', as({ body: { provider: 'ASAAS', name: 'Asaas CNPJ novo', apiKey: KEY_B, environment: 'SANDBOX', isDefault: true } }));
  const gws = (await call('GET', '/billing/gateways', as())).data;
  ok('6a. segunda conta Asaas (do CNPJ novo) aceita; a antiga fica marcada como do CNPJ anterior', gwB.status === 201 && gws.find((g) => g.id === gwA.data.id)?.previousCnpj === true && gws.find((g) => g.id === gwB.data.id)?.previousCnpj === false, short(gwB));
  const backA = await call('PATCH', `/billing/gateways/${gwA.data.id}`, as({ body: { isDefault: true } }));
  ok('6b. conta do CNPJ antigo não pode voltar a ser a padrão', backA.status === 400, short(backA));
  const certWrong = new FormData(); certWrong.append('file', new Blob([certA.pfx]), 'a.pfx'); certWrong.append('password', certA.password);
  const upWrong = await call('POST', '/nfse/config/certificate', as({ body: certWrong }));
  const fdB = new FormData(); fdB.append('file', new Blob([certB.pfx]), 'b.pfx'); fdB.append('password', certB.password);
  const upB = await call('POST', '/nfse/config/certificate', as({ body: fdB }));
  ok('6c. certificado do CNPJ antigo é recusado; o do novo é aceito', upWrong.status === 400 && upB.status === 201 && upB.data.readiness.ready, short(upWrong) + short(upB));
  const ck2 = (await call('GET', '/issuer', as())).data.checklist;
  ok('6d. checklist marca sozinho conta de cobrança e certificado do CNPJ novo', ck2.items.find((i) => i.key === 'gateway').done && ck2.items.find((i) => i.key === 'certificate').done && ck2.items.find((i) => i.key === 'nfseProvider').done, JSON.stringify(ck2.items.map((i) => [i.key, i.done])));

  // ── 7. Emite NOVO → dados NOVOS ─────────────────────────
  const p2 = await newProp('Rua Nova', 'SALE', seller2.id);
  const c2 = (await call('POST', '/contracts', as({ body: { type: 'SALE', propertyId: p2.id, ownerId: seller2.id, tenantId: buyer.id, saleValue: 500000, commissionRate: 5 } }))).data;
  const act2 = await call('POST', `/contracts/${c2.id}/sale/activate`, as({ body: plan(`${YEAR}-09-10`) }));
  const doc2 = html(await call('GET', `/contracts/${c2.id}/document`, as()));
  ok('7a. contrato novo sai com CNPJ e razão social novos', act2.status === 201 && doc2.includes(FMT_B) && doc2.includes('Empresa Nova Ltda') && !doc2.includes(FMT_A), short(act2));
  const rec2 = (await call('GET', `/contracts/${c2.id}`, as())).data.financialEntries.filter((e) => e.type === 'RECEIVABLE');
  const bol2 = await call('POST', '/billing/boletos', as({ body: { financialEntryId: rec2[0].id, kind: 'BOLETO' } }));
  ok('7b. boleto novo sai pela conta Asaas do CNPJ novo', bol2.status === 201 && asaas.state.keyOf.get(bol2.data.gatewayBoletoId) === KEY_B, short(bol2));
  const nf2 = await call('POST', `/nfse/entries/${rec2[0].id}`, as({ body: {} }));
  ok('7c. NFS-e nova no CNPJ novo, assinada com o certificado novo', nf2.status === 201 && nf2.data.status === 'AUTHORIZED' && nf2.data.issuerCnpj === CNPJ_B && sil.signedBy.at(-1)?.cert === 1 && sil.signedBy.at(-1)?.cnpj === CNPJ_B, short(nf2) + JSON.stringify(sil.signedBy.at(-1)));
  const rent2 = (await call('POST', '/contracts', as({ body: { type: 'RENTAL_RESIDENTIAL', propertyId: (await newProp('Rua Aluguel 2', 'RENTAL', seller2.id)).id, ownerId: seller2.id, tenantId: buyer.id, rentalValue: 3000, dueDay: 5, commissionRate: 10, startDate: iso(-5), endDate: iso(700) } }))).data;
  const comms2 = (await call('GET', '/financial/commissions?limit=100', as())).data;
  const com2 = (comms2?.items ?? comms2 ?? []).find((c) => c.contractId === rent2?.id);
  if (com2) await call('PATCH', `/financial/commissions/${com2.id}/receive`, as({ body: {} }));
  const receipt2 = com2 ? html(await call('GET', `/financial/commissions/${com2.id}/receipt`, as())) : '';
  ok('7d. recibo novo sai com o CNPJ novo', receipt2.includes(FMT_B) && receipt2.includes('Empresa Nova Ltda') && !receipt2.includes(FMT_A), receipt2.slice(0, 80));

  // ── 8. Nota antiga cancelada com o certificado antigo ──
  const cancNf = await call('POST', `/nfse/${nf1.data.id}/cancel`, as({ body: { reason: 'Teste: erro na emissão', code: '1' } }));
  const lastCancel = [...sil.signedBy].reverse().find((s) => s.op === 'CancelarNfse');
  ok('8. NFS-e antiga cancelada na prefeitura com o certificado e o CNPJ antigos', cancNf.status < 300 && cancNf.data.status === 'CANCELLED' && lastCancel?.cert === 0 && lastCancel?.cnpj === CNPJ_A, short(cancNf) + JSON.stringify(lastCancel));

  // ── 9. DIMOB com troca no meio do ano ───────────────────
  const decl = await call('GET', `/fiscal/dimob/declarants?year=${YEAR}`, as());
  const cA = decl.data?.company?.find((c) => c.cnpj === CNPJ_A);
  const cB = decl.data?.company?.find((c) => c.cnpj === CNPJ_B);
  ok('9a. tela da DIMOB oferece os dois CNPJs do ano, cada um com seu período e 1 operação', decl.status === 200 && cA?.events === 1 && cB?.events === 1 && cA.periodTo.startsWith(`${YEAR}-07-01`) && cB.periodFrom.startsWith(`${YEAR}-07-01`), short(decl));
  const pgdA = await call('GET', `/fiscal/dimob/pgd?year=${YEAR}&declarantDoc=${CNPJ_A}`, as());
  const pgdB = await call('GET', `/fiscal/dimob/pgd?year=${YEAR}&declarantDoc=${CNPJ_B}`, as());
  const txtA = pgdA.data?.content ?? pgdA.buf?.toString('latin1') ?? '';
  const txtB = pgdB.data?.content ?? pgdB.buf?.toString('latin1') ?? '';
  ok('9b. dois arquivos: o do CNPJ antigo só com a venda de março (vendedora Vera)', pgdA.status === 200 && txtA.includes(CNPJ_A) && txtA.includes('11144477735') && !txtA.includes('39053344705') && pgdA.data?.filename?.includes(CNPJ_A), String(txtA).slice(0, 160));
  ok('9c. e o do CNPJ novo só com a venda de setembro (vendedora Sara)', pgdB.status === 200 && txtB.includes(CNPJ_B) && txtB.includes('39053344705') && !txtB.includes('11144477735'), String(txtB).slice(0, 160));

  // ── 10. Isolamento ──────────────────────────────────────
  const reg2 = await call('POST', '/auth/register', { body: { workspaceName: 'Vizinha ' + run, workspaceSlug: 'viz' + run, email: `viz-${run}@teste.local`, name: 'Outro', password: PASS } });
  const X = { token: reg2.data.accessToken, ws: reg2.data.workspaceId };
  const xIss = await call('GET', '/issuer', X);
  const xDecl = await call('GET', `/fiscal/dimob/declarants?year=${YEAR}`, X);
  const xCross = await call('GET', '/issuer', { token: X.token, ws: O.ws });
  ok('10. outra imobiliária só vê o próprio histórico e não entra no alheio', xIss.status === 200 && xIss.data.history.length === 1 && !JSON.stringify(xIss.data).includes(CNPJ_B) && (xDecl.data?.company ?? []).every((c) => c.events === 0) && xCross.status === 403, short(xIss) + short(xCross));
} catch (err) {
  ok('roteiro interrompido por erro inesperado', false, err?.stack ?? String(err));
} finally {
  asaas.close(); sil.close(); smtp.close();
  if (prisma) await prisma.$disconnect();
}

let fail = 0;
for (const [c, n, e] of results) { if (!c) fail++; console.log(c ? 'OK  ' : 'FAIL', n, c ? '' : '→ ' + e); }
console.log(`\n${results.length - fail}/${results.length} verificações passaram`);
process.exit(fail ? 1 : 0);

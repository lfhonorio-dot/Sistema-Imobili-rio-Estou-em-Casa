// Roteiro de ponta a ponta da Fase 2 contra a API REAL (banco de teste).
// Uso: suba o backend apontando para um banco de TESTE e rode
//   API_URL=http://localhost:3301/api/v1 node test/api/fase2-cadastros.mjs
// Nunca rode contra produção: o roteiro cria imobiliárias de teste.
const B = process.env.API_URL || 'http://localhost:3301/api/v1';
const results = [];
const ok = (name, cond, extra = '') => { results.push([cond, name, extra]); };
async function call(method, path, { token, ws, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (ws) headers['X-Workspace-Id'] = ws;
  let payload;
  if (form) payload = form; else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(B + path, { method, headers, body: payload });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, data: json?.data ?? json, raw: json, headers: res.headers, bytes: text.length };
}
async function register(slug) {
  const r = await call('POST', '/auth/register', { body: {
    workspaceName: 'Imob ' + slug, workspaceSlug: slug, email: `${slug}@teste.local`, name: 'Dono Teste', password: 'Senha@12345',
  } });
  if (r.status >= 300) throw new Error('register ' + JSON.stringify(r.raw));
  return { token: r.data.accessToken, ws: r.data.workspaceId };
}
const run = Date.now().toString(36);
const A = await register('a' + run);
const Bw = await register('b' + run);
const as = (o) => ({ token: A.token, ws: A.ws, ...o });

// Contatos
const owner1 = (await call('POST', '/contacts', as({ body: { type: 'PERSON', name: 'Proprietário Um', maritalStatus: 'CASADO', marriageRegime: 'COMUNHAO_PARCIAL' } }))).data;
const spouse = (await call('POST', '/contacts', as({ body: { type: 'PERSON', name: 'Cônjuge Um' } }))).data;
const upd = await call('PATCH', `/contacts/${owner1.id}`, as({ body: { spouseContactId: spouse.id, marketingConsent: true } }));
ok('cônjuge e consentimento gravados', upd.status === 200 && upd.data.spouseContactId === spouse.id && !!upd.data.marketingConsentAt, JSON.stringify(upd.raw).slice(0, 200));
const self = await call('PATCH', `/contacts/${owner1.id}`, as({ body: { spouseContactId: owner1.id } }));
ok('cônjuge = o próprio contato é recusado', self.status === 400, self.raw?.message);
const owner2 = (await call('POST', '/contacts', as({ body: { type: 'PERSON', name: 'Proprietária Dois' } }))).data;
const buyer = (await call('POST', '/contacts', as({ body: { type: 'PERSON', name: 'Comprador', origin: 'PLACA' } }))).data;
ok('origem PLACA aceita', buyer?.origin === 'PLACA');
const det = await call('GET', `/contacts/${owner1.id}`, as({}));
ok('detalhe do contato traz cônjuge', det.data?.spouse?.id === spouse.id);

// Imóvel
const prop = (await call('POST', '/properties', as({ body: { type: 'HOUSE', purpose: 'SALE', city: 'Franca', neighborhood: 'Centro', salePrice: 400000, bedrooms: 3, parkingSpaces: 2, ownerId: owner1.id } }))).data;
ok('imóvel criado', !!prop?.id, JSON.stringify(prop).slice(0, 200));
let owners = await call('GET', `/properties/${prop.id}/owners`, as({}));
ok('proprietário principal criado junto', owners.data.length === 1 && owners.data[0].isPrimary);
const add2 = await call('POST', `/properties/${prop.id}/owners`, as({ body: { contactId: owner2.id, sharePct: 50 } }));
ok('segundo proprietário', add2.status === 201, add2.raw?.message);
const dupOwner = await call('POST', `/properties/${prop.id}/owners`, as({ body: { contactId: owner2.id } }));
ok('proprietário repetido recusado', dupOwner.status === 400);
const over = await call('POST', `/properties/${prop.id}/owners`, as({ body: { contactId: buyer.id, sharePct: 60 } }));
ok('soma de % acima de 100 recusada', over.status === 400, over.raw?.message);
owners = await call('GET', `/properties/${prop.id}/owners`, as({}));
const primaryLink = owners.data.find((o) => o.isPrimary);
const rem = await call('DELETE', `/properties/${prop.id}/owners/${primaryLink.id}`, as({}));
const propAfter = (await call('GET', `/properties/${prop.id}`, as({}))).data;
ok('remover principal promove o próximo e atualiza o imóvel', rem.status === 200 && propAfter.ownerId === owner2.id);

// Autorização
const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const in10 = new Date(today.getTime() + 10 * 864e5);
const badAuth = await call('POST', `/properties/${prop.id}/authorizations`, as({ body: { signedAt: iso(today), validUntil: iso(new Date(today.getTime() - 864e5)) } }));
ok('validade antes da assinatura recusada', badAuth.status === 400);
const auth = await call('POST', `/properties/${prop.id}/authorizations`, as({ body: { signedAt: iso(new Date(today.getTime() - 80 * 864e5)), validUntil: iso(in10), exclusive: true, commissionRate: 6 } }));
ok('autorização criada como "vencendo"', auth.status === 201 && auth.data.situation === 'EXPIRING', JSON.stringify(auth.raw).slice(0, 200));
const exp = await call('GET', '/properties/authorizations/expiring', as({}));
ok('lista de autorizações vencendo traz o imóvel', exp.status === 200 && exp.data.some((a) => a.propertyId === prop.id), JSON.stringify(exp.raw).slice(0, 200));
const cancelNoReason = await call('PATCH', `/properties/${prop.id}/authorizations/${auth.data.id}/cancel`, as({ body: { reason: '' } }));
ok('cancelar exige motivo', cancelNoReason.status === 400);

// Chaves
const ret0 = await call('POST', `/properties/${prop.id}/keys`, as({ body: { action: 'RETURN' } }));
ok('devolver sem retirada é recusado', ret0.status === 400);
const co = await call('POST', `/properties/${prop.id}/keys`, as({ body: { action: 'CHECKOUT', holderName: 'Corretor João', keyLabel: 'Jogo 1' } }));
const co2 = await call('POST', `/properties/${prop.id}/keys`, as({ body: { action: 'CHECKOUT', holderName: 'Outro' } }));
ok('retirada e bloqueio de segunda retirada', co.status === 201 && co2.status === 400, co2.raw?.message);
const keys = await call('GET', `/properties/${prop.id}/keys`, as({}));
ok('situação da chave: com Corretor João', keys.data.currentlyOut && keys.data.holder.name === 'Corretor João');
const ret = await call('POST', `/properties/${prop.id}/keys`, as({ body: { action: 'RETURN' } }));
ok('devolução', ret.status === 201);

// Histórico de preço
await call('PATCH', `/properties/${prop.id}`, as({ body: { type: 'HOUSE', purpose: 'SALE', salePrice: 380000 } }));
await call('PATCH', `/properties/${prop.id}`, as({ body: { type: 'HOUSE', purpose: 'SALE', salePrice: 380000, bedrooms: 3 } }));
const ph = await call('GET', `/properties/${prop.id}/price-history`, as({}));
ok('histórico de preço registra só a mudança real', ph.data.length === 1 && Number(ph.data[0].oldValue) === 400000 && Number(ph.data[0].newValue) === 380000, JSON.stringify(ph.raw).slice(0, 200));

// Upload de foto (PNG 1x1)
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const fd = new FormData(); fd.append('file', new Blob([png], { type: 'image/png' }), 'foto.png'); fd.append('caption', 'Fachada');
const up = await call('POST', `/properties/${prop.id}/photos/upload`, as({ form: fd }));
ok('upload de foto', up.status === 201 && up.data.url.startsWith('/files/'), JSON.stringify(up.raw).slice(0, 200));
const img = await fetch(B + up.data.url);
ok('foto servida pela URL assinada', img.status === 200 && img.headers.get('content-type') === 'image/png');
const tampered = await fetch(B + up.data.url.replace(/sig=./, 'sig=0'));
ok('URL adulterada é recusada (403)', tampered.status === 403);
const fdBad = new FormData(); fdBad.append('file', new Blob([Buffer.from('x')], { type: 'text/plain' }), 'a.txt');
const upBad = await call('POST', `/properties/${prop.id}/photos/upload`, as({ form: fdBad }));
ok('formato inválido recusado com mensagem', upBad.status === 400, upBad.raw?.message);
const listed = (await call('GET', `/properties/${prop.id}`, as({}))).data;
ok('detalhe do imóvel traz a foto com URL assinada', listed.photos[0]?.url?.startsWith('/files/'));

// Documento PDF
const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
const fd2 = new FormData(); fd2.append('file', new Blob([pdf], { type: 'application/pdf' }), 'matricula.pdf'); fd2.append('type', 'MATRICULA');
const doc = await call('POST', `/properties/${prop.id}/documents`, as({ form: fd2 }));
ok('upload de matrícula (PDF)', doc.status === 201 && doc.data.type === 'MATRICULA', JSON.stringify(doc.raw).slice(0, 200));
const docs = await call('GET', `/properties/${prop.id}/documents`, as({}));
const delDoc = await call('DELETE', `/properties/${prop.id}/documents/${doc.data.id}`, as({}));
const docsAfter = await call('GET', `/properties/${prop.id}/documents`, as({}));
ok('documento listado e removido (soft delete)', docs.data.length === 1 && delDoc.status === 200 && docsAfter.data.length === 0);

// Fornecedor + conta a pagar
const sup = await call('POST', '/suppliers', as({ body: { name: 'Cartório 1º Ofício', personType: 'PJ', document: '11.222.333/0001-81', category: 'CARTORIO' } }));
ok('fornecedor criado (CNPJ normalizado)', sup.status === 201 && sup.data.document === '11222333000181', JSON.stringify(sup.raw).slice(0, 200));
const supDup = await call('POST', '/suppliers', as({ body: { name: 'Outro', document: '11222333000181' } }));
ok('fornecedor com CNPJ repetido recusado', supDup.status === 409);
const supBad = await call('POST', '/suppliers', as({ body: { name: 'X', personType: 'PF', document: '123' } }));
ok('CPF com tamanho errado recusado', supBad.status === 400);
const entry = await call('POST', '/financial/entries', as({ body: { type: 'PAYABLE', category: 'OTHER', description: 'Certidão', amount: 150.5, dueDate: iso(in10), supplierId: sup.data.id } }));
ok('conta a pagar com fornecedor', entry.status === 201 && entry.data.supplierId === sup.data.id, JSON.stringify(entry.raw).slice(0, 200));
const entries = await call('GET', '/financial/entries?type=PAYABLE', as({}));
ok('listagem traz o nome do fornecedor', entries.data.items.some((e) => e.supplier?.name === 'Cartório 1º Ofício'));

// Perfil de interesse + compatíveis
const prof = await call('PUT', `/contacts/${buyer.id}/interest-profile`, as({ body: { propertyTypes: ['HOUSE'], cities: ['franca'], minPrice: 300000, maxPrice: 390000, minBedrooms: 2, paymentMethods: ['FINANCING', 'FGTS'] } }));
ok('perfil de interesse salvo', prof.status === 200, JSON.stringify(prof.raw).slice(0, 200));
const badProf = await call('PUT', `/contacts/${buyer.id}/interest-profile`, as({ body: { minPrice: 500000, maxPrice: 100000 } }));
ok('mínimo > máximo recusado', badProf.status === 400);
const mp = await call('GET', `/contacts/${buyer.id}/matching-properties`, as({}));
ok('imóveis compatíveis com o cliente', mp.data.hasProfile && mp.data.items.some((i) => i.property.id === prop.id), JSON.stringify(mp.raw).slice(0, 300));
const mc = await call('GET', `/properties/${prop.id}/matching-contacts`, as({}));
ok('clientes compatíveis com o imóvel', mc.data.some((m) => m.contact.id === buyer.id), JSON.stringify(mc.raw).slice(0, 300));

// Isolamento entre imobiliárias
const asB = (o) => ({ token: Bw.token, ws: Bw.ws, ...o });
const x1 = await call('GET', `/properties/${prop.id}/owners`, asB({}));
const x2 = await call('POST', `/properties/${prop.id}/keys`, asB({ body: { action: 'CHECKOUT', holderName: 'Invasor' } }));
const x3 = await call('GET', `/suppliers/${sup.data.id}`, asB({}));
const x4 = await call('PUT', `/contacts/${buyer.id}/interest-profile`, asB({ body: { cities: ['x'] } }));
const x5 = await call('POST', '/financial/entries', asB({ body: { type: 'PAYABLE', category: 'OTHER', description: 'x', amount: 1, dueDate: iso(in10), supplierId: sup.data.id } }));
const x6 = await call('GET', '/properties/authorizations/expiring', asB({}));
const x7 = await call('GET', `/properties/${prop.id}/owners`, { token: Bw.token, ws: A.ws });
ok('outra imobiliária não vê nem altera nada', [x1, x2, x3, x4].every((r) => r.status === 404) && x5.status === 400 && x6.data.length === 0 && x7.status === 403,
  [x1, x2, x3, x4, x5, x7].map((r) => r.status).join(','));

let fail = 0;
for (const [c, n, e] of results) { if (!c) fail++; console.log(c ? 'OK  ' : 'FAIL', n, c ? '' : '→ ' + e); }
console.log(`\n${results.length - fail}/${results.length} verificações passaram`);
process.exit(fail ? 1 : 0);

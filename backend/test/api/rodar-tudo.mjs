// Roda TODOS os roteiros de ponta a ponta, um de cada vez, e resume o resultado.
// É o que o GitHub Actions executa para liberar (ou bloquear) o merge.
// Uso (de dentro de backend/, com o backend de TESTE rodando):
//   API_URL=http://localhost:3001/api/v1 DATABASE_URL=... node test/api/rodar-tudo.mjs
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const ROTEIROS = [
  ['fluxo-de-ouro.mjs', 'FLUXO DE OURO completo (captação → ... → DIMOB)'],
  ['isolamento-workspaces.mjs', 'Isolamento entre imobiliárias'],
  ['fase2-cadastros.mjs', 'Cadastros (imóvel, cliente, fornecedores)'],
  ['fase3-funil.mjs', 'Funil de venda (visita, proposta, ganho)'],
  ['fase4-contrato-venda.mjs', 'Contrato de venda: contas automáticas e rescisão'],
  ['fase5-financeiro.mjs', 'Financeiro: baixa parcial, boleto e PIX por webhook'],
  ['fase6-nfse.mjs', 'NFS-e com prefeitura simulada'],
  ['fase7-permissoes.mjs', 'Permissões do Corretor, relatórios, avisos, LGPD'],
  ['dados-emitente.mjs', 'Troca de CNPJ: documentos antigos intactos, novos com a empresa nova, DIMOB por CNPJ'],
];
const only = process.argv.slice(2);
const resumo = [];
for (const [file, title] of ROTEIROS) {
  if (only.length && !only.some((o) => file.includes(o))) continue;
  console.log(`\n══════ ${title} (${file}) ══════`);
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(dir, file)], { encoding: 'utf8', env: process.env, timeout: 10 * 60 * 1000 });
  const out = (r.stdout ?? '') + (r.stderr ?? '');
  const m = out.match(/(\d+)\/(\d+) verificações passaram/);
  const passed = r.status === 0 && !!m && m[1] === m[2];
  // mostra só as falhas e o total: o registro completo fica grande demais
  console.log(out.split('\n').filter((l) => !l.startsWith('OK  ')).join('\n').trim());
  resumo.push([passed, title, m ? `${m[1]}/${m[2]}` : 'não terminou', ((Date.now() - t0) / 1000).toFixed(0) + 's']);
}
console.log('\n══════ RESUMO ══════');
for (const [p, t, n, s] of resumo) console.log(`${p ? 'PASSOU' : 'FALHOU'}  ${n.padEnd(8)} ${s.padStart(5)}  ${t}`);
const falhas = resumo.filter((r) => !r[0]).length;
console.log(falhas ? `\n${falhas} roteiro(s) com falha — o merge deve ficar BLOQUEADO.` : '\nTodos os roteiros passaram.');
process.exit(falhas || !resumo.length ? 1 : 0);

/**
 * Preenche catalog.json com titulo, preco e offer_hash de cada produto,
 * consultando GET /products/{hash} na API da IronPay.
 *
 *   node scripts/fetch-catalog.mjs
 *
 * O token e lido de .env (IRONPAY_API_TOKEN) e nunca e impresso.
 * Rode de novo sempre que mudar preco ou criar oferta nova.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://api.ironpayapp.com.br/api/public/v1';

/** Le o .env sem depender de pacote externo. */
async function carregarToken() {
  let bruto;
  try {
    bruto = await readFile(join(RAIZ, '.env'), 'utf8');
  } catch {
    falhar(
      'Arquivo .env nao encontrado.',
      'Copie .env.example para .env e preencha IRONPAY_API_TOKEN com o token do painel da IronPay.'
    );
  }
  for (const linha of bruto.split('\n')) {
    const m = linha.match(/^\s*IRONPAY_API_TOKEN\s*=\s*(.*)\s*$/);
    if (m) {
      const valor = m[1].trim().replace(/^["']|["']$/g, '');
      if (valor) return valor;
    }
  }
  falhar('IRONPAY_API_TOKEN esta vazio no .env.', 'Cole o token do painel da IronPay e rode de novo.');
}

function falhar(...linhas) {
  console.error('\n  ' + linhas.join('\n  ') + '\n');
  process.exit(1);
}

/** Busca um produto. Devolve {ok, dados} ou {ok:false, motivo}. */
async function buscarProduto(hash, token) {
  const url = `${BASE}/products/${encodeURIComponent(hash)}?api_token=${encodeURIComponent(token)}`;
  let resposta;
  try {
    resposta = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch (erro) {
    return { ok: false, motivo: `falha de rede (${erro.message})` };
  }
  if (resposta.status === 401) return { ok: false, motivo: 'token invalido ou sem permissao (401)' };
  if (resposta.status === 404) return { ok: false, motivo: 'nao encontrado (404) — e um product_hash mesmo?' };
  if (!resposta.ok) return { ok: false, motivo: `HTTP ${resposta.status}` };

  let corpo;
  try {
    corpo = await resposta.json();
  } catch {
    return { ok: false, motivo: 'resposta nao era JSON' };
  }
  // A API ora devolve o objeto direto, ora embrulhado em {success, data}.
  return { ok: true, dados: corpo?.data ?? corpo };
}

/** Escolhe a oferta a usar: a primeira ativa, senao a primeira que existir. */
function escolherOferta(produto) {
  const ofertas = Array.isArray(produto?.offers) ? produto.offers : [];
  if (ofertas.length === 0) return null;
  return ofertas.find((o) => o.status === 1) ?? ofertas[0];
}

const token = await carregarToken();
const catalogo = JSON.parse(await readFile(join(RAIZ, 'catalog.json'), 'utf8'));

console.log(`\n  Consultando ${catalogo.items.length} produtos na IronPay...\n`);

const problemas = [];

for (const item of catalogo.items) {
  const { ok, dados, motivo } = await buscarProduto(item.product_hash, token);

  if (!ok) {
    problemas.push(`${item.product_hash} (${item.role}): ${motivo}`);
    console.log(`  ✗ ${item.product_hash}  ${motivo}`);
    continue;
  }

  const oferta = escolherOferta(dados);
  item.title = dados?.title ?? null;
  item.offer_hash = oferta?.hash ?? null;
  item.price_cents = oferta?.price ?? dados?.price ?? null;
  item.tangible = dados?.product_type ? dados.product_type !== 'digital' : false;

  const ofertasEncontradas = Array.isArray(dados?.offers) ? dados.offers.length : 0;
  const preco = item.price_cents == null ? '?' : (item.price_cents / 100).toFixed(2);
  console.log(
    `  ✓ ${item.product_hash}  R$ ${preco.padStart(8)}  ${item.title ?? '(sem titulo)'}` +
      (ofertasEncontradas > 1 ? `  [${ofertasEncontradas} ofertas — conferir qual e a certa]` : '')
  );

  if (!item.offer_hash) problemas.push(`${item.product_hash}: nenhuma oferta retornada — offer_hash ficou nulo`);
  if (item.price_cents == null) problemas.push(`${item.product_hash}: preco nao veio na resposta`);
}

// So carimba a data quando tudo veio certo — assim um catalog.json com
// _generated_at preenchido significa "confiavel", sem meio-termo.
if (problemas.length === 0) catalogo._generated_at = new Date().toISOString();
await writeFile(join(RAIZ, 'catalog.json'), JSON.stringify(catalogo, null, 2) + '\n');

console.log(`\n  catalog.json ${problemas.length ? 'gravado parcialmente' : 'atualizado'}.`);

if (problemas.length) {
  console.log('\n  Pendencias:');
  for (const p of problemas) console.log(`    - ${p}`);
  console.log('');
  process.exit(1);
}
console.log('');

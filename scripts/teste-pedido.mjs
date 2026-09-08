/**
 * Testes de montagem do pedido — a parte que decide quanto o cliente paga.
 *
 *   npm test
 *
 * Roda contra um catalogo falso em memoria, entao nao precisa de token nem de
 * rede. O que se verifica aqui: o total bate, bump desconhecido e recusado, e
 * o preco nunca vem do cliente.
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFile, writeFile, rename } from 'node:fs/promises';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const CAMINHO = join(RAIZ, 'catalog.json');

const CATALOGO_FALSO = {
  _generated_at: '2026-09-08T00:00:00.000Z',
  items: [
    { id: 'guia', role: 'front', product_hash: 'front_hash', offer_hash: 'front_hash', title: 'Guia', price_cents: 1000 },
    { id: 'bump1', role: 'bump', product_hash: 'b1_hash', offer_hash: 'b1_hash', title: 'Bump Um', price_cents: 990 },
    { id: 'bump2', role: 'bump', product_hash: 'b2_hash', offer_hash: 'b2_hash', title: 'Bump Dois', price_cents: 1990 },
    { id: 'bump3', role: 'bump', product_hash: 'b3_hash', offer_hash: 'b3_hash', title: null, price_cents: null }
  ]
};

let falhas = 0;
function checar(descricao, condicao) {
  console.log(`  ${condicao ? '✓' : '✗'} ${descricao}`);
  if (!condicao) falhas++;
}

// Troca o catalog.json pelo falso, roda, e devolve o original no fim.
const original = await readFile(CAMINHO, 'utf8');
const backup = CAMINHO + '.bak';
await writeFile(backup, original);

try {
  await writeFile(CAMINHO, JSON.stringify(CATALOGO_FALSO, null, 2));
  const require = createRequire(import.meta.url);
  const { montarPedido, bumpsParaCliente, statusConfiguracao } = require('../lib/ofertas.js');

  console.log('\n  Pedido sem bump');
  const so = montarPedido([]);
  checar('aceita', so.ok);
  checar('total = 1000 (so o front)', so.amount === 1000);
  checar('cart tem 1 item', so.cart.length === 1);
  checar('offer_hash e o do front', so.offerHash === 'front_hash');
  checar('operation_type = 1 no front', so.cart[0].operation_type === 1);

  console.log('\n  Pedido com dois bumps');
  const dois = montarPedido(['bump1', 'bump2']);
  checar('aceita', dois.ok);
  checar('total = 3980 (1000 + 990 + 1990)', dois.amount === 3980);
  checar('cart tem 3 itens', dois.cart.length === 3);
  checar('todos com operation_type = 1', dois.cart.every(i => i.operation_type === 1));
  checar('soma do cart bate com o amount', dois.cart.reduce((s, i) => s + i.price, 0) === dois.amount);

  console.log('\n  Entradas que precisam ser recusadas');
  checar('bump inexistente e recusado', montarPedido(['nao_existe']).ok === false);
  checar('bump sem preco e recusado', montarPedido(['bump3']).ok === false);
  checar('bump repetido nao cobra duas vezes', montarPedido(['bump1', 'bump1']).amount === 1990);
  checar('id do front nao entra como bump', montarPedido(['guia']).ok === false);

  console.log('\n  O que vai para o navegador');
  const publicos = bumpsParaCliente();
  const serializado = JSON.stringify(publicos);
  checar('so os bumps configurados aparecem (2)', publicos.length === 2);
  checar('nenhum product_hash vaza', !serializado.includes('_hash'));
  checar('nenhum offer_hash vaza', !/offer/i.test(serializado));

  console.log('\n  Diagnostico');
  const st = statusConfiguracao();
  checar('aponta o bump sem preco', st.pendencias.some(p => p.includes('bump3')));
} finally {
  await rename(backup, CAMINHO);
}

console.log(falhas ? `\n  ${falhas} falha(s)\n` : '\n  tudo certo\n');
process.exit(falhas ? 1 : 0);

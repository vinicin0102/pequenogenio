/**
 * Catalogo do funil — FONTE DA VERDADE DE PRECO.
 *
 * O navegador envia apenas os ids dos bumps marcados. O valor cobrado e montado
 * aqui, no servidor. Se o preco viesse do cliente, qualquer pessoa abriria o
 * DevTools e compraria por R$ 0,01.
 *
 * Hashes e precos vem de catalog.json, preenchido por `npm run catalog` a partir
 * da API da IronPay. Nada de preco digitado a mao: um centavo errado em oito
 * produtos passa despercebido ate a primeira venda.
 *
 * Valores em CENTAVOS.
 */

const catalogo = require('../catalog.json');

/**
 * Copy dos order bumps, por id.
 *
 * A API devolve titulo e preco, mas nao a descricao de venda — essa e decisao
 * de marketing, entao mora aqui. Bump sem descricao ainda funciona: a tela cai
 * no titulo vindo da API.
 */
const COPY = {
  // bump1: { descricao: 'Texto que aparece na caixinha do bump.' },
};

/** Itens de cart no formato que a IronPay espera.
 *
 * operation_type: 1 vale para TODOS os itens — produto principal e order bumps.
 * Bump nao tem codigo proprio: e mais um item no array, somando no `amount`.
 */
function itemCart(productHash, title, price) {
  return {
    product_hash: productHash,
    title,
    cover: null,
    price,
    quantity: 1,
    operation_type: 1,
    tangible: false
  };
}

const itens = Array.isArray(catalogo?.items) ? catalogo.items : [];

const FRONT = itens.find(i => i.role === 'front') || null;
const BUMPS = itens.filter(i => i.role === 'bump');

/** Um item so e vendavel quando tem id, hash, titulo e preco maior que zero. */
function configurado(item) {
  return Boolean(
    item && item.id && item.product_hash && item.offer_hash && item.title && item.price_cents > 0
  );
}

/**
 * Monta o pedido a partir dos bumps marcados.
 * Retorna { ok:true, amount, cart, offerHash, resumo } ou { ok:false, erro, codigo }.
 */
function montarPedido(bumpIds = []) {
  if (!configurado(FRONT)) {
    return {
      ok: false,
      codigo: 'FRONT_NAO_CONFIGURADO',
      erro: 'Produto principal sem titulo ou preco em catalog.json. Rode `npm run catalog`.'
    };
  }

  let amount = FRONT.price_cents;
  const cart = [itemCart(FRONT.product_hash, FRONT.title, FRONT.price_cents)];
  const resumo = [{ titulo: FRONT.title, amount: FRONT.price_cents }];

  // Ids unicos, na ordem do catalogo — nao na ordem que o cliente mandou.
  const marcados = new Set(Array.isArray(bumpIds) ? bumpIds.map(String) : []);

  for (const bump of BUMPS) {
    if (!marcados.has(bump.id)) continue;
    marcados.delete(bump.id);

    if (!configurado(bump)) {
      return {
        ok: false,
        codigo: 'BUMP_NAO_CONFIGURADO',
        erro: `Order bump "${bump.id}" sem titulo ou preco em catalog.json.`
      };
    }

    amount += bump.price_cents;
    cart.push(itemCart(bump.product_hash, bump.title, bump.price_cents));
    resumo.push({ titulo: bump.title, amount: bump.price_cents });
  }

  // Sobrou id que nao existe no catalogo: recusa em vez de cobrar a menos.
  if (marcados.size) {
    return {
      ok: false,
      codigo: 'BUMP_INVALIDO',
      erro: `Order bump desconhecido: ${[...marcados].join(', ')}.`
    };
  }

  return { ok: true, amount, cart, offerHash: FRONT.offer_hash, resumo };
}

/** Bumps prontos para o frontend. Os hashes nao saem do servidor. */
function bumpsParaCliente() {
  return BUMPS.filter(configurado).map(b => ({
    id: b.id,
    titulo: b.title,
    descricao: COPY[b.id]?.descricao || null,
    amount: b.price_cents
  }));
}

/** Produto principal para o frontend. */
function frontParaCliente() {
  if (!configurado(FRONT)) return null;
  return { titulo: FRONT.title, amount: FRONT.price_cents };
}

/** Usado pelo /api/diagnostico. */
function statusConfiguracao() {
  const pendencias = [];

  if (!FRONT) {
    pendencias.push('catalog.json nao tem nenhum item com role "front"');
  } else if (!configurado(FRONT)) {
    pendencias.push(`front "${FRONT.id}": ${FRONT.title ? 'preco' : 'titulo e preco'} nao preenchido`);
  }

  const ids = new Set();
  for (const item of itens) {
    // Id repetido faria dois produtos disputarem o mesmo identificador publico,
    // e o pedido cobraria o errado sem reclamar.
    if (ids.has(item.id)) pendencias.push(`id "${item.id}" aparece mais de uma vez em catalog.json`);
    ids.add(item.id);
  }

  for (const b of BUMPS) {
    if (!configurado(b)) {
      pendencias.push(`bump "${b.id}": ${b.title ? 'preco' : 'titulo e preco'} nao preenchido`);
    }
    if (b.offer_hash_api) {
      pendencias.push(`bump "${b.id}": a API devolveu offer_hash "${b.offer_hash_api}", diferente do product_hash`);
    }
  }

  if (!catalogo._generated_at) {
    pendencias.push('catalog.json nunca foi preenchido com sucesso — rode `npm run catalog`');
  }

  return { ok: pendencias.length === 0, pendencias, geradoEm: catalogo._generated_at || null };
}

module.exports = {
  FRONT,
  BUMPS,
  montarPedido,
  bumpsParaCliente,
  frontParaCliente,
  statusConfiguracao
};

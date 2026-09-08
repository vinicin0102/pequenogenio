/**
 * POST /api/criar-pix
 *
 * Corpo esperado (do navegador):
 *   { bumps: ["hash1", "hash2"], name, email, document, phone, tracking? }
 *
 * O navegador NAO envia valor. O total e montado em lib/ofertas.js, no servidor.
 */

const { criarTransacao, extrairDadosPix } = require('../lib/ironpay');
const { montarPedido } = require('../lib/ofertas');
const { validarCliente } = require('../lib/validacao');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ erro: 'Metodo nao permitido.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};

    // 1. Pedido — preco sempre do servidor.
    const pedido = montarPedido(body.bumps);
    if (!pedido.ok) {
      // Hash ou preco faltando e problema nosso, nao do comprador: 500 e a
      // mensagem real vai para o log, nunca para a tela.
      if (pedido.codigo.endsWith('NAO_CONFIGURADO')) {
        console.error(`[criar-pix] CONFIGURACAO: ${pedido.erro}`);
        return res.status(500).json({ erro: 'Checkout indisponivel no momento.', codigo: pedido.codigo });
      }
      return res.status(400).json({ erro: pedido.erro, codigo: pedido.codigo });
    }

    // 2. Dados do comprador.
    const validacao = validarCliente(body);
    if (!validacao.ok) {
      return res.status(422).json({ erro: 'Dados invalidos.', detalhes: validacao.erros });
    }

    // 3. Postback derivado do host da requisicao — funciona em preview e producao.
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const postbackUrl = process.env.IRONPAY_POSTBACK_URL || `${proto}://${host}/api/webhook`;

    const t = body?.tracking || {};
    const payload = {
      amount: pedido.amount,
      offer_hash: pedido.offerHash,
      payment_method: 'pix',
      customer: validacao.customer,
      cart: pedido.cart,
      // Obrigatorio mesmo no PIX: omitir devolve 400.
      installments: 1,
      expire_in_days: 1,
      transaction_origin: 'api',
      tracking: {
        src: t.src || '',
        utm_source: t.utm_source || '',
        utm_medium: t.utm_medium || '',
        utm_campaign: t.utm_campaign || '',
        utm_term: t.utm_term || '',
        utm_content: t.utm_content || ''
      },
      postback_url: postbackUrl
    };

    const transacao = await criarTransacao(payload);

    // Log unico para confirmar o schema real da resposta na primeira transacao.
    // Imprime apenas as CHAVES, nunca os valores.
    console.log('[criar-pix] chaves da resposta:', JSON.stringify(Object.keys(transacao?.data ?? transacao ?? {})));

    const pix = extrairDadosPix(transacao);

    if (!pix.copiaECola) {
      console.error('[criar-pix] copia-e-cola nao encontrado. Ajuste extrairDadosPix() em lib/ironpay.js.');
      return res.status(502).json({
        erro: 'Cobranca criada, mas o codigo PIX nao veio no formato esperado.',
        codigo: 'SCHEMA_PIX_INESPERADO',
        hash: pix.hash
      });
    }

    return res.status(201).json({
      hash: pix.hash,
      copiaECola: pix.copiaECola,
      imagemQr: pix.imagemQr,
      expiraEm: pix.expiraEm,
      valor: pedido.amount,
      itens: pedido.resumo
    });
  } catch (err) {
    console.error('[criar-pix] falhou:', err.message);

    if (err.message?.includes('IRONPAY_API_TOKEN')) {
      return res.status(500).json({ erro: 'Checkout indisponivel no momento.', codigo: 'TOKEN_AUSENTE' });
    }

    // 401 e culpa nossa (token errado), nao do comprador — vira 500.
    const status = err.status === 401 ? 500 : err.status || 500;
    return res.status(status).json({
      erro: status === 500
        ? 'Nao foi possivel gerar o PIX agora. Tente novamente.'
        : 'A operadora recusou a cobranca.',
      codigo: err.status === 401 ? 'TOKEN_INVALIDO' : 'ERRO_IRONPAY',
      detalhes: err.body?.message || undefined
    });
  }
};

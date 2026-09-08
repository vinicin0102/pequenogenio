/**
 * POST /api/webhook — postback da IronPay.
 *
 * Payload documentado:
 *   { transaction_hash, status, amount, payment_method, paid_at }
 *
 * IMPORTANTE: este endpoint e publico e o postback da IronPay NAO e assinado.
 * Qualquer pessoa que descubra a URL pode chamar com um corpo forjado dizendo
 * "status": "paid". Por isso ele nao confia no corpo: ao receber a notificacao,
 * reconsulta a transacao na IronPay e usa o status que a API devolve.
 * O corpo serve apenas como gatilho.
 */

const { consultarTransacao } = require('../lib/ironpay');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ erro: 'Metodo nao permitido.' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch {
    return res.status(400).json({ erro: 'Corpo invalido.' });
  }

  const hash = body.transaction_hash || body.hash;
  if (!hash) return res.status(400).json({ erro: 'transaction_hash ausente.' });

  try {
    // Nao confiamos no status do corpo — perguntamos para a fonte.
    const t = await consultarTransacao(hash);
    const dados = t?.data ?? t ?? {};
    const statusReal = dados.status ?? dados.payment_status;

    console.log(`[webhook] ${hash} -> ${statusReal}`);

    if (statusReal === 'paid') {
      await entregarProduto(dados);
    }

    // 200 rapido para a IronPay parar de reenviar.
    return res.status(200).json({ recebido: true });
  } catch (err) {
    console.error('[webhook] falhou:', err.message);
    // 500 sinaliza para a IronPay tentar de novo mais tarde.
    return res.status(500).json({ erro: 'Falha ao processar.' });
  }
};

/**
 * TODO: ligar a entrega real (e-mail com os links / area de membros).
 *
 * Precisa ser IDEMPOTENTE: a IronPay reenvia o mesmo postback, e o cliente nao
 * pode receber o material duas vezes nem a venda ser contada em dobro.
 */
async function entregarProduto(transacao) {
  console.log('[webhook] entrega pendente de implementacao para', transacao.hash);
}

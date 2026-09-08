/**
 * GET /api/status?hash=...
 *
 * Consultado pelo navegador em polling enquanto a tela do QR Code esta aberta.
 * Devolve so o status — nada de dados do comprador.
 */

const { consultarTransacao } = require('../lib/ironpay');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ erro: 'Metodo nao permitido.' });
  }

  const hash = String(req.query?.hash || '').trim();
  if (!hash || !/^[A-Za-z0-9_-]{4,64}$/.test(hash)) {
    return res.status(400).json({ erro: 'Hash invalido.' });
  }

  try {
    const t = await consultarTransacao(hash);
    const dados = t?.data ?? t ?? {};
    const status = dados.status ?? dados.payment_status ?? 'pending';

    // Sem cache: o navegador precisa do estado atual a cada chamada.
    res.setHeader('Cache-Control', 'no-store');

    return res.status(200).json({
      status,
      pago: status === 'paid',
      finalizado: ['paid', 'canceled', 'refunded'].includes(status)
    });
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ erro: 'Transacao nao encontrada.' });
    console.error('[status] falhou:', err.message);
    return res.status(500).json({ erro: 'Nao foi possivel consultar o status.' });
  }
};

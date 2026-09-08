/**
 * GET /api/ofertas
 *
 * Alimenta a tela de checkout: produto principal e order bumps disponiveis.
 * Nao devolve product_hash nem offer_hash — o navegador nao precisa deles.
 */

const { frontParaCliente, bumpsParaCliente } = require('../lib/ofertas');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ erro: 'Metodo nao permitido.' });
  }

  const front = frontParaCliente();
  if (!front) {
    console.error('[ofertas] produto principal sem titulo ou preco em catalog.json');
    return res.status(500).json({ erro: 'Checkout indisponivel no momento.' });
  }

  res.setHeader('Cache-Control', 'public, max-age=60');
  return res.status(200).json({ front, bumps: bumpsParaCliente() });
};

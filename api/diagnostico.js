/**
 * GET /api/diagnostico
 *
 * Checagem rapida antes de por no ar: token presente, catalogo completo e a
 * API respondendo. Nao devolve o token nem os hashes — so o que esta faltando.
 */

const { statusConfiguracao } = require('../lib/ofertas');
const { consultarProduto } = require('../lib/ironpay');
const { FRONT } = require('../lib/ofertas');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ erro: 'Metodo nao permitido.' });
  }

  const catalogo = statusConfiguracao();
  const tokenPresente = Boolean(process.env.IRONPAY_API_TOKEN);

  let api = { ok: false, detalhe: 'nao testado' };
  if (!tokenPresente) {
    api = { ok: false, detalhe: 'IRONPAY_API_TOKEN nao definido' };
  } else if (!FRONT?.product_hash) {
    api = { ok: false, detalhe: 'sem product_hash do front para testar' };
  } else {
    try {
      await consultarProduto(FRONT.product_hash);
      api = { ok: true, detalhe: 'a API respondeu ao produto principal' };
    } catch (err) {
      api = {
        ok: false,
        detalhe: err.status === 401 ? 'token recusado (401)' : `falhou com ${err.status || 'erro de rede'}`
      };
    }
  }

  const ok = catalogo.ok && tokenPresente && api.ok;

  res.setHeader('Cache-Control', 'no-store');
  return res.status(ok ? 200 : 503).json({
    ok,
    token: tokenPresente ? 'definido' : 'ausente',
    api,
    catalogo: {
      ok: catalogo.ok,
      geradoEm: catalogo.geradoEm,
      pendencias: catalogo.pendencias
    }
  });
};

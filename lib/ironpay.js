/**
 * Cliente da API publica da IronPay.
 *
 * O token NUNCA aparece aqui em texto puro: vem de process.env.IRONPAY_API_TOKEN,
 * definido no painel de variaveis de ambiente da hospedagem. Este arquivo roda
 * somente no servidor — nada daqui e enviado ao navegador.
 *
 * Docs: https://docs.ironpayapp.com.br
 */

const BASE_URL = 'https://api.ironpayapp.com.br/api/public/v1';

function getToken() {
  const token = process.env.IRONPAY_API_TOKEN;
  if (!token) {
    throw new Error('IRONPAY_API_TOKEN nao definido. Configure a variavel de ambiente na hospedagem.');
  }
  return token;
}

/**
 * A IronPay autentica via query param `api_token`, nao por header.
 * A URL e montada aqui para o token jamais ser logado junto do corpo.
 */
function buildUrl(path, params = {}) {
  const url = new URL(BASE_URL + path);
  url.searchParams.set('api_token', getToken());
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  return url;
}

/** Remove o token de qualquer string antes de ir para o log. */
function redact(text) {
  const token = process.env.IRONPAY_API_TOKEN;
  if (!token) return text;
  return String(text).split(token).join('***REDACTED***');
}

async function request(method, path, { params, body } = {}) {
  const url = buildUrl(path, params);

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });

  const raw = await res.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = { _raw: raw };
  }

  if (!res.ok) {
    const err = new Error(`IronPay ${method} ${path} respondeu ${res.status}`);
    err.status = res.status;
    err.body = data;
    console.error(redact(`[ironpay] ${method} ${path} -> ${res.status}: ${raw.slice(0, 500)}`));
    throw err;
  }

  return data;
}

/** POST /transactions — cria a cobranca. `amount` e `price` em CENTAVOS. */
function criarTransacao(payload) {
  return request('POST', '/transactions', { body: payload });
}

/** GET /transactions/{hash} — usado no polling e na conferencia do webhook. */
function consultarTransacao(hash) {
  return request('GET', `/transactions/${encodeURIComponent(hash)}`);
}

/** GET /products/{hash} */
function consultarProduto(hash) {
  return request('GET', `/products/${encodeURIComponent(hash)}`);
}

/**
 * A doc publica descreve o corpo da requisicao e mostra `pix.pix_qr_code` na
 * resposta, mas nao publica o schema completo. Os nomes abaixo cobrem as formas
 * mais comuns; a primeira transacao real confirma qual e a correta — por isso
 * criar-pix.js loga as CHAVES da resposta.
 */
function extrairDadosPix(transacao) {
  const t = transacao?.data ?? transacao ?? {};
  const pix = t.pix ?? t.pix_information ?? t.payment ?? t.charge ?? {};

  const copiaECola =
    pix.pix_qr_code ?? pix.qr_code ?? pix.emv ?? pix.copy_paste ?? pix.payload ??
    t.pix_qr_code ?? t.qr_code ?? null;

  const imagemQr =
    pix.pix_qr_code_image ?? pix.qr_code_image ?? pix.qr_code_base64 ?? pix.image_url ??
    pix.pix_url ?? t.qr_code_image ?? null;

  const expiraEm = pix.expires_at ?? pix.expiration_date ?? t.expires_at ?? null;
  const hash = t.hash ?? t.transaction_hash ?? t.id ?? null;
  const status = t.status ?? t.payment_status ?? 'pending';

  return { hash, copiaECola, imagemQr, expiraEm, status };
}

module.exports = {
  request,
  criarTransacao,
  consultarTransacao,
  consultarProduto,
  extrairDadosPix,
  redact
};

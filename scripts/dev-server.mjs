/**
 * Servidor local: serve os arquivos estaticos e roda os handlers de /api.
 *
 *   npm run dev        -> http://localhost:4173
 *
 * Emula o suficiente do ambiente da Vercel (req.query, req.body ja parseado,
 * res.status().json()) para o checkout funcionar igual em producao. Sem isso a
 * unica forma de testar a tela seria publicando.
 */

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, extname, normalize } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORTA = Number(process.env.PORT) || 4173;
const require = createRequire(import.meta.url);

// Carrega o .env para o handler enxergar IRONPAY_API_TOKEN.
try {
  const env = await readFile(join(RAIZ, '.env'), 'utf8');
  for (const linha of env.split('\n')) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
} catch { /* sem .env: /api/ofertas ainda funciona, criar-pix vai reclamar */ }

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp'
};

/** Resposta com a mesma interface que os handlers usam na Vercel. */
function shimResposta(res) {
  res.status = code => { res.statusCode = code; return res; };
  res.json = obj => {
    if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(obj));
    return res;
  };
  return res;
}

async function lerCorpo(req) {
  const partes = [];
  for await (const p of req) partes.push(p);
  const bruto = Buffer.concat(partes).toString('utf8');
  if (!bruto) return {};
  try { return JSON.parse(bruto); } catch { return bruto; }
}

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORTA}`);
  shimResposta(res);

  if (url.pathname.startsWith('/api/')) {
    const nome = url.pathname.slice(5).replace(/[^a-z0-9-]/gi, '');
    const arquivo = join(RAIZ, 'api', nome + '.js');
    try {
      // Limpa o cache de TODOS os modulos do projeto, nao so do handler: sem
      // isso uma edicao em lib/ ou em catalog.json so aparece reiniciando.
      for (const id of Object.keys(require.cache)) {
        if (id.startsWith(RAIZ) && !id.includes('node_modules')) delete require.cache[id];
      }
      const handler = require(arquivo);
      req.query = Object.fromEntries(url.searchParams);
      req.body = req.method === 'POST' ? await lerCorpo(req) : undefined;
      await handler(req, res);
    } catch (err) {
      if (err.code === 'MODULE_NOT_FOUND') return res.status(404).json({ erro: 'Rota nao existe.' });
      console.error(`[dev] ${url.pathname} explodiu:`, err);
      if (!res.writableEnded) res.status(500).json({ erro: err.message });
    }
    return;
  }

  // Estatico. normalize() impede subir de diretorio com "..".
  const caminho = url.pathname === '/' ? '/index.html' : url.pathname;
  const alvo = join(RAIZ, normalize(caminho).replace(/^([/\\])+/, ''));
  if (!alvo.startsWith(RAIZ)) return res.status(403).json({ erro: 'Proibido.' });

  try {
    const conteudo = await readFile(alvo);
    res.setHeader('Content-Type', TIPOS[extname(alvo)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.end(conteudo);
  } catch {
    res.status(404).end('404');
  }
});

servidor.listen(PORTA, () => {
  const temToken = Boolean(process.env.IRONPAY_API_TOKEN);
  console.log(`\n  http://localhost:${PORTA}`);
  console.log(`  IRONPAY_API_TOKEN: ${temToken ? 'carregado do .env' : 'AUSENTE — /api/criar-pix vai recusar'}\n`);
});

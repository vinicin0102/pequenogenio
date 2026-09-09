# Pequeno Gênio — Guia dos Projetos Robóticos

Landing page de venda do **Guia dos Projetos Robóticos**, em arquivo único (`index.html`),
sem framework e sem etapa de build.

## Rodando localmente

```bash
npm run dev
```

Sobe <http://localhost:4173> servindo a página **e** rodando os handlers de `/api`,
para o checkout funcionar igual em produção. Sem o `.env` a página carrega e o
modal abre; só a geração do Pix responde "indisponível".

## Estrutura

| Arquivo | O que é |
| --- | --- |
| `index.html` | A página de venda: HTML, CSS e JS num arquivo só |
| `catalog.json` | Funil: 1 produto front + 7 order bumps |
| `lib/ironpay.js` | Cliente da API da IronPay |
| `lib/ofertas.js` | **Fonte da verdade de preço** — monta o pedido |
| `lib/validacao.js` | Valida nome, e-mail, CPF e telefone |
| `api/criar-pix.js` | `POST` — cria a cobrança e devolve o copia-e-cola |
| `api/status.js` | `GET` — polling do status pelo hash |
| `api/webhook.js` | `POST` — recebe o postback da IronPay |
| `api/ofertas.js` | `GET` — produto e bumps para a tela de checkout |
| `api/diagnostico.js` | `GET` — o que ainda falta configurar |

## Checkout Pix (IronPay)

O pagamento acontece **na própria página**: os CTAs abrem um modal com os dados do
comprador e os 7 order bumps, e o Pix (QR Code + copia e cola) aparece ali mesmo.
O status é consultado a cada 3s até o pagamento cair.

Os CTAs continuam sendo `<a href>` apontando para a oferta na IronPay. O clique é
interceptado por JavaScript — se o script falhar, o link ainda leva a um checkout
que funciona, em vez de virar um botão morto.

### Configurando

```bash
cp .env.example .env   # cole o IRONPAY_API_TOKEN
npm run catalog        # preenche título e preço dos 8 produtos pela API
npm test               # confere a montagem do pedido
```

O `catalog.json` só recebe `_generated_at` quando os 8 produtos vêm certos. Enquanto
estiver `null`, `/api/diagnostico` lista o que falta e o checkout responde
"indisponível" em vez de cobrar um valor inventado.

### Duas regras que sustentam o desenho

**O navegador nunca manda preço.** Ele envia só os ids dos bumps marcados
(`bump1`…`bump7`); o total é somado no servidor. Se o valor viesse do cliente,
qualquer pessoa abriria o DevTools e compraria por R$ 0,01. Os `product_hash`
também não saem do servidor.

**O webhook não confia no próprio corpo.** O postback da IronPay não é assinado e o
endpoint é público, então quem descobrir a URL pode forjar um `"status":"paid"`. Ao
receber, o handler reconsulta `GET /transactions/{hash}` e usa o status que a API
devolve — o corpo é só o gatilho. A entrega precisa ser idempotente: o mesmo
postback é reenviado.

> `api/webhook.js` tem a entrega como `TODO`. Ligar o e-mail ou a área de membros ali
> antes de vender, senão o cliente paga e não recebe nada.

### Detalhes da API que custam caro esquecer

- Valores em **centavos** — R$ 10,00 é `1000`
- `installments: 1` é **obrigatório mesmo no Pix**; omitir devolve 400
- `operation_type: 1` em **todos** os itens do `cart`, front e bumps igual
- `offer_hash` == `product_hash` nesta conta; o do topo do payload é o do front
- O token vai na **query string**, não em header — servidor apenas, nunca no navegador

## O que a página faz

- **Repassa os parâmetros de campanha ao checkout.** Todo link com a classe `js-checkout`
  recebe automaticamente os parâmetros da URL da visita (`src`, `utm_source`, `utm_term`, …),
  então o rastreamento não quebra quando o anúncio muda.
- **Data e contagem regressiva reais**, calculadas até a meia-noite do dia corrente.
- **Botão fixo no mobile**, que aparece depois que o primeiro CTA sai da tela.
- **FAQ em `<details>/<summary>`**, que funciona sem JavaScript e é acessível por teclado.
- **Rede de segurança**: se o JavaScript falhar, nenhuma seção fica invisível.

## Personalizando

| O que mudar | Onde |
| --- | --- |
| Link do checkout | Atributo `href` dos `<a class="js-checkout">` |
| Preço | Bloco `.offer` e o `.sticky-cta__price` |
| Cores | Variáveis CSS em `:root` (`--red`, `--amber`, `--blue`, `--green`) |
| Imagens dos projetos | Variáveis `base` e `itens` no primeiro `<script>` |
| Bônus (títulos e capas) | Blocos `<article class="bonus-card">` |
| E-mail de suporte | Rodapé |

> As imagens ainda são carregadas do domínio `projetogeniobrasil.com.br`. Para hospedar a
> página em outro domínio, baixe os arquivos para uma pasta local e ajuste a variável `base`.

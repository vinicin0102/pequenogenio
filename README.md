# Pequeno Gênio — Guia dos Projetos Robóticos

Landing page de venda do **Guia dos Projetos Robóticos**, em arquivo único (`index.html`),
sem framework e sem etapa de build.

## Rodando localmente

```bash
python -m http.server 4173
```

Depois abra <http://localhost:4173>.

## Estrutura

| Arquivo | O que é |
| --- | --- |
| `index.html` | A página inteira: HTML, CSS e JS num arquivo só (~32 KB) |
| `.claude/launch.json` | Configuração do servidor local de preview |

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

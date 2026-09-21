# OLX Viewer

Visualizador de anúncios OLX com preview de OpenGraph em cards e abertura direta no site.

## Como funciona

- `links.json` — lista de URLs do OLX que você quer acompanhar
- O frontend faz fetch dos metadados (título, descrição, imagem, preço) via um proxy Node interno
- O proxy remove `X-Frame-Options`, `CSP` e cookies, e segue redirects internamente para evitar vazamento de CORS
- Cada card abre o anúncio original em nova aba

## Estrutura

```
.
├── index.html       # Frontend estático
├── app.js           # Lógica de cards e fetch de OpenGraph
├── proxy.js         # Proxy Node.js built-in (sem dependências)
├── nginx.conf       # Nginx: serve estático + repassa /proxy para Node
├── entrypoint.sh    # Sobe proxy Node + nginx no mesmo container
├── links.json       # ← EDITE AQUI com seus links
├── Dockerfile
└── docker-compose.yml
```

## Uso

**1. Edite `links.json`** com seus links do OLX:

```json
[
  "https://rj.olx.com.br/...",
  "https://www.olx.com.br/..."
]
```

**2. Suba o container:**

```bash
docker compose up -d
```

Acesse em `http://localhost:8777`.

**3. Para atualizar os links** sem rebuild — edite o `links.json` e recarregue o browser. O arquivo é montado como volume, a imagem não precisa ser reconstruída.

**4. Rebuild** só é necessário se você alterar `index.html`, `app.js`, `proxy.js` ou `nginx.conf`:

```bash
docker compose up -d --build
```

## Notas

- O proxy segue até 5 redirects internamente antes de desistir
- Imagens do OLX também passam pelo proxy para evitar 403 por checagem de `Referer`
- Timeout de 15s por requisição — anúncios muito pesados ou indisponíveis aparecem com indicação de erro no card
- Os links fictícios no `links.json` de exemplo retornam erro — substitua pelos seus

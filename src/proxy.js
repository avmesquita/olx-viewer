/**
 * proxy.js — fetch server-side com follow de redirects e remoção de CORS/X-Frame-Options
 * Sem dependências externas — só módulos built-in do Node.
 *
 * GET /proxy?url=https://www.olx.com.br/...
 */

const http  = require("http");
const https = require("https");
const { URL } = require("url");

const PORT        = 3000;
const MAX_REDIRECTS = 5;

const HEADERS_REMOVE = new Set([
  "x-frame-options",
  "content-security-policy",
  "x-content-type-options",
  "set-cookie",       // não vazar cookies do OLX para o browser
  "strict-transport-security",
]);

function buildRequestHeaders(parsed) {
  return {
    "Host":                      parsed.host,
    "User-Agent":                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept":                    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language":           "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding":           "identity",
    "Referer":                   `${parsed.protocol}//${parsed.host}/`,
    "Sec-Fetch-Dest":            "document",
    "Sec-Fetch-Mode":            "navigate",
    "Sec-Fetch-Site":            "same-origin",
    "Sec-Fetch-User":            "?1",
    "Upgrade-Insecure-Requests": "1",
    "Cache-Control":             "max-age=0",
    "Connection":                "keep-alive",
  };
}

function doRequest(targetUrl, res, redirectsLeft) {
  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("URL inválida");
    return;
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Protocolo não permitido");
    return;
  }

  const lib     = parsed.protocol === "https:" ? https : http;
  const options = {
    hostname: parsed.hostname,
    port:     parsed.port || (parsed.protocol === "https:" ? 443 : 80),
    path:     parsed.pathname + parsed.search,
    method:   "GET",
    headers:  buildRequestHeaders(parsed),
    timeout:  15000,
  };

  const req = lib.request(options, (upstream) => {
    const status = upstream.statusCode;

    // Segue redirect internamente — não repassa 3xx ao browser
    if ([301, 302, 303, 307, 308].includes(status)) {
      const location = upstream.headers["location"];
      upstream.resume(); // descarta o body do redirect

      if (!location) {
        res.writeHead(502, { "Content-Type": "text/plain" });
        res.end("Redirect sem Location");
        return;
      }

      if (redirectsLeft <= 0) {
        res.writeHead(502, { "Content-Type": "text/plain" });
        res.end("Muitos redirects");
        return;
      }

      // Resolve URL relativa se necessário
      const nextUrl = new URL(location, targetUrl).toString();
      console.log(`[proxy] ${status} → ${nextUrl}`);
      doRequest(nextUrl, res, redirectsLeft - 1);
      return;
    }

    console.log(`[proxy] ${status} ${targetUrl}`);

    // Monta headers de saída filtrando os problemáticos
    const outHeaders = {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "GET",
    };
    for (const [key, val] of Object.entries(upstream.headers)) {
      if (!HEADERS_REMOVE.has(key.toLowerCase())) {
        outHeaders[key] = val;
      }
    }

    res.writeHead(status, outHeaders);
    upstream.pipe(res);
  });

  req.on("timeout", () => {
    req.destroy();
    if (!res.headersSent) {
      res.writeHead(504, { "Content-Type": "text/plain" });
      res.end("Timeout");
    }
  });

  req.on("error", (err) => {
    console.error(`[proxy] erro: ${err.message} → ${targetUrl}`);
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "text/plain" });
      res.end(`Erro upstream: ${err.message}`);
    }
  });

  req.end();
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "GET",
    });
    res.end();
    return;
  }

  if (req.method !== "GET") { res.writeHead(405); res.end(); return; }

  const reqUrl = new URL(req.url, `http://localhost:${PORT}`);

  if (reqUrl.pathname !== "/proxy") { res.writeHead(404); res.end(); return; }

  const target = reqUrl.searchParams.get("url");
  if (!target) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Parâmetro ?url= obrigatório");
    return;
  }

  doRequest(target, res, MAX_REDIRECTS);
});

server.listen(PORT, () => console.log(`Proxy rodando em http://localhost:${PORT}`));

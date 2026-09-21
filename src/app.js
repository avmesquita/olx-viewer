/**
 * OLX Viewer — app.js
 *
 * Os links são carregados de ./links.json (montado via volume no Docker).
 * Para uso local sem Docker, basta servir a pasta com qualquer servidor HTTP
 * e editar o links.json ao lado.
 *
 * Formato do links.json:
 *   ["https://www.olx.com.br/...", "https://www.olx.com.br/..."]
 */

const PROXY = "/proxy?url=";

// ─────────────────────────────────────────────
// Helpers OpenGraph
// ─────────────────────────────────────────────

function parseOpenGraph(html, originUrl) {
  const doc = new DOMParser().parseFromString(html, "text/html");

  const meta = (prop) =>
    doc.querySelector(`meta[property="${prop}"]`)?.content ||
    doc.querySelector(`meta[name="${prop}"]`)?.content ||
    "";

  return {
    title:       meta("og:title")       || meta("twitter:title")       || doc.title || "Sem título",
    description: meta("og:description") || meta("twitter:description") || meta("description") || "",
    image:       meta("og:image")       || meta("twitter:image")       || "",
    price:       meta("og:price:amount") || extractPrice(html),
    url:         originUrl,
  };
}

function extractPrice(html) {
  // Tenta primeiro pegar o preço do meta tag específico do OLX
  const metaMatch = html.match(/["'](R\$\s*[\d.]+(?:,[\d]{2})?)["']/)
  if (metaMatch) return metaMatch[1].trim();
  // Fallback: primeiro R$ seguido de valor com pelo menos 2 dígitos (evita pegar "R$ 4" solto)
  const match = html.match(/R\$\s*\d{2,}[\d.,]*/);
  return match ? match[0].replace(/\s+/, " ") : "";
}

async function fetchOG(url) {
  const res = await fetch(`${PROXY}${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  return parseOpenGraph(html, url);
}

// ─────────────────────────────────────────────
// Cards
// ─────────────────────────────────────────────

const grid    = document.getElementById("grid");
const counter = document.getElementById("counter");

function createCard(url, index) {
  const card = document.createElement("div");
  card.className = "card";
  card.dataset.index = index;
  card._url = url;

  card.innerHTML = `
    <div class="card-thumb placeholder">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
    </div>
    <div class="card-body">
      <div class="card-title">${shortUrl(url)}</div>
      <div class="card-desc"></div>
      <div class="card-price"></div>
      <div class="card-status loading">Carregando…</div>
    </div>
    <div class="card-footer">
      <a href="${url}" target="_blank" rel="noopener noreferrer">
        Ver no OLX
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 1H1v10h10V7M7 1h4v4M11 1 5.5 6.5"/>
        </svg>
      </a>
    </div>
  `;

  // Clique tratado pelo link no footer — sem listener no card inteiro
  return card;
}

function shortUrl(url) {
  try { return new URL(url).pathname.split("/").filter(Boolean).pop() || url; }
  catch { return url; }
}

function updateCard(card, og) {
  card.dataset.og = JSON.stringify(og);

  const thumb = card.querySelector(".card-thumb");
  if (og.image) {
    const img = document.createElement("img");
    img.className = "card-thumb";
    // Imagem via proxy para evitar 403 por Referer/Origin check do OLX
    img.src = og.image.startsWith("http") ? PROXY + encodeURIComponent(og.image) : og.image;
    img.alt = og.title;
    img.loading = "lazy";
    img.onerror = () => img.replaceWith(thumb);
    thumb.replaceWith(img);
  }

  card.querySelector(".card-title").textContent = og.title;
  card.querySelector(".card-desc").textContent  = og.description;
  if (og.price) card.querySelector(".card-price").textContent = og.price;

  const status = card.querySelector(".card-status");
  status.className = "card-status";
  status.textContent = "";
}

function markCardError(card) {
  const status = card.querySelector(".card-status");
  status.className = "card-status error";
  status.textContent = "Falha ao carregar";
  card.querySelector(".card-title").textContent = shortUrl(card._url || "");
}

// Modal removido — anúncios abrem diretamente no OLX em nova aba

// ─────────────────────────────────────────────
// Bootstrap — carrega links.json e inicializa
// ─────────────────────────────────────────────

async function init() {
  let links = [];

  try {
    const res = await fetch("./links.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    links = await res.json();
    if (!Array.isArray(links)) throw new Error("links.json deve ser um array de strings");
  } catch (err) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;text-align:center;padding:48px 16px;color:#888;font-size:.88rem;line-height:1.7">
        <div style="font-size:2rem;margin-bottom:12px">📄</div>
        Não foi possível carregar <code>links.json</code>.<br>
        <span style="font-size:.78rem;color:#666">${err.message}</span>
      </div>`;
    return;
  }

  counter.textContent = `${links.length} link${links.length !== 1 ? "s" : ""}`;

  const cards = links.map((url, i) => {
    const card = createCard(url, i);
    grid.appendChild(card);
    return { card, url };
  });

  await Promise.allSettled(
    cards.map(async ({ card, url }) => {
      try {
        const og = await fetchOG(url);
        updateCard(card, og);
      } catch {
        markCardError(card);
      }
    })
  );
}

init();

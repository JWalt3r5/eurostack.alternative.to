// Static site generator for eurostack.alternative.to
// Reads data/*.yml (one category each) and renders dist/:
//   index.html, <slug>/index.html per category, sitemap.xml, robots.txt, llms.txt
// Zero framework — plain Node + js-yaml. Independent look (NOT the Buddy design system).
import { readFileSync, readdirSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');
const DIST = join(ROOT, 'dist');
const SITE = 'https://eurostack.alternative.to';
const UPDATED = new Date().toISOString().slice(0, 10);

const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---- load categories -------------------------------------------------------
const categories = readdirSync(DATA)
  .filter((f) => f.endsWith('.yml') && !f.startsWith('_'))
  .map((f) => {
    const doc = yaml.load(readFileSync(join(DATA, f), 'utf8')) || {};
    const cat = doc.category || {};
    return { ...cat, slug: cat.slug || f.replace(/\.yml$/, ''), tools: doc.tools || [] };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const totalTools = categories.reduce((n, c) => n + c.tools.length, 0);

// ---- page shell ------------------------------------------------------------
const CSS = `
:root{--bg:#fbfbfc;--card:#fff;--ink:#14161a;--muted:#5b6472;--line:#e6e8ec;--accent:#1a48d6;--accent-ink:#fff;--chip:#eef1f6;--radius:14px}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
.wrap{max-width:1040px;margin:0 auto;padding:0 20px}
header.site{border-bottom:1px solid var(--line);background:#fff}
header.site .wrap{display:flex;align-items:center;justify-content:space-between;height:64px}
.brand{font-weight:700;font-size:18px;color:var(--ink)}
.brand b{color:var(--accent)}
.hero{padding:56px 0 32px}
.hero h1{font-size:clamp(28px,4.5vw,44px);line-height:1.15;margin:0 0 14px;letter-spacing:-.02em}
.hero p{font-size:18px;color:var(--muted);max-width:60ch;margin:0}
.meta{margin-top:18px;font-size:14px;color:var(--muted)}
.toc{display:flex;flex-wrap:wrap;gap:8px;margin:28px 0 8px}
.toc a{background:var(--chip);color:var(--ink);padding:6px 12px;border-radius:999px;font-size:14px}
section.cat{padding:34px 0;border-top:1px solid var(--line)}
section.cat h2{font-size:24px;margin:0 0 6px;letter-spacing:-.01em}
section.cat .desc{color:var(--muted);margin:0 0 6px}
.altto{font-size:13px;color:var(--muted);margin:0 0 18px}
.altto b{color:var(--ink);font-weight:600}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:18px;display:flex;flex-direction:column;gap:10px}
.card h3{margin:0;font-size:18px;display:flex;align-items:center;gap:8px}
.flag{font-size:18px}
.hq{font-size:13px;color:var(--muted)}
.badges{display:flex;flex-wrap:wrap;gap:6px}
.badge{font-size:12px;background:var(--chip);color:var(--ink);border-radius:999px;padding:3px 9px}
.badge.oss{background:#e7f6ec;color:#1a7f37}
.price{font-size:14px}
.price .free{color:#1a7f37;font-weight:600}
.notes{font-size:14px;color:var(--muted);margin:0}
.card .go{margin-top:auto;font-weight:600;font-size:14px}
footer.site{border-top:1px solid var(--line);padding:30px 0;color:var(--muted);font-size:14px;margin-top:20px}
.crumb{padding:20px 0 0;font-size:14px;color:var(--muted)}
@media (prefers-color-scheme:dark){
 :root{--bg:#0e1013;--card:#16191e;--ink:#eceef2;--muted:#9aa4b2;--line:#252a31;--accent:#7aa2ff;--chip:#1d222a}
 header.site,.card{background:var(--card)}
 .badge.oss{background:#12351f;color:#7ee2a0}
 .price .free{color:#7ee2a0}
}
`;

function shell({ title, desc, canonical, body, jsonld }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(canonical)}">
<style>${CSS}</style>
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
</head>
<body>
<header class="site"><div class="wrap"><a class="brand" href="/"><b>euro</b>stack<span style="color:var(--muted)">.alternative.to</span></a><a href="https://github.com/JWalt3r5/eurostack.alternative.to">GitHub</a></div></header>
${body}
<footer class="site"><div class="wrap">Community-maintained list of European alternatives. No affiliate links, no pay-for-ranking. Last updated ${UPDATED}. · <a href="https://github.com/JWalt3r5/eurostack.alternative.to">Suggest an edit on GitHub</a></div></footer>
</body>
</html>`;
}

function toolCard(t) {
  const oss = /apache|mit|gpl|agpl|source-available|open/i.test(t.license || '');
  const badges = [
    t.hosting ? `<span class="badge">${esc(t.hosting)}</span>` : '',
    t.license ? `<span class="badge${oss ? ' oss' : ''}">${esc(t.license)}</span>` : '',
  ].join('');
  const free = t.free_tier && t.free_tier !== '—';
  return `<div class="card">
<h3>${t.flag ? `<span class="flag">${esc(t.flag)}</span>` : ''}${esc(t.name)}</h3>
${t.hq ? `<div class="hq">${esc(t.hq)}</div>` : ''}
<div class="badges">${badges}</div>
${t.data_residency ? `<p class="notes">${esc(t.data_residency)}</p>` : ''}
<div class="price">${free ? `<span class="free">Free</span> — ${esc(t.free_tier)}` : esc(t.free_tier || '')}${t.paid_from && t.paid_from !== '—' ? `<br>Paid: ${esc(t.paid_from)}` : ''}</div>
${t.notes ? `<p class="notes">${esc(t.notes.trim())}</p>` : ''}
<a class="go" href="${esc(t.url)}" rel="nofollow noopener" target="_blank">Visit ${esc(t.name)} →</a>
</div>`;
}

function catSection(c, { linkHeading } = {}) {
  const alt = (c.alternative_to || []).map((x) => `<b>${esc(x)}</b>`).join(', ');
  const h = linkHeading ? `<a href="/${esc(c.slug)}/">${esc(c.name)}</a>` : esc(c.name);
  return `<section class="cat" id="${esc(c.slug)}">
<h2>${h}</h2>
${c.description ? `<p class="desc">${esc(c.description.trim())}</p>` : ''}
${alt ? `<p class="altto">European alternatives to ${alt}</p>` : ''}
<div class="grid">${c.tools.map(toolCard).join('')}</div>
</section>`;
}

// ---- render ----------------------------------------------------------------
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

// homepage
const toc = categories.map((c) => `<a href="#${esc(c.slug)}">${esc(c.name)}</a>`).join('');
const home = `<main class="wrap">
<div class="hero">
<h1>European alternatives to the US tools you use by default</h1>
<p>Email, storage, hosting, CI/CD and more — the European-built services that do the same job, with where each one is hosted and what it costs.</p>
<div class="meta">${totalTools} tools across ${categories.length} categories · updated ${UPDATED}</div>
<div class="toc">${toc}</div>
</div>
${categories.map((c) => catSection(c, { linkHeading: true })).join('')}
</main>`;
writeFileSync(
  join(DIST, 'index.html'),
  shell({
    title: 'European alternatives to US SaaS & cloud tools — EuroStack',
    desc: `A community list of ${totalTools} European alternatives to popular US software, sorted by category, with hosting location and pricing.`,
    canonical: SITE + '/',
    body: home,
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'European alternatives to US SaaS and cloud tools',
      numberOfItems: categories.length,
      itemListElement: categories.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, url: `${SITE}/${c.slug}/` })),
    },
  })
);

// category pages
for (const c of categories) {
  const dir = join(DIST, c.slug);
  mkdirSync(dir, { recursive: true });
  const body = `<main class="wrap">
<div class="crumb"><a href="/">Home</a> › ${esc(c.name)}</div>
<div class="hero"><h1>European ${esc(c.name)} alternatives</h1>${c.description ? `<p>${esc(c.description.trim())}</p>` : ''}<div class="meta">${c.tools.length} tools · updated ${esc(c.updated || UPDATED)}</div></div>
${catSection(c)}
</main>`;
  writeFileSync(
    join(dir, 'index.html'),
    shell({
      title: `European ${c.name} alternatives — EuroStack`,
      desc: `European alternatives to ${(c.alternative_to || []).join(', ') || 'US ' + c.name.toLowerCase() + ' tools'}, with hosting location and pricing.`,
      canonical: `${SITE}/${c.slug}/`,
      body,
      jsonld: {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: `European ${c.name} alternatives`,
        numberOfItems: c.tools.length,
        itemListElement: c.tools.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, url: t.url })),
      },
    })
  );
}

// sitemap + robots + llms.txt
const urls = [SITE + '/', ...categories.map((c) => `${SITE}/${c.slug}/`)];
writeFileSync(
  join(DIST, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${u}</loc><lastmod>${UPDATED}</lastmod></url>`)
    .join('\n')}\n</urlset>\n`
);
writeFileSync(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
writeFileSync(
  join(DIST, 'llms.txt'),
  `# EuroStack — European alternatives to US SaaS & cloud tools\n\n> A community-maintained catalog of European-built alternatives, sorted by category, with hosting location and pricing.\n\n## Categories\n\n${categories
    .map((c) => `- [European ${c.name} alternatives](${SITE}/${c.slug}/): ${(c.description || '').trim()}`)
    .join('\n')}\n`
);

console.log(`build: ${categories.length} categories, ${totalTools} tools -> dist/`);

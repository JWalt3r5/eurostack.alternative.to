// Static site generator for eurostack.alternative.to
// Reads data/*.yml (one category each) and renders dist/:
//   index.html (with client-side search), <slug>/ per category,
//   <slug>/<tool>/ per product, how-to-add/, sitemap.xml, robots.txt, llms.txt
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
const slugify = (s = '') =>
  String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// ---- load categories + tools ----------------------------------------------
const categories = readdirSync(DATA)
  .filter((f) => f.endsWith('.yml') && !f.startsWith('_'))
  .map((f) => {
    const doc = yaml.load(readFileSync(join(DATA, f), 'utf8')) || {};
    const cat = doc.category || {};
    const slug = cat.slug || f.replace(/\.yml$/, '');
    const tools = (doc.tools || []).map((t) => {
      const tslug = slugify(t.name);
      return { ...t, slug: tslug, page: `/${slug}/${tslug}/` };
    });
    return { ...cat, slug, tools };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const totalTools = categories.reduce((n, c) => n + c.tools.length, 0);

// ---- styles ----------------------------------------------------------------
const CSS = `
:root{--bg:#fbfbfc;--card:#fff;--ink:#14161a;--muted:#5b6472;--line:#e6e8ec;--accent:#1a48d6;--chip:#eef1f6;--radius:14px}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
.wrap{max-width:1040px;margin:0 auto;padding:0 20px}
header.site{border-bottom:1px solid var(--line);background:#fff}
header.site .wrap{display:flex;align-items:center;justify-content:space-between;height:64px;gap:16px}
.brand{font-weight:700;font-size:18px;color:var(--ink)}.brand b{color:var(--accent)}
.nav a{margin-left:18px;font-size:15px;color:var(--muted)}
.hero{padding:52px 0 22px}
.hero h1{font-size:clamp(28px,4.5vw,44px);line-height:1.15;margin:0 0 14px;letter-spacing:-.02em}
.hero p{font-size:18px;color:var(--muted);max-width:60ch;margin:0}
.meta{margin-top:16px;font-size:14px;color:var(--muted)}
.search{margin:22px 0 4px}
.search input{width:100%;max-width:520px;padding:12px 16px;font-size:16px;border:1px solid var(--line);border-radius:999px;background:var(--card);color:var(--ink)}
.toc{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0 8px}
.toc a{background:var(--chip);color:var(--ink);padding:6px 12px;border-radius:999px;font-size:14px}
section.cat{padding:32px 0;border-top:1px solid var(--line)}
section.cat h2{font-size:24px;margin:0 0 6px;letter-spacing:-.01em}
.desc{color:var(--muted);margin:0 0 6px}
.altto{font-size:13px;color:var(--muted);margin:0 0 18px}.altto b{color:var(--ink);font-weight:600}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
.card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:18px;display:flex;flex-direction:column;gap:10px;color:var(--ink);text-decoration:none;transition:border-color .15s,box-shadow .15s}
.card:hover{border-color:var(--accent);text-decoration:none;box-shadow:0 2px 14px rgba(26,72,214,.08)}
.card h3{margin:0;font-size:18px;color:var(--accent)}
.hq{font-size:13px;color:var(--muted)}
.badges{display:flex;flex-wrap:wrap;gap:6px}
.badge{font-size:12px;background:var(--chip);color:var(--ink);border-radius:999px;padding:3px 9px}
.badge.oss{background:#e7f6ec;color:#1a7f37}
.price{font-size:14px}.price .free{color:#1a7f37;font-weight:600}
.notes{font-size:14px;color:var(--muted);margin:0}
.card .go{margin-top:auto;font-weight:600;font-size:14px}
.linkrow{display:flex;flex-direction:column;align-items:flex-start;gap:8px;margin:10px 0}
.prodhead{display:flex;align-items:flex-start;justify-content:space-between;gap:20px}
.prodhead h1{margin:0}
.logo{height:56px;max-width:180px;object-fit:contain;flex:none}
.crumb{padding:20px 0 0;font-size:14px;color:var(--muted)}
.prose{max-width:70ch}.prose li{margin:6px 0}
.dl{display:grid;grid-template-columns:150px 1fr;gap:8px 18px;margin:18px 0;font-size:15px}
.dl dt{color:var(--muted)}.dl dd{margin:0}
.src{font-size:13px;color:var(--muted)}
footer.site{border-top:1px solid var(--line);padding:30px 0;color:var(--muted);font-size:14px;margin-top:20px}
.empty{display:none;color:var(--muted);padding:20px 0}
@media (prefers-color-scheme:dark){
 :root{--bg:#0e1013;--card:#16191e;--ink:#eceef2;--muted:#9aa4b2;--line:#252a31;--accent:#7aa2ff;--chip:#1d222a}
 header.site,.card,.search input{background:var(--card)}
 .badge.oss{background:#12351f;color:#7ee2a0}.price .free{color:#7ee2a0}
}`;

function shell({ title, desc, canonical, body, jsonld, extraHead = '' }) {
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
${extraHead}
</head>
<body>
<header class="site"><div class="wrap"><a class="brand" href="/"><b>euro</b>stack<span style="color:var(--muted)">.alternative.to</span></a><nav class="nav"><a href="/how-to-add/">How to add</a><a href="https://github.com/JWalt3r5/eurostack.alternative.to">GitHub</a></nav></div></header>
${body}
<footer class="site"><div class="wrap">Community-maintained list of European alternatives. No affiliate links, no pay-for-ranking. Last updated ${UPDATED}. · <a href="/how-to-add/">How to add a tool</a> · <a href="https://github.com/JWalt3r5/eurostack.alternative.to">GitHub</a></div></footer>
</body>
</html>`;
}

const isOss = (t) => /apache|mit|gpl|agpl|source-available|open/i.test(t.license || '');

function toolCard(t, catName) {
  const badges = [
    t.hosting ? `<span class="badge">${esc(t.hosting)}</span>` : '',
    t.license ? `<span class="badge${isOss(t) ? ' oss' : ''}">${esc(t.license)}</span>` : '',
  ].join('');
  const free = t.free_tier && t.free_tier !== '—';
  const searchKey = esc([t.name, t.hq, catName, t.notes, (t.alternative_to || []).join(' ')].join(' ').toLowerCase());
  return `<a class="card" href="${esc(t.page)}" data-search="${searchKey}">
<h3>${esc(t.name)}</h3>
${t.hq ? `<div class="hq">${esc(t.hq)}</div>` : ''}
<div class="badges">${badges}</div>
${t.data_residency ? `<p class="notes">${esc(t.data_residency)}</p>` : ''}
<div class="price">${free ? `<span class="free">Free</span> — ${esc(t.free_tier)}` : esc(t.free_tier || '')}${t.paid_from && t.paid_from !== '—' ? `<br>Paid: ${esc(t.paid_from)}` : ''}</div>
${t.notes ? `<p class="notes">${esc(t.notes.trim())}</p>` : ''}
<span class="go">Details →</span>
</a>`;
}

function catSection(c, { linkHeading } = {}) {
  const alt = (c.alternative_to || []).map((x) => `<b>${esc(x)}</b>`).join(', ');
  const h = linkHeading ? `<a href="/${esc(c.slug)}/">${esc(c.name)}</a>` : esc(c.name);
  return `<section class="cat" data-cat id="${esc(c.slug)}">
<h2>${h}</h2>
${c.description ? `<p class="desc">${esc(c.description.trim())}</p>` : ''}
${alt ? `<p class="altto">European alternatives to ${alt}</p>` : ''}
<div class="grid">${c.tools.map((t) => toolCard(t, c.name)).join('')}</div>
</section>`;
}

// links helper (cap at 3)
function toolLinks(t) {
  const links = [{ label: 'Website', url: t.url }, ...((t.links || []).slice(0, 4))].filter((l) => l && l.url);
  return links.map((l) => `<a href="${esc(l.url)}" rel="nofollow noopener" target="_blank">${esc(l.label || l.url)} →</a>`).join('');
}

// ---- render ----------------------------------------------------------------
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

const SEARCH_JS = `<script>
document.addEventListener('DOMContentLoaded',function(){
var i=document.getElementById('q');if(!i)return;
var cards=[].slice.call(document.querySelectorAll('.card[data-search]'));
var cats=[].slice.call(document.querySelectorAll('section[data-cat]'));
var empty=document.getElementById('noresults');
i.addEventListener('input',function(){var q=i.value.trim().toLowerCase();var any=false;
cards.forEach(function(c){var m=!q||c.getAttribute('data-search').indexOf(q)>-1;c.style.display=m?'':'none';if(m)any=true;});
cats.forEach(function(s){var vis=0;s.querySelectorAll('.card').forEach(function(c){if(c.style.display!=='none')vis++;});s.style.display=vis?'':'none';});
if(empty)empty.style.display=any?'none':'block';});
});
</script>`;

// homepage
const toc = categories.map((c) => `<a href="#${esc(c.slug)}">${esc(c.name)}</a>`).join('');
const home = `<main class="wrap">
<div class="hero">
<h1>European alternatives to the US tools you use by default</h1>
<p>Email, storage, hosting, CI/CD and more — the European-built services that do the same job, with where each one is hosted and what it costs.</p>
<div class="meta">${totalTools} tools across ${categories.length} categories · updated ${UPDATED}</div>
<div class="search"><input id="q" type="search" placeholder="Search tools, categories, countries…" autocomplete="off" aria-label="Search"></div>
<div class="toc">${toc}</div>
</div>
<div id="noresults" class="empty">No tools match your search.</div>
${categories.map((c) => catSection(c, { linkHeading: true })).join('')}
</main>`;
writeFileSync(
  join(DIST, 'index.html'),
  shell({
    title: 'European alternatives to US SaaS & cloud tools — EuroStack',
    desc: `A community list of ${totalTools} European alternatives to popular US software, sorted by category, with hosting location and pricing.`,
    canonical: SITE + '/',
    body: home,
    extraHead: SEARCH_JS,
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'European alternatives to US SaaS and cloud tools',
      numberOfItems: categories.length,
      itemListElement: categories.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, url: `${SITE}/${c.slug}/` })),
    },
  })
);

// category + product pages
for (const c of categories) {
  mkdirSync(join(DIST, c.slug), { recursive: true });
  const catBody = `<main class="wrap">
<div class="crumb"><a href="/">Home</a> › ${esc(c.name)}</div>
<div class="hero"><h1>European ${esc(c.name)} alternatives</h1>${c.description ? `<p>${esc(c.description.trim())}</p>` : ''}<div class="meta">${c.tools.length} tools · updated ${esc(c.updated || UPDATED)}</div></div>
${catSection(c)}
</main>`;
  writeFileSync(
    join(DIST, c.slug, 'index.html'),
    shell({
      title: `European ${c.name} alternatives — EuroStack`,
      desc: `European alternatives to ${(c.alternative_to || []).join(', ') || 'US ' + c.name.toLowerCase() + ' tools'}, with hosting location and pricing.`,
      canonical: `${SITE}/${c.slug}/`,
      body: catBody,
      jsonld: {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: `European ${c.name} alternatives`,
        numberOfItems: c.tools.length,
        itemListElement: c.tools.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, url: `${SITE}${t.page}` })),
      },
    })
  );

  // product pages
  for (const t of c.tools) {
    mkdirSync(join(DIST, c.slug, t.slug), { recursive: true });
    const free = t.free_tier && t.free_tier !== '—';
    const alt = (t.alternative_to || c.alternative_to || []).join(', ');
    const body = `<main class="wrap">
<div class="crumb"><a href="/">Home</a> › <a href="/${esc(c.slug)}/">${esc(c.name)}</a> › ${esc(t.name)}</div>
<div class="hero"><div class="prodhead"><h1>${esc(t.name)}</h1>${t.logo ? `<img class="logo" src="${esc(t.logo)}" alt="${esc(t.name)} logo" loading="lazy" referrerpolicy="no-referrer">` : ''}</div>${t.notes ? `<p>${esc(t.notes.trim())}</p>` : ''}</div>
<div class="linkrow">${toolLinks(t)}</div>
<dl class="dl">
${t.hq ? `<dt>Based in</dt><dd>${esc(t.hq)}</dd>` : ''}
${t.license ? `<dt>Licence</dt><dd>${esc(t.license)}</dd>` : ''}
${t.hosting ? `<dt>Hosting</dt><dd>${esc(t.hosting)}</dd>` : ''}
${t.data_residency ? `<dt>Data residency</dt><dd>${esc(t.data_residency)}</dd>` : ''}
<dt>Free tier</dt><dd>${free ? esc(t.free_tier) : 'No'}</dd>
${t.paid_from && t.paid_from !== '—' ? `<dt>Paid from</dt><dd>${esc(t.paid_from)}</dd>` : ''}
${t.best_for ? `<dt>Best for</dt><dd>${esc(t.best_for)}</dd>` : ''}
${alt ? `<dt>Alternative to</dt><dd>${esc(alt)}</dd>` : ''}
</dl>
${(t.sources || []).length ? `<p class="src">Sources: ${t.sources.map((s) => `<a href="${esc(s.url)}" rel="nofollow noopener" target="_blank">${esc(new URL(s.url).hostname)}</a>${s.verified ? ` (${esc(s.verified)})` : ''}`).join(', ')}</p>` : ''}
<p><a href="/${esc(c.slug)}/">← Back to ${esc(c.name)}</a></p>
</main>`;
    writeFileSync(
      join(DIST, c.slug, t.slug, 'index.html'),
      shell({
        title: `${t.name} — European ${c.name} alternative — EuroStack`,
        desc: `${t.name}${t.hq ? ' (' + t.hq + ')' : ''}: a European ${c.name.toLowerCase()} alternative${alt ? ' to ' + alt : ''}. ${(t.notes || '').trim()}`.slice(0, 300),
        canonical: `${SITE}${t.page}`,
        body,
        jsonld: {
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: t.name,
          applicationCategory: c.name,
          url: t.url,
          offers: free ? { '@type': 'Offer', price: '0', priceCurrency: 'EUR' } : undefined,
        },
      })
    );
  }
}

// how-to-add page
const howto = `<main class="wrap">
<div class="crumb"><a href="/">Home</a> › How to add</div>
<div class="hero"><h1>How to add or edit a tool</h1><p>The catalog is data-driven and open. There are two ways to contribute — pick whichever suits you.</p></div>
<div class="prose">
<h2>1. Suggest a tool (the easy way)</h2>
<p>Not comfortable with Git? <a href="https://github.com/JWalt3r5/eurostack.alternative.to/issues/new?template=suggest-a-tool.yml">Open an issue</a> with the tool's name, website, where it's based and what it costs. A maintainer will add it.</p>
<h2>2. Open a pull request (the direct way)</h2>
<ol>
<li>Fork <a href="https://github.com/JWalt3r5/eurostack.alternative.to">the repository</a> on GitHub.</li>
<li>Open the category file under <code>data/</code> (for example <code>data/email.yml</code>), or create a new one if the category doesn't exist yet.</li>
<li>Add a tool entry. Minimum fields: <code>name</code>, <code>url</code>, <code>hq</code>, <code>hosting</code>, <code>license</code>, a short <code>notes</code>, and at least one <code>sources</code> link. You can add up to three extra <code>links</code> (e.g. Pricing, Docs, GitHub).</li>
<li>Open a pull request. On push, the <b>verify-data</b> check validates your entry (schema, duplicates, links).</li>
<li>A maintainer reviews it and publishes — nothing goes live automatically.</li>
</ol>
<p>Rules: European-built or European-hosted tools only. Primary sources only (link the official site, never another directory). No affiliate links.</p>
<h2>Example entry</h2>
<pre style="overflow:auto;background:var(--chip);padding:16px;border-radius:12px"><code>- name: Example Tool
  url: https://example.eu/
  hq: Berlin, Germany
  license: Apache-2.0
  hosting: both
  data_residency: EU-hosted; self-host option.
  free_tier: Free community edition.
  paid_from: Cloud from €5/mo.
  best_for: Teams who want X without leaving the EU.
  notes: One or two honest sentences.
  links:
    - label: Pricing
      url: https://example.eu/pricing
    - label: Docs
      url: https://docs.example.eu/
  alternative_to:
    - Some US Tool
  sources:
    - url: https://example.eu/pricing
      verified: ${UPDATED}</code></pre>
</div>
</main>`;
mkdirSync(join(DIST, 'how-to-add'), { recursive: true });
writeFileSync(
  join(DIST, 'how-to-add', 'index.html'),
  shell({
    title: 'How to add a tool — EuroStack',
    desc: 'How to add or edit a European alternative in the EuroStack catalog: edit a YAML data file, open a pull request, and a maintainer publishes it.',
    canonical: `${SITE}/how-to-add/`,
    body: howto,
  })
);

// sitemap + robots + llms.txt
const urls = [
  SITE + '/',
  `${SITE}/how-to-add/`,
  ...categories.map((c) => `${SITE}/${c.slug}/`),
  ...categories.flatMap((c) => c.tools.map((t) => `${SITE}${t.page}`)),
];
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

console.log(`build: ${categories.length} categories, ${totalTools} tools, ${urls.length} urls -> dist/`);

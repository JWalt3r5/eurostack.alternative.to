// Static site generator for eurostack.alternative.to
// Reads data/*.yml (one category each) and renders dist/:
//   index.html (with client-side search), <slug>/ per category,
//   <slug>/<tool>/ per product, how-to-add/, sitemap.xml, robots.txt, llms.txt
// Zero framework - plain Node + js-yaml. Independent look (NOT the Buddy design system).
import { readFileSync, readdirSync, mkdirSync, writeFileSync, rmSync, cpSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');
const DIST = join(ROOT, 'dist');
const SITE = 'https://eurostack.alternative.to';
const ANALYTICS = '<script defer src="https://wiadro.24h.sh/script.js" data-website-id="c8478936-c06f-4d99-b934-a939766e4340"></script>';
const UPDATED = new Date().toISOString().slice(0, 10);

const esc = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = (s = '') =>
  String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// ---- load categories + tools ----------------------------------------------
// Each tool is authored once, in its home category file. Optional `categories:`
// lists every category it belongs to; the home file (where it's authored) stays
// its CANONICAL category - the single product page lives at /<homeCat>/<tool>/.
// Any extra categories only cross-list a card that links back to that one page,
// so a multi-category service never duplicates content or its product URL.
const rawCategories = readdirSync(DATA)
  .filter((f) => f.endsWith('.yml') && !f.startsWith('_'))
  .map((f) => {
    const doc = yaml.load(readFileSync(join(DATA, f), 'utf8')) || {};
    const cat = doc.category || {};
    const slug = cat.slug || f.replace(/\.yml$/, '');
    return { cat: { ...cat, slug }, slug, rawTools: doc.tools || [] };
  });

const knownSlugs = new Set(rawCategories.map((c) => c.slug));
const canonicalTools = [];               // one entry per tool (product pages, counts)
const listingsByCat = new Map(rawCategories.map((c) => [c.slug, []]));

for (const c of rawCategories) {
  for (const raw of c.rawTools) {
    const slug = slugify(raw.name);
    const tool = { ...raw, slug, homeCat: c.slug, page: `/${c.slug}/${slug}/` };
    canonicalTools.push(tool);
    const memberOf = new Set([c.slug, ...((raw.categories || []).filter((s) => knownSlugs.has(s)))]);
    for (const cs of memberOf) listingsByCat.get(cs).push(tool);
  }
}
// keep a category's own (canonical) tools first, cross-listed ones after
for (const [cs, list] of listingsByCat) list.sort((a, b) => (a.homeCat === cs ? 0 : 1) - (b.homeCat === cs ? 0 : 1));

const categories = rawCategories
  .map((c) => ({ ...c.cat, tools: listingsByCat.get(c.slug) }))
  .sort((a, b) => a.name.localeCompare(b.name));

const totalTools = canonicalTools.length;

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
<meta name="google-site-verification" content="BQGNLeFC-c27dGx5uOFTNH9UQjLKhLqb_2qn-JWwkLc">
<meta name="msvalidate.01" content="7632340AF6F68FEE312A0396A4D03BB8">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#1a48d6">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${SITE}/og2.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="EuroStack - European alternatives to US SaaS &amp; cloud tools">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/og2.png">
<style>${CSS}</style>
${(Array.isArray(jsonld) ? jsonld : jsonld ? [jsonld] : []).filter(Boolean).map((j) => `<script type="application/ld+json">${JSON.stringify(j)}</script>`).join('\n')}
${ANALYTICS}
${extraHead}
</head>
<body>
<header class="site"><div class="wrap"><a class="brand" href="/"><b>euro</b>stack<span style="color:var(--muted)">.alternative.to</span></a><nav class="nav"><a href="/how-to-add/">How to add</a><a href="https://github.com/JWalt3r5/eurostack.alternative.to">GitHub</a></nav></div></header>
${body}
<footer class="site"><div class="wrap">Community-maintained list of European alternatives. No affiliate links, no pay-for-ranking. Last updated ${UPDATED}. · <a href="/about/">About</a> · <a href="/how-to-add/">How to add a tool</a> · <a href="https://github.com/JWalt3r5/eurostack.alternative.to">GitHub</a></div></footer>
  <script defer src="https://assets.buddy.works/scripts/badge.min.js"></script>
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
<div class="price">${free ? `<span class="free">Free</span> - ${esc(t.free_tier)}` : esc(t.free_tier || '')}${t.paid_from && t.paid_from !== '—' ? `<br>Paid: ${esc(t.paid_from)}` : ''}</div>
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

// BreadcrumbList JSON-LD from [{name, url}, ...] (mirrors the visible crumb)
const crumbLd = (items) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.url })),
});

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
<p>Email, storage, hosting, CI/CD and more - the European-built services that do the same job, with where each one is hosted and what it costs.</p>
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
    title: 'European alternatives to US SaaS & cloud tools | EuroStack',
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
      title: `European ${c.name} alternatives | EuroStack`,
      desc: `European alternatives to ${(c.alternative_to || []).join(', ') || 'US ' + c.name.toLowerCase() + ' tools'}, with hosting location and pricing.`,
      canonical: `${SITE}/${c.slug}/`,
      body: catBody,
      jsonld: [
        {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: `European ${c.name} alternatives`,
          numberOfItems: c.tools.length,
          itemListElement: c.tools.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, url: `${SITE}${t.page}` })),
        },
        crumbLd([
          { name: 'Home', url: SITE + '/' },
          { name: c.name, url: `${SITE}/${c.slug}/` },
        ]),
      ],
    })
  );

  // product pages - only for tools whose canonical (home) category is this one;
  // cross-listed tools just render a card here that links to their one page.
  for (const t of c.tools) {
    if (t.homeCat !== c.slug) continue;
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
        title: `${t.name} | European ${c.name} alternative | EuroStack`,
        desc: `${t.name}${t.hq ? ' (' + t.hq + ')' : ''}: a European ${c.name.toLowerCase()} alternative${alt ? ' to ' + alt : ''}. ${(t.notes || '').trim()}`.slice(0, 300),
        canonical: `${SITE}${t.page}`,
        body,
        jsonld: [
          {
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: t.name,
            applicationCategory: c.name,
            url: t.url,
            offers: free ? { '@type': 'Offer', price: '0', priceCurrency: 'EUR' } : undefined,
          },
          crumbLd([
            { name: 'Home', url: SITE + '/' },
            { name: c.name, url: `${SITE}/${c.slug}/` },
            { name: t.name, url: `${SITE}${t.page}` },
          ]),
        ],
      })
    );
  }
}

// how-to-add page
const howto = `<main class="wrap">
<div class="crumb"><a href="/">Home</a> › How to add</div>
<div class="hero"><h1>How to add or edit a tool</h1><p>The catalog is data-driven and open. There are two ways to contribute - pick whichever suits you.</p></div>
<div class="prose">
<h2>1. Suggest a tool (the easy way)</h2>
<p>Not comfortable with Git? <a href="https://github.com/JWalt3r5/eurostack.alternative.to/issues/new?template=suggest-a-tool.yml">Open an issue</a> with the tool's name, website, where it's based and what it costs. A maintainer will add it.</p>
<h2>2. Open a pull request (the direct way)</h2>
<ol>
<li>Fork <a href="https://github.com/JWalt3r5/eurostack.alternative.to">the repository</a> on GitHub.</li>
<li>Open the category file under <code>data/</code> (for example <code>data/email.yml</code>), or create a new one if the category doesn't exist yet.</li>
<li>Add a tool entry. Minimum fields: <code>name</code>, <code>url</code>, <code>hq</code>, <code>hosting</code>, <code>license</code>, a short <code>notes</code>, and at least one <code>sources</code> link. You can add up to three extra <code>links</code> (e.g. Pricing, Docs, GitHub).</li>
<li>Open a pull request. On push, the <b>verify-data</b> check validates your entry (schema, duplicates, links).</li>
<li>A maintainer reviews it and publishes - nothing goes live automatically.</li>
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
    title: 'How to add a tool | EuroStack',
    desc: 'How to add or edit a European alternative in the EuroStack catalog: edit a YAML data file, open a pull request, and a maintainer publishes it.',
    canonical: `${SITE}/how-to-add/`,
    body: howto,
    jsonld: crumbLd([
      { name: 'Home', url: SITE + '/' },
      { name: 'How to add', url: `${SITE}/how-to-add/` },
    ]),
  })
);

// about / methodology page - provenance & E-E-A-T via the open project, not a person
const REPO = 'https://github.com/JWalt3r5/eurostack.alternative.to';
const about = `<main class="wrap">
<div class="crumb"><a href="/">Home</a> › About</div>
<div class="hero"><h1>About EuroStack</h1><p>A community-maintained catalog of European-built and European-hosted alternatives to the US SaaS and cloud tools most teams reach for by default - sorted by category, with where each tool is hosted and what it costs.</p></div>
<div class="prose">
<h2>Who maintains this</h2>
<p>EuroStack is an open, community-run project, not a company and not sponsored by any tool listed here. The catalog and everything behind it are public on <a href="${REPO}" rel="noopener">GitHub</a> - the data, the change history, and every contributor are visible and auditable. Corrections and additions come in through public pull requests.</p>
<h2>How tools are chosen</h2>
<ul>
<li><b>European by substance</b> - the company is based in Europe, or the service is genuinely European-hosted with data kept in the EU/EEA (or Switzerland).</li>
<li><b>A real like-for-like alternative</b> - it does the same job as the US tool it's listed against, not a loose relative.</li>
<li><b>Honestly positioned</b> - trade-offs and limits are stated, not hidden.</li>
</ul>
<h2>How we keep it honest</h2>
<ul>
<li><b>Primary sources only.</b> Every price, free tier and claim links to the tool's own official site or pricing page, with the date we verified it - never another directory.</li>
<li><b>No affiliate links, no pay-for-ranking.</b> Nobody can buy a place or a position on this list.</li>
<li><b>Open data.</b> The catalog lives in plain <code>data/*.yml</code> files on GitHub; anyone can read the source, check a fact, or fix it.</li>
<li><b>Reviewed publishing.</b> Contributions are validated automatically and reviewed by a maintainer - nothing goes live on its own.</li>
</ul>
<h2>Contribute</h2>
<p>Spot something out of date, or know a European tool we're missing? <a href="/how-to-add/">Add or edit a tool</a> - it takes a single data file and a pull request.</p>
</div>
</main>`;
mkdirSync(join(DIST, 'about'), { recursive: true });
writeFileSync(
  join(DIST, 'about', 'index.html'),
  shell({
    title: 'About | how EuroStack is made | EuroStack',
    desc: 'EuroStack is an open, community-maintained catalog of European alternatives to US SaaS and cloud tools: primary sources only, no affiliate links, open data on GitHub.',
    canonical: `${SITE}/about/`,
    body: about,
    jsonld: [
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'EuroStack',
        url: SITE + '/',
        description: 'A community-maintained catalog of European alternatives to US SaaS and cloud tools.',
        sameAs: [REPO],
      },
      crumbLd([
        { name: 'Home', url: SITE + '/' },
        { name: 'About', url: `${SITE}/about/` },
      ]),
    ],
  })
);

// sitemap + robots + llms.txt
const urls = [
  SITE + '/',
  `${SITE}/about/`,
  `${SITE}/how-to-add/`,
  ...categories.map((c) => `${SITE}/${c.slug}/`),
  ...canonicalTools.map((t) => `${SITE}${t.page}`),
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
  `# EuroStack - European alternatives to US SaaS & cloud tools\n\n> A community-maintained catalog of European-built alternatives, sorted by category, with hosting location and pricing.\n\n## Categories\n\n${categories
    .map((c) => `- [European ${c.name} alternatives](${SITE}/${c.slug}/): ${(c.description || '').trim()}`)
    .join('\n')}\n`
);

// static assets (og images, etc.) copied verbatim into dist/
const STATIC = join(ROOT, 'static');
if (existsSync(STATIC)) cpSync(STATIC, DIST, { recursive: true });

console.log(`build: ${categories.length} categories, ${totalTools} tools, ${urls.length} urls -> dist/`);

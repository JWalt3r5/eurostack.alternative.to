// Validate data/*.yml before build/publish. Fails (exit 1) on schema errors.
// Dead-link checking is opt-in (VERIFY_LINKS=1) so the default gate isn't flaky.
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const errors = [];
const warns = [];
const seenUrls = new Map();

const files = readdirSync(DATA).filter((f) => f.endsWith('.yml') && !f.startsWith('_'));
if (!files.length) errors.push('no data/*.yml files found');
const knownSlugs = new Set(files.map((f) => f.replace(/\.yml$/, '')));

for (const f of files) {
  const slug = f.replace(/\.yml$/, '');
  let doc;
  try {
    doc = yaml.load(readFileSync(join(DATA, f), 'utf8'));
  } catch (e) {
    errors.push(`${f}: YAML parse error — ${e.message}`);
    continue;
  }
  const c = doc?.category;
  if (!c) { errors.push(`${f}: missing "category"`); continue; }
  if (!c.slug) errors.push(`${f}: category.slug is required`);
  else if (c.slug !== slug) errors.push(`${f}: category.slug "${c.slug}" must match filename "${slug}"`);
  if (!c.name) errors.push(`${f}: category.name is required`);
  if (!c.description) warns.push(`${f}: category.description is empty`);

  const tools = doc.tools || [];
  if (!tools.length) warns.push(`${f}: no tools`);
  for (const t of tools) {
    const id = `${f} › ${t.name || '(unnamed)'}`;
    if (!t.name) errors.push(`${id}: tool.name is required`);
    if (!t.url) errors.push(`${id}: tool.url is required`);
    else if (!/^https?:\/\//.test(t.url)) errors.push(`${id}: url must be http(s) — got "${t.url}"`);
    if (!t.sources || !t.sources.length) warns.push(`${id}: no sources cited`);
    if (t.categories !== undefined) {
      if (!Array.isArray(t.categories)) errors.push(`${id}: categories must be a list of category slugs`);
      else for (const cs of t.categories) {
        if (!knownSlugs.has(cs)) errors.push(`${id}: categories references unknown category "${cs}" (no data/${cs}.yml)`);
      }
    }
    if (t.url) {
      if (seenUrls.has(t.url)) warns.push(`${id}: duplicate url (also in ${seenUrls.get(t.url)})`);
      else seenUrls.set(t.url, f);
    }
  }
}

// opt-in dead-link check
if (process.env.VERIFY_LINKS === '1') {
  for (const [url, where] of seenUrls) {
    try {
      const r = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(12000) });
      if (r.status >= 400) warns.push(`dead link ${r.status}: ${url} (${where})`);
    } catch (e) {
      warns.push(`unreachable: ${url} (${where}) — ${e.message}`);
    }
  }
}

for (const w of warns) console.warn('warn: ' + w);
if (errors.length) {
  for (const e of errors) console.error('ERROR: ' + e);
  console.error(`\nverify: FAILED — ${errors.length} error(s), ${warns.length} warning(s)`);
  process.exit(1);
}
console.log(`verify: OK — ${files.length} categories, ${seenUrls.size} tools, ${warns.length} warning(s)`);

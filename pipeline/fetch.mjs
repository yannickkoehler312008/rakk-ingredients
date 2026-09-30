/**
 * Download every bulk source into sources/raw/ and record what was fetched.
 *
 * Run: node fetch.mjs [source-id …]
 *
 * sources/manifest.json is committed and holds the URL, fetch time, byte count
 * and sha256 of each document. That is what makes a build reproducible, and
 * what §12.D's change detection diffs against: if a source's hash moves, the
 * rows built from it are candidates for re-review.
 *
 * Politeness: requests are sequential, identify themselves, and retry with
 * backoff. eCFR throttles under concurrency (PHASE-2-HANDOFF §3.2).
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOURCES } from './sources.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const RAW = join(ROOT, 'sources/raw');
const MANIFEST = join(ROOT, 'sources/manifest.json');
const UA = 'RakkIngredients-pipeline/1.0 (ingredient database build; bulk download)';
const HK_CAPS = ['132BD', '132H', '132U', '132AR'];

mkdirSync(RAW, { recursive: true });

const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
const only = process.argv.slice(2);

async function get(url, headers = {}) {
  let last;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, ...headers },
        signal: AbortSignal.timeout(600_000),
      });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      last = `HTTP ${res.status}`;
      if (res.status === 404) break;
    } catch (e) {
      last = e.message;
    }
    await new Promise((r) => setTimeout(r, 2000 * attempt));
  }
  throw new Error(`${url}: ${last}`);
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

async function latestEcfrDate() {
  const titles = JSON.parse((await get('https://www.ecfr.gov/api/versioner/v1/titles.json')).toString());
  return titles.titles.find((t) => t.number === 21).up_to_date_as_of;
}

async function latestConsolidatedCelex() {
  const q = `PREFIX cdm: <http://publications.europa.eu/ontology/cdm#>
SELECT ?celex WHERE { ?w cdm:resource_legal_id_celex ?celex .
FILTER(STRSTARTS(STR(?celex), "02008R1333")) } ORDER BY DESC(?celex) LIMIT 1`;
  const url = `https://publications.europa.eu/webapi/rdf/sparql?query=${encodeURIComponent(q)}`;
  const res = JSON.parse((await get(url, { Accept: 'application/sparql-results+json' })).toString());
  return res.results.bindings[0].celex.value;
}

/** The FDA exports declare UTF-8 but contain stray Windows-1252 bytes. */
function repairFdaEncoding(buf) {
  const out = [];
  for (const line of buf.toString('latin1').split('\r\n')) {
    const bytes = Buffer.from(line, 'latin1');
    const utf8 = bytes.toString('utf8');
    out.push(utf8.includes('�') ? new TextDecoder('windows-1252').decode(bytes) : utf8);
  }
  return Buffer.from(out.join('\n'), 'utf8');
}

let ecfrDate;
for (const src of SOURCES) {
  if (only.length && !only.includes(src.id)) continue;

  if (src.manual) {
    const dir = join(ROOT, src.manual);
    const files = existsSync(dir) ? readdirSync(dir) : [];
    manifest[src.id] = {
      title: src.title,
      url: src.url,
      manual: true,
      present: files,
      note: files.length
        ? 'Placed by hand.'
        : `Not present. ${src.publisher} serves this behind a bot challenge, which this pipeline does not bypass. Download it in a browser and place it in ${src.manual}.`,
    };
    console.log(`· ${src.id}: manual — ${files.length ? files.join(', ') : 'NOT PRESENT'}`);
    continue;
  }

  let url = src.url;
  const extra = {};
  if (url.includes('{date}')) {
    ecfrDate ??= await latestEcfrDate();
    url = url.replace('{date}', ecfrDate);
    extra.ecfr_date = ecfrDate;
  }
  if (url.includes('{celex}')) {
    extra.celex = await latestConsolidatedCelex();
    url = url.replace('{celex}', extra.celex);
  }

  process.stdout.write(`↓ ${src.id} … `);
  const headers = {};
  if (url.includes('ecfr.gov')) Object.assign(headers, { Accept: 'application/xml', 'Accept-Encoding': 'gzip' });
  if (url.includes('publications.europa.eu')) Object.assign(headers, { Accept: 'application/xhtml+xml', 'Accept-Language': 'eng' });

  let body = await get(url, headers);

  if (src.id === 'hk_legislation') {
    // 235 MB of every Cap. 1–300. Keep only the food additive regulations.
    const zip = join(RAW, 'hk_bulk.zip');
    writeFileSync(zip, body);
    const hash = sha256(body);
    const outDir = join(RAW, 'hk');
    mkdirSync(outDir, { recursive: true });
    execFileSync('python3', [
      '-c',
      `import zipfile,re,sys
z=zipfile.ZipFile(sys.argv[1])
for n in z.namelist():
    m=re.match(r'cap_(${HK_CAPS.join('|')})_en_c[\\\\/]cap_[0-9A-Z]+_[0-9]+_en_c\\.xml$',n)
    if m: open(sys.argv[2]+'/cap'+m.group(1)+'.xml','wb').write(z.read(n))`,
      zip,
      outDir,
    ]);
    rmSync(zip);
    const got = readdirSync(outDir);
    manifest[src.id] = {
      title: src.title, url, fetched_at: new Date().toISOString(), bytes: body.length, sha256: hash,
      extracted: got.map((f) => ({ file: `hk/${f}`, sha256: sha256(readFileSync(join(outDir, f))) })),
    };
    console.log(`${(body.length / 1e6).toFixed(1)} MB → ${got.join(', ')}`);
    continue;
  }

  if (src.id.startsWith('fda_')) {
    body = repairFdaEncoding(body);
    const m = body.toString('utf8', 0, 400).match(/Last updated ([0-9/]+)/);
    if (m) extra.source_last_updated = m[1];
  }

  writeFileSync(join(RAW, src.file), body);
  manifest[src.id] = {
    title: src.title, url, fetched_at: new Date().toISOString(), bytes: body.length, sha256: sha256(body), ...extra,
  };
  console.log(`${(body.length / 1e6).toFixed(1)} MB`);
  if (url.includes('ecfr.gov')) await new Promise((r) => setTimeout(r, 1500));
}

writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
console.log(`\nwrote sources/manifest.json`);

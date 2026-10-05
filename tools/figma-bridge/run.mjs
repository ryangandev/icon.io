#!/usr/bin/env node
// Runs one script in Figma through the bridge and prints what came back.
//
//   npm run figma:run -- script.js [--label text] [--out dir] [--timeout seconds]
//   echo 'return figma.currentPage.name' | npm run figma:run -- -
//
// The script is the body of an async function. In scope: figma, log(...),
// node(id), png(nodeOrId, path, scale), svg(nodeOrId, path), checkpoint(title)
// and loadFonts(nodeOrId); see README.md. Exported files land in --out
// (default: a folder per job under the system temp directory).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const PORT = 7799;
const TOKEN_FILE = join(tmpdir(), 'zumpo-figma-bridge.token');

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    label: { type: 'string' },
    out: { type: 'string' },
    timeout: { type: 'string', default: '300' },
  },
});

const source = positionals[0];
if (!source) {
  console.error(
    'Usage: npm run figma:run -- <script.js | -> [--label text] [--out dir]',
  );
  process.exit(2);
}
const code =
  source === '-' ? readFileSync(0, 'utf8') : readFileSync(source, 'utf8');
const label = values.label || (source === '-' ? 'stdin' : basename(source));

let token;
try {
  token = readFileSync(TOKEN_FILE, 'utf8').trim();
} catch {
  console.error(
    'The bridge server is not running. Start it with: npm run figma:bridge',
  );
  process.exit(2);
}

async function call(method, path, body) {
  const init = { method, headers: { 'x-bridge-token': token } };
  if (body !== undefined) init.body = JSON.stringify(body);
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`, init);
  if (res.status === 204) return undefined;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

let job = await call('POST', '/jobs', { code, label });
if (!job.pluginConnected) {
  console.error(
    'Waiting for the Zumpo bridge plugin: open it in Figma desktop.',
  );
} else if (job.pluginPaused) {
  console.error(
    'The Zumpo bridge plugin is paused: press Resume in its window.',
  );
}

const deadline = Date.now() + Number(values.timeout) * 1000;
while (job.state !== 'done') {
  if (Date.now() > deadline) {
    await call('DELETE', `/jobs/${job.id}`);
    console.error(
      `Timed out after ${values.timeout} s; job #${job.id} cancelled.`,
    );
    process.exit(1);
  }
  job = await call('GET', `/jobs/${job.id}`);
}

const result = job.result;
for (const line of result.logs || []) console.log(`log: ${line}`);

if (result.files && result.files.length) {
  const out = resolve(
    values.out || join(tmpdir(), 'zumpo-figma-bridge', job.id),
  );
  for (const file of result.files) {
    const target = join(out, file.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(
      target,
      file.base64 ? Buffer.from(file.base64, 'base64') : file.text,
    );
    console.log(`file: ${target}`);
  }
}

if (result.ok) {
  if (result.value !== null && result.value !== undefined) {
    console.log(JSON.stringify(result.value, null, 2));
  }
  console.error(`ok in ${result.ms} ms`);
} else {
  console.error(`error: ${result.error}`);
  if (result.stack) console.error(result.stack);
  process.exit(1);
}

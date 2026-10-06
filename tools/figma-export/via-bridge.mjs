#!/usr/bin/env node
// Runs the export plugin's own code through the Figma bridge, so an export
// needs no switching of plugins in Figma desktop, then imports the result.
//
//   npm run design:export [-- --timeout seconds] [--no-previews]
//
// A full export with previews runs several minutes in the plugin; the bridge
// gives up after `--timeout` seconds (default 1800), and the plugin finishes
// the job all the same before it takes the next one. --no-previews skips the
// PNG renders, the slow part, and leaves design/figma/previews/ as it was.
//
// The exporter in code.js is used as is: its plugin-window wiring (showUI and
// the message handler at the end) is cut off, and its `post` is redirected to
// collect the files it would have streamed to ui.html. The files are zipped
// exactly as ui.html would zip them and handed to import.mjs, so both paths
// produce the same design/figma/.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    timeout: { type: 'string', default: '1800' },
    'no-previews': { type: 'boolean', default: false },
  },
});

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, 'code.js'), 'utf8');
const cut = source.indexOf('figma.showUI(');
if (cut === -1) throw new Error('code.js no longer calls figma.showUI');

const script = `${source.slice(0, cut)}
const collected = [];
let finished = null;
post = (message) => {
  if (message.type === 'file') {
    collected.push(
      typeof message.data === 'string'
        ? { path: message.path, text: message.data }
        : { path: message.path, base64: figma.base64Encode(message.data) },
    );
  } else if (message.type === 'warning') {
    log('warning: ' + message.text);
  } else if (message.type === 'done') {
    finished = message;
  }
};
await new Exporter({ previews: ${!values['no-previews']} }).run();
return { files: collected, done: finished };
`;

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'zumpo-export-'));
const scriptPath = path.join(work, 'export.js');
fs.writeFileSync(scriptPath, script);

const output = execFileSync(
  process.execPath,
  [
    path.join(here, '../figma-bridge/run.mjs'),
    scriptPath,
    '--label',
    'design export',
    '--timeout',
    values.timeout,
  ],
  { maxBuffer: 1024 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] },
).toString();

// run.mjs prints log lines first, then the JSON result.
const lines = output.split('\n');
const start = lines.findIndex((line) => line.startsWith('{'));
for (const line of lines.slice(0, start)) if (line) console.log(line);
const { files, done } = JSON.parse(lines.slice(start).join('\n'));
if (!done) throw new Error('The exporter did not finish');

const tree = path.join(work, 'tree');
for (const file of files) {
  const target = path.join(tree, file.path);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(
    target,
    file.base64 === undefined ? file.text : Buffer.from(file.base64, 'base64'),
  );
}
const zip = path.join(work, done.fileName);
execFileSync('zip', ['-qr', zip, '.'], { cwd: tree, stdio: 'inherit' });
console.log(
  `${files.length} files, ${(fs.statSync(zip).size / 1e6).toFixed(1)} MB`,
);

execFileSync(process.execPath, [path.join(here, 'import.mjs'), zip], {
  stdio: 'inherit',
});
fs.rmSync(work, { recursive: true, force: true });

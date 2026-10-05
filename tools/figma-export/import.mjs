// Unpacks a Figma export zip into design/figma/, replacing the previous one.
//
//   npm run design:import                 newest ~/Downloads/zumpo-figma-export*.zip
//   npm run design:import -- path/to.zip  a specific export
//
// design/figma/ is generated: never edit it by hand. Change the design in
// Figma, export again, import again.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const target = path.join(repo, 'design', 'figma');

function newestExport() {
  const downloads = path.join(os.homedir(), 'Downloads');
  const zips = fs
    .readdirSync(downloads)
    .filter((f) => /^zumpo-figma-export.*\.zip$/.test(f))
    .map((f) => path.join(downloads, f))
    .toSorted((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  if (!zips.length) {
    throw new Error(`No zumpo-figma-export*.zip in ${downloads}`);
  }
  return zips[0];
}

const zip = path.resolve(process.argv[2] ?? newestExport());
execFileSync('unzip', ['-tq', zip], { stdio: 'inherit' });

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });
execFileSync('unzip', ['-q', zip, '-d', target], { stdio: 'inherit' });

const index = JSON.parse(
  fs.readFileSync(path.join(target, 'index.json'), 'utf8'),
);
console.log(
  `Imported ${path.basename(zip)} into ${path.relative(repo, target)}/`,
);
console.log(`Exported at ${index.exportedAt} from "${index.file.name}"`);
console.log(JSON.stringify(index.counts));
for (const warning of index.warnings) console.warn(`warning: ${warning}`);

// Keep the frontend's generated tokens and glyphs in step with the design.
execFileSync(
  process.execPath,
  [path.join(repo, 'tools', 'design-tokens', 'generate.mjs')],
  { stdio: 'inherit' },
);

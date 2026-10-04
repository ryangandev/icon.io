// Zumpo bridge: runs scripts queued on the local bridge server (server.mjs)
// against the open Figma file, and sends back their result, logs and exports.
//
// Unlike tools/figma-export, this plugin can change the document: that is its
// job. Every script runs as one undo step, and scripts that edit call
// checkpoint() first so the file's version history has a named restore point.
//
// Scripts arrive as the body of an async function and run in the plugin
// sandbox, so they follow the same ES2017 limits as the export plugin.

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

figma.showUI(__html__, { width: 360, height: 440, themeColors: true });

function format(value) {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch (e) {
    return String(value);
  }
}

function plain(value) {
  if (value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (e) {
    return String(value);
  }
}

async function nodeById(id) {
  const node = await figma.getNodeByIdAsync(id);
  if (!node) throw new Error('No node ' + id);
  return node;
}

async function resolve(nodeOrId) {
  return typeof nodeOrId === 'string' ? nodeById(nodeOrId) : nodeOrId;
}

// Loads every font used under a node, so text edits inside it do not throw.
async function loadFonts(nodeOrId) {
  const root = await resolve(nodeOrId);
  const texts =
    root.type === 'TEXT'
      ? [root]
      : 'findAllWithCriteria' in root
        ? root.findAllWithCriteria({ types: ['TEXT'] })
        : [];
  const seen = {};
  const loads = [];
  for (const text of texts) {
    const fonts =
      text.fontName === figma.mixed
        ? text.getRangeAllFontNames(0, text.characters.length)
        : [text.fontName];
    for (const font of fonts) {
      const key = font.family + '/' + font.style;
      if (seen[key]) continue;
      seen[key] = true;
      loads.push(figma.loadFontAsync(font));
    }
  }
  await Promise.all(loads);
  return Object.keys(seen);
}

figma.ui.on('message', async (msg) => {
  if (!msg || msg.type !== 'job') return;
  const logs = [];
  const files = [];
  const started = Date.now();

  function log() {
    logs.push(Array.prototype.map.call(arguments, format).join(' '));
  }
  async function png(nodeOrId, path, scale) {
    const node = await resolve(nodeOrId);
    const bytes = await node.exportAsync({
      format: 'PNG',
      constraint: { type: 'SCALE', value: scale || 1 },
    });
    files.push({ path: path || node.id.replace(/:/g, '-') + '.png', bytes });
    return path;
  }
  async function svg(nodeOrId, path) {
    const node = await resolve(nodeOrId);
    const text = await node.exportAsync({ format: 'SVG_STRING' });
    files.push({ path: path || node.id.replace(/:/g, '-') + '.svg', text });
    return path;
  }
  async function checkpoint(title) {
    await figma.saveVersionHistoryAsync('Bridge: ' + title);
    log('checkpoint saved: ' + title);
  }

  let reply;
  try {
    const run = new AsyncFunction(
      'figma',
      'log',
      'node',
      'png',
      'svg',
      'checkpoint',
      'loadFonts',
      msg.code,
    );
    const value = await run(
      figma,
      log,
      nodeById,
      png,
      svg,
      checkpoint,
      loadFonts,
    );
    reply = { ok: true, value: plain(value) };
  } catch (e) {
    reply = {
      ok: false,
      error: e && e.message ? e.message : String(e),
      stack: e && e.stack ? String(e.stack) : '',
    };
  }
  figma.commitUndo();
  reply.type = 'result';
  reply.id = msg.id;
  reply.logs = logs;
  reply.files = files;
  reply.ms = Date.now() - started;
  figma.ui.postMessage(reply);
});

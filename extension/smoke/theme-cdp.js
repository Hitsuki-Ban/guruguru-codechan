const assert = require('node:assert/strict');
const vscode = require('vscode');

const EXTENSION_ID = 'hitsuki-ban.guruguru-codechan';
const remoteDebuggingPort = Number(process.env.GGC_CDP_PORT);

const THEME_CASES = [
  { name: 'Default Dark Modern', expectedBodyClass: 'vscode-dark' },
  { name: 'Default Light Modern', expectedBodyClass: 'vscode-light' },
  { name: 'Default High Contrast', expectedBodyClass: 'vscode-high-contrast' },
];

async function run() {
  assert.ok(Number.isInteger(remoteDebuggingPort), 'GGC_CDP_PORT must be provided.');
  const extension = vscode.extensions.getExtension(EXTENSION_ID);
  assert.ok(extension, `Expected ${EXTENSION_ID} to be loaded in the Extension Development Host.`);

  await extension.activate();
  await vscode.commands.executeCommand('guruguru-codechan.openCanvas');
  await vscode.commands.executeCommand('guruguru-codechan.toggleSettings');
  await delay(1000);

  const { client } = await waitForWebviewClient();
  try {
    const contextId = await findWebviewContext(client);
    await evaluate(client, `document.querySelector('[aria-label="Open tweaks"]')?.click()`, contextId);
    await delay(200);

    const results = [];
    for (const theme of THEME_CASES) {
      await vscode.workspace
        .getConfiguration('workbench')
        .update('colorTheme', theme.name, vscode.ConfigurationTarget.Global);
      await delay(800);
      const snapshot = await evaluate(client, `(() => {
        const stage = document.querySelector('.stage');
        const tweaks = document.querySelector('.tweaksPanel');
        const importButton = document.querySelector('[aria-label="Import character"]');
        const stageStyle = stage ? getComputedStyle(stage) : undefined;
        const buttonStyle = importButton ? getComputedStyle(importButton) : undefined;
        return {
          theme: ${JSON.stringify(theme.name)},
          bodyClass: document.body.className,
          stageBackgroundImage: stageStyle?.backgroundImage ?? '',
          stageBackgroundColor: stageStyle?.backgroundColor ?? '',
          buttonBorderColor: buttonStyle?.borderColor ?? '',
          hasTweaks: Boolean(tweaks),
          hasRange: Boolean(document.querySelector('[aria-label="Tracking range"]')),
          hasSpeed: Boolean(document.querySelector('[aria-label="Tracking speed"]')),
          hasMouthSync: Boolean(document.querySelector('[aria-label="Sync mouth with typing"]')),
          hasAutoBlink: Boolean(document.querySelector('[aria-label="Auto blink"]')),
        };
      })()`, contextId);

      assert.match(snapshot.bodyClass, new RegExp(`(^|\\\\s)${theme.expectedBodyClass}(\\\\s|$)`));
      assert.ok(snapshot.stageBackgroundImage || snapshot.stageBackgroundColor, `Expected stage background for ${theme.name}.`);
      assert.equal(snapshot.hasTweaks, true, `Expected tweaks panel in ${theme.name}.`);
      assert.equal(snapshot.hasRange, true, `Expected tracking range control in ${theme.name}.`);
      assert.equal(snapshot.hasSpeed, true, `Expected tracking speed control in ${theme.name}.`);
      assert.equal(snapshot.hasMouthSync, true, `Expected mouth sync control in ${theme.name}.`);
      assert.equal(snapshot.hasAutoBlink, true, `Expected auto blink control in ${theme.name}.`);
      if (theme.expectedBodyClass === 'vscode-high-contrast') {
        assert.notEqual(snapshot.buttonBorderColor, 'rgba(0, 0, 0, 0)', 'Expected visible high-contrast button border.');
      }
      results.push(snapshot);
    }
    console.log(`GGC_THEME_QA_RESULT ${JSON.stringify(results, null, 2)}`);
  } finally {
    client.close();
  }
}

async function findWebviewContext(client) {
  await client.call('Page.enable');
  const { frameTree } = await client.call('Page.getFrameTree');
  const frames = flattenFrames(frameTree).reverse();

  for (const frame of frames) {
    const { executionContextId } = await client.call('Page.createIsolatedWorld', {
      frameId: frame.id,
      worldName: 'guruguru-codechan-theme-qa',
    });
    const hasStage = await evaluate(client, `Boolean(document.querySelector('.stage'))`, executionContextId).catch(() => false);
    if (hasStage) return executionContextId;
  }

  throw new Error(`Could not find Codechan document frame:\n${JSON.stringify(frames.map((frame) => ({
    id: frame.id,
    name: frame.name,
    url: redactWebviewUrl(frame.url),
  })), null, 2)}`);
}

function flattenFrames(frameTree) {
  const frames = [frameTree.frame];
  for (const child of frameTree.childFrames ?? []) {
    frames.push(...flattenFrames(child));
  }
  return frames;
}

async function waitForWebviewClient() {
  const snapshots = [];
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const targets = await fetchJson(`http://127.0.0.1:${remoteDebuggingPort}/json/list`).catch(() => []);
    const webviews = targets.filter((target) => /vscode-webview/i.test(`${target.url ?? ''} ${target.title ?? ''}`));
    snapshots.splice(0, snapshots.length, ...webviews.map((target) => ({
      type: target.type,
      title: target.title,
      url: redactWebviewUrl(target.url),
    })));

    for (const target of webviews) {
      const client = await connectCdp(target.webSocketDebuggerUrl);
      return { target, client };
    }
    await delay(250);
  }
  throw new Error(`Could not find Codechan webview target:\n${JSON.stringify(snapshots, null, 2)}`);
}

async function evaluate(client, expression, contextId) {
  const response = await client.call('Runtime.evaluate', {
    expression,
    returnByValue: true,
    ...(contextId === undefined ? {} : { contextId }),
  });
  if (response.exceptionDetails) {
    throw new Error(`Runtime evaluation failed: ${response.exceptionDetails.text}`);
  }
  return response.result.value;
}

async function connectCdp(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  const pending = new Map();
  let id = 1;

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error) request.reject(new Error(`${message.error.message}: ${message.error.data ?? ''}`));
    else request.resolve(message.result ?? {});
  });

  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  return {
    call(method, params = {}) {
      const requestId = id;
      id += 1;
      return new Promise((resolve, reject) => {
        pending.set(requestId, { resolve, reject });
        socket.send(JSON.stringify({ id: requestId, method, params }));
      });
    },
    close() {
      socket.close();
    },
  };
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
  return response.json();
}

function redactWebviewUrl(url) {
  if (typeof url !== 'string') return '';
  return url.replace(/[?].*$/u, '?...');
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { run };

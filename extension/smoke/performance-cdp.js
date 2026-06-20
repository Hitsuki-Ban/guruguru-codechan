const assert = require('node:assert/strict');
const vscode = require('vscode');

const EXTENSION_ID = 'hitsuki-ban.guruguru-codechan';
const remoteDebuggingPort = Number(process.env.GGC_CDP_PORT);

async function run() {
  assert.ok(Number.isInteger(remoteDebuggingPort), 'GGC_CDP_PORT must be provided.');
  const extension = vscode.extensions.getExtension(EXTENSION_ID);
  assert.ok(extension, `Expected ${EXTENSION_ID} to be loaded in the Extension Development Host.`);

  const wasActiveBefore = extension.isActive;
  const activationStarted = performance.now();
  await extension.activate();
  const activationMs = performance.now() - activationStarted;

  const openStarted = performance.now();
  await vscode.commands.executeCommand('guruguru-codechan.openCanvas');
  const openCanvasMs = performance.now() - openStarted;
  await delay(1800);

  const { target, client } = await waitForWebviewClient();
  try {
    await client.call('Performance.enable');
    const idle = await sampleRenderer(client, 'idle', 5000);
    const mouthCommandStress = await sampleMouthCommandStress(client);
    const hostIdle = await sampleExtensionHostIdle();
    const hostMemory = process.memoryUsage();

    console.log(`GGC_PERF_RESULT ${JSON.stringify({
      extensionHost: {
        wasActiveBefore,
        activationMs: round(activationMs, 3),
        openCanvasMs: round(openCanvasMs, 3),
        idleCpuBusyPercent: hostIdle.cpuBusyPercent,
        idleCpuMs: hostIdle.cpuMs,
        rssMB: round(hostMemory.rss / 1024 / 1024, 3),
        heapUsedMB: round(hostMemory.heapUsed / 1024 / 1024, 3),
        heapTotalMB: round(hostMemory.heapTotal / 1024 / 1024, 3),
      },
      target: {
        title: target.title,
        type: target.type,
        url: redactWebviewUrl(target.url),
      },
      samples: [idle, mouthCommandStress],
    }, null, 2)}`);
  } finally {
    client.close();
  }
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

async function sampleRenderer(client, label, durationMs) {
  const before = await performanceMetrics(client);
  const start = Date.now();
  await delay(durationMs);
  const elapsedMs = Date.now() - start;
  const after = await performanceMetrics(client);
  return summarizeMetrics(label, before, after, elapsedMs);
}

async function sampleMouthCommandStress(client) {
  const before = await performanceMetrics(client);
  const start = Date.now();
  for (let index = 0; index < 180; index += 1) {
    await vscode.commands.executeCommand('guruguru-codechan.setMouthLevel', index % 3);
    await delay(16);
  }
  await vscode.commands.executeCommand('guruguru-codechan.setMouthLevel', 0);
  const elapsedMs = Date.now() - start;
  const after = await performanceMetrics(client);
  return summarizeMetrics('mouth-command-stress', before, after, elapsedMs);
}

async function sampleExtensionHostIdle() {
  const before = process.cpuUsage();
  const start = Date.now();
  await delay(5000);
  const elapsedMs = Date.now() - start;
  const after = process.cpuUsage(before);
  const cpuMs = (after.user + after.system) / 1000;
  return {
    cpuMs: round(cpuMs, 3),
    cpuBusyPercent: round((cpuMs / elapsedMs) * 100, 3),
  };
}

async function performanceMetrics(client) {
  const response = await client.call('Performance.getMetrics');
  return Object.fromEntries(response.metrics.map((metric) => [metric.name, metric.value]));
}

function summarizeMetrics(label, before, after, elapsedMs) {
  const elapsedSeconds = elapsedMs / 1000;
  const taskDurationDelta = delta(before, after, 'TaskDuration');
  return {
    label,
    elapsedMs,
    rendererTaskBusyPercent: round((taskDurationDelta / elapsedSeconds) * 100, 3),
    taskDurationMs: round(taskDurationDelta * 1000, 3),
    jsHeapUsedMB: round((after.JSHeapUsedSize ?? 0) / 1024 / 1024, 3),
    jsHeapTotalMB: round((after.JSHeapTotalSize ?? 0) / 1024 / 1024, 3),
    nodes: Math.round(after.Nodes ?? 0),
    layoutCountDelta: Math.round(delta(before, after, 'LayoutCount')),
    recalcStyleCountDelta: Math.round(delta(before, after, 'RecalcStyleCount')),
  };
}

function delta(before, after, key) {
  return (after[key] ?? 0) - (before[key] ?? 0);
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

async function evaluate(client, expression, awaitPromise = false) {
  const response = await client.call('Runtime.evaluate', {
    expression,
    awaitPromise,
    returnByValue: true,
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

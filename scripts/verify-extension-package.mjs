import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { inflateRawSync } from 'node:zlib';

const SOURCE_MANIFEST = JSON.parse(readFileSync(join('extension', 'package.json'), 'utf8'));
const PACKAGE_PATH = join('extension', `${SOURCE_MANIFEST.name}-${SOURCE_MANIFEST.version}.vsix`);
const EXPECTED_SAMPLE_FRAMES = 150;
const MAX_PACKAGE_BYTES = 60 * 1024 * 1024;
const MAX_WEBVIEW_JS_BYTES = 180 * 1024;
const MAX_WEBVIEW_CSS_BYTES = 8 * 1024;
const MAX_SAMPLE_FRAME_BYTES = 450 * 1024;
const MAX_SAMPLE_FRAME_TOTAL_BYTES = 52 * 1024 * 1024;
const MAX_MARKETPLACE_PREVIEW_BYTES = 1_500_000;
const MAX_MARKETPLACE_DEMO_BYTES = 2_500_000;
const MAX_VENDOR_TOTAL_BYTES = 3 * 1024 * 1024;
const REQUIRED_VENDOR_ENTRIES = [
  'extension/out/vendor/@jsquash/png/decode.js',
  'extension/out/vendor/@jsquash/png/encode.js',
  'extension/out/vendor/@jsquash/png/codec/pkg/squoosh_png_bg.wasm',
  'extension/out/vendor/@jsquash/resize/index.js',
  'extension/out/vendor/@jsquash/resize/lib/resize/pkg/squoosh_resize_bg.wasm',
  'extension/out/vendor/@jsquash/webp/decode.js',
  'extension/out/vendor/@jsquash/webp/encode.js',
  'extension/out/vendor/@jsquash/webp/codec/dec/webp_dec.wasm',
  'extension/out/vendor/@jsquash/webp/codec/enc/webp_enc.wasm',
  'extension/out/vendor/node_modules/wasm-feature-detect/package.json',
];
const ALLOWED_EXACT = new Set([
  '[Content_Types].xml',
  'extension.vsixmanifest',
  'extension/ASSET_LICENSE.md',
  'extension/ASSET_PROVENANCE.json',
  'extension/LICENSE.txt',
  'extension/changelog.md',
  'extension/media/icon.png',
  'extension/media/marketplace/codechan-view-v0.5.5.png',
  'extension/media/marketplace/demo-editor-cursor.gif',
  'extension/media/marketplace/demo-pointer.gif',
  'extension/package.json',
  'extension/package.nls.ja.json',
  'extension/package.nls.json',
  'extension/package.nls.zh-cn.json',
  'extension/readme.md',
  'extension/SUPPORT.md',
  'extension/dist/webview/webview.css',
  'extension/dist/webview/webview.js',
  'extension/out/assetValidation.js',
  'extension/out/characterRegistry.js',
  'extension/out/commands.js',
  'extension/out/extension.js',
  'extension/out/focusTarget.js',
  'extension/out/frameProcessor.js',
  'extension/out/layout.js',
  'extension/out/panel.js',
  'extension/out/shared.js',
  'extension/out/webviewProtocol.js',
]);

function fail(message) {
  console.error(`Extension package verification failed: ${message}`);
  process.exit(1);
}

function readUInt16(buffer, offset) {
  return buffer.readUInt16LE(offset);
}

function readUInt32(buffer, offset) {
  return buffer.readUInt32LE(offset);
}

function findEndOfCentralDirectory(buffer) {
  const signature = 0x06054b50;
  const minOffset = Math.max(0, buffer.length - 0xffff - 22);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (readUInt32(buffer, offset) === signature) return offset;
  }
  fail('could not find ZIP end of central directory');
}

function readZipEntries(buffer) {
  const eocd = findEndOfCentralDirectory(buffer);
  const entryCount = readUInt16(buffer, eocd + 10);
  let offset = readUInt32(buffer, eocd + 16);
  const entries = new Map();

  for (let index = 0; index < entryCount; index += 1) {
    if (readUInt32(buffer, offset) !== 0x02014b50) {
      fail(`invalid central directory header at offset ${offset}`);
    }
    const method = readUInt16(buffer, offset + 10);
    const compressedSize = readUInt32(buffer, offset + 20);
    const uncompressedSize = readUInt32(buffer, offset + 24);
    const fileNameLength = readUInt16(buffer, offset + 28);
    const extraLength = readUInt16(buffer, offset + 30);
    const commentLength = readUInt16(buffer, offset + 32);
    const localHeaderOffset = readUInt32(buffer, offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + fileNameLength);
    entries.set(name, { name, method, compressedSize, uncompressedSize, localHeaderOffset });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function readZipEntry(buffer, entry) {
  const offset = entry.localHeaderOffset;
  if (readUInt32(buffer, offset) !== 0x04034b50) {
    fail(`invalid local file header for ${entry.name}`);
  }
  const fileNameLength = readUInt16(buffer, offset + 26);
  const extraLength = readUInt16(buffer, offset + 28);
  const dataStart = offset + 30 + fileNameLength + extraLength;
  const data = buffer.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.method === 0) return data;
  if (entry.method === 8) return inflateRawSync(data);
  fail(`unsupported ZIP compression method ${entry.method} for ${entry.name}`);
}

if (!existsSync(PACKAGE_PATH)) fail(`missing VSIX: ${PACKAGE_PATH}`);
const packageSize = statSync(PACKAGE_PATH).size;
if (packageSize > MAX_PACKAGE_BYTES) {
  fail(`VSIX is larger than the ${MAX_PACKAGE_BYTES} byte budget: ${packageSize}`);
}

const packageBuffer = readFileSync(PACKAGE_PATH);
const zipEntries = readZipEntries(packageBuffer);
const entries = [...zipEntries.keys()].sort();
if (!zipEntries.has('extension/ASSET_PROVENANCE.json')) {
  fail('missing extension/ASSET_PROVENANCE.json');
}
if (!zipEntries.has('extension/SUPPORT.md')) {
  fail('missing extension/SUPPORT.md');
}
const marketplacePreview = zipEntries.get('extension/media/marketplace/codechan-view-v0.5.5.png');
if (!marketplacePreview) {
  fail('missing extension/media/marketplace/codechan-view-v0.5.5.png');
}
if (marketplacePreview.uncompressedSize > MAX_MARKETPLACE_PREVIEW_BYTES) {
  fail(`Marketplace preview image is larger than the ${MAX_MARKETPLACE_PREVIEW_BYTES} byte budget: ${marketplacePreview.uncompressedSize}`);
}
for (const demoPath of [
  'extension/media/marketplace/demo-editor-cursor.gif',
  'extension/media/marketplace/demo-pointer.gif',
]) {
  const demo = zipEntries.get(demoPath);
  if (!demo) fail(`missing ${demoPath}`);
  if (demo.uncompressedSize > MAX_MARKETPLACE_DEMO_BYTES) {
    fail(`${demoPath} is larger than the ${MAX_MARKETPLACE_DEMO_BYTES} byte budget: ${demo.uncompressedSize}`);
  }
}
for (const walkthroughMedia of [
  'extension/media/walkthrough/open-companion-view.md',
  'extension/media/walkthrough/settings-and-assets.md',
  'extension/media/walkthrough/asset-rights.md',
]) {
  if (!zipEntries.has(walkthroughMedia)) fail(`missing ${walkthroughMedia}`);
}
for (const vendorEntry of REQUIRED_VENDOR_ENTRIES) {
  if (!zipEntries.has(vendorEntry)) fail(`missing runtime vendor entry: ${vendorEntry}`);
}
const unexpected = entries.filter((entry) => {
  if (ALLOWED_EXACT.has(entry)) return false;
  if (/^extension\/media\/actions\/(dark|light)\/(import|lock|switch|trash)\.svg$/.test(entry)) return false;
  if (/^extension\/media\/walkthrough\/(asset-rights|open-companion-view|settings-and-assets)\.md$/.test(entry)) return false;
  if (/^extension\/out\/vendor\/@jsquash\/(png|resize|webp)\//.test(entry)) return false;
  if (/^extension\/out\/vendor\/node_modules\/wasm-feature-detect\//.test(entry)) return false;
  return !entry.startsWith('extension/media/sample-codechan/');
});
if (unexpected.length > 0) {
  fail(`unexpected VSIX entries: ${unexpected.join(', ')}`);
}

const sampleFrames = entries.filter((entry) => /^extension\/media\/sample-codechan\/[A-F]\/r[0-4]c[0-4]\.webp$/.test(entry));
if (sampleFrames.length !== EXPECTED_SAMPLE_FRAMES) {
  fail(`expected ${EXPECTED_SAMPLE_FRAMES} sample frames, found ${sampleFrames.length}`);
}

const webviewScript = zipEntries.get('extension/dist/webview/webview.js');
if (!webviewScript) fail('missing extension/dist/webview/webview.js');
if (webviewScript.uncompressedSize > MAX_WEBVIEW_JS_BYTES) {
  fail(`webview.js is larger than the ${MAX_WEBVIEW_JS_BYTES} byte budget: ${webviewScript.uncompressedSize}`);
}
const webviewStyle = zipEntries.get('extension/dist/webview/webview.css');
if (!webviewStyle) fail('missing extension/dist/webview/webview.css');
if (webviewStyle.uncompressedSize > MAX_WEBVIEW_CSS_BYTES) {
  fail(`webview.css is larger than the ${MAX_WEBVIEW_CSS_BYTES} byte budget: ${webviewStyle.uncompressedSize}`);
}

const sampleEntries = sampleFrames.map((entry) => zipEntries.get(entry));
if (sampleEntries.some((entry) => !entry)) fail('sample frame entry disappeared while checking budgets');
const sampleTotalBytes = sampleEntries.reduce((sum, entry) => sum + entry.compressedSize, 0);
if (sampleTotalBytes > MAX_SAMPLE_FRAME_TOTAL_BYTES) {
  fail(`sample frames exceed the ${MAX_SAMPLE_FRAME_TOTAL_BYTES} byte budget: ${sampleTotalBytes}`);
}
const largestSample = sampleEntries.reduce((largest, entry) => entry.compressedSize > largest.compressedSize ? entry : largest);
if (largestSample.compressedSize > MAX_SAMPLE_FRAME_BYTES) {
  fail(`${largestSample.name} exceeds the ${MAX_SAMPLE_FRAME_BYTES} byte sample frame budget: ${largestSample.compressedSize}`);
}

const vendorEntries = entries.map((entry) => zipEntries.get(entry)).filter((entry) => entry?.name.startsWith('extension/out/vendor/'));
const vendorTotalBytes = vendorEntries.reduce((sum, entry) => sum + entry.uncompressedSize, 0);
if (vendorTotalBytes > MAX_VENDOR_TOTAL_BYTES) {
  fail(`runtime vendor files exceed the ${MAX_VENDOR_TOTAL_BYTES} byte budget: ${vendorTotalBytes}`);
}

const packageJsonEntry = zipEntries.get('extension/package.json');
if (!packageJsonEntry) fail('missing extension/package.json');
const packageJson = JSON.parse(readZipEntry(packageBuffer, packageJsonEntry).toString('utf8'));
if (packageJson.name !== 'guruguru-codechan') {
  fail(`unexpected extension name: ${packageJson.name}`);
}
if (packageJson.publisher !== SOURCE_MANIFEST.publisher) {
  fail(`packaged publisher does not match source manifest: ${packageJson.publisher}`);
}
if (basename(PACKAGE_PATH) !== `${packageJson.name}-${packageJson.version}.vsix`) {
  fail(`VSIX filename does not match manifest version ${packageJson.version}: ${basename(PACKAGE_PATH)}`);
}

console.log('Extension package verification passed.');

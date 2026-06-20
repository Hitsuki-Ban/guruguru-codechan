import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { FrameExt } from './shared';

export const IMPORT_FRAME_MAX_EDGE = 512;

interface RgbaImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

type PngDecodeModule = typeof import('@jsquash/png/decode.js');
type PngEncodeModule = typeof import('@jsquash/png/encode.js');
type ResizeModule = typeof import('@jsquash/resize');
type WebpDecodeModule = typeof import('@jsquash/webp/decode.js');
type WebpEncodeModule = typeof import('@jsquash/webp/encode.js');

const requireFromHere = createRequire(__filename);
const runtimeVendorRoot = join(dirname(__filename), 'vendor');
let pngReady: Promise<void> | undefined;
let resizeReady: Promise<void> | undefined;
let webpDecodeReady: Promise<void> | undefined;
let webpEncodeReady: Promise<void> | undefined;

export async function normalizeImportedFrame(input: Uint8Array, ext: FrameExt): Promise<Uint8Array> {
  const size = readFrameSize(input, ext);
  if (Math.max(size.width, size.height) <= IMPORT_FRAME_MAX_EDGE) return input;
  ensureImageDataGlobal();
  const image = await decodeFrame(input, ext);
  const normalized = await resizeToMaxEdge(image, IMPORT_FRAME_MAX_EDGE);
  return encodeFrame(normalized, ext);
}

async function decodeFrame(input: Uint8Array, ext: FrameExt): Promise<RgbaImage> {
  const source = toArrayBuffer(input);
  if (ext === 'png') {
    const module = await import(codecModuleSpecifier('@jsquash/png/decode.js')) as PngDecodeModule;
    await initPng(module);
    return module.decode(source);
  }

  const module = await import(codecModuleSpecifier('@jsquash/webp/decode.js')) as WebpDecodeModule;
  await initWebpDecode(module);
  return module.default(source);
}

async function resizeToMaxEdge(image: RgbaImage, maxEdge: number): Promise<RgbaImage> {
  const longestEdge = Math.max(image.width, image.height);
  if (longestEdge === maxEdge) return image;
  const scale = maxEdge / longestEdge;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const module = await import(codecModuleSpecifier('@jsquash/resize/index.js')) as ResizeModule;
  await initResize(module);
  return module.default(asImageData(image), {
    width,
    height,
    method: 'lanczos3',
    fitMethod: 'stretch',
  });
}

async function encodeFrame(image: RgbaImage, ext: FrameExt): Promise<Uint8Array> {
  if (ext === 'png') {
    const module = await import(codecModuleSpecifier('@jsquash/png/encode.js')) as PngEncodeModule;
    await initPng(module);
    return new Uint8Array(await module.default(asImageData(image)));
  }

  const module = await import(codecModuleSpecifier('@jsquash/webp/encode.js')) as WebpEncodeModule;
  await initWebpEncode(module);
  return new Uint8Array(await module.default(asImageData(image), { quality: 90 }));
}

async function initPng(module: PngDecodeModule | PngEncodeModule): Promise<void> {
  if (!pngReady) {
    pngReady = wasmModule('@jsquash/png/codec/pkg/squoosh_png_bg.wasm').then((wasm) => module.init(wasm)).then(() => undefined);
  }
  await pngReady;
}

async function initResize(module: ResizeModule): Promise<void> {
  if (!resizeReady) {
    resizeReady = wasmModule('@jsquash/resize/lib/resize/pkg/squoosh_resize_bg.wasm')
      .then((wasm) => module.initResize(wasm))
      .then(() => undefined);
  }
  await resizeReady;
}

async function initWebpDecode(module: WebpDecodeModule): Promise<void> {
  if (!webpDecodeReady) {
    webpDecodeReady = wasmModule('@jsquash/webp/codec/dec/webp_dec.wasm')
      .then((wasm) => module.init(wasm))
      .then(() => undefined);
  }
  await webpDecodeReady;
}

async function initWebpEncode(module: WebpEncodeModule): Promise<void> {
  if (!webpEncodeReady) {
    webpEncodeReady = wasmModule('@jsquash/webp/codec/enc/webp_enc.wasm')
      .then((wasm) => module.init(wasm))
      .then(() => undefined);
  }
  await webpEncodeReady;
}

async function wasmModule(specifier: string): Promise<WebAssembly.Module> {
  const bytes = await readFile(codecFilePath(specifier));
  return WebAssembly.compile(bytes);
}

function codecModuleSpecifier(specifier: string): string {
  const vendorPath = vendorCodecPath(specifier);
  if (vendorPath) return pathToFileURL(vendorPath).href;
  return specifier;
}

function codecFilePath(specifier: string): string {
  const vendorPath = vendorCodecPath(specifier);
  if (vendorPath) return vendorPath;
  return requireFromHere.resolve(specifier);
}

function vendorCodecPath(specifier: string): string | undefined {
  const vendorPath = join(runtimeVendorRoot, ...specifier.split('/'));
  return existsSync(vendorPath) ? vendorPath : undefined;
}

function toArrayBuffer(input: Uint8Array): ArrayBuffer {
  const output = new ArrayBuffer(input.byteLength);
  new Uint8Array(output).set(input);
  return output;
}

function asImageData(image: RgbaImage): ImageData {
  ensureImageDataGlobal();
  return new ImageData(toImageDataArray(image.data), image.width, image.height);
}

function toImageDataArray(data: Uint8ClampedArray): ImageDataArray {
  const copy = new Uint8ClampedArray(data.length);
  copy.set(data);
  return copy as ImageDataArray;
}

function ensureImageDataGlobal(): void {
  if (typeof globalThis.ImageData !== 'undefined') return;
  globalThis.ImageData = class ImageData {
    readonly data: Uint8ClampedArray;
    readonly width: number;
    readonly height: number;
    readonly colorSpace: PredefinedColorSpace = 'srgb';

    constructor(data: Uint8ClampedArray, width: number, height: number) {
      this.data = data;
      this.width = width;
      this.height = height;
    }
  } as typeof ImageData;
}

function readFrameSize(input: Uint8Array, ext: FrameExt): { width: number; height: number } {
  if (ext === 'png') return readPngSize(input);
  return readWebpSize(input);
}

function readPngSize(input: Uint8Array): { width: number; height: number } {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (input.length < 24 || !signature.every((byte, index) => input[index] === byte)) {
    throw new Error('Invalid PNG frame: missing PNG signature.');
  }
  return {
    width: readUint32Be(input, 16),
    height: readUint32Be(input, 20),
  };
}

function readWebpSize(input: Uint8Array): { width: number; height: number } {
  if (input.length < 20 || text(input, 0, 4) !== 'RIFF' || text(input, 8, 4) !== 'WEBP') {
    throw new Error('Invalid WebP frame: missing RIFF WEBP signature.');
  }

  let offset = 12;
  while (offset + 8 <= input.length) {
    const chunk = text(input, offset, 4);
    const size = readUint32Le(input, offset + 4);
    const payload = offset + 8;
    if (payload + size > input.length) throw new Error(`Invalid WebP frame: truncated ${chunk} chunk.`);
    if (chunk === 'VP8X') {
      if (size < 10) throw new Error('Invalid WebP frame: truncated VP8X chunk.');
      return {
        width: 1 + readUint24Le(input, payload + 4),
        height: 1 + readUint24Le(input, payload + 7),
      };
    }
    if (chunk === 'VP8L') {
      if (size < 5 || input[payload] !== 0x2f) throw new Error('Invalid WebP frame: malformed VP8L chunk.');
      const bits = readUint32Le(input, payload + 1);
      return {
        width: 1 + (bits & 0x3fff),
        height: 1 + ((bits >> 14) & 0x3fff),
      };
    }
    if (chunk === 'VP8 ') {
      if (size < 10 || input[payload + 3] !== 0x9d || input[payload + 4] !== 0x01 || input[payload + 5] !== 0x2a) {
        throw new Error('Invalid WebP frame: malformed VP8 chunk.');
      }
      return {
        width: readUint16Le(input, payload + 6) & 0x3fff,
        height: readUint16Le(input, payload + 8) & 0x3fff,
      };
    }
    offset = payload + size + (size % 2);
  }

  throw new Error('Invalid WebP frame: missing VP8, VP8L, or VP8X chunk.');
}

function text(input: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...input.subarray(offset, offset + length));
}

function readUint16Le(input: Uint8Array, offset: number): number {
  return input[offset] | (input[offset + 1] << 8);
}

function readUint24Le(input: Uint8Array, offset: number): number {
  return input[offset] | (input[offset + 1] << 8) | (input[offset + 2] << 16);
}

function readUint32Le(input: Uint8Array, offset: number): number {
  return (input[offset] | (input[offset + 1] << 8) | (input[offset + 2] << 16) | (input[offset + 3] << 24)) >>> 0;
}

function readUint32Be(input: Uint8Array, offset: number): number {
  return ((input[offset] << 24) | (input[offset + 1] << 16) | (input[offset + 2] << 8) | input[offset + 3]) >>> 0;
}

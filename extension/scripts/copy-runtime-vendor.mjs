import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const vendorRoot = join(process.cwd(), 'out', 'vendor');
const codecPackages = [
  { name: '@jsquash/png', target: ['@jsquash', 'png'] },
  { name: '@jsquash/resize', target: ['@jsquash', 'resize'] },
  { name: '@jsquash/webp', target: ['@jsquash', 'webp'] },
  { name: 'wasm-feature-detect', target: ['node_modules', 'wasm-feature-detect'] },
];

rmSync(vendorRoot, { recursive: true, force: true });
mkdirSync(vendorRoot, { recursive: true });

for (const packageInfo of codecPackages) {
  const source = dirname(require.resolve(`${packageInfo.name}/package.json`));
  const target = join(vendorRoot, ...packageInfo.target);
  cpSync(source, target, { recursive: true, dereference: true });
}

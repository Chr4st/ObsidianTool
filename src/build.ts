import * as esbuild from 'esbuild';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const emptyModulePath = join(__dirname, '..', 'dist', '_empty.js');

mkdirSync(join(__dirname, '..', 'dist'), { recursive: true });
writeFileSync(emptyModulePath, 'export default {};');

const esmBanner = `#!/usr/bin/env node
import { createRequire as __$$createRequire } from 'module';
const require = __$$createRequire(import.meta.url);
`;

await esbuild.build({
  entryPoints: ['src/cli.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/cli.js',
  sourcemap: true,
  banner: {
    js: esmBanner,
  },
  external: [
    'better-sqlite3',
    'web-tree-sitter',
    'onnxruntime-node',
    'fsevents',
  ],
  alias: {
    'react-devtools-core': emptyModulePath,
    'yoga-wasm-web': emptyModulePath,
  },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  logLevel: 'info',
});

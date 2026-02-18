import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const src = resolve(root, 'public');
const out = resolve(root, 'build');

if (!existsSync(src)) {
  throw new Error('public directory does not exist');
}

if (existsSync(out)) {
  rmSync(out, { recursive: true, force: true });
}

mkdirSync(out, { recursive: true });
cpSync(src, out, { recursive: true });

console.log('Build complete: public -> build');

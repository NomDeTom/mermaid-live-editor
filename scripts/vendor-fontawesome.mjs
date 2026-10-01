// Copies Font Awesome Free's stylesheet, webfonts and LICENSE into static/vendor/, so the
// hub build's exported SVGs can reference the hub's own copy instead of cdnjs.
// Unmodified files with their license (icons CC BY 4.0, fonts SIL OFL 1.1, code MIT):
// redistribution alongside software is permitted on those terms.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const pkg = dirname(
  createRequire(import.meta.url).resolve('@fortawesome/fontawesome-free/package.json')
);
const out = 'static/vendor/fontawesome';
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'css'), { recursive: true });
cpSync(join(pkg, 'css/all.min.css'), join(out, 'css/all.min.css'));
cpSync(join(pkg, 'webfonts'), join(out, 'webfonts'), { recursive: true });
cpSync(join(pkg, 'LICENSE.txt'), join(out, 'LICENSE.txt'));
console.log(`vendored Font Awesome Free into ${out}`);

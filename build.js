/**
 * Build script: bundles, minifies, and obfuscates the extension for distribution.
 * Output → dist/  (load this folder as an unpacked extension)
 */

import * as esbuild from 'esbuild';
import JavaScriptObfuscator from 'javascript-obfuscator';
import fs from 'fs';
import path from 'path';

const WATCH = process.argv.includes('--watch');

// ── Clean output ────────────────────────────────────────────────────────────
fs.rmSync('dist', { recursive: true, force: true });
fs.mkdirSync('dist/content', { recursive: true });
fs.mkdirSync('dist/popup',   { recursive: true });
fs.mkdirSync('dist/icons',   { recursive: true });

// ── Bundle + minify JS ──────────────────────────────────────────────────────
await esbuild.build({
  entryPoints: {
    'content/skin':   'content/skin.js',
    'content/bridge': 'content/bridge.js',
    'popup/popup':    'popup/popup.js',
  },
  bundle:   true,
  minify:   true,
  format:   'iife',
  target:   ['chrome100'],
  outdir:   'dist',
  logLevel: 'info',
});

// ── Obfuscate the two main scripts ──────────────────────────────────────────
const OBFUSCATE_OPTIONS = {
  compact:                    true,
  // Control-flow flattening and dead-code injection hurt perf — off
  controlFlowFlattening:      false,
  deadCodeInjection:          false,
  // String encoding makes the source very hard to read
  stringArray:                true,
  stringArrayEncoding:        ['base64'],
  stringArrayThreshold:       0.8,
  rotateStringArray:          true,
  shuffleStringArray:         true,
  splitStrings:               false,
  // Rename all internal identifiers to _0xABCD style
  identifierNamesGenerator:   'hexadecimal',
  renameGlobals:              false,
  // selfDefending uses Function() constructor which Chrome CSP blocks
  selfDefending:              false,
  target:                     'browser',
};

for (const file of ['dist/content/skin.js', 'dist/content/bridge.js']) {
  const src    = fs.readFileSync(file, 'utf8');
  const result = JavaScriptObfuscator.obfuscate(src, OBFUSCATE_OPTIONS);
  fs.writeFileSync(file, result.getObfuscatedCode());
  console.log(`Obfuscated ${file}`);
}

// ── Minify CSS ───────────────────────────────────────────────────────────────
await esbuild.build({
  entryPoints: ['content/skin.css', 'content/pip.css'],
  minify:      true,
  outdir:      'dist/content',
  logLevel:    'info',
});

// ── Copy static assets ───────────────────────────────────────────────────────
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    entry.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}
copyDir('icons', 'dist/icons');
fs.copyFileSync('popup/popup.html', 'dist/popup/popup.html');

// ── Generate dist/manifest.json ──────────────────────────────────────────────
// All skin/* and bridge/* modules are now bundled into single files,
// so we no longer need to expose the sub-module directories.
const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
manifest.web_accessible_resources = [
  {
    resources: ['content/bridge.js', 'content/pip.css'],
    matches:   ['*://www.youtube.com/*'],
  },
];
fs.writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2));

console.log('\n✓ Build complete → dist/');

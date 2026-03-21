// BlackjackML — Bundle Minifier
// Removes block comments and blank lines only.
// Does NOT strip // single-line comments — a naive regex for that breaks
// regex literals like /^https?:\/\// inside the source code.

const fs   = require('fs');
const path = require('path');

// Find the project root (two levels up from build-src/)
const projectRoot = path.resolve(__dirname, '..');
const bundlePath  = path.join(projectRoot, 'app', 'static', 'bundle.js');
const minPath     = path.join(projectRoot, 'app', 'static', 'bundle.min.js');

const src = fs.readFileSync(bundlePath, 'utf8');

const out = src
  .replace(/\/\*(?!!)[^]*?\*\//g, '')  // remove /* block comments */ (keep /*! licence)
  .replace(/\n{3,}/g, '\n\n')           // collapse 3+ blank lines → 1 blank line
  .replace(/[ \t]+$/gm, '')             // strip trailing whitespace from each line
  .replace(/^[ \t]{8,}/gm, '    ')      // collapse deep indentation to 4 spaces
  .trim();

fs.writeFileSync(minPath, out, 'utf8');

const origKB = (fs.statSync(bundlePath).size / 1024).toFixed(0);
const minKB  = (fs.statSync(minPath).size  / 1024).toFixed(0);
console.log(`  ${origKB} KB → ${minKB} KB`);

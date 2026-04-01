// fix_hooks.js - fixes duplicate const hook declarations in bundle.js
// Run with: node build-src/fix_hooks.js
const fs = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, '..', 'app', 'static', 'bundle.js');
let src = fs.readFileSync(bundlePath, 'utf8');

// Fix 1: Replace `const { useState, useEffect, ... } = React;` with var equivalents
// var allows redeclaration across the whole file; const does not
src = src.replace(/const \{ ([\w,\s]+) \} = React;/g, function(match, hooks) {
    var hookList = hooks.split(',').map(function(h) { return h.trim(); }).filter(Boolean);
    return 'var ' + hookList.map(function(h) { return h + ' = React.' + h; }).join(', ') + ';';
});

// Fix 2: Convert `const` to `var` inside function bodies.
// When tsc compiles useCallback/useMemo/etc, it emits `const handleX = useCallback(...)`.
// In a single concatenated file, useEffect dependency arrays can reference these BEFORE
// their declaration line, causing "Cannot access 'X' before initialization" (TDZ error).
// `var` hoists to function scope, avoiding the temporal dead zone entirely.
// We only convert `const` that are followed by a variable assignment (not destructuring).
src = src.replace(/^(\s+)const (\w+ =)/gm, '$1var $2');

fs.writeFileSync(bundlePath, src, 'utf8');
console.log('Hook declarations fixed.');
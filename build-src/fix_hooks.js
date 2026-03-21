// fix_hooks.js - fixes duplicate const hook declarations in bundle.js
// Run with: node build-src/fix_hooks.js
const fs = require('fs');
const path = require('path');

const bundlePath = path.join(__dirname, '..', 'app', 'static', 'bundle.js');
let src = fs.readFileSync(bundlePath, 'utf8');

// Replace `const { useState, useEffect, ... } = React;` with var equivalents
// var allows redeclaration across the whole file; const does not
src = src.replace(/const \{ ([\w,\s]+) \} = React;/g, function(match, hooks) {
    var hookList = hooks.split(',').map(function(h) { return h.trim(); }).filter(Boolean);
    return 'var ' + hookList.map(function(h) { return h + ' = React.' + h; }).join(', ') + ';';
});

fs.writeFileSync(bundlePath, src, 'utf8');
console.log('Hook declarations fixed.');
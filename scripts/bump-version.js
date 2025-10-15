#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const packagePath = path.join(__dirname, '../package.json');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

// Incrementar la versión patch (1.0.0 -> 1.0.1)
const version = pkg.version.split('.');
version[2] = parseInt(version[2]) + 1;
pkg.version = version.join('.');

// Guardar el package.json actualizado
fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');

console.log(`✅ Versión incrementada a ${pkg.version}`);


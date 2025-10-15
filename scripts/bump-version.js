#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packagePath = join(__dirname, '../package.json');
const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));

// Incrementar la versión patch (1.0.0 -> 1.0.1)
const version = pkg.version.split('.');
version[2] = parseInt(version[2]) + 1;
pkg.version = version.join('.');

// Guardar el package.json actualizado
writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');

console.log(`✅ Versión incrementada a ${pkg.version}`);


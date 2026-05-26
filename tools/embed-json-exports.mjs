import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const catalogPath = path.join(root, 'js/data/catalog.js');
let catalog = fs.readFileSync(catalogPath, 'utf8');

const npcs = JSON.parse(fs.readFileSync(path.join(root, 'config/v1/npcs.json'), 'utf8'));
const sums = JSON.parse(fs.readFileSync(path.join(root, 'config/v1/semesterSummaries.json'), 'utf8'));

const esc = (s) => JSON.stringify(s);

const npcBlock = `export const npcsCatalog = ${esc(npcs)};\n\n`;
const sumBlock = `export const semesterSummariesCatalog = ${esc(sums)};\n\n`;

catalog = catalog.replace(/export const npcsCatalog = \[[\s\S]*?\];\n\n/, '');
catalog = catalog.replace(/export const semesterSummariesCatalog = \[[\s\S]*?\];\n\n/, '');
if (!catalog.includes('export const npcsCatalog')) {
  catalog = catalog.replace(/export const relationshipsCatalog = /, `${npcBlock}${sumBlock}export const relationshipsCatalog = `);
} else {
  console.error('unexpected: npcs marker missing after strip');
  process.exit(1);
}

fs.writeFileSync(catalogPath, catalog);
console.log('embedded npcs + semesterSummaries');

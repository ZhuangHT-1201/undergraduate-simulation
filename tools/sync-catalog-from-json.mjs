/**
 * Mirrors config/v1/*.json into js/data/catalog.js exports (no bundled CLI elsewhere).
 * Run from repo root: node tools/sync-catalog-from-json.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function patchExport(catalogText, exportName, data) {
  const needle = `export const ${exportName} = `;
  const i = catalogText.indexOf(needle);
  if (i < 0) throw new Error(`missing ${exportName}`);
  let j = i + needle.length;
  const open = catalogText[j];
  if (open !== '[' && open !== '{') throw new Error(`${exportName} is not a JSON literal`);
  const close = open === '[' ? ']' : '}';
  let depth = 0;
  let inStr = false;
  let esc = false;
  let q = '';
  const start = j;
  for (; j < catalogText.length; j++) {
    const c = catalogText[j];
    if (inStr) {
      if (esc) {
        esc = false;
      } else if (c === '\\') {
        esc = true;
      } else if (c === q) {
        inStr = false;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = true;
      q = c;
      continue;
    }
    if (c === open) depth++;
    if (c === close) {
      depth--;
      if (depth === 0) {
        j++;
        break;
      }
    }
  }
  const before = catalogText.slice(0, start);
  const after = catalogText.slice(j);
  return `${before}${JSON.stringify(data)}${after}`;
}

const catalogPath = path.join(root, 'js/data/catalog.js');
let catalog = fs.readFileSync(catalogPath, 'utf8');

const events = JSON.parse(fs.readFileSync(path.join(root, 'config/v1/events.json'), 'utf8'));
const actions = JSON.parse(fs.readFileSync(path.join(root, 'config/v1/actions.json'), 'utf8'));
const endings = JSON.parse(fs.readFileSync(path.join(root, 'config/v1/endings.json'), 'utf8'));
const items = JSON.parse(fs.readFileSync(path.join(root, 'config/v1/items.json'), 'utf8'));
const randomEvents = JSON.parse(fs.readFileSync(path.join(root, 'config/v1/randomEvents.json'), 'utf8'));
const achievements = JSON.parse(fs.readFileSync(path.join(root, 'config/v1/achievements.json'), 'utf8'));
const npcs = JSON.parse(fs.readFileSync(path.join(root, 'config/v1/npcs.json'), 'utf8'));
const uiThemeConfig = JSON.parse(fs.readFileSync(path.join(root, 'config/v1/uiTheme.json'), 'utf8'));
const semesterSummaries = JSON.parse(
  fs.readFileSync(path.join(root, 'config/v1/semesterSummaries.json'), 'utf8'),
);

catalog = patchExport(catalog, 'eventsCatalog', events);
catalog = patchExport(catalog, 'actionsCatalog', actions);
catalog = patchExport(catalog, 'endingsCatalog', endings);
catalog = patchExport(catalog, 'itemsCatalog', items);
catalog = patchExport(catalog, 'randomEventsCatalog', randomEvents);
catalog = patchExport(catalog, 'achievementsCatalog', achievements);
catalog = patchExport(catalog, 'npcsCatalog', npcs);
catalog = patchExport(catalog, 'uiTheme', uiThemeConfig);
catalog = patchExport(catalog, 'semesterSummariesCatalog', semesterSummaries);

fs.writeFileSync(catalogPath, catalog);
console.log('synced events/actions/endings/items/randomEvents/achievements/npcs/uiTheme/semesterSummaries → catalog.js');

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GAME_TYPES_IMPORT = `import { WeaponsDB } from './weapons_data';\nimport type { EntityConfig, WeaponData } from '@/types/game';\n\n`;

function transformEntities() {
  const p = path.join(__dirname, 'lib/game/entities.ts');
  let code = fs.readFileSync(p, 'utf8');
  code = code.replace(/^class /gm, 'export class ');
  code = code.replace(/window\.WeaponsDB/g, 'WeaponsDB');
  code = GAME_TYPES_IMPORT + code;
  fs.writeFileSync(p, code);
  console.log('Transformed entities.ts');
}

function transformSimulation() {
  const p = path.join(__dirname, 'lib/game/simulation.ts');
  let code = fs.readFileSync(p, 'utf8');
  code = code.replace(/^class /gm, 'export class ');
  code = code.replace(/window\.WeaponsDB/g, 'WeaponsDB');
  const simImports = `import { Entity, OffensiveEntity, DefensiveEntity, ReconDrone, KamikazeDrone } from './entities';\nimport { WeaponsDB } from './weapons_data';\n\n`;
  code = simImports + code;
  fs.writeFileSync(p, code);
  console.log('Transformed simulation.ts');
}

function transformRenderer() {
  const p = path.join(__dirname, 'lib/game/renderer.ts');
  if (!fs.existsSync(p)) return;
  let code = fs.readFileSync(p, 'utf8');
  code = code.replace(/^class /gm, 'export class ');
  code = code.replace(/window\.WeaponsDB/g, 'WeaponsDB');
  const renImports = `import type { Entity, OffensiveEntity, DefensiveEntity } from './entities';\nimport { WeaponsDB } from './weapons_data';\n\n`;
  code = renImports + code;
  fs.writeFileSync(p, code);
  console.log('Transformed renderer.ts');
}

transformEntities();
transformSimulation();
transformRenderer();

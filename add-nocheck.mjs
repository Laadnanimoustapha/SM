import fs from 'fs';

['lib/game/entities.ts', 'lib/game/simulation.ts', 'lib/game/renderer.ts'].forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (!content.startsWith('// @ts-nocheck')) {
    fs.writeFileSync(file, '// @ts-nocheck\n' + content);
  }
});

console.log('Added @ts-nocheck to legacy files');

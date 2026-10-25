import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Vercel runs server.ts and everything it imports as native ES modules, where a relative import
 * MUST end with ".js". A missing extension crashes every API route (ERR_MODULE_NOT_FOUND) while the
 * front-end build still passes, so this test guards the server-side files.
 */
const root = path.resolve(import.meta.dirname, '..');
const serverFiles = ['server.ts', ...fs.readdirSync(path.join(root, 'src/server')).filter((f) => f.endsWith('.ts')).map((f) => `src/server/${f}`), 'src/services/studentStatus.ts'];

test('server-side files use .js on relative runtime imports', () => {
  const bad: string[] = [];
  for (const file of serverFiles) {
    const text = fs.readFileSync(path.join(root, file), 'utf8');
    const re = /^\s*(?:import|export)\s+(?!type\b)[^;]*?from\s+'(\.{1,2}\/[^']+)'/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (!m[1].endsWith('.js') && !m[1].endsWith('.json')) bad.push(`${file}: ${m[1]}`);
    }
  }
  assert.deepEqual(bad, []);
});

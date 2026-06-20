import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, 'js', 'buildId.js');

const id = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)
  || process.env.VERCEL_DEPLOYMENT_ID?.slice(0, 8)
  || Date.now().toString(36);

const content = `/** Generated at deploy — do not edit. */
export const BUILD_ID = '${id}';
`;

fs.writeFileSync(out, content, 'utf8');
console.log(`buildId.js → ${id}`);

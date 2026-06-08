import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { buildApp } from '../src/app.js';
import { env } from '../src/config/env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'swagger');

async function main() {
  const app = await buildApp();
  await app.ready();

  const spec = app.swagger() as Record<string, unknown>;
  if (spec.servers && Array.isArray(spec.servers) && spec.servers[0]) {
    (spec.servers[0] as { url: string }).url = `http://localhost:${env.port}`;
  }

  mkdirSync(outDir, { recursive: true });

  const jsonPath = join(outDir, 'openapi.json');
  writeFileSync(jsonPath, JSON.stringify(spec, null, 2), 'utf8');

  const yamlPath = join(outDir, 'openapi.yaml');
  const yaml = app.swagger({ yaml: true }) as string;
  writeFileSync(yamlPath, yaml, 'utf8');

  await app.close();

  const paths = spec.paths as Record<string, unknown> | undefined;
  const pathCount = paths ? Object.keys(paths).length : 0;
  // eslint-disable-next-line no-console
  console.log(`Swagger spec generated: ${pathCount} paths`);
  // eslint-disable-next-line no-console
  console.log(`  JSON: ${jsonPath}`);
  // eslint-disable-next-line no-console
  console.log(`  YAML: ${yamlPath}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

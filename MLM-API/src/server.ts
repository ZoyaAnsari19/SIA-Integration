import { buildApp } from './app.js';
import { env } from './config/env.js';
import { startJobs } from './jobs/index.js';

// Ensure BigInt values are JSON-serializable across all responses
// e.g. Prisma BIGINT ids in support_tickets, users, etc.
// This prevents frontend from seeing empty {} objects for items.
// eslint-disable-next-line no-extend-native
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

async function main() {
  const app = await buildApp();
  await startJobs();
  await app.listen({ port: env.port, host: '0.0.0.0' });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});


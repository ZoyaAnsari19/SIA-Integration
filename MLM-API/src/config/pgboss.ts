import PgBoss from 'pg-boss';
import { env } from './env.js';

export const boss = new PgBoss(env.databaseUrl);

// Handle PgBoss errors
boss.on('error', (error) => {
  console.error('❌ PgBoss error:', error);
});



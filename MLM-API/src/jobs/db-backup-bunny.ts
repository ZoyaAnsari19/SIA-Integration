/**
 * Daily production DB backup: pg_dump -> gzip -> upload to Bunny Storage.
 * Scheduled at 23:30 UTC (5:00 AM IST) via PgBoss - runs on the same server as the API.
 */

import { spawn } from 'child_process';
import { createReadStream, unlinkSync, writeFileSync, existsSync } from 'fs';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { readFile } from 'fs/promises';
import { bunnyCDNService } from '../modules/bunny-cdn/bunny-cdn.service.js';
import { env } from '../config/env.js';

const BUNNY_FOLDER = 'db-backups';

function parseDatabaseUrl(url: string): { host: string; port: string; user: string; password: string; database: string } {
  try {
    const u = new URL(url);
    const db = (u.pathname || '/').slice(1).split('?')[0] || 'postgres';
    return {
      host: u.hostname || 'localhost',
      port: u.port || '5432',
      user: decodeURIComponent(u.username || 'postgres'),
      password: decodeURIComponent(u.password || ''),
      database: db || 'postgres',
    };
  } catch {
    throw new Error('Invalid DATABASE_URL');
  }
}

/** Format current time in IST (Asia/Kolkata) for filename: YYYYMMDD_HHMMSS */
function formatTimestamp(): string {
  const d = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const Y = get('year');
  const M = get('month');
  const D = get('day');
  const h = get('hour');
  const m = get('minute');
  const s = get('second');
  return `${Y}${M}${D}_${h}${m}${s}`;
}

export async function runDbBackupToBunny(): Promise<{ filename: string; sizeBytes: number }> {
  const dbUrl = env.databaseUrl;
  const parsed = parseDatabaseUrl(dbUrl);
  const prefix = `mlm-prod-${formatTimestamp()}`;
  const workDir = tmpdir();
  const sqlPath = join(workDir, `${prefix}.sql`);
  const gzPath = join(workDir, `${prefix}.sql.gz`);

  return new Promise((resolve, reject) => {
    const envWithPass = { ...process.env, PGPASSWORD: parsed.password };
    const pgDump = spawn('pg_dump', [
      '-h', parsed.host,
      '-p', parsed.port,
      '-U', parsed.user,
      '-d', parsed.database,
      '--no-owner',
      '--no-acl',
      '--format=plain',
    ], { env: envWithPass });

    const out = createWriteStream(sqlPath);
    pgDump.stdout.pipe(out);
    let stderr = '';
    pgDump.stderr?.on('data', (ch) => { stderr += ch.toString(); });

    pgDump.on('close', (code) => {
      const done = () => {
        if (code !== 0) {
          if (existsSync(sqlPath)) unlinkSync(sqlPath);
          reject(new Error(`pg_dump failed (${code}): ${stderr}`));
          return;
        }
        runGzipAndUpload().then(resolve).catch(reject);
      };
      if (out.writableFinished) done();
      else out.once('finish', done);
    });
    pgDump.on('error', (err) => {
      if (existsSync(sqlPath)) unlinkSync(sqlPath);
      reject(err);
    });

    async function runGzipAndUpload(): Promise<{ filename: string; sizeBytes: number }> {
      await pipeline(
        createReadStream(sqlPath),
        createGzip({ level: 9 }),
        createWriteStream(gzPath),
      );
      unlinkSync(sqlPath);

      const gzBuffer = await readFile(gzPath);
      const remoteName = `${prefix}.sql.gz`;
      await bunnyCDNService.uploadFile(gzBuffer, remoteName, BUNNY_FOLDER);
      unlinkSync(gzPath);

      return { filename: remoteName, sizeBytes: gzBuffer.length };
    }
  });
}

export async function registerDbBackupBunny() {
  const { boss } = await import('../config/pgboss.js');
  await boss.work('db-backup-bunny', async () => {
    console.log('[db-backup-bunny] Starting production DB backup (pg_dump -> gzip -> Bunny)');
    try {
      const result = await runDbBackupToBunny();
      console.log(`[db-backup-bunny] Done: ${result.filename} (${(result.sizeBytes / 1024 / 1024).toFixed(2)} MB)`);
      return result;
    } catch (err) {
      console.error('[db-backup-bunny] Error:', err instanceof Error ? err.message : err);
      if (err instanceof Error && err.stack) console.error('[db-backup-bunny] Stack:', err.stack);
      throw err;
    }
  });
}

import 'dotenv/config';
import { Client } from 'pg';

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    // Add pragmatic foreign keys (may error if rerun)
    await client.query(`
      DO $$ BEGIN
      BEGIN
        ALTER TABLE purchases
          ADD CONSTRAINT purchases_user_fk FOREIGN KEY (user_id) REFERENCES users(id),
          ADD CONSTRAINT purchases_package_fk FOREIGN KEY (package_id) REFERENCES packages(id);
      EXCEPTION WHEN duplicate_object THEN NULL; END;
      BEGIN
        ALTER TABLE ledger_entries
          ADD CONSTRAINT ledger_receiver_fk FOREIGN KEY (receiver_user_id) REFERENCES users(id),
          ADD CONSTRAINT ledger_source_fk FOREIGN KEY (source_user_id) REFERENCES users(id);
      EXCEPTION WHEN duplicate_object THEN NULL; END;
      BEGIN
        ALTER TABLE wallet_transactions
          ADD CONSTRAINT wallet_receiver_fk FOREIGN KEY (receiver_user_id) REFERENCES users(id),
          ADD CONSTRAINT wallet_ledger_fk FOREIGN KEY (ledger_entry_id) REFERENCES ledger_entries(id);
      EXCEPTION WHEN duplicate_object THEN NULL; END;
      BEGIN
        ALTER TABLE pending_commissions
          ADD CONSTRAINT pending_receiver_fk FOREIGN KEY (receiver_user_id) REFERENCES users(id),
          ADD CONSTRAINT pending_source_fk FOREIGN KEY (source_user_id) REFERENCES users(id);
      EXCEPTION WHEN duplicate_object THEN NULL; END;
      BEGIN
        ALTER TABLE scheduled_commissions
          ADD CONSTRAINT sched_receiver_fk FOREIGN KEY (receiver_user_id) REFERENCES users(id),
          ADD CONSTRAINT sched_source_fk FOREIGN KEY (source_user_id) REFERENCES users(id);
      EXCEPTION WHEN duplicate_object THEN NULL; END;
      END $$;
    `);
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

    // Example default commission rules placeholders
    const spotPercents = [5, 3, 2, 1, 1, 0.5, 0.5, 0.25, 0.25];
    for (let lvl = 1; lvl <= 9; lvl++) {
      await client.query(
        `INSERT INTO commission_rules (type, level, percent, fixed_amount, eligibility)
         VALUES ($1, $2, $3, NULL, $4)
         ON CONFLICT DO NOTHING;`,
        [
          'LEVEL_SPOT',
          lvl,
          spotPercents[lvl - 1],
          JSON.stringify({ required_leg_count: Math.min(lvl, 4), required_leg_min_amount: 375000 }),
        ]
      );
      await client.query(
        `INSERT INTO commission_rules (type, level, percent, fixed_amount, eligibility)
         VALUES ($1, $2, $3, NULL, $4)
         ON CONFLICT DO NOTHING;`,
        [
          'LEVEL_RECURRING',
          lvl,
          0.5,
          JSON.stringify({ required_leg_count: Math.min(lvl, 4), required_leg_min_amount: 375000 }),
        ]
      );
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});



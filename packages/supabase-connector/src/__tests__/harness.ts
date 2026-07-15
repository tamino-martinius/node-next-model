import type { DatabaseSchema } from '@next-model/core';
import { MockSupabaseClient } from '../MockSupabaseClient.js';
import { SupabaseConnector } from '../SupabaseConnector.js';

export interface HarnessConnector {
  connector: SupabaseConnector<any>;
  provision(sql: string): Promise<void>;
  teardown(): Promise<void>;
}

export interface SupabaseTestHarness {
  name: string;
  makeConnector(schema?: DatabaseSchema<any>): Promise<HarnessConnector>;
}

export const mockHarness: SupabaseTestHarness = {
  name: 'MockSupabaseClient',
  async makeConnector(schema) {
    const client = new MockSupabaseClient();
    const connector = new SupabaseConnector(client, { schema });
    return {
      connector,
      async provision(sql) {
        client.exec(sql);
      },
      async teardown() {
        client.close();
      },
    };
  },
};

function liveHarness(): SupabaseTestHarness | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!url || !key || !dbUrl) return null;
  return {
    name: 'live Supabase',
    async makeConnector(schema) {
      // Lazy import so `pg` stays dev-only and unused in the hermetic path.
      const { Client } = await import('pg');
      const admin = new Client({ connectionString: dbUrl });
      await admin.connect();
      const created: string[] = [];
      const connector = new SupabaseConnector(
        { url, key, options: { auth: { persistSession: false } } },
        { schema },
      );
      return {
        connector,
        async provision(sql) {
          const match = sql.match(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?"?(\w+)"?/i);
          if (match) created.push(match[1]);
          await admin.query(sql);
          // PostgREST caches schema; reload so the new table is visible.
          await admin.query("NOTIFY pgrst, 'reload schema'");
        },
        async teardown() {
          for (const t of created.reverse()) {
            await admin.query(`DROP TABLE IF EXISTS "${t}" CASCADE`);
          }
          await admin.query("NOTIFY pgrst, 'reload schema'");
          await admin.end();
        },
      };
    },
  };
}

const live = liveHarness();
export const harnesses: SupabaseTestHarness[] = live ? [mockHarness, live] : [mockHarness];

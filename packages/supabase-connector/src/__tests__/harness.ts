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

/** Harnesses to run the shared suite against. Task 10 appends the live harness. */
export const harnesses: SupabaseTestHarness[] = [mockHarness];

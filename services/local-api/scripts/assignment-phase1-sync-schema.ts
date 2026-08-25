#!/usr/bin/env ts-node
import { AppDataSource } from '../ormconfig';

async function main(): Promise<void> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  await AppDataSource.destroy();
  process.stdout.write('Canonical assignment schema synchronized.\n');
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`Schema sync failed: ${message}\n`);
  process.exit(1);
});

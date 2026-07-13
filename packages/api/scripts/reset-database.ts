import 'reflect-metadata';
import { AppDataSource, databasePath } from '../ormconfig';
import { assertDatabaseIntegrity, createDatabaseBackup } from '../src/database/bootstrap';
import { CacheManager } from '../src/database/cache/cacheManager';
import { DatabaseResetService } from '../src/services/databaseReset.service';

function hasArgument(name: string): boolean {
  return process.argv.includes(name);
}

function argumentValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  if (argumentValue('--confirm') !== 'RESET_ALL_DATA') {
    throw new Error('Reset refused. Pass --confirm RESET_ALL_DATA and optionally --wipe-teachers.');
  }

  const backupPath = await createDatabaseBackup(databasePath, 'reset-backup');
  await AppDataSource.initialize();

  try {
    await assertDatabaseIntegrity(AppDataSource);
    const service = new DatabaseResetService(AppDataSource, new CacheManager());
    const result = await service.reset({ wipeTeachers: hasArgument('--wipe-teachers') });
    await assertDatabaseIntegrity(AppDataSource);

    process.stdout.write(
      `${JSON.stringify({ success: true, databasePath, backupPath, ...result }, null, 2)}\n`
    );
  } finally {
    if (AppDataSource.isInitialized) await AppDataSource.destroy();
  }
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});

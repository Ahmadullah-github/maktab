#!/usr/bin/env ts-node
import {
  buildPhase2BackfillPlan,
  comparePlanToCanonicalSnapshot,
} from '../src/services/assignmentPhase2Planner';
import {
  applyBackfillPlan,
  getCanonicalSchemaStatus,
  loadCanonicalSnapshot,
  loadPlannerInput,
  log,
  openDatabase,
  parseCommonArgs,
  printHeader,
  printPlanSummary,
  summarizeIssuesByCode,
  writeJsonFile,
} from './assignment-phase2-shared';

function main(): void {
  const options = parseCommonArgs(process.argv.slice(2));

  printHeader('Assignment Phase 2 Backfill');
  log(`Database: ${options.dbPath}`, 'cyan');
  log(`Mode: ${options.dryRun ? 'dry-run' : 'live'}`, options.dryRun ? 'yellow' : 'green');

  const db = openDatabase(options.dbPath);

  try {
    const input = loadPlannerInput(db);
    const plan = buildPhase2BackfillPlan(input);
    const schemaStatus = getCanonicalSchemaStatus(db);

    printPlanSummary(plan, options.verbose);

    if (!schemaStatus.present) {
      log(
        `Canonical schema missing: ${schemaStatus.missingTables.join(', ')}`,
        options.dryRun ? 'yellow' : 'red'
      );
    }

    const issueSummary = summarizeIssuesByCode(plan.issues);
    writeJsonFile(options.jsonPath, {
      mode: options.dryRun ? 'dry-run' : 'live',
      schemaStatus,
      plan,
      issueSummary,
    });

    if (plan.summary.errorCount > 0 && !options.force) {
      throw new Error(
        'Blocking reconciliation errors were found. Re-run with --force only if you intentionally want to backfill around those errors.'
      );
    }

    if (options.dryRun) {
      log('\nDry-run complete. No database changes were written.', 'yellow');
      return;
    }

    if (!schemaStatus.present) {
      throw new Error(
        `Phase 1 canonical tables are required before live backfill. Missing: ${schemaStatus.missingTables.join(', ')}`
      );
    }

    applyBackfillPlan(db, plan);
    log('\nBackfill applied successfully.', 'green');

    const integrityReport = comparePlanToCanonicalSnapshot(plan, loadCanonicalSnapshot(db));
    const driftCount =
      integrityReport.missingRequirements.length +
      integrityReport.mismatchedRequirements.length +
      integrityReport.unexpectedRequirements.length +
      integrityReport.missingCapabilities.length +
      integrityReport.mismatchedCapabilities.length +
      integrityReport.unexpectedCapabilities.length +
      integrityReport.missingAssignments.length +
      integrityReport.mismatchedAssignments.length +
      integrityReport.unexpectedAssignments.length;

    log(`Post-write integrity drift count: ${driftCount}`, driftCount === 0 ? 'green' : 'yellow');
  } finally {
    db.close();
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  log(`\nBackfill failed: ${message}`, 'red');
  process.exitCode = 1;
}

#!/usr/bin/env ts-node
import {
  buildPhase2BackfillPlan,
  comparePlanToCanonicalSnapshot,
} from '../src/services/assignmentPhase2Planner';
import {
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

  printHeader('Assignment Phase 2 Integrity Report');
  log(`Database: ${options.dbPath}`, 'cyan');

  const db = openDatabase(options.dbPath);

  try {
    const input = loadPlannerInput(db);
    const plan = buildPhase2BackfillPlan(input);
    const schemaStatus = getCanonicalSchemaStatus(db);

    printPlanSummary(plan, options.verbose);

    if (!schemaStatus.present) {
      writeJsonFile(options.jsonPath, {
        schemaStatus,
        plan,
        issueSummary: summarizeIssuesByCode(plan.issues),
      });
      throw new Error(
        `Cannot compare against canonical tables because the phase 1 schema is missing: ${schemaStatus.missingTables.join(', ')}`
      );
    }

    const report = comparePlanToCanonicalSnapshot(plan, loadCanonicalSnapshot(db));
    const driftCount =
      report.missingRequirements.length +
      report.mismatchedRequirements.length +
      report.unexpectedRequirements.length +
      report.missingCapabilities.length +
      report.mismatchedCapabilities.length +
      report.unexpectedCapabilities.length +
      report.missingAssignments.length +
      report.mismatchedAssignments.length +
      report.unexpectedAssignments.length;

    log(`\nRequirement drift: ${report.missingRequirements.length + report.mismatchedRequirements.length + report.unexpectedRequirements.length}`, driftCount === 0 ? 'green' : 'yellow');
    log(`Capability drift: ${report.missingCapabilities.length + report.mismatchedCapabilities.length + report.unexpectedCapabilities.length}`, driftCount === 0 ? 'green' : 'yellow');
    log(`Assignment drift: ${report.missingAssignments.length + report.mismatchedAssignments.length + report.unexpectedAssignments.length}`, driftCount === 0 ? 'green' : 'yellow');
    log(`Total drift count: ${driftCount}`, driftCount === 0 ? 'green' : 'yellow');

    writeJsonFile(options.jsonPath, {
      schemaStatus,
      plan,
      issueSummary: summarizeIssuesByCode(plan.issues),
      integrityReport: report,
    });
  } finally {
    db.close();
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  log(`\nIntegrity report failed: ${message}`, 'red');
  process.exitCode = 1;
}

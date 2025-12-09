/**
 * Wizard Comprehensive Analysis Script
 * 
 * This script performs infrastructure setup and file discovery for analyzing
 * the 8-step wizard in the timetable generation application.
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  rootDir: process.cwd(),
  wizardBasePath: 'packages/web/src/components/wizard',
  i18nPath: 'packages/web/src/i18n',
  outputDir: 'analysis-output',
  docsDir: 'docs',
  tasksDir: 'tasks',
};

// ============================================================================
// File System Utilities
// ============================================================================

/**
 * Create directory if it doesn't exist
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✓ Created directory: ${dirPath}`);
  }
}

/**
 * Recursively scan directory for files
 */
function scanDirectory(dirPath, extensions = ['.tsx', '.ts']) {
  const files = [];
  
  if (!fs.existsSync(dirPath)) {
    console.warn(`⚠ Directory not found: ${dirPath}`);
    return files;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    
    if (entry.isDirectory()) {
      files.push(...scanDirectory(fullPath, extensions));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (extensions.includes(ext)) {
        files.push(fullPath);
      }
    }
  }
  
  return files;
}

/**
 * Get file type based on path
 */
function getFileType(filePath) {
  if (filePath.includes('/hooks/') || filePath.includes('\\hooks\\')) return 'hook';
  if (filePath.includes('/stores/') || filePath.includes('\\stores\\')) return 'store';
  if (filePath.includes('/types/') || filePath.includes('\\types\\')) return 'type';
  if (filePath.includes('/schemas/') || filePath.includes('\\schemas\\')) return 'schema';
  if (filePath.includes('/i18n/') || filePath.includes('\\i18n\\')) return 'i18n';
  if (filePath.includes('/lib/') || filePath.includes('\\lib\\')) return 'utility';
  return 'component';
}

/**
 * Extract imports from a TypeScript/React file
 */
function extractImports(content) {
  const imports = [];
  const importRegex = /import\s+(?:{[^}]*}|[\w*]+)\s+from\s+['"]([^'"]+)['"]/g;
  
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  
  return imports;
}

/**
 * Extract exports from a TypeScript/React file
 */
function extractExports(content) {
  const exports = [];
  
  // Named exports
  const namedExportRegex = /export\s+(?:const|function|class|interface|type)\s+([\w]+)/g;
  let match;
  while ((match = namedExportRegex.exec(content)) !== null) {
    exports.push(match[1]);
  }
  
  // Default export
  if (/export\s+default/.test(content)) {
    exports.push('default');
  }
  
  return exports;
}

// ============================================================================
// Analysis Functions
// ============================================================================

/**
 * Discover all wizard-related files
 */
function discoverWizardFiles(basePath) {
  console.log('\n📁 Discovering wizard files...');
  
  const wizardPath = path.join(CONFIG.rootDir, basePath);
  const filePaths = scanDirectory(wizardPath);
  
  const files = filePaths.map(filePath => {
    const stats = fs.statSync(filePath);
    const relativePath = path.relative(CONFIG.rootDir, filePath);
    
    return {
      path: relativePath.replace(/\\/g, '/'),
      name: path.basename(filePath),
      type: getFileType(relativePath),
      size: stats.size,
    };
  });
  
  console.log(`✓ Found ${files.length} wizard files`);
  
  // Group by type
  const byType = files.reduce((acc, file) => {
    acc[file.type] = (acc[file.type] || 0) + 1;
    return acc;
  }, {});
  
  console.log('  File types:', byType);
  
  return files;
}

/**
 * Build dependency graph for wizard components
 */
function buildDependencyGraph(files) {
  console.log('\n🔗 Building dependency graph...');
  
  const dependencies = [];
  
  for (const file of files) {
    const fullPath = path.join(CONFIG.rootDir, file.path);
    
    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const imports = extractImports(content);
      const exports = extractExports(content);
      
      dependencies.push({
        file: file.path,
        imports,
        exports,
      });
    } catch (error) {
      console.warn(`⚠ Could not read file: ${file.path}`);
    }
  }
  
  console.log(`✓ Built dependency graph for ${dependencies.length} files`);
  
  return dependencies;
}

/**
 * Flatten nested object to key paths
 */
function flattenObject(obj, prefix = []) {
  const entries = [];
  
  for (const key in obj) {
    const value = obj[key];
    const currentPath = [...prefix, key];
    
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      entries.push(...flattenObject(value, currentPath));
    } else if (typeof value === 'string') {
      entries.push({
        key: currentPath.join('.'),
        en: '',
        fa: '',
        path: currentPath,
      });
    }
  }
  
  return entries;
}

/**
 * Extract and catalog i18n translations
 */
function extractI18nTranslations() {
  console.log('\n🌐 Extracting i18n translations...');
  
  const i18nPath = path.join(CONFIG.rootDir, CONFIG.i18nPath);
  const enPath = path.join(i18nPath, 'en.ts');
  const faPath = path.join(i18nPath, 'fa.ts');
  
  try {
    // Read translation files
    const enContent = fs.readFileSync(enPath, 'utf-8');
    const faContent = fs.readFileSync(faPath, 'utf-8');
    
    // Extract the exported objects (simplified parsing)
    const enMatch = enContent.match(/export const en = ({[\s\S]*});/);
    const faMatch = faContent.match(/export const fa = ({[\s\S]*});/);
    
    if (!enMatch || !faMatch) {
      console.warn('⚠ Could not parse translation files');
      return [];
    }
    
    // Use eval to parse (in production, use proper AST parsing)
    const enObj = eval(`(${enMatch[1]})`);
    const faObj = eval(`(${faMatch[1]})`);
    
    // Flatten both objects
    const enEntries = flattenObject(enObj);
    const faEntries = flattenObject(faObj);
    
    // Merge EN and FA
    const catalog = enEntries.map(enEntry => {
      const faEntry = faEntries.find(fa => fa.key === enEntry.key);
      
      // Get actual values
      let enValue = enObj;
      let faValue = faObj;
      
      for (const part of enEntry.path) {
        enValue = enValue?.[part];
        faValue = faValue?.[part];
      }
      
      return {
        key: enEntry.key,
        en: typeof enValue === 'string' ? enValue : '',
        fa: typeof faValue === 'string' ? faValue : '',
        path: enEntry.path,
      };
    });
    
    console.log(`✓ Extracted ${catalog.length} translation entries`);
    
    // Count wizard-related translations
    const wizardTranslations = catalog.filter(entry => 
      entry.key.startsWith('wizard.')
    );
    console.log(`  Wizard translations: ${wizardTranslations.length}`);
    
    return catalog;
  } catch (error) {
    console.error('✗ Error extracting translations:', error.message);
    return [];
  }
}

// ============================================================================
// Output Generation
// ============================================================================

/**
 * Save workspace data to JSON
 */
function saveWorkspaceData(workspace) {
  const outputPath = path.join(workspace.outputDir, 'workspace.json');
  fs.writeFileSync(outputPath, JSON.stringify(workspace, null, 2));
  console.log(`✓ Saved workspace data to: ${outputPath}`);
}

/**
 * Generate file inventory markdown
 */
function generateFileInventory(workspace) {
  const lines = [
    '# Wizard File Inventory',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    `- Total Files: ${workspace.wizardFiles.length}`,
    `- Total Dependencies: ${workspace.dependencies.length}`,
    `- i18n Entries: ${workspace.i18nCatalog.length}`,
    '',
    '## Wizard Step Files',
    '',
  ];
  
  // Group files by step
  const stepFiles = workspace.wizardFiles.filter(f => 
    f.path.includes('/steps/') && f.name.endsWith('-step.tsx')
  );
  
  lines.push('### Main Step Components', '');
  for (const file of stepFiles) {
    lines.push(`- **${file.name}**`);
    lines.push(`  - Path: \`${file.path}\``);
    lines.push(`  - Size: ${(file.size / 1024).toFixed(2)} KB`);
    lines.push('');
  }
  
  // Shared components
  const sharedFiles = workspace.wizardFiles.filter(f => 
    f.path.includes('/shared/')
  );
  
  if (sharedFiles.length > 0) {
    lines.push('### Shared Components', '');
    for (const file of sharedFiles) {
      lines.push(`- \`${file.path}\``);
    }
    lines.push('');
  }
  
  // Supporting files
  const supportFiles = workspace.wizardFiles.filter(f => 
    !f.path.includes('/steps/') && !f.path.includes('/shared/')
  );
  
  if (supportFiles.length > 0) {
    lines.push('### Supporting Files', '');
    for (const file of supportFiles) {
      lines.push(`- \`${file.path}\``);
    }
    lines.push('');
  }
  
  const outputPath = path.join(workspace.docsDir, 'file-inventory.md');
  fs.writeFileSync(outputPath, lines.join('\n'));
  console.log(`✓ Generated file inventory: ${outputPath}`);
}

/**
 * Generate dependency graph markdown
 */
function generateDependencyGraph(workspace) {
  const lines = [
    '# Wizard Dependency Graph',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Component Dependencies',
    '',
  ];
  
  // Focus on step components
  const stepDeps = workspace.dependencies.filter(dep => 
    dep.file.includes('/steps/') && dep.file.endsWith('-step.tsx')
  );
  
  for (const dep of stepDeps) {
    const fileName = path.basename(dep.file);
    lines.push(`### ${fileName}`, '');
    lines.push(`**File:** \`${dep.file}\``, '');
    
    if (dep.imports.length > 0) {
      lines.push('**Imports:**', '');
      
      // Group imports by type
      const localImports = dep.imports.filter(imp => imp.startsWith('.') || imp.startsWith('@/'));
      const externalImports = dep.imports.filter(imp => !imp.startsWith('.') && !imp.startsWith('@/'));
      
      if (localImports.length > 0) {
        lines.push('*Local:*', '');
        for (const imp of localImports) {
          lines.push(`- \`${imp}\``);
        }
        lines.push('');
      }
      
      if (externalImports.length > 0) {
        lines.push('*External:*', '');
        for (const imp of externalImports) {
          lines.push(`- \`${imp}\``);
        }
        lines.push('');
      }
    }
    
    if (dep.exports.length > 0) {
      lines.push('**Exports:**', '');
      for (const exp of dep.exports) {
        lines.push(`- \`${exp}\``);
      }
      lines.push('');
    }
    
    lines.push('---', '');
  }
  
  const outputPath = path.join(workspace.docsDir, 'dependency-graph.md');
  fs.writeFileSync(outputPath, lines.join('\n'));
  console.log(`✓ Generated dependency graph: ${outputPath}`);
}

/**
 * Generate i18n catalog markdown
 */
function generateI18nCatalog(workspace) {
  const lines = [
    '# i18n Translation Catalog',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    `Total Entries: ${workspace.i18nCatalog.length}`,
    '',
    '## Wizard Translations',
    '',
  ];
  
  // Filter wizard-related translations
  const wizardTranslations = workspace.i18nCatalog.filter(entry => 
    entry.key.startsWith('wizard.')
  );
  
  lines.push('| Key | English | Persian/Dari |');
  lines.push('|-----|---------|--------------|');
  
  for (const entry of wizardTranslations) {
    const en = entry.en.replace(/\|/g, '\\|');
    const fa = entry.fa.replace(/\|/g, '\\|');
    lines.push(`| \`${entry.key}\` | ${en} | ${fa} |`);
  }
  
  lines.push('');
  lines.push('## All Translations by Category', '');
  
  // Group by top-level key
  const byCategory = workspace.i18nCatalog.reduce((acc, entry) => {
    const category = entry.path[0] || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(entry);
    return acc;
  }, {});
  
  for (const [category, entries] of Object.entries(byCategory)) {
    lines.push(`### ${category} (${entries.length} entries)`, '');
    lines.push(`<details><summary>View translations</summary>`, '');
    lines.push('');
    lines.push('| Key | English | Persian/Dari |');
    lines.push('|-----|---------|--------------|');
    
    for (const entry of entries.slice(0, 50)) { // Limit to first 50
      const en = entry.en.replace(/\|/g, '\\|');
      const fa = entry.fa.replace(/\|/g, '\\|');
      lines.push(`| \`${entry.key}\` | ${en} | ${fa} |`);
    }
    
    if (entries.length > 50) {
      lines.push(`| ... | *${entries.length - 50} more entries* | ... |`);
    }
    
    lines.push('');
    lines.push('</details>', '');
    lines.push('');
  }
  
  const outputPath = path.join(workspace.docsDir, 'i18n-catalog.md');
  fs.writeFileSync(outputPath, lines.join('\n'));
  console.log(`✓ Generated i18n catalog: ${outputPath}`);
}

// ============================================================================
// Main Execution
// ============================================================================

/**
 * Main analysis function
 */
function runAnalysis() {
  console.log('🚀 Starting Wizard Comprehensive Analysis');
  console.log('==========================================\n');
  
  // Step 1: Create output directories
  console.log('📂 Setting up workspace...');
  const outputDir = path.join(CONFIG.rootDir, CONFIG.outputDir);
  const docsDir = path.join(CONFIG.rootDir, CONFIG.docsDir);
  const tasksDir = path.join(CONFIG.rootDir, CONFIG.tasksDir);
  
  ensureDir(outputDir);
  ensureDir(docsDir);
  ensureDir(tasksDir);
  
  // Step 2: Discover wizard files
  const wizardFiles = discoverWizardFiles(CONFIG.wizardBasePath);
  
  // Step 3: Build dependency graph
  const dependencies = buildDependencyGraph(wizardFiles);
  
  // Step 4: Extract i18n translations
  const i18nCatalog = extractI18nTranslations();
  
  // Create workspace object
  const workspace = {
    rootDir: CONFIG.rootDir,
    outputDir,
    docsDir,
    tasksDir,
    wizardFiles,
    dependencies,
    i18nCatalog,
  };
  
  // Step 5: Generate outputs
  console.log('\n📝 Generating analysis outputs...');
  saveWorkspaceData(workspace);
  generateFileInventory(workspace);
  generateDependencyGraph(workspace);
  generateI18nCatalog(workspace);
  
  console.log('\n✅ Analysis infrastructure setup complete!');
  console.log('==========================================');
  console.log(`\nOutput directories:`);
  console.log(`  - Analysis data: ${outputDir}`);
  console.log(`  - Documentation: ${docsDir}`);
  console.log(`  - Tasks: ${tasksDir}`);
  console.log(`\nGenerated files:`);
  console.log(`  - ${path.join(outputDir, 'workspace.json')}`);
  console.log(`  - ${path.join(docsDir, 'file-inventory.md')}`);
  console.log(`  - ${path.join(docsDir, 'dependency-graph.md')}`);
  console.log(`  - ${path.join(docsDir, 'i18n-catalog.md')}`);
}

// Run if executed directly
if (require.main === module) {
  runAnalysis();
}

module.exports = { runAnalysis };

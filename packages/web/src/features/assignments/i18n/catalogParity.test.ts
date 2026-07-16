import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import en from './en.json';
import fa from './fa.json';

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key)
  );
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.test.ts') ? [path] : [];
  });
}

describe('assignment locale catalogs', () => {
  it('keeps English and Farsi keys in parity', () => {
    expect(flattenKeys(en).sort()).toEqual(flattenKeys(fa).sort());
  });

  it('defines every statically referenced assignment translation', () => {
    const featureRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
    const referencedKeys = new Set<string>();

    for (const file of sourceFiles(featureRoot)) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/\bt\(\s*['"](assignments\.[A-Za-z0-9_.]+)['"]/g)) {
        referencedKeys.add(match[1]);
      }
    }

    const englishKeys = new Set(flattenKeys(en));
    const farsiKeys = new Set(flattenKeys(fa));
    expect([...referencedKeys].filter((key) => !englishKeys.has(key))).toEqual([]);
    expect([...referencedKeys].filter((key) => !farsiKeys.has(key))).toEqual([]);
  });
});

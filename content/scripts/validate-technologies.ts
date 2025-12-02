#!/usr/bin/env bun

import { readFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { technologyZod } from '../src/technologies.ts';

interface ValidationResult {
  id: string;
  path: string;
  valid: boolean;
  errors: string[];
}

// Main validation function
async function validateAll(): Promise<void> {
  console.log('\n📋 Technology Validation');
  console.log('========================\n');

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const contentRoot = join(__dirname, '..');
  const technologiesDir = join(contentRoot, 'technologies');

  console.log(`Validating technologies in: ${technologiesDir}\n`);

  // Get all technology directories
  const techDirs = await readdir(technologiesDir, { withFileTypes: true });
  const techIds = techDirs
    .filter(d => d.isDirectory())
    .map(d => d.name);

  console.log(`Found ${techIds.length} technologies\n`);

  const results: ValidationResult[] = [];
  let processed = 0;

  // Validate each technology
  for (const techId of techIds) {
    const mdxPath = join(technologiesDir, techId, 'index.mdx');
    const result: ValidationResult = {
      id: techId,
      path: mdxPath,
      valid: true,
      errors: [],
    };

    try {
      const content = await readFile(mdxPath, 'utf-8');
      const { data } = matter(content);

      // Validate against schema
      try {
        technologyZod.parse(data);
      } catch (error: any) {
        result.valid = false;

        // Parse Zod errors
        if (error.errors && Array.isArray(error.errors)) {
          for (const err of error.errors) {
            const path = err.path.join('.');
            const message = err.message;
            result.errors.push(`${path}: ${message}`);
          }
        } else {
          result.errors.push(error.message || String(error));
        }
      }
    } catch (error) {
      result.valid = false;
      result.errors.push(`Failed to read or parse file: ${error instanceof Error ? error.message : String(error)}`);
    }

    results.push(result);
    processed++;

    if (processed % 50 === 0) {
      console.log(`Validated ${processed}/${techIds.length} technologies...`);
    }
  }

  console.log(`\n✅ Validation complete\n`);

  // Generate report
  const invalid = results.filter(r => !r.valid);
  const valid = results.filter(r => r.valid);

  console.log('📊 Results');
  console.log('==========');
  console.log(`Total: ${results.length}`);
  console.log(`Valid: ${valid.length}`);
  console.log(`Invalid: ${invalid.length}`);

  if (invalid.length > 0) {
    console.log('\n❌ Validation Errors:\n');

    for (const result of invalid) {
      console.log(`${result.id}:`);
      for (const error of result.errors) {
        console.log(`  - ${error}`);
      }
      console.log();
    }

    console.error(`\n❌ ${invalid.length} validation error(s) found`);
    process.exit(1);
  } else {
    console.log(`\n✅ All ${results.length} technologies validated successfully\n`);
  }
}

// Run validation
validateAll().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

#!/usr/bin/env bun

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

// Types
interface CNCFEntry {
  name: string;
  homepage_url?: string;
  repo_url?: string;
  blog_url?: string;
  documentation_url?: string;
  project?: 'sandbox' | 'incubating' | 'graduated' | 'archived';
  category?: string;
  subcategory?: string;
  summary_personas?: string;
  summary_tags?: string;
  summary_use_case?: string;
  summary_business_use_case?: string;
  summary_integrations?: string;
  summary_release_rate?: string;
  twitter?: string;
  youtube_url?: string;
  slack_url?: string;
  github_discussions_url?: string;
  mailing_list_url?: string;
  extra?: {
    accepted?: string;
    incubating?: string;
    graduated?: string;
    archived?: string;
    dev_stats_url?: string;
  };
}

interface TechMetadata {
  id: string;
  name: string;
  aliases?: string[];
  website?: string;
  source?: string;
}

interface SyncResult {
  path: string;
  id: string;
  matched: boolean;
  matchMethod?: string;
  updated: boolean;
  changes: string[];
  warnings: string[];
}

interface CLIOptions {
  apply: boolean;
  landscapeUrl: string;
  only?: string[];
}

// Parse CLI arguments
function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {
    apply: false,
    landscapeUrl: 'https://raw.githubusercontent.com/cncf/landscape/refs/heads/master/landscape.yml',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--apply') {
      options.apply = true;
    } else if (arg === '--landscape-url') {
      options.landscapeUrl = args[++i];
    } else if (arg === '--only') {
      options.only = args[++i].split(',').map(s => s.trim());
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
CNCF Landscape Sync Script

This script syncs CNCF landscape data to technology files without touching
user-curated content (descriptions, matrix fields, etc.)

Usage: bun sync-landscape.ts --apply [options]

Options:
  --apply                   Apply changes (required for automation)
  --landscape-url <url>     Custom CNCF landscape URL
  --only <tech1,tech2>      Only sync specific technologies
  --help, -h                Show this help message

Examples:
  # Sync all technologies
  bun sync-landscape.ts --apply

  # Sync specific technologies
  bun sync-landscape.ts --apply --only kubernetes,prometheus
      `.trim());
      process.exit(0);
    }
  }

  return options;
}

// Fetch and parse CNCF landscape
async function fetchCNCFLandscape(url: string): Promise<CNCFEntry[]> {
  console.log(`Fetching CNCF landscape from: ${url}`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch landscape: ${response.statusText}`);
    }

    const yamlText = await response.text();

    // Parse YAML manually (simple parser for the landscape structure)
    const entries: CNCFEntry[] = [];
    const lines = yamlText.split('\n');

    let currentCategory = '';
    let currentSubcategory = '';
    let currentItem: Partial<CNCFEntry> = {};
    let inItem = false;
    let expectingCategoryName = false;
    let expectingSubcategoryName = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Category
      if (trimmed.startsWith('- category:')) {
        currentCategory = '';
        expectingCategoryName = true;
        expectingSubcategoryName = false;
      } else if (expectingCategoryName && trimmed.startsWith('name:')) {
        currentCategory = trimmed.replace('name:', '').trim().replace(/["']/g, '');
        expectingCategoryName = false;
      }

      // Subcategory
      if (trimmed.startsWith('- subcategory:')) {
        currentSubcategory = '';
        expectingSubcategoryName = true;
      } else if (expectingSubcategoryName && trimmed.startsWith('name:')) {
        currentSubcategory = trimmed.replace('name:', '').trim().replace(/["']/g, '');
        expectingSubcategoryName = false;
      }

      // Item start
      if (trimmed.startsWith('- item:')) {
        if (inItem && currentItem.name) {
          currentItem.category = currentCategory;
          currentItem.subcategory = currentSubcategory;
          entries.push(currentItem as CNCFEntry);
        }
        currentItem = {};
        inItem = true;
        expectingCategoryName = false;
        expectingSubcategoryName = false;
      }

      // Item properties
      if (inItem && !trimmed.startsWith('- item:')) {
        if (trimmed.startsWith('name:')) {
          currentItem.name = trimmed.replace('name:', '').trim().replace(/["']/g, '');
        } else if (trimmed.startsWith('homepage_url:')) {
          currentItem.homepage_url = trimmed.replace('homepage_url:', '').trim().replace(/["']/g, '');
        } else if (trimmed.startsWith('repo_url:')) {
          currentItem.repo_url = trimmed.replace('repo_url:', '').trim().replace(/["']/g, '');
        } else if (trimmed.startsWith('blog_url:')) {
          currentItem.blog_url = trimmed.replace('blog_url:', '').trim().replace(/["']/g, '');
        } else if (trimmed.startsWith('documentation_url:')) {
          currentItem.documentation_url = trimmed.replace('documentation_url:', '').trim().replace(/["']/g, '');
        } else if (trimmed.startsWith('project:')) {
          const project = trimmed.replace('project:', '').trim().replace(/["']/g, '');
          if (['sandbox', 'incubating', 'graduated', 'archived'].includes(project)) {
            currentItem.project = project as 'sandbox' | 'incubating' | 'graduated' | 'archived';
          }
        } else if (trimmed.startsWith('twitter:')) {
          currentItem.twitter = trimmed.replace('twitter:', '').trim().replace(/["']/g, '');
        } else if (trimmed.startsWith('youtube_url:')) {
          currentItem.youtube_url = trimmed.replace('youtube_url:', '').trim().replace(/["']/g, '');
        } else if (trimmed.startsWith('slack_url:')) {
          currentItem.slack_url = trimmed.replace('slack_url:', '').trim().replace(/["']/g, '');
        } else if (trimmed.startsWith('github_discussions_url:')) {
          currentItem.github_discussions_url = trimmed.replace('github_discussions_url:', '').trim().replace(/["']/g, '');
        } else if (trimmed.startsWith('mailing_list_url:')) {
          currentItem.mailing_list_url = trimmed.replace('mailing_list_url:', '').trim().replace(/["']/g, '');
        } else if (trimmed.startsWith('summary_personas:')) {
          currentItem.summary_personas = trimmed.replace('summary_personas:', '').trim().replace(/["']/g, '');
        } else if (trimmed.startsWith('summary_tags:')) {
          currentItem.summary_tags = trimmed.replace('summary_tags:', '').trim().replace(/["']/g, '');
        } else if (trimmed.startsWith('summary_use_case:')) {
          currentItem.summary_use_case = trimmed.replace('summary_use_case:', '').trim().replace(/["']/g, '');
        } else if (trimmed.startsWith('summary_business_use_case:')) {
          currentItem.summary_business_use_case = trimmed.replace('summary_business_use_case:', '').trim().replace(/["']/g, '');
        } else if (trimmed.startsWith('summary_integrations:')) {
          currentItem.summary_integrations = trimmed.replace('summary_integrations:', '').trim().replace(/["']/g, '');
        } else if (trimmed.startsWith('summary_release_rate:')) {
          currentItem.summary_release_rate = trimmed.replace('summary_release_rate:', '').trim().replace(/["']/g, '');
        } else if (trimmed.startsWith('extra:')) {
          currentItem.extra = {};
        } else if (currentItem.extra && trimmed.startsWith('accepted:')) {
          currentItem.extra.accepted = trimmed.replace('accepted:', '').trim().replace(/["']/g, '');
        } else if (currentItem.extra && trimmed.startsWith('incubating:')) {
          currentItem.extra.incubating = trimmed.replace('incubating:', '').trim().replace(/["']/g, '');
        } else if (currentItem.extra && trimmed.startsWith('graduated:')) {
          currentItem.extra.graduated = trimmed.replace('graduated:', '').trim().replace(/["']/g, '');
        } else if (currentItem.extra && trimmed.startsWith('archived:')) {
          currentItem.extra.archived = trimmed.replace('archived:', '').trim().replace(/["']/g, '');
        } else if (currentItem.extra && trimmed.startsWith('dev_stats_url:')) {
          currentItem.extra.dev_stats_url = trimmed.replace('dev_stats_url:', '').trim().replace(/["']/g, '');
        }
      }
    }

    // Add last item
    if (inItem && currentItem.name) {
      currentItem.category = currentCategory;
      currentItem.subcategory = currentSubcategory;
      entries.push(currentItem as CNCFEntry);
    }

    console.log(`Parsed ${entries.length} entries from CNCF landscape`);
    return entries;
  } catch (error) {
    console.error('Error fetching CNCF landscape:', error);
    throw error;
  }
}

// Normalize string for matching
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Normalize GitHub URL
function normalizeGitHubUrl(url: string): string {
  return url
    .toLowerCase()
    .replace(/\.git$/, '')
    .replace(/\/$/, '')
    .replace(/^https?:\/\/(www\.)?github\.com\//, '');
}

// Match technology with CNCF entry
function matchTechnology(tech: TechMetadata, cncfEntries: CNCFEntry[]): { entry: CNCFEntry; method: string } | null {
  // Tier 1: Exact name match (case-insensitive)
  const exactMatch = cncfEntries.find(
    entry => entry.name.toLowerCase() === tech.name.toLowerCase()
  );
  if (exactMatch) return { entry: exactMatch, method: 'exact-name' };

  // Tier 2: Alias match
  if (tech.aliases?.length) {
    for (const alias of tech.aliases) {
      const aliasMatch = cncfEntries.find(
        entry => entry.name.toLowerCase() === alias.toLowerCase()
      );
      if (aliasMatch) return { entry: aliasMatch, method: `alias-${alias}` };
    }
  }

  // Tier 3: Normalized match (remove special chars, spaces)
  const techNorm = normalize(tech.name);
  const normalizedMatch = cncfEntries.find(
    entry => normalize(entry.name) === techNorm
  );
  if (normalizedMatch) return { entry: normalizedMatch, method: 'normalized-name' };

  // Tier 4: Directory ID match (handles kebab-case)
  const idMatch = cncfEntries.find(
    entry => normalize(entry.name) === normalize(tech.id)
  );
  if (idMatch) return { entry: idMatch, method: 'directory-id' };

  // Tier 5: Repo URL match (if both have repo)
  if (tech.source) {
    const repoMatch = cncfEntries.find(
      entry => entry.repo_url && normalizeGitHubUrl(entry.repo_url) === normalizeGitHubUrl(tech.source!)
    );
    if (repoMatch) return { entry: repoMatch, method: 'repo-url' };
  }

  return null;
}

// Parse comma-separated string into array
function parseCommaSeparated(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

// Sync single technology file
async function syncTechnology(
  filePath: string,
  techId: string,
  cncfMatch: { entry: CNCFEntry; method: string } | null
): Promise<SyncResult> {
  const result: SyncResult = {
    path: filePath,
    id: techId,
    matched: !!cncfMatch,
    matchMethod: cncfMatch?.method,
    updated: false,
    changes: [],
    warnings: [],
  };

  if (!cncfMatch) {
    return result; // Nothing to sync for non-CNCF technologies
  }

  try {
    const content = await readFile(filePath, 'utf-8');
    const { data: frontmatter, content: body } = matter(content);

    let hasChanges = false;
    const entry = cncfMatch.entry;

    // Update category/subcategory
    if (entry.category && frontmatter.category !== entry.category) {
      frontmatter.category = entry.category;
      result.changes.push(`Updated category: ${entry.category}`);
      hasChanges = true;
    }

    if (entry.subcategory && frontmatter.subcategory !== entry.subcategory) {
      frontmatter.subcategory = entry.subcategory;
      result.changes.push(`Updated subcategory: ${entry.subcategory}`);
      hasChanges = true;
    }

    // Update CNCF metadata
    const existingCncf = frontmatter.cncf || {};
    const newCncf: any = { ...existingCncf };

    // Status changes are important - highlight them
    if (entry.project && existingCncf.status !== entry.project) {
      const oldStatus = existingCncf.status || 'unknown';
      newCncf.status = entry.project;
      result.changes.push(`🎉 Status changed: ${oldStatus} → ${entry.project}`);
      hasChanges = true;
    }

    // Update timeline dates
    if (entry.extra?.accepted && newCncf.accepted !== entry.extra.accepted) {
      newCncf.accepted = entry.extra.accepted;
      if (!existingCncf.accepted) {
        result.changes.push(`Added accepted date: ${entry.extra.accepted}`);
        hasChanges = true;
      }
    }
    if (entry.extra?.incubating && newCncf.incubating !== entry.extra.incubating) {
      newCncf.incubating = entry.extra.incubating;
      if (!existingCncf.incubating) {
        result.changes.push(`Added incubating date: ${entry.extra.incubating}`);
        hasChanges = true;
      }
    }
    if (entry.extra?.graduated && newCncf.graduated !== entry.extra.graduated) {
      newCncf.graduated = entry.extra.graduated;
      if (!existingCncf.graduated) {
        result.changes.push(`Added graduated date: ${entry.extra.graduated}`);
        hasChanges = true;
      }
    }
    if (entry.extra?.archived && newCncf.archived !== entry.extra.archived) {
      newCncf.archived = entry.extra.archived;
      if (!existingCncf.archived) {
        result.changes.push(`Added archived date: ${entry.extra.archived}`);
        hasChanges = true;
      }
    }
    if (entry.extra?.dev_stats_url && newCncf.devStatsUrl !== entry.extra.dev_stats_url) {
      newCncf.devStatsUrl = entry.extra.dev_stats_url;
      if (!existingCncf.devStatsUrl) {
        result.changes.push(`Added devStats URL`);
        hasChanges = true;
      }
    }

    // Update personas
    const personas = parseCommaSeparated(entry.summary_personas);
    if (personas && JSON.stringify(existingCncf.personas) !== JSON.stringify(personas)) {
      newCncf.personas = personas;
      result.changes.push(`Updated personas`);
      hasChanges = true;
    }

    // Update tags
    const tags = parseCommaSeparated(entry.summary_tags);
    if (tags && JSON.stringify(existingCncf.tags) !== JSON.stringify(tags)) {
      newCncf.tags = tags;
      result.changes.push(`Updated tags`);
      hasChanges = true;
    }

    // Update use cases
    if (entry.summary_use_case && existingCncf.useCase !== entry.summary_use_case) {
      newCncf.useCase = entry.summary_use_case;
      result.changes.push(`Updated use case`);
      hasChanges = true;
    }

    if (entry.summary_business_use_case && existingCncf.businessUseCase !== entry.summary_business_use_case) {
      newCncf.businessUseCase = entry.summary_business_use_case;
      result.changes.push(`Updated business use case`);
      hasChanges = true;
    }

    // Update release rate
    if (entry.summary_release_rate && existingCncf.releaseRate !== entry.summary_release_rate) {
      newCncf.releaseRate = entry.summary_release_rate;
      result.changes.push(`Updated release rate`);
      hasChanges = true;
    }

    // Update integrations
    const integrations = parseCommaSeparated(entry.summary_integrations);
    if (integrations && JSON.stringify(existingCncf.integrations) !== JSON.stringify(integrations)) {
      newCncf.integrations = integrations;
      result.changes.push(`Updated integrations`);
      hasChanges = true;
    }

    // Only update cncf object if there were changes
    if (Object.keys(newCncf).length > 0 && JSON.stringify(existingCncf) !== JSON.stringify(newCncf)) {
      frontmatter.cncf = newCncf;
    }

    // Update community links (only add missing ones, don't overwrite existing)
    const existingCommunity = frontmatter.community || {};
    const newCommunity: any = { ...existingCommunity };
    let communityChanged = false;

    if (entry.twitter && !existingCommunity.twitter) {
      newCommunity.twitter = entry.twitter;
      result.changes.push(`Added Twitter link`);
      communityChanged = true;
    }

    if (entry.youtube_url && !existingCommunity.youtube) {
      newCommunity.youtube = entry.youtube_url;
      result.changes.push(`Added YouTube link`);
      communityChanged = true;
    }

    if (entry.slack_url && !existingCommunity.slack) {
      newCommunity.slack = entry.slack_url;
      result.changes.push(`Added Slack link`);
      communityChanged = true;
    }

    if (entry.blog_url && !existingCommunity.blog) {
      newCommunity.blog = entry.blog_url;
      result.changes.push(`Added blog link`);
      communityChanged = true;
    }

    if (entry.github_discussions_url && !existingCommunity.githubDiscussions) {
      newCommunity.githubDiscussions = entry.github_discussions_url;
      result.changes.push(`Added GitHub Discussions link`);
      communityChanged = true;
    }

    if (entry.mailing_list_url && !existingCommunity.mailingList) {
      newCommunity.mailingList = entry.mailing_list_url;
      result.changes.push(`Added mailing list link`);
      communityChanged = true;
    }

    if (communityChanged) {
      frontmatter.community = newCommunity;
      hasChanges = true;
    }

    // Write back to file if there were changes
    if (hasChanges) {
      result.updated = true;
      const newContent = matter.stringify(body, frontmatter);
      await writeFile(filePath, newContent, 'utf-8');
    }

  } catch (error) {
    result.warnings.push(`Error: ${error instanceof Error ? error.message : String(error)}`);
  }

  return result;
}

// Generate sync report
async function generateReport(results: SyncResult[], reportPath: string): Promise<void> {
  const updated = results.filter(r => r.updated);
  const statusChanges = results.filter(r => r.changes.some(c => c.includes('Status changed')));
  const matched = results.filter(r => r.matched);

  let report = `# CNCF Landscape Sync Report

**Date**: ${new Date().toISOString().split('T')[0]}
**Landscape Source**: [CNCF Landscape](https://github.com/cncf/landscape)

## Summary

- 🔄 **${updated.length} technologies** updated
- 🎉 **${statusChanges.length} status changes** (graduations, promotions)
- ✅ **${matched.filter(r => !r.updated).length} technologies** already up-to-date
- 📊 **${results.filter(r => r.matched).length} total** CNCF technologies tracked
- ⚠️ **${results.filter(r => r.warnings.length > 0).length} warnings**

---

`;

  // Highlight status changes
  if (statusChanges.length > 0) {
    report += `## 🎉 Status Changes\n\n`;
    for (const result of statusChanges) {
      const statusChange = result.changes.find(c => c.includes('Status changed'));
      report += `### ${result.id}\n${statusChange}\n\n`;
    }
    report += `---\n\n`;
  }

  // List all updated technologies
  if (updated.length > 0) {
    report += `## Updated Technologies\n\n`;
    for (const result of updated) {
      report += `### ${result.id}\n`;
      report += `**Match method**: ${result.matchMethod}\n\n`;
      report += `**Changes**:\n`;
      for (const change of result.changes) {
        report += `- ${change}\n`;
      }
      if (result.warnings.length > 0) {
        report += `\n**Warnings**:\n`;
        for (const warning of result.warnings) {
          report += `- ${warning}\n`;
        }
      }
      report += `\n`;
    }
    report += `---\n\n`;
  }

  // Summary for unchanged
  if (matched.filter(r => !r.updated).length > 0) {
    report += `## Already Up-to-Date\n\n`;
    report += `${matched.filter(r => !r.updated).length} technologies are already in sync with the CNCF landscape.\n\n`;
  }

  await writeFile(reportPath, report, 'utf-8');
}

// Main function
async function main() {
  const options = parseArgs();

  if (!options.apply) {
    console.error('❌ Error: --apply flag is required for this script');
    console.error('This script is designed for automated syncing and requires explicit confirmation.');
    console.error('\nRun: bun sync-landscape.ts --apply');
    process.exit(1);
  }

  console.log('\n🔄 CNCF Landscape Sync');
  console.log('======================\n');

  // Get script directory
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const contentRoot = join(__dirname, '..');
  const technologiesDir = join(contentRoot, 'technologies');

  // Fetch landscape
  const cncfEntries = await fetchCNCFLandscape(options.landscapeUrl);
  console.log();

  // Get all technologies
  const techDirs = await readdir(technologiesDir, { withFileTypes: true });
  const techIds = techDirs
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .filter(name => !options.only || options.only.includes(name));

  console.log(`Processing ${techIds.length} technologies...\n`);

  // Sync each technology
  const results: SyncResult[] = [];
  let processed = 0;

  for (const techId of techIds) {
    const mdxPath = join(technologiesDir, techId, 'index.mdx');

    try {
      const content = await readFile(mdxPath, 'utf-8');
      const { data } = matter(content);

      const techMetadata: TechMetadata = {
        id: techId,
        name: data.name || techId,
        aliases: data.aliases,
        website: data.website,
        source: data.source,
      };

      const cncfMatch = matchTechnology(techMetadata, cncfEntries);
      const result = await syncTechnology(mdxPath, techId, cncfMatch);
      results.push(result);

      processed++;
      if (processed % 50 === 0) {
        console.log(`Processed ${processed}/${techIds.length} technologies...`);
      }
    } catch (error) {
      console.error(`Error processing ${techId}:`, error);
      results.push({
        path: mdxPath,
        id: techId,
        matched: false,
        updated: false,
        changes: [],
        warnings: [`Failed to process: ${error instanceof Error ? error.message : String(error)}`],
      });
    }
  }

  console.log(`\n✅ Processing complete\n`);

  // Generate report
  const reportPath = join(contentRoot, 'landscape-sync-report.md');
  await generateReport(results, reportPath);

  // Summary
  const updated = results.filter(r => r.updated);
  const statusChanges = results.filter(r => r.changes.some(c => c.includes('Status changed')));

  console.log('📊 Summary');
  console.log('==========');
  console.log(`Total processed: ${results.length}`);
  console.log(`CNCF technologies: ${results.filter(r => r.matched).length}`);
  console.log(`Updated: ${updated.length}`);
  console.log(`Status changes: ${statusChanges.length}`);
  console.log(`Warnings: ${results.filter(r => r.warnings.length > 0).length}`);
  console.log(`\nReport: ${reportPath}\n`);

  if (statusChanges.length > 0) {
    console.log('🎉 Status Changes:');
    for (const result of statusChanges) {
      const change = result.changes.find(c => c.includes('Status changed'));
      console.log(`  - ${result.id}: ${change}`);
    }
    console.log();
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

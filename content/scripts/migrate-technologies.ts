#!/usr/bin/env bun

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
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

interface LandscapeCategory {
  name: string;
  subcategories: Array<{
    name: string;
    items: CNCFEntry[];
  }>;
}

interface TechMetadata {
  id: string;
  name: string;
  aliases?: string[];
  website?: string;
  source?: string;
}

interface TransformResult {
  path: string;
  id: string;
  matched: boolean;
  matchMethod?: string;
  changes: string[];
  warnings: string[];
}

interface CLIOptions {
  apply: boolean;
  landscapeUrl: string;
  only?: string[];
  noMoveDescription: boolean;
}

// Parse CLI arguments
function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);
  const options: CLIOptions = {
    apply: false,
    landscapeUrl: 'https://raw.githubusercontent.com/cncf/landscape/refs/heads/master/landscape.yml',
    noMoveDescription: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--apply') {
      options.apply = true;
    } else if (arg === '--landscape-url') {
      options.landscapeUrl = args[++i];
    } else if (arg === '--only') {
      options.only = args[++i].split(',').map(s => s.trim());
    } else if (arg === '--no-move-description') {
      options.noMoveDescription = true;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Technology Migration Script

Usage: bun migrate-technologies.ts [options]

Options:
  --apply                   Apply changes (default is dry-run)
  --landscape-url <url>     Custom CNCF landscape URL
  --only <tech1,tech2>      Only process specific technologies
  --no-move-description     Skip moving description to body
  --help, -h                Show this help message

Examples:
  # Dry-run (default)
  bun migrate-technologies.ts

  # Apply changes
  bun migrate-technologies.ts --apply

  # Process specific technologies
  bun migrate-technologies.ts --only kubernetes,prometheus
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

// Compare URLs and return warning if different
function compareUrls(field: string, ours: string | undefined, cncf: string | undefined): string | null {
  if (!ours && !cncf) return null;
  if (!ours) return null; // CNCF fills gap, no warning needed
  if (!cncf) return null; // We have data, CNCF doesn't, no issue

  // Normalize URLs for comparison
  const normalizeUrl = (url: string) =>
    url.toLowerCase().replace(/\/$/, '').replace(/^https?:\/\/(www\.)?/, '');

  if (normalizeUrl(ours) !== normalizeUrl(cncf)) {
    return `${field}: ours="${ours}" vs CNCF="${cncf}"`;
  }

  return null;
}

// Parse comma-separated string into array
function parseCommaSeparated(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

// Transform single MDX file
async function transformFile(
  filePath: string,
  techId: string,
  cncfMatch: { entry: CNCFEntry; method: string } | null,
  options: CLIOptions
): Promise<TransformResult> {
  const result: TransformResult = {
    path: filePath,
    id: techId,
    matched: !!cncfMatch,
    matchMethod: cncfMatch?.method,
    changes: [],
    warnings: [],
  };

  try {
    // Read and parse file
    const content = await readFile(filePath, 'utf-8');
    const { data: frontmatter, content: body } = matter(content);

    // Extract description
    const description = frontmatter.description?.trim() || '';

    // Remove description from frontmatter
    if (!options.noMoveDescription && description) {
      delete frontmatter.description;
      result.changes.push(`Description moved to body (${description.length} characters)`);
    }

    // Remove old categories field
    if (frontmatter.categories) {
      delete frontmatter.categories;
      result.changes.push(`Removed old categories field`);
    }

    // Rename radar to matrix and update field names
    if (frontmatter.radar) {
      const radar = frontmatter.radar;
      frontmatter.matrix = {
        ...radar,
        // Rename quadrant → grouping
        grouping: radar.quadrant,
        // Rename ring → status
        status: radar.ring,
      };
      // Remove old field names
      delete frontmatter.matrix.quadrant;
      delete frontmatter.matrix.ring;
      delete frontmatter.radar;
      result.changes.push(`Renamed radar to matrix (quadrant→grouping, ring→status)`);
    } else if (frontmatter.matrix && (frontmatter.matrix.quadrant || frontmatter.matrix.ring)) {
      // Handle existing matrix objects with old field names
      if (frontmatter.matrix.quadrant) {
        frontmatter.matrix.grouping = frontmatter.matrix.quadrant;
        delete frontmatter.matrix.quadrant;
      }
      if (frontmatter.matrix.ring) {
        frontmatter.matrix.status = frontmatter.matrix.ring;
        delete frontmatter.matrix.ring;
      }
      result.changes.push(`Renamed matrix fields (quadrant→grouping, ring→status)`);
    }

    // Build new body content
    let newBody = body.trim();
    if (!options.noMoveDescription && description) {
      if (newBody) {
        newBody = `${description}\n\n${newBody}`;
      } else {
        newBody = description;
      }
    }

    // Enrich with CNCF data if matched
    if (cncfMatch) {
      const entry = cncfMatch.entry;

      // Compare URLs and warn on conflicts
      const websiteWarning = compareUrls('website', frontmatter.website, entry.homepage_url);
      if (websiteWarning) result.warnings.push(websiteWarning);

      const sourceWarning = compareUrls('source', frontmatter.source, entry.repo_url);
      if (sourceWarning) result.warnings.push(sourceWarning);

      const docWarning = compareUrls('documentation', frontmatter.documentation, entry.documentation_url);
      if (docWarning) result.warnings.push(docWarning);

      // Add category/subcategory at TOP LEVEL (from CNCF landscape)
      if (entry.category) {
        frontmatter.category = entry.category;
        result.changes.push(`Added category: ${entry.category}`);
      }

      if (entry.subcategory) {
        frontmatter.subcategory = entry.subcategory;
        result.changes.push(`Added subcategory: ${entry.subcategory}`);
      }

      // Add CNCF metadata
      const cncfData: Record<string, any> = {};

      if (entry.project) {
        cncfData.status = entry.project;
        result.changes.push(`Added CNCF status: ${entry.project}`);
      }

      if (entry.extra?.accepted) cncfData.accepted = entry.extra.accepted;
      if (entry.extra?.incubating) cncfData.incubating = entry.extra.incubating;
      if (entry.extra?.graduated) cncfData.graduated = entry.extra.graduated;
      if (entry.extra?.archived) cncfData.archived = entry.extra.archived;
      if (entry.extra?.dev_stats_url) cncfData.devStatsUrl = entry.extra.dev_stats_url;

      const personas = parseCommaSeparated(entry.summary_personas);
      if (personas) {
        cncfData.personas = personas;
        result.changes.push(`Added personas: ${personas.join(', ')}`);
      }

      const tags = parseCommaSeparated(entry.summary_tags);
      if (tags) {
        cncfData.tags = tags;
        result.changes.push(`Added tags: ${tags.join(', ')}`);
      }

      if (entry.summary_use_case) {
        cncfData.useCase = entry.summary_use_case;
        result.changes.push(`Added use case`);
      }

      if (entry.summary_business_use_case) {
        cncfData.businessUseCase = entry.summary_business_use_case;
        result.changes.push(`Added business use case`);
      }

      if (entry.summary_release_rate) {
        cncfData.releaseRate = entry.summary_release_rate;
        result.changes.push(`Added release rate: ${entry.summary_release_rate}`);
      }

      const integrations = parseCommaSeparated(entry.summary_integrations);
      if (integrations) {
        cncfData.integrations = integrations;
        result.changes.push(`Added integrations: ${integrations.join(', ')}`);
      }

      if (Object.keys(cncfData).length > 0) {
        frontmatter.cncf = cncfData;
      }

      // Add community links
      const communityData: Record<string, string> = {};

      if (entry.twitter) communityData.twitter = entry.twitter;
      if (entry.youtube_url) communityData.youtube = entry.youtube_url;
      if (entry.slack_url) communityData.slack = entry.slack_url;
      if (entry.blog_url) communityData.blog = entry.blog_url;
      if (entry.github_discussions_url) communityData.githubDiscussions = entry.github_discussions_url;
      if (entry.mailing_list_url) communityData.mailingList = entry.mailing_list_url;

      if (Object.keys(communityData).length > 0) {
        frontmatter.community = communityData;
        result.changes.push(`Added community links: ${Object.keys(communityData).join(', ')}`);
      }
    }

    // Serialize back to MDX
    const newContent = matter.stringify(newBody, frontmatter);

    // Write file if apply mode
    if (options.apply) {
      await writeFile(filePath, newContent, 'utf-8');
    }

  } catch (error) {
    result.warnings.push(`Error processing file: ${error instanceof Error ? error.message : String(error)}`);
  }

  return result;
}

// Generate migration report
async function generateReport(results: TransformResult[], reportPath: string): Promise<void> {
  const matched = results.filter(r => r.matched);
  const notMatched = results.filter(r => !r.matched);
  const withWarnings = results.filter(r => r.warnings.length > 0);

  let report = `# Technology Migration Report

Date: ${new Date().toISOString().split('T')[0]}
Total Technologies: ${results.length}

## Summary
- Matched with CNCF: ${matched.length} technologies
- Not in CNCF: ${notMatched.length} technologies
- URL conflicts: ${withWarnings.length} technologies (see warnings below)
- Descriptions moved: ${results.filter(r => r.changes.some(c => c.includes('Description moved'))).length} technologies

---

## Matched Technologies (${matched.length})

`;

  for (const result of matched) {
    report += `### ${result.id}\n`;
    report += `**Status**: Matched with CNCF (${result.matchMethod})\n`;
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
    report += '\n';
  }

  report += `---

## Not Matched with CNCF (${notMatched.length})

These technologies will only have descriptions moved to body:

`;

  for (const result of notMatched.slice(0, 20)) {
    report += `- ${result.id}`;
    if (result.changes.length > 0) {
      report += ` (${result.changes[0]})`;
    }
    report += '\n';
  }

  if (notMatched.length > 20) {
    report += `\n... and ${notMatched.length - 20} more\n`;
  }

  report += `\n---

## Action Items

1. Review URL conflicts (${withWarnings.length} technologies)
2. Consider enriching minimal descriptions
3. Run migration: \`bun content/scripts/migrate-technologies.ts --apply\`

`;

  await writeFile(reportPath, report, 'utf-8');
  console.log(`\nReport written to: ${reportPath}`);
}

// Main function
async function main() {
  const options = parseArgs();

  console.log('\n📦 Technology Migration Script');
  console.log('================================\n');

  if (options.apply) {
    console.log('⚠️  APPLY MODE - Files will be modified!\n');
  } else {
    console.log('🔍 DRY-RUN MODE - No files will be modified\n');
  }

  // Get script directory and navigate to content root
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const contentRoot = join(__dirname, '..');
  const technologiesDir = join(contentRoot, 'technologies');

  console.log(`Technologies directory: ${technologiesDir}\n`);

  // Fetch CNCF landscape
  const cncfEntries = await fetchCNCFLandscape(options.landscapeUrl);
  console.log();

  // Get all technology directories
  const techDirs = await readdir(technologiesDir, { withFileTypes: true });
  const techIds = techDirs
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
    .filter(name => !options.only || options.only.includes(name));

  console.log(`Processing ${techIds.length} technologies...\n`);

  // Process each technology
  const results: TransformResult[] = [];
  let processed = 0;

  for (const techId of techIds) {
    const mdxPath = join(technologiesDir, techId, 'index.mdx');

    try {
      // Read frontmatter to get metadata for matching
      const content = await readFile(mdxPath, 'utf-8');
      const { data } = matter(content);

      const techMetadata: TechMetadata = {
        id: techId,
        name: data.name || techId,
        aliases: data.aliases,
        website: data.website,
        source: data.source,
      };

      // Match with CNCF
      const cncfMatch = matchTechnology(techMetadata, cncfEntries);

      // Transform file
      const result = await transformFile(mdxPath, techId, cncfMatch, options);
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
        changes: [],
        warnings: [`Failed to process: ${error instanceof Error ? error.message : String(error)}`],
      });
    }
  }

  console.log(`\n✅ Processed ${processed} technologies\n`);

  // Generate report
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const reportPath = join(contentRoot, `migration-report-${timestamp}.md`);
  await generateReport(results, reportPath);

  // Summary
  console.log('\n📊 Summary');
  console.log('===========');
  console.log(`Total processed: ${results.length}`);
  console.log(`Matched with CNCF: ${results.filter(r => r.matched).length}`);
  console.log(`Not matched: ${results.filter(r => !r.matched).length}`);
  console.log(`With warnings: ${results.filter(r => r.warnings.length > 0).length}`);

  if (!options.apply) {
    console.log('\n💡 This was a dry-run. To apply changes, run with --apply flag');
  } else {
    console.log('\n✨ Migration complete!');
  }

  console.log();
}

// Run main function
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

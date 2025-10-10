#!/usr/bin/env bun
/*
  Crawl internal links to find orphans and pages deeper than a given click depth.
  Usage: bun scripts/orphan-check.ts --base https://rawkode.academy --maxDepth 3 --limit 1000
*/

type Args = { base: string; maxDepth: number; limit: number; crawlDepth: number };

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (k: string, d?: string) => {
    const i = argv.indexOf(k);
    return i >= 0 ? argv[i + 1] : d;
  };
  return {
    base: get("--base", "https://rawkode.academy")!,
    maxDepth: parseInt(get("--maxDepth", "3")!, 10),
    limit: parseInt(get("--limit", "1000")!, 10),
    crawlDepth: parseInt(get("--crawlDepth", "7")!, 10),
  };
}

function isInternal(baseHost: string, href: string) {
  try {
    const u = new URL(href, `https://${baseHost}`);
    return u.host === baseHost && u.protocol.startsWith("http");
  } catch {
    return false;
  }
}

function normalize(url: string) {
  const u = new URL(url);
  let p = u.pathname;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return `${u.protocol}//${u.host}${p}`;
}

async function fetchHtml(url: string) {
  const res = await fetch(url, { headers: { Accept: "text/html" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return await res.text();
}

function extractLinks(html: string, baseUrl: string) {
  const re = /<a\s+[^>]*href=["']([^"'#]+)["'][^>]*>/gi;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  const base = new URL(baseUrl);
  while ((m = re.exec(html))) {
    try {
      const href = m[1];
      if (!href) continue; // noUncheckedIndexedAccess safety
      const abs = new URL(href, base).href;
      out.push(abs);
    } catch {}
  }
  return out;
}

async function run() {
  const { base, maxDepth, limit, crawlDepth } = parseArgs();
  const baseHost = new URL(base).host.replace(/^www\./, "");
  const start = normalize(base);

  const queue: { url: string; depth: number }[] = [{ url: start, depth: 0 }];
  const seen = new Set<string>();
  const incoming = new Map<string, number>();
  const depthMap = new Map<string, number>();
  const errors: string[] = [];

  while (queue.length && seen.size < limit) {
    const { url, depth } = queue.shift()!;
    if (seen.has(url) || depth > crawlDepth) continue;
    seen.add(url);
    depthMap.set(url, depth);
    try {
      const html = await fetchHtml(url);
      const links = extractLinks(html, url);
      for (const l of links) {
        if (!isInternal(baseHost, l)) continue;
        const n = normalize(l);
        incoming.set(n, (incoming.get(n) || 0) + 1);
        if (!seen.has(n)) queue.push({ url: n, depth: depth + 1 });
      }
    } catch (e) {
      errors.push(`${url}: ${e}`);
    }
  }

  // Collect potential orphans (no incoming except from itself/home) and deep pages
  const visited = Array.from(seen);
  const deepPages = visited.filter((u) => (depthMap.get(u) ?? 0) > maxDepth);

  const orphans = visited.filter((u) => (incoming.get(u) || 0) === 0 && u !== start);

  console.log(`Crawled ${visited.length} pages (limit ${limit}, maxDepth ${maxDepth}).`);
  if (errors.length) {
    console.log(`Errors (${errors.length}):`);
    for (const e of errors) console.log(`  - ${e}`);
  }
  if (orphans.length) {
    console.log(`\nPotential orphans (${orphans.length}):`);
    for (const u of orphans) console.log(`  - ${u}`);
  } else {
    console.log("\nNo orphans detected at this crawl depth.");
  }

  if (deepPages.length) {
    console.log(`\nPages deeper than ${maxDepth} clicks from home (${deepPages.length}):`);
    for (const u of deepPages) console.log(`  - ${u} (depth ${depthMap.get(u)})`);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

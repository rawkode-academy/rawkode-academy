#!/usr/bin/env bun
/*
  Check sitemap URLs for status 200 and correct canonical.
  Usage: bun scripts/check-sitemap.ts --base https://rawkode.academy [--limit 400] [--concurrency 10]
*/

import { parse } from "node-html-parser";

type Args = {
  base: string;
  limit: number;
  concurrency: number;
};

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : undefined;
  };
  const base = get("--base") || "https://rawkode.academy";
  const limit = parseInt(get("--limit") || "400", 10);
  const concurrency = parseInt(get("--concurrency") || "10", 10);
  return { base, limit, concurrency };
}

async function fetchText(url: string) {
  const r = await fetch(url, { headers: { Accept: "*/*" } });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return await r.text();
}

function extractLocsFromXml(xml: string): string[] {
  const locs: string[] = [];
  const re = /<loc>\s*([^<]+?)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    locs.push(m[1].trim());
  }
  return locs;
}

function normalize(url: string) {
  const u = new URL(url);
  let p = u.pathname;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return `${u.protocol}//${u.host}${p}`;
}

async function getAllSitemapUrls(base: string): Promise<string[]> {
  // Try index first, fallback to /sitemap.xml
  const candidates = [
    new URL("/sitemap-index.xml", base).href,
    new URL("/sitemap.xml", base).href,
  ];

  for (const sm of candidates) {
    try {
      const xml = await fetchText(sm);
      const locs = extractLocsFromXml(xml);
      if (locs.length === 0) continue;

      // If file appears to be an index (contains sitemap URLs), fetch each and collect page URLs
      const looksLikeIndex = xml.includes("<sitemapindex") || locs.some((l) => /sitemap.*\.xml/i.test(l));
      if (looksLikeIndex) {
        const all: string[] = [];
        for (const loc of locs) {
          try {
            const childXml = await fetchText(loc);
            const childLocs = extractLocsFromXml(childXml);
            all.push(...childLocs);
          } catch (e) {
            console.warn(`Failed to read child sitemap ${loc}:`, e);
          }
        }
        return Array.from(new Set(all));
      }
      return Array.from(new Set(locs));
    } catch {
      // try next candidate
    }
  }
  throw new Error("Could not fetch sitemap index or sitemap.xml");
}

async function checkUrl(url: string, apexHost: string) {
  const res = await fetch(url, { headers: { Accept: "text/html" } });
  const ok = res.status === 200;
  const ct = res.headers.get("content-type") || "";
  let canonical: string | null = null;
  let canonicalOk = false;
  let hostOk = false;
  if (ok && ct.includes("text/html")) {
    const html = await res.text();
    const dom = parse(html);
    const link = dom.querySelector('link[rel="canonical"]');
    canonical = link?.getAttribute("href") || null;
    if (canonical) {
      canonicalOk = normalize(canonical) === normalize(url);
      hostOk = new URL(canonical).hostname === apexHost;
    }
  }
  return { url, ok, canonical, canonicalOk, hostOk, status: res.status };
}

async function run() {
  const { base, limit, concurrency } = parseArgs();
  const apexHost = new URL(base).hostname.replace(/^www\./, "");
  console.log(`Checking sitemap for ${base} (limit=${limit}, concurrency=${concurrency})`);
  const urls = (await getAllSitemapUrls(base)).slice(0, limit);
  console.log(`Found ${urls.length} URLs from sitemap`);

  const results: Awaited<ReturnType<typeof checkUrl>>[] = [];
  let i = 0;
  async function worker() {
    while (i < urls.length) {
      const idx = i++;
      const u = urls[idx];
      try {
        const r = await checkUrl(u, apexHost);
        results.push(r);
        const emoji = r.ok && r.canonicalOk && r.hostOk ? "✅" : "⚠️";
        console.log(`${emoji} ${u} [${r.status}]`);
      } catch (e) {
        console.log(`❌ ${u} -> ${e}`);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));

  const failures = results.filter((r) => !r.ok || !r.canonicalOk || !r.hostOk);
  const non200 = results.filter((r) => !r.ok);
  const badCanon = results.filter((r) => r.ok && !r.canonicalOk);
  const badHost = results.filter((r) => r.ok && r.canonicalOk && !r.hostOk);

  console.log("\nSummary:");
  console.log(`  Total checked: ${results.length}`);
  console.log(`  Non-200:       ${non200.length}`);
  console.log(`  Canonical mismatches: ${badCanon.length}`);
  console.log(`  Canonical host not apex: ${badHost.length}`);

  if (failures.length > 0) process.exit(2);
}

run().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});


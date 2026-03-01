#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

const resultsDir = path.join(repoRoot, "qa", "results");
const screenshotsDir = path.join(resultsDir, "screenshots");
const resultsJsonPath = path.join(resultsDir, "results.json");
const reportPath = path.join(resultsDir, "report.md");
const devServerLogPath = path.join(resultsDir, "dev-server.log");

const baseUrl = process.env.QA_BASE_URL ?? "http://localhost:4321";
const shouldStartServer = process.env.QA_NO_SERVER !== "1";
const serverReadyTimeoutMs = 90_000;
const pageTimeoutMs = 45_000;
const existingServerProbeTimeoutMs = 1_500;

const themes = ["light", "dark"];
const viewports = [
  {
    name: "desktop",
    options: {
      viewport: { width: 1440, height: 900 },
      isMobile: false,
      hasTouch: false,
      deviceScaleFactor: 1,
    },
  },
  {
    name: "tablet",
    options: {
      viewport: { width: 1024, height: 1366 },
      isMobile: false,
      hasTouch: true,
      deviceScaleFactor: 2,
    },
  },
  {
    name: "mobile",
    options: {
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 3,
    },
  },
];

const defaultRoutes = [
  "/",
  "/news",
  "/ask",
  "/show",
  "/search",
  "/search?q=kubernetes",
  "/submit",
  "/profile",
  "/admin/tags",
  "/this-route-should-404",
];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const slugifyRoute = (route) => {
  const plain = route.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  return plain || "home";
};

const waitForServer = async (url, timeoutMs) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status < 500) {
        return;
      }
    } catch {
      // keep polling until timeout
    }
    await delay(500);
  }

  throw new Error(`Timed out waiting for ${url}`);
};

const canReachServer = async (url, timeoutMs) => {
  try {
    await waitForServer(url, timeoutMs);
    return true;
  } catch {
    return false;
  }
};

const startDevServer = async () => {
  await fs.mkdir(resultsDir, { recursive: true });
  const serverLog = fsSync.createWriteStream(devServerLogPath, { flags: "w" });
  const child = spawn("bun", ["run", "dev", "--host", "127.0.0.1", "--port", "4321"], {
    cwd: repoRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });

  child.stdout?.pipe(serverLog);
  child.stderr?.pipe(serverLog);

  await waitForServer(baseUrl, serverReadyTimeoutMs);
  return child;
};

const stopDevServer = async (child) => {
  if (!child || child.exitCode !== null || child.killed) {
    return;
  }

  child.kill("SIGTERM");
  await delay(500);
  if (child.exitCode === null) {
    child.kill("SIGKILL");
  }
};

const formatFocusEntry = (entry) => {
  const idPart = entry.id ? `#${entry.id}` : "";
  const classPart = entry.className ? `.${entry.className}` : "";
  const textPart = entry.text ? ` "${entry.text}"` : "";
  return `${entry.tag}${idPart}${classPart}${textPart}`;
};

const normalizeViolation = (violation) => {
  const firstNode = violation.nodes[0];
  return {
    id: violation.id,
    impact: violation.impact ?? "unknown",
    description: violation.description,
    help: violation.help,
    helpUrl: violation.helpUrl,
    nodeCount: violation.nodes.length,
    target: firstNode?.target?.join(" ") ?? "",
  };
};

const discoverItemRoute = async (browser) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    hasTouch: false,
    isMobile: false,
  });
  const page = await context.newPage();

  try {
    await page.goto(new URL("/", baseUrl).toString(), {
      waitUntil: "networkidle",
      timeout: pageTimeoutMs,
    });
    const href = await page.locator('a[href^="/item/"]').first().getAttribute("href");
    if (!href) {
      return null;
    }
    return href.split("#")[0];
  } catch {
    return null;
  } finally {
    await context.close();
  }
};

const scanRoute = async ({
  browser,
  axeSource,
  route,
  theme,
  viewportName,
  contextOptions,
}) => {
  const startedAt = Date.now();
  const url = new URL(route, baseUrl).toString();
  const scan = {
    route,
    url,
    theme,
    viewport: viewportName,
    status: "ok",
    durationMs: 0,
    screenshot: "",
    focusTrail: [],
    violations: [],
    error: null,
  };

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: pageTimeoutMs });

    if (theme === "dark") {
      await page.evaluate(() => {
        document.documentElement.classList.add("dark");
      });
      await page.waitForTimeout(100);
    }

    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press("Tab");
      const active = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) {
          return null;
        }

        const text = (el.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 48);
        return {
          tag: el.tagName.toLowerCase(),
          id: el.id || "",
          className: typeof el.className === "string"
            ? el.className
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .join(".")
            : "",
          text,
        };
      });

      if (active) {
        scan.focusTrail.push(formatFocusEntry(active));
      }
    }

    const fileStem = `${slugifyRoute(route)}__${theme}__${viewportName}`;
    const screenshotPath = path.join(screenshotsDir, `${fileStem}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    scan.screenshot = path.relative(repoRoot, screenshotPath);

    await page.addScriptTag({ content: axeSource });
    const axeResult = await page.evaluate(async () => {
      // @ts-ignore - axe is injected at runtime.
      return window.axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa"],
        },
        resultTypes: ["violations"],
      });
    });
    scan.violations = axeResult.violations.map(normalizeViolation);
  } catch (error) {
    scan.status = "error";
    scan.error = error instanceof Error ? error.message : String(error);
  } finally {
    scan.durationMs = Date.now() - startedAt;
    await context.close();
  }

  return scan;
};

const buildReport = (scans) => {
  const timestamp = new Date().toISOString();
  const total = scans.length;
  const failures = scans.filter((scan) => scan.status === "error");
  const successful = scans.filter((scan) => scan.status === "ok");
  const withViolations = successful.filter((scan) => scan.violations.length > 0);
  const totalViolations = successful.reduce((sum, scan) => sum + scan.violations.length, 0);

  const impactCounts = { critical: 0, serious: 0, moderate: 0, minor: 0, unknown: 0 };
  for (const scan of successful) {
    for (const violation of scan.violations) {
      const key = violation.impact ?? "unknown";
      if (key in impactCounts) {
        impactCounts[key] += 1;
      } else {
        impactCounts.unknown += 1;
      }
    }
  }

  const lines = [];
  lines.push("# Headless QA Report");
  lines.push("");
  lines.push(`Generated: ${timestamp}`);
  lines.push(`Base URL: ${baseUrl}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Total scans: ${total}`);
  lines.push(`- Successful scans: ${successful.length}`);
  lines.push(`- Failed scans: ${failures.length}`);
  lines.push(`- Scans with accessibility violations: ${withViolations.length}`);
  lines.push(`- Total accessibility violations: ${totalViolations}`);
  lines.push("");
  lines.push("### Violation Impact Counts");
  lines.push("");
  lines.push(`- Critical: ${impactCounts.critical}`);
  lines.push(`- Serious: ${impactCounts.serious}`);
  lines.push(`- Moderate: ${impactCounts.moderate}`);
  lines.push(`- Minor: ${impactCounts.minor}`);
  lines.push(`- Unknown: ${impactCounts.unknown}`);
  lines.push("");

  lines.push("## Scan Matrix");
  lines.push("");
  lines.push("| Route | Theme | Viewport | Status | Violations | Screenshot |");
  lines.push("| --- | --- | --- | --- | ---: | --- |");
  for (const scan of scans) {
    lines.push(
      `| \`${scan.route}\` | ${scan.theme} | ${scan.viewport} | ${scan.status} | ${scan.violations.length} | ${scan.screenshot ? `\`${scan.screenshot}\`` : "n/a"} |`,
    );
  }
  lines.push("");

  if (failures.length > 0) {
    lines.push("## Failures");
    lines.push("");
    for (const failure of failures) {
      lines.push(`- \`${failure.route}\` / ${failure.theme} / ${failure.viewport}: ${failure.error}`);
    }
    lines.push("");
  }

  if (withViolations.length > 0) {
    lines.push("## Accessibility Findings");
    lines.push("");
    for (const scan of withViolations) {
      lines.push(`### ${scan.route} (${scan.theme}, ${scan.viewport})`);
      lines.push("");
      for (const violation of scan.violations) {
        lines.push(
          `- [${violation.impact}] \`${violation.id}\`: ${violation.help} (${violation.nodeCount} node${violation.nodeCount === 1 ? "" : "s"})`,
        );
        lines.push(`- Target: \`${violation.target || "n/a"}\``);
        lines.push(`- ${violation.helpUrl}`);
      }
      lines.push("");
    }
  } else {
    lines.push("## Accessibility Findings");
    lines.push("");
    lines.push("No WCAG A/AA violations were reported by axe-core in this run.");
    lines.push("");
  }

  lines.push("## Keyboard Focus Sampling");
  lines.push("");
  for (const scan of successful) {
    const focusText = scan.focusTrail.length > 0 ? scan.focusTrail.join(" -> ") : "No focusable elements sampled";
    lines.push(`- \`${scan.route}\` / ${scan.theme} / ${scan.viewport}: ${focusText}`);
  }
  lines.push("");

  return lines.join("\n");
};

const main = async () => {
  await fs.mkdir(screenshotsDir, { recursive: true });
  const axeSource = await fs.readFile(require.resolve("axe-core/axe.min.js"), "utf8");

  let server = null;
  if (shouldStartServer) {
    const existingServerDetected = await canReachServer(baseUrl, existingServerProbeTimeoutMs);
    if (existingServerDetected) {
      process.stdout.write(`[qa] reusing existing server at ${baseUrl}\n`);
    } else {
      process.stdout.write(`[qa] starting local dev server for ${baseUrl}\n`);
      server = await startDevServer();
    }
  } else {
    process.stdout.write(`[qa] using existing server only (QA_NO_SERVER=1): ${baseUrl}\n`);
    await waitForServer(baseUrl, serverReadyTimeoutMs);
  }

  const browser = await chromium.launch({ headless: true });

  try {
    const itemRoute = await discoverItemRoute(browser);
    const routes = itemRoute ? [...defaultRoutes, itemRoute] : defaultRoutes;
    const uniqueRoutes = [...new Set(routes)];
    const scans = [];

    for (const route of uniqueRoutes) {
      for (const theme of themes) {
        for (const viewport of viewports) {
          const scan = await scanRoute({
            browser,
            axeSource,
            route,
            theme,
            viewportName: viewport.name,
            contextOptions: viewport.options,
          });
          scans.push(scan);
          const status = scan.status === "ok" ? "ok" : "error";
          const violationCount = scan.violations.length;
          process.stdout.write(
            `[qa] ${status} ${route} (${theme}/${viewport.name}) violations=${violationCount}\n`,
          );
        }
      }
    }

    const report = buildReport(scans);
    await fs.writeFile(resultsJsonPath, JSON.stringify(scans, null, 2), "utf8");
    await fs.writeFile(reportPath, report, "utf8");

    process.stdout.write(`\nReport: ${path.relative(repoRoot, reportPath)}\n`);
    process.stdout.write(`Raw results: ${path.relative(repoRoot, resultsJsonPath)}\n`);
    process.stdout.write(`Screenshots: ${path.relative(repoRoot, screenshotsDir)}\n`);
    if (server) {
      process.stdout.write(`Dev server log: ${path.relative(repoRoot, devServerLogPath)}\n`);
    }
  } finally {
    await browser.close();
    if (server) {
      await stopDevServer(server);
    }
  }
};

main().catch(async (error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});

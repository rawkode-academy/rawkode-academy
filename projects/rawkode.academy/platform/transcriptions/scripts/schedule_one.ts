function usage(code = 1) {
  console.log(
    [
      "Usage:",
      "  bun scripts/schedule_one.ts <id> [language]",
      "  bun scripts/schedule_one.ts --id <id> [--language en] [--force]",
      "",
      "Options:",
      "  --force            Regenerate captions even if captions/en.vtt exists.",
      "",
      "Requires:",
      "  Wrangler CLI configured with Cloudflare credentials",
    ].join("\n"),
  );
  process.exit(code);
}

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  let id = "";
  let language = "en";
  let force = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-h" || a === "--help") usage(0);
    if (a === "-v" || a === "--video-id" || a === "--id") {
      if (!args[i + 1]) usage();
      id = args[++i];
      continue;
    }
    if (a === "-l" || a === "--language") {
      if (!args[i + 1]) usage();
      language = args[++i];
      continue;
    }
    if (a === "--force") {
      force = true;
      continue;
    }
    if (!a.startsWith("-")) {
      if (!id) id = a;
      else language = a;
      continue;
    }
    console.error(`Unknown argument: ${a}`);
    usage();
  }

  if (!id) usage();

  return {
    id,
    language,
    force,
  };
}

async function triggerTranscription(
  id: string,
  language: string,
  force: boolean,
) {
  console.log(
    `Triggering transcription: id=${id} language=${language} force=${force}`,
  );

  const params = JSON.stringify({ id, language, force });
  const proc = Bun.spawn(
    ["bunx", "wrangler", "workflows", "trigger", "transcribe", params],
    { stdout: "pipe", stderr: "pipe" },
  );

  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`Wrangler failed: ${stderr}`);
  }

  const match = output.match(/([a-f0-9-]{36})/i);
  console.log(`Success. Workflow scheduled. workflowId=${match?.[1] ?? "unknown"}`);
}

async function main() {
  const { id, language, force } = parseArgs(process.argv);
  await triggerTranscription(id, language, force);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(4);
});

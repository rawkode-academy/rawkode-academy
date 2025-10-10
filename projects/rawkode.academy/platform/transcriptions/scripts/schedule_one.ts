const CLOUDFLARE_TRANSCRIPTION_ENDPOINT =
  "https://transcriptions.rawkodeacademy.workers.dev";

type TriggerResult = { workflowId: string };

function usage(code = 1) {
  console.log(
    [
      "Usage:",
      "  bun scripts/schedule_one.ts <videoId> [language]",
      "  bun scripts/schedule_one.ts --video-id <id> [--language en]",
      "",
      "Env:",
      "  HTTP_TRANSCRIPTION_TOKEN   Bearer token for the Worker",
    ].join("\n"),
  );
  process.exit(code);
}

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  let videoId = "";
  let language = "en";

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "-h" || a === "--help") usage(0);
    if (a === "-v" || a === "--video-id") {
      if (!args[i + 1]) usage();
      videoId = args[++i];
      continue;
    }
    if (a === "-l" || a === "--language") {
      if (!args[i + 1]) usage();
      language = args[++i];
      continue;
    }
    if (!a.startsWith("-")) {
      if (!videoId) videoId = a;
      else language = a;
      continue;
    }
    console.error(`Unknown argument: ${a}`);
    usage();
  }

  if (!videoId) usage();

  return { videoId, language };
}

async function triggerTranscription(videoId: string, language: string) {
  const token = process.env.HTTP_TRANSCRIPTION_TOKEN;
  if (!token) {
    console.error(
      "Missing env HTTP_TRANSCRIPTION_TOKEN. Export your Worker API token.",
    );
    process.exit(2);
  }

  console.log(
    `Triggering transcription: videoId=${videoId} language=${language}`,
  );
  const response = await fetch(CLOUDFLARE_TRANSCRIPTION_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ videoId, language }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(
      `Failed: ${response.status} ${response.statusText} -> ${body}`,
    );
    process.exit(3);
  }

  const result = (await response.json()) as TriggerResult;
  console.log(
    `Success. Workflow scheduled. workflowId=${result.workflowId}`,
  );
}

async function main() {
  const { videoId, language } = parseArgs(process.argv);
  await triggerTranscription(videoId, language);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(4);
});


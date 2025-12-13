import { triggerTranscriptionJob } from "./transcriptions";

type TriggerResult = { workflowId: string };

function usage(code = 1) {
  console.log(
    [
      "Usage:",
      "  bun scripts/schedule_one.ts <id> [language]",
      "  bun scripts/schedule_one.ts --id <id> [--language en]",
      "",
      "Env:",
      "  HTTP_TRANSCRIPTION_TOKEN   Bearer token for the Worker",
      "  TRANSCRIPTIONS_SERVICE     Service binding to the transcriptions Worker",
    ].join("\n"),
  );
  process.exit(code);
}

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  let id = "";
  let language = "en";

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
    if (!a.startsWith("-")) {
      if (!id) id = a;
      else language = a;
      continue;
    }
    console.error(`Unknown argument: ${a}`);
    usage();
  }

  if (!id) usage();

  return { id, language };
}

async function triggerTranscription(id: string, language: string) {
  console.log(`Triggering transcription: id=${id} language=${language}`);
  const result = (await triggerTranscriptionJob({ id, language })) as TriggerResult;
  console.log(`Success. Workflow scheduled. workflowId=${result.workflowId}`);
}

async function main() {
  const { id, language } = parseArgs(process.argv);
  await triggerTranscription(id, language);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(4);
});

import { App, LogLevel, type SlackEventMiddlewareArgs } from "@slack/bolt";

const kagentA2AUrl = Deno.env.get("KAGENT_A2A_URL");
if (!kagentA2AUrl) {
  throw new Error("KAGENT_A2A_URL environment variable is required");
}
const KAGENT_A2A_URL = kagentA2AUrl;
const DEBUG_ENABLED = isDebugEnabled(Deno.env.get("DEBUG"));
const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN");
const SLACK_APP_TOKEN = Deno.env.get("SLACK_APP_TOKEN");
const REQUIRED_BOT_SCOPES = ["chat:write", "app_mentions:read", "im:history"];

const app = new App({
  token: SLACK_BOT_TOKEN,
  appToken: SLACK_APP_TOKEN,
  socketMode: true,
  logLevel: DEBUG_ENABLED ? LogLevel.DEBUG : LogLevel.INFO,
});

interface A2ATextPart {
  kind?: string;
  text?: string;
}

interface A2ADataPart {
  kind?: string;
  data?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

type A2APart = A2ATextPart | A2ADataPart;

interface A2AMessage {
  kind?: string;
  messageId?: string;
  role?: string;
  parts?: A2APart[];
  contextId?: string;
  taskId?: string;
  metadata?: Record<string, unknown>;
}

interface A2AStatusUpdateEvent {
  kind?: string;
  contextId?: string;
  taskId?: string;
  final?: boolean;
  status?: {
    state?: string;
    message?: A2AMessage;
    timestamp?: string;
  };
  metadata?: Record<string, unknown>;
}

interface A2AArtifactUpdateEvent {
  kind?: string;
  contextId?: string;
  taskId?: string;
  lastChunk?: boolean;
  artifact?: {
    artifactId?: string;
    parts?: A2APart[];
  };
}

interface A2AErrorResponse {
  error?: {
    message: string;
  };
}

type A2AStreamEvent = A2AStatusUpdateEvent | A2AArtifactUpdateEvent;

interface AgentRequestContext {
  contextId: string;
  text: string;
  userId: string;
  onProgress?: (text: string) => Promise<void>;
}

interface AgentStreamSnapshot {
  finalReply: string;
  lastAssistantText: string;
  lastProgressText: string;
  state: string;
  toolNames: string[];
}

interface SlackAuthTestResponse {
  ok: boolean;
  error?: string;
  team?: string;
  team_id?: string;
  user?: string;
  user_id?: string;
  bot_id?: string;
  url?: string;
}

function isDebugEnabled(value: string | undefined): boolean {
  if (!value) return false;
  return !["0", "false", "off", "no"].includes(value.toLowerCase());
}

function truncate(text: string, maxLength = 200): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function debugLog(message: string, details?: Record<string, unknown>): void {
  if (!DEBUG_ENABLED) return;

  if (!details) {
    console.log(`[debug] ${message}`);
    return;
  }

  console.log(`[debug] ${message} ${JSON.stringify(details)}`);
}

function buildSlackUserId(userId: string | undefined): string {
  return userId ? `slack:${userId}` : "slack:unknown";
}

function buildContextId(channel: string, threadTs?: string): string {
  if (threadTs) {
    return `slack:${channel}:thread:${threadTs}`;
  }

  return `slack:${channel}:dm`;
}

function getReplyThreadTs(event: { ts: string; thread_ts?: string }): string {
  return event.thread_ts ?? event.ts;
}

function isTextPart(part: A2APart): part is A2ATextPart {
  return part.kind === "text" && "text" in part &&
    typeof part.text === "string";
}

function isDataPart(part: A2APart): part is A2ADataPart {
  return part.kind === "data" && "data" in part &&
    typeof part.data === "object" &&
    part.data !== null;
}

function isErrorResponse(
  event: A2AErrorResponse | A2AStreamEvent,
): event is A2AErrorResponse {
  return "error" in event && typeof event.error?.message === "string";
}

function isStatusUpdateEvent(
  event: A2AErrorResponse | A2AStreamEvent,
): event is A2AStatusUpdateEvent {
  return "kind" in event && event.kind === "status-update";
}

function isArtifactUpdateEvent(
  event: A2AErrorResponse | A2AStreamEvent,
): event is A2AArtifactUpdateEvent {
  return "kind" in event && event.kind === "artifact-update";
}

function extractTextFromParts(parts: A2APart[] | undefined): string {
  if (!parts) return "";

  return parts
    .filter(isTextPart)
    .map((part) => part.text?.trim() ?? "")
    .filter(Boolean)
    .join("\n");
}

function extractToolNames(parts: A2APart[] | undefined): string[] {
  if (!parts) return [];

  return unique(
    parts
      .filter(isDataPart)
      .map((part) => part.data?.name)
      .filter((name): name is string =>
        typeof name === "string" && name.length > 0
      ),
  );
}

function buildProgressMessage(snapshot: AgentStreamSnapshot): string {
  const lines: string[] = [];
  const stateLabel = snapshot.state || "working";

  if (snapshot.toolNames.length > 0) {
    lines.push(
      `Working via ${
        snapshot.toolNames.map((name) => `\`${name}\``).join(", ")
      }.`,
    );
  } else if (stateLabel === "submitted") {
    lines.push("Submitted to the executive assistant.");
  } else {
    lines.push(`State: ${stateLabel}.`);
  }

  if (snapshot.lastAssistantText) {
    lines.push(snapshot.lastAssistantText);
  }

  return truncate(lines.join("\n\n"), 3000);
}

async function* parseSSEStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<A2AStreamEvent | A2AErrorResponse> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      while (true) {
        const separatorIndex = buffer.indexOf("\n\n");
        if (separatorIndex < 0) break;

        const rawEvent = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);

        for (const line of rawEvent.split("\n")) {
          if (!line.startsWith("data: ")) continue;

          const dataString = line.slice(6).trim();
          if (!dataString || dataString === "[DONE]") {
            continue;
          }

          try {
            const payload = JSON.parse(dataString) as {
              result?: A2AStreamEvent;
              error?: { message: string };
            };
            if (payload.result) {
              yield payload.result;
            } else if (payload.error) {
              yield { error: payload.error };
            }
          } catch (error) {
            debugLog("Failed to parse SSE event", {
              error: error instanceof Error ? error.message : String(error),
              data: truncate(dataString, 500),
            });
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function parseScopes(headerValue: string | null): string[] {
  if (!headerValue) return [];
  return headerValue
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
}

async function logSlackConfiguration(): Promise<void> {
  if (!SLACK_BOT_TOKEN) {
    console.error("SLACK_BOT_TOKEN environment variable is required");
    return;
  }

  let response: Response;
  try {
    response = await fetch("https://slack.com/api/auth.test", {
      headers: { Authorization: `Bearer ${SLACK_BOT_TOKEN}` },
    });
  } catch (error) {
    console.error("Slack auth.test request failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  let payload: SlackAuthTestResponse;
  try {
    payload = await response.json();
  } catch {
    console.error("Slack auth.test returned invalid JSON");
    return;
  }

  const scopes = parseScopes(response.headers.get("x-oauth-scopes"));
  if (!payload.ok) {
    console.error("Slack auth.test failed", {
      error: payload.error ?? "unknown_error",
      scopes,
    });
    return;
  }

  console.log("Slack auth ok", {
    team: payload.team ?? null,
    teamId: payload.team_id ?? null,
    user: payload.user ?? null,
    userId: payload.user_id ?? null,
    botId: payload.bot_id ?? null,
    scopes,
  });

  const missingScopes = REQUIRED_BOT_SCOPES.filter((scope) =>
    !scopes.includes(scope)
  );
  if (missingScopes.length > 0) {
    console.error(
      "Slack bot token is missing required scopes for mentions/DMs",
      {
        currentScopes: scopes,
        missingScopes,
      },
    );
  }
}

async function sendToAgent(
  { contextId, onProgress, text, userId }: AgentRequestContext,
): Promise<string> {
  const requestId = crypto.randomUUID();
  debugLog("Sending request to Kagent", {
    contextId,
    requestId,
    text: truncate(text),
    userId,
  });

  let response: Response;
  try {
    response = await fetch(KAGENT_A2A_URL, {
      method: "POST",
      headers: {
        Accept: "text/event-stream",
        "Content-Type": "application/json",
        "X-User-ID": userId,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: requestId,
        method: "message/stream",
        params: {
          message: {
            contextId,
            kind: "message",
            messageId: crypto.randomUUID(),
            role: "user",
            parts: [{ kind: "text", text }],
          },
        },
      }),
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    debugLog("Failed to reach Kagent", { requestId, error });
    return `Failed to reach agent: ${error}`;
  }

  debugLog("Kagent HTTP response received", {
    requestId,
    status: response.status,
    statusText: response.statusText,
  });

  if (!response.ok) {
    return `Agent returned HTTP ${response.status}: ${response.statusText}`;
  }

  if (!response.body) {
    return "Agent returned an empty response body.";
  }

  const snapshot: AgentStreamSnapshot = {
    finalReply: "",
    lastAssistantText: "",
    lastProgressText: "",
    state: "submitted",
    toolNames: [],
  };

  for await (const event of parseSSEStream(response.body)) {
    if (isErrorResponse(event)) {
      const errorMessage = event.error?.message ?? "Unknown agent error";
      debugLog("Kagent returned an application error", {
        requestId,
        error: errorMessage,
      });
      return `Agent error: ${errorMessage}`;
    }

    debugLog("Received Kagent stream event", {
      kind: "kind" in event ? event.kind ?? null : null,
      requestId,
      state: isStatusUpdateEvent(event) ? event.status?.state ?? null : null,
      taskId: "taskId" in event ? event.taskId ?? null : null,
    });

    if (isStatusUpdateEvent(event)) {
      snapshot.state = event.status?.state ?? snapshot.state;

      const statusText = extractTextFromParts(event.status?.message?.parts);
      if (statusText) {
        snapshot.lastAssistantText = statusText;
      }

      snapshot.toolNames = unique([
        ...snapshot.toolNames,
        ...extractToolNames(event.status?.message?.parts),
      ]);
    }

    if (isArtifactUpdateEvent(event)) {
      const artifactText = extractTextFromParts(event.artifact?.parts);
      if (artifactText) {
        snapshot.finalReply = artifactText;
      }

      snapshot.toolNames = unique([
        ...snapshot.toolNames,
        ...extractToolNames(event.artifact?.parts),
      ]);
    }

    const progressMessage = buildProgressMessage(snapshot);
    if (
      onProgress && progressMessage &&
      progressMessage !== snapshot.lastProgressText && !snapshot.finalReply
    ) {
      snapshot.lastProgressText = progressMessage;
      await onProgress(progressMessage);
    }
  }

  const reply = snapshot.finalReply ||
    snapshot.lastAssistantText ||
    (snapshot.state === "failed"
      ? "The agent failed to complete the request."
      : "No response from agent.");

  debugLog("Kagent reply ready", {
    requestId,
    reply: truncate(reply),
    state: snapshot.state,
    toolNames: snapshot.toolNames,
  });

  return reply;
}

app.use(async ({ body, next }) => {
  debugLog("Received Slack envelope", {
    type: typeof body === "object" && body !== null && "type" in body
      ? body.type
      : null,
    eventType: typeof body === "object" &&
        body !== null &&
        "event" in body &&
        typeof body.event === "object" &&
        body.event !== null &&
        "type" in body.event
      ? body.event.type
      : null,
  });
  await next();
});

app.event(
  "app_mention",
  async ({ event, say }: SlackEventMiddlewareArgs<"app_mention">) => {
    const text = event.text.replace(/<@[A-Z0-9]+>/g, "").trim();
    const threadTs = getReplyThreadTs(event);
    const userId = buildSlackUserId(event.user);
    const contextId = buildContextId(event.channel, threadTs);
    debugLog("Received Slack app mention", {
      channel: event.channel,
      contextId,
      threadTs: event.thread_ts ?? null,
      ts: event.ts,
      user: event.user,
      text: truncate(text),
    });

    if (!text) {
      await say({ text: "Hey! How can I help?", thread_ts: threadTs });
      debugLog("Sent empty app mention prompt", {
        channel: event.channel,
        threadTs,
      });
      return;
    }

    const progress = await say({
      text: "Submitted to the executive assistant.",
      thread_ts: threadTs,
    });
    const reply = await sendToAgent({
      contextId,
      onProgress: async (progressText) => {
        if (!progress.ts) return;
        await app.client.chat.update({
          channel: event.channel,
          text: progressText,
          ts: progress.ts,
        });
      },
      text,
      userId,
    });

    if (progress.ts) {
      await app.client.chat.update({
        channel: event.channel,
        text: truncate(reply, 3000),
        ts: progress.ts,
      });
    } else {
      await say({ text: reply, thread_ts: threadTs });
    }

    debugLog("Sent Slack reply for app mention", {
      channel: event.channel,
      contextId,
      threadTs,
      reply: truncate(reply),
    });
  },
);

app.event(
  "message",
  async ({ event, say }: SlackEventMiddlewareArgs<"message">) => {
    if (event.channel_type !== "im") {
      debugLog("Ignored non-DM Slack message", {
        channel: event.channel,
        channelType: event.channel_type,
        ts: event.ts,
      });
      return;
    }

    if ("bot_id" in event) {
      debugLog("Ignored bot-authored Slack DM", {
        botId: event.bot_id,
        channel: event.channel,
        ts: event.ts,
      });
      return;
    }

    const text = "text" in event ? (event.text ?? "") : "";
    const userId = buildSlackUserId("user" in event ? event.user : undefined);
    const contextId = buildContextId(event.channel);
    debugLog("Received Slack DM", {
      channel: event.channel,
      contextId,
      ts: event.ts,
      user: "user" in event ? event.user : null,
      text: truncate(text),
    });

    if (!text) {
      debugLog("Ignored empty Slack DM", {
        channel: event.channel,
        ts: event.ts,
      });
      return;
    }

    const progress = await say({
      text: "Submitted to the executive assistant.",
    });
    const reply = await sendToAgent({
      contextId,
      onProgress: async (progressText) => {
        if (!progress.ts) return;
        await app.client.chat.update({
          channel: event.channel,
          text: progressText,
          ts: progress.ts,
        });
      },
      text,
      userId,
    });

    if (progress.ts) {
      await app.client.chat.update({
        channel: event.channel,
        text: truncate(reply, 3000),
        ts: progress.ts,
      });
    } else {
      await say({ text: reply });
    }

    debugLog("Sent Slack reply for DM", {
      channel: event.channel,
      contextId,
      reply: truncate(reply),
    });
  },
);

app.error(async (error) => {
  console.error("Slack app error", error);
});

await logSlackConfiguration();
await app.start();
debugLog("Debug logging enabled", {
  kagentA2AUrl: KAGENT_A2A_URL,
  socketMode: true,
});
console.log("Rocko is running");

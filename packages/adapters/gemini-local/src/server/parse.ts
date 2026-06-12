import { asNumber, asString, parseJson, parseObject } from "@paperclipai/adapter-utils/server-utils";

// --- Message collection ---

function collectMessageText(message: unknown): string[] {
  if (typeof message === "string") {
    const trimmed = message.trim();
    return trimmed ? [trimmed] : [];
  }

  const record = parseObject(message);
  const direct = asString(record.text, "").trim();
  const lines: string[] = direct ? [direct] : [];

  for (const partRaw of Array.isArray(record.content) ? record.content : []) {
    const part = parseObject(partRaw);
    const type = asString(part.type, "").trim();
    if (type === "output_text" || type === "text" || type === "content") {
      const text = asString(part.text, "").trim() || asString(part.content, "").trim();
      if (text) lines.push(text);
    }
  }

  return lines;
}

function extractQuestionFromMessage(message: unknown): { prompt: string; choices: Array<{ key: string; label: string; description?: string }> } | null {
  const messageObj = parseObject(message);
  const content = Array.isArray(messageObj.content) ? messageObj.content : [];

  for (const partRaw of content) {
    const part = parseObject(partRaw);
    if (asString(part.type, "").trim() === "question") {
      return {
        prompt: asString(part.prompt, "").trim(),
        choices: (Array.isArray(part.choices) ? part.choices : []).map((c) => {
          const choice = parseObject(c);
          return {
            key: asString(choice.key, "").trim(),
            label: asString(choice.label, "").trim(),
            description: asString(choice.description, "").trim() || undefined,
          };
        }),
      };
    }
  }
  return null;
}

// --- Session ID ---

const SESSION_ID_KEYS = ["session_id", "sessionId", "sessionID", "checkpoint_id", "thread_id"] as const;

function readSessionId(event: Record<string, unknown>): string | null {
  for (const key of SESSION_ID_KEYS) {
    const value = asString(event[key], "").trim();
    if (value) return value;
  }
  return null;
}

// --- Error handling ---

function asErrorText(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  const rec = parseObject(value);
  const message = asString(rec.message, "") || asString(rec.error, "") || asString(rec.code, "") || asString(rec.detail, "");
  if (message) return message;
  try {
    const stringified = JSON.stringify(rec);
    return stringified === "{}" ? "" : stringified;
  } catch {
    return "";
  }
}

function extractErrorMessages(parsed: Record<string, unknown>): string[] {
  const messages: string[] = [];
  const errorMsg = asString(parsed.error, "").trim();
  if (errorMsg) messages.push(errorMsg);

  for (const entry of Array.isArray(parsed.errors) ? parsed.errors : []) {
    if (typeof entry === "string") {
      const msg = entry.trim();
      if (msg) messages.push(msg);
      continue;
    }
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue;
    const obj = entry as Record<string, unknown>;
    const msg = asString(obj.message, "") || asString(obj.error, "") || asString(obj.code, "");
    if (msg) {
      messages.push(msg);
      continue;
    }
    try {
      messages.push(JSON.stringify(obj));
    } catch {
      // skip non-serializable entry
    }
  }

  return messages;
}

// --- Usage accumulation ---

function accumulateUsage(
  target: { inputTokens: number; cachedInputTokens: number; outputTokens: number },
  usageRaw: unknown,
) {
  const usage = parseObject(usageRaw);
  const usageMetadata = parseObject(usage.usageMetadata);
  const source = Object.keys(usageMetadata).length > 0 ? usageMetadata : usage;

  target.inputTokens += asNumber(source.input_tokens, asNumber(source.inputTokens, asNumber(source.promptTokenCount, 0)));
  target.cachedInputTokens += asNumber(source.cached_input_tokens, asNumber(source.cachedInputTokens, asNumber(source.cachedContentTokenCount, asNumber(source.cached, 0))));
  target.outputTokens += asNumber(source.output_tokens, asNumber(source.outputTokens, asNumber(source.candidatesTokenCount, 0)));
}

// --- Cost extraction ---

function extractCostUsd(event: Record<string, unknown>, previous: number | null): number | null {
  return asNumber(event.total_cost_usd, asNumber(event.cost_usd, asNumber(event.cost, previous ?? 0))) ?? previous;
}

// --- Main JSONL parser ---

export function parseGeminiJsonl(stdout: string) {
  let sessionId: string | null = null;
  const messages: string[] = [];
  let errorMessage: string | null = null;
  let costUsd: number | null = null;
  let resultEvent: Record<string, unknown> | null = null;
  let question: { prompt: string; choices: Array<{ key: string; label: string; description?: string }> } | null = null;
  const usage = { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 };

  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const event = parseJson(line);
    if (!event) continue;

    const foundSessionId = readSessionId(event);
    if (foundSessionId) sessionId = foundSessionId;

    const type = asString(event.type, "").trim();

    switch (type) {
      case "assistant": {
        messages.push(...collectMessageText(event.message));
        question = extractQuestionFromMessage(event.message);
        break;
      }

      case "message": {
        const role = asString(event.role, "").trim().toLowerCase();
        if (role === "assistant") {
          messages.push(...collectMessageText(event.content));
        }
        break;
      }

      case "result": {
        resultEvent = event;
        accumulateUsage(usage, event.usage ?? event.usageMetadata ?? event.stats);
        const resultText = asString(event.result, "").trim() || asString(event.text, "").trim() || asString(event.response, "").trim();
        if (resultText && messages.length === 0) messages.push(resultText);
        costUsd = extractCostUsd(event, costUsd);

        const status = asString(event.status, "").toLowerCase();
        const isError = event.is_error === true || asString(event.subtype, "").toLowerCase() === "error" || status === "error" || status === "failed";
        if (isError) {
          const text = asErrorText(event.error ?? event.message ?? event.result).trim();
          if (text) errorMessage = text;
        }
        break;
      }

      case "error": {
        const text = asErrorText(event.error ?? event.message ?? event.detail).trim();
        if (text) errorMessage = text;
        break;
      }

      case "system": {
        const subtype = asString(event.subtype, "").trim().toLowerCase();
        if (subtype === "error") {
          const text = asErrorText(event.error ?? event.message ?? event.detail).trim();
          if (text) errorMessage = text;
        }
        break;
      }

      case "text": {
        const text = asString(parseObject(event.part).text, "").trim();
        if (text) messages.push(text);
        break;
      }

      default: {
        if (type === "step_finish" || event.usage || event.usageMetadata) {
          accumulateUsage(usage, event.usage ?? event.usageMetadata);
          costUsd = extractCostUsd(event, costUsd);
        }
        break;
      }
    }
  }

  return {
    sessionId,
    summary: messages.join("\n\n").trim() || stdout.trim(),
    usage,
    costUsd,
    errorMessage,
    resultEvent,
    question,
  };
}

// --- Session error detection ---

const UNKNOWN_SESSION_RE = /unknown\s+session|session\s+(?:.*\s+)?not\s+found|resume\s+(?:.*\s+)?not\s+found|checkpoint\s+(?:.*\s+)?not\s+found|cannot\s+resume|failed\s+to\s+resume/i;

export function isGeminiUnknownSessionError(stdout: string, stderr: string): boolean {
  const haystack = `${stdout}\n${stderr}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");

  return UNKNOWN_SESSION_RE.test(haystack);
}

// --- Failure description ---

export function describeGeminiFailure(parsed: Record<string, unknown>): string | null {
  const status = asString(parsed.status, "");
  const errors = extractErrorMessages(parsed);
  const detail = errors[0] ?? "";
  const parts = ["Gemini run failed"];
  if (status) parts.push(`status=${status}`);
  if (detail) parts.push(detail);
  return parts.length > 1 ? parts.join(": ") : null;
}

// --- Auth and quota detection ---

const AUTH_REQUIRED_RE = /(?:not\s+authenticated|please\s+authenticate|api[_ ]?key\s+(?:required|missing|invalid)|authentication\s+required|unauthorized|invalid\s+credentials|not\s+logged\s+in|login\s+required|run\s+`?gemini\s+auth(?:\s+login)?`?\s+first)/i;
const QUOTA_EXHAUSTED_RE = /(?:resource_exhausted|quota|rate[-\s]?limit|too many requests|\b429\b|billing details)/i;
const REFRESH_DATE_RE = /refresh on ([a-zA-Z0-9/:\s,]+(?:AM|PM|am|pm)?)/i;
const REFRESH_RELATIVE_RE = /resets in (?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/i;

function gatherInputLines(input: { parsed: Record<string, unknown> | null; stdout: string; stderr: string }): string[] {
  return [...extractErrorMessages(input.parsed ?? {}), input.stdout, input.stderr]
    .join("\n")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function detectGeminiAuthRequired(input: {
  parsed: Record<string, unknown> | null;
  stdout: string;
  stderr: string;
}): { requiresAuth: boolean } {
  const lines = gatherInputLines(input);
  return { requiresAuth: lines.some((line) => AUTH_REQUIRED_RE.test(line)) };
}

export function detectGeminiQuotaExhausted(input: {
  parsed: Record<string, unknown> | null;
  stdout: string;
  stderr: string;
}): { exhausted: boolean; refreshAt?: Date } {
  const lines = gatherInputLines(input);
  let exhausted = false;
  let refreshAt: Date | undefined;

  for (const line of lines) {
    if (QUOTA_EXHAUSTED_RE.test(line)) {
      exhausted = true;
    }

    // Absolute date: "refresh on 5/30/2026, 8:38:38 PM"
    const dateMatch = line.match(REFRESH_DATE_RE);
    if (dateMatch) {
      const parsedDate = new Date(dateMatch[1]);
      if (!isNaN(parsedDate.getTime())) {
        refreshAt = parsedDate;
      }
    }

    // Relative time: "resets in 27m57s"
    const relativeMatch = line.match(REFRESH_RELATIVE_RE);
    if (relativeMatch && (relativeMatch[1] || relativeMatch[2] || relativeMatch[3])) {
      const hours = parseInt(relativeMatch[1] || "0", 10);
      const minutes = parseInt(relativeMatch[2] || "0", 10);
      const seconds = parseInt(relativeMatch[3] || "0", 10);
      const ms = (hours * 3600 + minutes * 60 + seconds) * 1000;
      if (ms > 0) {
        refreshAt = new Date(Date.now() + ms);
      }
    }
  }

  return { exhausted, refreshAt };
}

// --- Turn limit detection ---

const TURN_LIMIT_REASONS = new Set(["turn_limit", "max_turns", "max_turns_exhausted", "turn_limit_exhausted"]);

export function isGeminiTurnLimitResult(
  parsed: Record<string, unknown> | null | undefined,
  exitCode?: number | null,
): boolean {
  if (exitCode === 53) return true;
  if (!parsed) return false;

  const stopReasons = [parsed.status, parsed.stopReason, parsed.stop_reason, parsed.errorCode, parsed.error_code]
    .map((value) => asString(value, "").trim().toLowerCase());

  return stopReasons.some((reason) => TURN_LIMIT_REASONS.has(reason));
}

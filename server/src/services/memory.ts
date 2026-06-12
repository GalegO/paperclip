import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

export interface MemoryEntry {
  uuid: string;
  timestamp: string;
  content: string;
}

export interface MemoryFile {
  prefix: string;
  entries: MemoryEntry[];
}

const ENTRY_DELIMITER = "§";
const ENTRY_REGEX = /§([^§\r\n]+)§\r?\n\[([^\]]+)\]\r?\n([\s\S]*?)\r?\n§/g;

const MEMORY_DIR_ENV = "PAPERCLIP_MEMORIES_DIR";
const DEFAULT_MEMORY_DIR = path.join(os.homedir(), ".pi", "memories");

export function parseMemoryFile(content: string): MemoryFile {
  const entries: MemoryEntry[] = [];
  const firstDelim = content.indexOf(ENTRY_DELIMITER);
  const prefix = firstDelim !== -1 ? content.slice(0, firstDelim).trim() : content.trim();

  ENTRY_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ENTRY_REGEX.exec(content)) !== null) {
    entries.push({ uuid: match[1]!, timestamp: match[2]!, content: match[3]!.trim() });
  }
  return { prefix, entries };
}

export function serializeMemoryFile(prefix: string, entries: MemoryEntry[]): string {
  const header = prefix ? `${prefix}\n\n` : "";
  const body = entries
    .map((e) => `${ENTRY_DELIMITER}${e.uuid}${ENTRY_DELIMITER}\n[${e.timestamp}]\n${e.content}\n${ENTRY_DELIMITER}`)
    .join("\n\n");
  return `${header}${body}\n`;
}

async function acquireLock(lockPath: string, timeoutMs = 5000, retryMs = 100): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const fd = await fs.open(lockPath, "wx");
      await fd.close();
      return true;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
    }
    await new Promise((r) => setTimeout(r, retryMs));
  }
  return false;
}

async function releaseLock(lockPath: string): Promise<void> {
  try {
    await fs.unlink(lockPath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

const TARGET_FILE_MAP: Record<string, (id: string | undefined) => string | null> = {
  global: () => "GLOBAL.md",
  company: (id) => id ? `COMPANY_${id}.md` : null,
  project: (id) => id ? `PROJECT_${id}.md` : null,
  agent: (id) => id ? `AGENT_${id}.md` : null,
};

export function resolveMemoryFilePath(target: string, ids: Record<string, string | undefined>): string {
  const memoryDir = process.env[MEMORY_DIR_ENV] || DEFAULT_MEMORY_DIR;
  const fileName = TARGET_FILE_MAP[target]?.(ids[target]);
  if (!fileName) throw new Error(`${target} memory target requires ${target}Id`);
  return path.join(memoryDir, fileName);
}

function formatTimestamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

export async function readMemoryFile(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    return "";
  }
}

async function writeMemoryFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

export interface MemoryActionInput {
  action: "add" | "replace" | "remove";
  target: "global" | "company" | "project" | "agent";
  content?: string;
  old_text?: string;
  ids: Record<string, string | undefined>;
}

export async function executeMemoryAction(input: MemoryActionInput): Promise<{ text: string }> {
  const filePath = resolveMemoryFilePath(input.target, input.ids);
  const lockFilePath = `${filePath}.lock`;

  const isTestEnv = !!process.env[MEMORY_DIR_ENV];
  const lockAcquired = await acquireLock(lockFilePath, isTestEnv ? 500 : 5000, isTestEnv ? 50 : 100);
  if (!lockAcquired) throw new Error(`Could not acquire lock on memory file ${filePath} within timeout.`);

  try {
    const rawContent = await readMemoryFile(filePath);
    const { prefix, entries } = parseMemoryFile(rawContent);

    if (input.action === "add") {
      if (!input.content) throw new Error("content is required for action: add");
      const entry: MemoryEntry = {
        uuid: crypto.randomUUID(),
        timestamp: formatTimestamp(),
        content: input.content.trim(),
      };
      entries.push(entry);
      await writeMemoryFile(filePath, serializeMemoryFile(prefix, entries));
      return { text: `Successfully added memory to ${input.target} (UUID: ${entry.uuid}).` };
    }

    if (input.action === "replace") {
      if (!input.old_text) throw new Error("old_text is required for action: replace");
      if (!input.content) throw new Error("content is required for action: replace");
      const idx = entries.findIndex((e) => e.content.toLowerCase().includes(input.old_text!.toLowerCase()));
      if (idx === -1) throw new Error(`No memory entry in ${input.target} matched: "${input.old_text}".`);
      entries[idx]!.content = input.content.trim();
      entries[idx]!.timestamp = formatTimestamp();
      await writeMemoryFile(filePath, serializeMemoryFile(prefix, entries));
      return { text: `Successfully updated memory in ${input.target} (UUID: ${entries[idx]!.uuid}).` };
    }

    if (input.action === "remove") {
      if (!input.old_text) throw new Error("old_text is required for action: remove");
      const idx = entries.findIndex((e) => e.content.toLowerCase().includes(input.old_text!.toLowerCase()));
      if (idx === -1) throw new Error(`No memory entry in ${input.target} matched: "${input.old_text}".`);
      const removedUuid = entries[idx]!.uuid;
      entries.splice(idx, 1);
      await writeMemoryFile(filePath, serializeMemoryFile(prefix, entries));
      return { text: `Successfully removed memory from ${input.target} (UUID: ${removedUuid}).` };
    }

    throw new Error(`Unsupported action: ${input.action}`);
  } finally {
    await releaseLock(lockFilePath);
  }
}

export async function loadMemoryForPrompt(target: string, ids: Record<string, string | undefined>): Promise<MemoryFile | null> {
  try {
    const filePath = resolveMemoryFilePath(target, ids);
    const raw = await readMemoryFile(filePath);
    if (!raw.trim()) return null;
    return parseMemoryFile(raw);
  } catch {
    return null;
  }
}

export function formatMemoryAsPrompt(level: string, memory: MemoryFile): string {
  const levelLabels: Record<string, string> = {
    global: "L4 Global Memory",
    company: "L3 Company Memory",
    project: "L2 Project Memory",
    agent: "L1 Agent Personal Memory",
  };
  const label = levelLabels[level] || `${level} Memory`;
  let output = `\n--- ${label} ---\n`;
  if (memory.prefix) output += `${memory.prefix}\n\n`;
  for (const entry of memory.entries) {
    output += `[${entry.timestamp}] ${entry.content}\n`;
  }
  return output;
}

export async function buildMemoryPromptBlock(ids: Record<string, string | undefined>): Promise<string> {
  const sections: string[] = [];
  for (const level of ["global", "company", "project", "agent"] as const) {
    const memory = await loadMemoryForPrompt(level, ids);
    if (memory && memory.entries.length > 0) {
      sections.push(formatMemoryAsPrompt(level, memory));
    }
  }
  if (sections.length === 0) return "";
  return `\n## Persistent Memory (read-only, injected at session start)\n${sections.join("")}`;
}

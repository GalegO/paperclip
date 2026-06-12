import { beforeEach, afterEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  executeMemoryAction,
  parseMemoryFile,
  serializeMemoryFile,
  loadMemoryForPrompt,
  formatMemoryAsPrompt,
  buildMemoryPromptBlock,
} from "./memory.js";

describe("memory service", () => {
  let tempDir: string;
  const ids = {
    global: undefined,
    company: "company-123",
    project: "project-789",
    agent: "agent-456",
  };

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-memory-test-"));
    process.env.PAPERCLIP_MEMORIES_DIR = tempDir;
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
    delete process.env.PAPERCLIP_MEMORIES_DIR;
  });

  describe("parser and serializer", () => {
    it("parses empty content", () => {
      const parsed = parseMemoryFile("");
      expect(parsed.prefix).toBe("");
      expect(parsed.entries).toEqual([]);
    });

    it("parses prefix with no entries", () => {
      const parsed = parseMemoryFile("# Preferences\nAlways use tabs.");
      expect(parsed.prefix).toBe("# Preferences\nAlways use tabs.");
      expect(parsed.entries).toEqual([]);
    });

    it("parses multiple entries", () => {
      const raw = `# Manual Prefix

§uuid-1§
[2026-05-30 01:00:00]
Note 1 content
§

§uuid-2§
[2026-05-30 01:05:00]
Note 2 content
§
`;
      const parsed = parseMemoryFile(raw);
      expect(parsed.prefix).toBe("# Manual Prefix");
      expect(parsed.entries).toHaveLength(2);
      expect(parsed.entries[0]).toEqual({ uuid: "uuid-1", timestamp: "2026-05-30 01:00:00", content: "Note 1 content" });
      expect(parsed.entries[1]).toEqual({ uuid: "uuid-2", timestamp: "2026-05-30 01:05:00", content: "Note 2 content" });
    });

    it("round-trips parse → serialize", () => {
      const prefix = "# Prefix";
      const entries = [{ uuid: "uuid-123", timestamp: "2026-05-30 01:00:00", content: "Some content" }];
      const serialized = serializeMemoryFile(prefix, entries);
      expect(serialized).toBe("# Prefix\n\n§uuid-123§\n[2026-05-30 01:00:00]\nSome content\n§\n");
    });
  });

  describe("executeMemoryAction", () => {
    it("adds memory to global", async () => {
      const res = await executeMemoryAction({ action: "add", target: "global", content: "Favorite color is green.", ids });
      expect(res.text).toContain("Successfully added memory");
      const parsed = parseMemoryFile(await fs.readFile(path.join(tempDir, "GLOBAL.md"), "utf8"));
      expect(parsed.entries).toHaveLength(1);
      expect(parsed.entries[0]?.content).toBe("Favorite color is green.");
    });

    it("adds memory to project", async () => {
      await executeMemoryAction({ action: "add", target: "project", content: "Use vitest.", ids });
      const parsed = parseMemoryFile(await fs.readFile(path.join(tempDir, "PROJECT_project-789.md"), "utf8"));
      expect(parsed.entries[0]?.content).toBe("Use vitest.");
    });

    it("replaces memory by substring", async () => {
      await executeMemoryAction({ action: "add", target: "agent", content: "Draft CSS note.", ids });
      const res = await executeMemoryAction({ action: "replace", target: "agent", old_text: "css", content: "Updated CSS guide.", ids });
      expect(res.text).toContain("Successfully updated memory");
      const parsed = parseMemoryFile(await fs.readFile(path.join(tempDir, "AGENT_agent-456.md"), "utf8"));
      expect(parsed.entries[0]?.content).toBe("Updated CSS guide.");
    });

    it("removes memory by substring", async () => {
      await executeMemoryAction({ action: "add", target: "company", content: "Company policy note.", ids });
      const res = await executeMemoryAction({ action: "remove", target: "company", old_text: "policy note", ids });
      expect(res.text).toContain("Successfully removed memory");
      const parsed = parseMemoryFile(await fs.readFile(path.join(tempDir, "COMPANY_company-123.md"), "utf8"));
      expect(parsed.entries).toHaveLength(0);
    });

    it("throws when replacing non-existent memory", async () => {
      await expect(
        executeMemoryAction({ action: "replace", target: "global", old_text: "nothing", content: "new", ids })
      ).rejects.toThrow("No memory entry in global matched");
    });
  });

  describe("locking", () => {
    it("fails when lock is held", async () => {
      const lockPath = path.join(tempDir, "GLOBAL.md.lock");
      await fs.mkdir(tempDir, { recursive: true });
      await fs.writeFile(lockPath, "locked", "utf8");
      await expect(
        executeMemoryAction({ action: "add", target: "global", content: "Should fail", ids })
      ).rejects.toThrow("Could not acquire lock");
    });
  });

  describe("prompt injection", () => {
    it("returns null when no memory file exists", async () => {
      const memory = await loadMemoryForPrompt("global", ids);
      expect(memory).toBeNull();
    });

    it("loads and formats existing memory", async () => {
      await executeMemoryAction({ action: "add", target: "global", content: "User prefers tabs.", ids });
      const memory = await loadMemoryForPrompt("global", ids);
      expect(memory).not.toBeNull();
      expect(memory!.entries).toHaveLength(1);
      const formatted = formatMemoryAsPrompt("global", memory!);
      expect(formatted).toContain("L4 Global Memory");
      expect(formatted).toContain("User prefers tabs.");
    });

    it("builds full memory prompt block with all levels", async () => {
      await executeMemoryAction({ action: "add", target: "global", content: "Global fact.", ids });
      await executeMemoryAction({ action: "add", target: "company", content: "Company fact.", ids });
      await executeMemoryAction({ action: "add", target: "project", content: "Project fact.", ids });
      await executeMemoryAction({ action: "add", target: "agent", content: "Agent fact.", ids });

      const block = await buildMemoryPromptBlock(ids);
      expect(block).toContain("Persistent Memory");
      expect(block).toContain("L4 Global Memory");
      expect(block).toContain("L3 Company Memory");
      expect(block).toContain("L2 Project Memory");
      expect(block).toContain("L1 Agent Personal Memory");
      expect(block).toContain("Global fact.");
      expect(block).toContain("Company fact.");
      expect(block).toContain("Project fact.");
      expect(block).toContain("Agent fact.");
    });

    it("returns empty string when no memories exist", async () => {
      const block = await buildMemoryPromptBlock(ids);
      expect(block).toBe("");
    });
  });
});

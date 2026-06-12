import { describe, expect, it, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { createTestHarness } from "@paperclipai/plugin-sdk/testing";
import manifest from "../src/manifest.js";
import plugin from "../src/worker.js";

const tempRoots: string[] = [];

describe("governance file harness plugin", () => {
  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(tempRoots.map((root) => fs.rm(root, { recursive: true, force: true })));
    tempRoots.length = 0;
  });

  it("writes artifact to disk and upserts into database when path and document key are valid", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-gov-test-"));
    tempRoots.push(rootDir);

    const spyCwd = vi.spyOn(process, "cwd").mockReturnValue(rootDir);

    const harness = createTestHarness({
      manifest,
      capabilities: [...manifest.capabilities]
    });

    const mockIssue = {
      id: "issue-uuid-1",
      companyId: "company-uuid-1",
      projectId: "project-uuid-1",
      projectWorkspaceId: null,
      goalId: null,
      parentId: null,
      description: null,
      identifier: "ARQ-1",
      title: "Hiring test",
      status: "todo" as const,
      workMode: "standard" as const,
      priority: "medium" as const,
      assigneeAgentId: null,
      assigneeUserId: null,
      checkoutRunId: null,
      executionRunId: null,
      executionAgentNameKey: null,
      executionLockedAt: null,
      createdByAgentId: null,
      createdByUserId: null,
      issueNumber: 1,
      requestDepth: 0,
      billingCode: null,
      assigneeAdapterOverrides: null,
      executionWorkspaceId: null,
      executionWorkspacePreference: null,
      executionWorkspaceSettings: null,
      startedAt: null,
      completedAt: null,
      cancelledAt: null,
      hiddenAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    harness.seed({
      issues: [mockIssue]
    });

    await plugin.definition.setup(harness.ctx);

    const params = {
      filePath: "Docs/Issues/ARQ-1-HIRING/proposal.md",
      content: "# Proposal content"
    };

    const runCtx = {
      agentId: "agent-uuid-1",
      runId: "run-uuid-1",
      companyId: "company-uuid-1",
      projectId: "project-uuid-1"
    };

    const result = await harness.executeTool("write_ticket_artifact", params, runCtx);
    expect(result.error).toBeUndefined();
    expect(result.content).toContain("Sucesso: Artefato salvo em");

    // Check disk
    const diskPath = path.join(rootDir, "Docs/Issues/ARQ-1-HIRING/proposal.md");
    const diskContent = await fs.readFile(diskPath, "utf8");
    expect(diskContent).toBe("# Proposal content");

    // Check database mock
    const dbDoc = await harness.ctx.issues.documents.get("issue-uuid-1", "proposal", "company-uuid-1");
    expect(dbDoc).not.toBeNull();
    expect(dbDoc?.body).toBe("# Proposal content");
    expect(dbDoc?.title).toBe("Proposal");
  });

  it("rejects file write when path is not in allowed directory", async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-gov-test-"));
    tempRoots.push(rootDir);

    const spyCwd = vi.spyOn(process, "cwd").mockReturnValue(rootDir);

    const harness = createTestHarness({ manifest });
    await plugin.definition.setup(harness.ctx);

    const params = {
      filePath: "outside-dir/proposal.md",
      content: "# Proposal content"
    };

    const runCtx = {
      agentId: "agent-uuid-1",
      runId: "run-uuid-1",
      companyId: "company-uuid-1",
      projectId: "project-uuid-1"
    };

    await expect(harness.executeTool("write_ticket_artifact", params, runCtx))
      .rejects.toThrow("Erro de Governança");
  });
});

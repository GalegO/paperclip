import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const mockGet = vi.fn().mockResolvedValue({ prefix: "", entries: [] });

vi.mock("./client.js", () => ({
  api: { get: mockGet },
}));

describe("memories API client", () => {
  beforeEach(() => {
    vi.resetModules();
    mockGet.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports memoriesApi with getMemories function", async () => {
    const { memoriesApi } = await import("./memories.js");
    expect(memoriesApi).toBeDefined();
    expect(memoriesApi.getMemories).toBeDefined();
    expect(typeof memoriesApi.getMemories).toBe("function");
  });

  it("builds correct query params for global target", async () => {
    const { memoriesApi } = await import("./memories.js");
    await memoriesApi.getMemories({ target: "global" });
    expect(mockGet).toHaveBeenCalledWith("/memories?target=global");
  });

  it("builds correct query params for company target with companyId", async () => {
    const { memoriesApi } = await import("./memories.js");
    await memoriesApi.getMemories({ target: "company", companyId: "test-company" });
    expect(mockGet).toHaveBeenCalledWith("/memories?target=company&companyId=test-company");
  });

  it("builds correct query params for project target with projectId", async () => {
    const { memoriesApi } = await import("./memories.js");
    await memoriesApi.getMemories({ target: "project", projectId: "test-project" });
    expect(mockGet).toHaveBeenCalledWith("/memories?target=project&projectId=test-project");
  });

  it("builds correct query params for agent target with agentId", async () => {
    const { memoriesApi } = await import("./memories.js");
    await memoriesApi.getMemories({ target: "agent", agentId: "test-agent" });
    expect(mockGet).toHaveBeenCalledWith("/memories?target=agent&agentId=test-agent");
  });
});

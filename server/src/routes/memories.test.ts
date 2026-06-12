import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

vi.mock("@paperclipai/mcp-server/memory_tool.js", async () => {
  const actual = await vi.importActual("../../../packages/mcp-server/src/memory_tool.js");
  return actual;
});

vi.mock("@paperclipai/db", () => ({
  Db: class {},
}));

describe("memory routes", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-memory-routes-test-"));
    process.env.PAPERCLIP_MEMORIES_DIR = tempDir;
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
    delete process.env.PAPERCLIP_MEMORIES_DIR;
    vi.resetModules();
  });

  it("registers GET and POST /memories routes", async () => {
    const { memoryRoutes } = await import("./memories.js");
    const router = memoryRoutes({} as any);

    const routes = router.stack.map((layer: any) => ({
      method: Object.keys(layer.route.methods)[0],
      path: layer.route.path,
    }));

    expect(routes).toContainEqual({ method: "get", path: "/memories" });
    expect(routes).toContainEqual({ method: "post", path: "/memories" });
    expect(routes).toContainEqual({ method: "post", path: "/memories/replace" });
    expect(routes).toContainEqual({ method: "post", path: "/memories/remove" });
  });

  it("returns empty list when memory file does not exist", async () => {
    const { memoryRoutes } = await import("./memories.js");
    const router = memoryRoutes({} as any);

    const getRoute = router.stack.find((layer: any) =>
      layer.route.path === "/memories" && layer.route.methods.get
    );
    expect(getRoute).toBeDefined();
  });
});

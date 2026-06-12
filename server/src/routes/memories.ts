import { Router } from "express";
import { z } from "zod";
import { executeMemoryAction, parseMemoryFile, resolveMemoryFilePath, readMemoryFile } from "../services/memory.js";
import type { Db } from "@paperclipai/db";

const querySchema = z.object({
  target: z.enum(["global", "company", "project", "agent"]),
  companyId: z.string().optional(),
  projectId: z.string().optional(),
  agentId: z.string().optional(),
});

const postSchema = z.object({
  target: z.enum(["global", "company", "project", "agent"]),
  companyId: z.string().optional(),
  projectId: z.string().optional(),
  agentId: z.string().optional(),
  content: z.string().min(1, "content must not be empty"),
});

const replaceSchema = z.object({
  target: z.enum(["global", "company", "project", "agent"]),
  companyId: z.string().optional(),
  projectId: z.string().optional(),
  agentId: z.string().optional(),
  content: z.string().min(1),
  old_text: z.string().min(1),
});

const removeSchema = z.object({
  target: z.enum(["global", "company", "project", "agent"]),
  companyId: z.string().optional(),
  projectId: z.string().optional(),
  agentId: z.string().optional(),
  old_text: z.string().min(1),
});

function makeIds(body: { companyId?: string; projectId?: string; agentId?: string }) {
  return { global: undefined, company: body.companyId, project: body.projectId, agent: body.agentId };
}

export function memoryRoutes(_db: Db) {
  const router = Router();

  router.get("/memories", async (req, res) => {
    try {
      const { target, companyId, projectId, agentId } = querySchema.parse(req.query);
      const filePath = resolveMemoryFilePath(target, { global: undefined, company: companyId, project: projectId, agent: agentId });
      let rawContent = "";
      try { rawContent = await readMemoryFile(filePath); }
      catch (err: any) { if (err.code === "ENOENT") return res.json({ prefix: "", entries: [] }); throw err; }
      res.json(parseMemoryFile(rawContent));
    } catch (err: any) {
      res.status(400).json(err instanceof z.ZodError ? { error: "Invalid query parameters", details: err.errors } : { error: err.message || "Failed to fetch memories" });
    }
  });

  router.post("/memories", async (req, res) => {
    try {
      const parsed = postSchema.parse(req.body);
      const result = await executeMemoryAction({ action: "add", target: parsed.target, content: parsed.content, ids: makeIds(parsed) });
      res.json({ success: true, text: result.text });
    } catch (err: any) {
      res.status(400).json(err instanceof z.ZodError ? { error: "Invalid memory payload", details: err.errors } : { error: err.message || "Failed to save memory" });
    }
  });

  router.post("/memories/replace", async (req, res) => {
    try {
      const parsed = replaceSchema.parse(req.body);
      const result = await executeMemoryAction({ action: "replace", target: parsed.target, content: parsed.content, old_text: parsed.old_text, ids: makeIds(parsed) });
      res.json({ success: true, text: result.text });
    } catch (err: any) {
      res.status(400).json(err instanceof z.ZodError ? { error: "Invalid memory payload", details: err.errors } : { error: err.message || "Failed to update memory" });
    }
  });

  router.post("/memories/remove", async (req, res) => {
    try {
      const parsed = removeSchema.parse(req.body);
      const result = await executeMemoryAction({ action: "remove", target: parsed.target, old_text: parsed.old_text, ids: makeIds(parsed) });
      res.json({ success: true, text: result.text });
    } catch (err: any) {
      res.status(400).json(err instanceof z.ZodError ? { error: "Invalid memory payload", details: err.errors } : { error: err.message || "Failed to remove memory" });
    }
  });

  return router;
}

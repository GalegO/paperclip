import fs from "node:fs/promises";
import path from "node:path";
import { exec } from "node:child_process";
import type { Db } from "@paperclipai/db";
import type { Issue, IssueDocument } from "@paperclipai/shared";
import { documentService } from "./documents.js";
import { logger as baseLogger } from "../middleware/logger.js";

const logger = baseLogger.child({ service: "sdd-local-sync" });

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
}

function getIssueFolderName(issue: any) {
  const titleSlug = slugify(issue.title ?? "issue");
  return `${issue.identifier ?? issue.id.slice(0, 8)}-${titleSlug}`;
}

export function sddLocalSyncService(db: Db) {
  const docsService = documentService(db);

  async function getIssueFolderPath(syncPath: string, issue: any) {
    const folderName = getIssueFolderName(issue);
    return path.join(syncPath, folderName);
  }

  async function ensureDirectoryExists(dir: string) {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  async function syncToDisk(syncPath: string, issue: any, documentKey: string, body: string) {
    if (!syncPath) return;
    try {
      const folderPath = await getIssueFolderPath(syncPath, issue);
      await ensureDirectoryExists(folderPath);
      const filePath = path.join(folderPath, documentKey);
      await fs.writeFile(filePath, body, "utf8");
    } catch (e) {
      logger.error({ err: e, issueId: issue.id, documentKey }, "Failed to write SDD to local disk");
    }
  }

  async function syncFromDiskIfNeeded(
    syncPath: string,
    issue: any,
    dbDocuments: any[],
    agentId?: string,
    userId?: string
  ) {
    if (!syncPath) return dbDocuments;

    try {
      const folderPath = await getIssueFolderPath(syncPath, issue);
      const stat = await fs.stat(folderPath).catch(() => null);
      if (!stat?.isDirectory()) return dbDocuments;

      let anyUpdates = false;

      for (const dbDoc of dbDocuments) {
        if (!dbDoc.key.toLowerCase().endsWith(".md") && dbDoc.key.includes(".")) continue;

        const filePath = path.join(folderPath, dbDoc.key);
        const fileStat = await fs.stat(filePath).catch(() => null);
        
        if (fileStat && fileStat.isFile()) {
          // Compare mtime to db updatedAt. Add 1000ms buffer to avoid rounding precision loops
          if (fileStat.mtime.getTime() > dbDoc.updatedAt.getTime() + 1000) {
            const localContent = await fs.readFile(filePath, "utf8");
            if (localContent !== dbDoc.body) {
              await docsService.upsertIssueDocument({
                issueId: issue.id,
                key: dbDoc.key,
                title: dbDoc.title,
                format: dbDoc.format,
                body: localContent,
                createdByAgentId: agentId ?? null,
                createdByUserId: userId ?? null,
                sourceTrust: null,
                lockedDocumentStrategy: "conflict"
              });
              dbDoc.body = localContent;
              dbDoc.updatedAt = fileStat.mtime;
              anyUpdates = true;
            }
          }
        }
      }
      
      // If any documents were updated, re-fetch them from the DB to get clean states
      if (anyUpdates) {
        return await docsService.listIssueDocuments(issue.id);
      }

    } catch (e) {
      logger.error({ err: e, issueId: issue.id }, "Failed to sync SDDs from local disk");
    }

    return dbDocuments;
  }

  async function openFolderInOS(syncPath: string, issue: any) {
    if (!syncPath) throw new Error("Local sync path not configured");
    const folderPath = await getIssueFolderPath(syncPath, issue);
    await ensureDirectoryExists(folderPath);

    return new Promise<void>((resolve, reject) => {
      let command = "";
      if (process.platform === "win32") {
        command = `start "" "${folderPath}"`;
      } else if (process.platform === "darwin") {
        command = `open "${folderPath}"`;
      } else {
        command = `xdg-open "${folderPath}"`;
      }

      exec(command, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  return { syncToDisk, syncFromDiskIfNeeded, openFolderInOS };
}

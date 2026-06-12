import { api } from "./client";

export interface MemoryEntry {
  uuid: string;
  timestamp: string;
  content: string;
}

export interface MemoryFile {
  prefix: string;
  entries: MemoryEntry[];
}

interface GetMemoriesParams {
  target: string;
  companyId?: string;
  projectId?: string;
  agentId?: string;
}

export const memoriesApi = {
  getMemories: async (params: GetMemoriesParams): Promise<MemoryFile> => {
    const searchParams = new URLSearchParams();
    searchParams.set("target", params.target);
    if (params.companyId) searchParams.set("companyId", params.companyId);
    if (params.projectId) searchParams.set("projectId", params.projectId);
    if (params.agentId) searchParams.set("agentId", params.agentId);
    return api.get(`/memories?${searchParams.toString()}`);
  },
};

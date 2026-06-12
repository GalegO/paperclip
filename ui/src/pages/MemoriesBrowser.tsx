import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { memoriesApi, MemoryFile, MemoryEntry } from "@/api/memories";
import { projectsApi } from "@/api/projects";
import { agentsApi } from "@/api/agents";
import { Brain, Calendar, Hash } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/EmptyState";
import { PageSkeleton } from "@/components/PageSkeleton";
import { MarkdownBody } from "@/components/MarkdownBody";
import { useCompany } from "@/context/CompanyContext";

const MEMORY_LEVELS = ["global", "company", "project", "agent"] as const;
const LEVEL_LABELS: Record<string, string> = {
  global: "L1: Global",
  company: "L2: Company",
  project: "L3: Project",
  agent: "L4: Agent",
};

export function MemoriesBrowser() {
  const { selectedCompany } = useCompany();
  const [activeTab, setActiveTab] = useState<(typeof MEMORY_LEVELS)[number]>("global");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState("");

  const { data: projects } = useQuery({
    queryKey: ["projects", selectedCompany?.id],
    queryFn: () => projectsApi.list(selectedCompany!.id),
    enabled: !!selectedCompany,
  });

  const { data: agents } = useQuery({
    queryKey: ["agents", selectedCompany?.id],
    queryFn: () => agentsApi.list(selectedCompany!.id),
    enabled: !!selectedCompany,
  });

  const canFetch =
    !!selectedCompany &&
    (activeTab === "global" ||
      activeTab === "company" ||
      (activeTab === "project" && !!selectedProjectId) ||
      (activeTab === "agent" && !!selectedAgentId));

  const { data: memoryData, isLoading } = useQuery({
    queryKey: ["memories", activeTab, selectedCompany?.id, selectedProjectId, selectedAgentId],
    queryFn: () =>
      memoriesApi.getMemories({
        target: activeTab,
        companyId: selectedCompany?.id,
        projectId: selectedProjectId || undefined,
        agentId: selectedAgentId || undefined,
      }),
    enabled: canFetch,
  });

  const needsSelection =
    (activeTab === "project" && !selectedProjectId) ||
    (activeTab === "agent" && !selectedAgentId);

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Memories Browser</h2>
      </div>
      <p className="text-muted-foreground max-w-2xl">
        Audit and inspect the long-term memories generated and consumed by the agents.
      </p>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="space-y-4">
        <TabsList>
          {MEMORY_LEVELS.map((level) => (
            <TabsTrigger key={level} value={level}>
              {LEVEL_LABELS[level]}
            </TabsTrigger>
          ))}
        </TabsList>

        {MEMORY_LEVELS.map((level) => (
          <TabsContent key={level} value={level} className="space-y-4">
            {level === "project" && (
              <ProjectSelector projects={projects} value={selectedProjectId} onChange={setSelectedProjectId} />
            )}
            {level === "agent" && (
              <AgentSelector agents={agents} value={selectedAgentId} onChange={setSelectedAgentId} />
            )}
            {needsSelection ? (
              <EmptyState icon={Brain} message={`No ${level} selected. Select a ${level} above to view its memories.`} />
            ) : (
              <MemoryContent isLoading={isLoading} memoryData={memoryData} />
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function ProjectSelector({ projects, value, onChange }: { projects: any[] | undefined; value: string; onChange: (v: string) => void }) {
  return (
    <div className="w-[300px] mb-4">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Select a project..." /></SelectTrigger>
        <SelectContent>
          {projects?.map((p: any) => (
            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function AgentSelector({ agents, value, onChange }: { agents: any[] | undefined; value: string; onChange: (v: string) => void }) {
  return (
    <div className="w-[300px] mb-4">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Select an agent..." /></SelectTrigger>
        <SelectContent>
          {agents?.map((a: any) => (
            <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function MemoryContent({ isLoading, memoryData }: { isLoading: boolean; memoryData?: MemoryFile }) {
  if (isLoading) return <PageSkeleton />;
  if (!memoryData || memoryData.entries.length === 0) {
    return <EmptyState icon={Brain} message="No memories found for this level." />;
  }

  return (
    <div className="space-y-4">
      {memoryData.prefix && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="font-semibold mb-2">Memory Prefix (System Prompt)</h3>
          <MarkdownBody className="text-sm">{memoryData.prefix}</MarkdownBody>
        </div>
      )}
      <div className="space-y-4">
        {memoryData.entries.map((entry) => (
          <div key={entry.uuid} className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="bg-muted/50 px-4 py-2 flex items-center justify-between border-b border-border">
              <div className="flex items-center text-xs text-muted-foreground gap-1">
                <Calendar className="h-3 w-3" />
                {entry.timestamp}
              </div>
              <div className="flex items-center text-xs text-muted-foreground font-mono gap-1">
                <Hash className="h-3 w-3" />
                {entry.uuid}
              </div>
            </div>
            <div className="p-4">
              <MarkdownBody className="text-sm">{entry.content}</MarkdownBody>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

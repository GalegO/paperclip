import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { issuesApi } from "../api/issues";
import { useCompany } from "../context/CompanyContext";
import { queryKeys } from "../lib/queryKeys";
import { agentsApi } from "../api/agents";
import type { Issue, Agent } from "@paperclipai/shared";
import { CircleDot } from "lucide-react";
import { Link } from "react-router-dom";

const KANBAN_COLUMNS = [
  { id: "backlog", label: "Backlog", color: "border-t-gray-500" },
  { id: "todo", label: "To Do", color: "border-t-blue-500" },
  { id: "in_progress", label: "In Progress", color: "border-t-yellow-500" },
  { id: "in_review", label: "In Review", color: "border-t-purple-500" },
  { id: "blocked", label: "Blocked", color: "border-t-red-500" },
  { id: "done", label: "Done", color: "border-t-green-500" },
];

function KanbanCard({ issue, agentName }: { issue: Issue; agentName: (id: string | null) => string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: issue.id,
    data: { type: "Issue", issue },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`relative flex flex-col gap-2 rounded-lg border border-border bg-card p-3 shadow-sm hover:border-primary/50 cursor-grab active:cursor-grabbing transition-colors ${
        isDragging ? "opacity-50 ring-2 ring-primary ring-offset-2" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <Link 
          to={`/issues/${issue.identifier ?? issue.id}`} 
          className="text-sm font-semibold leading-tight text-foreground hover:underline"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {issue.title}
        </Link>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
        <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px]">
          {issue.identifier ?? issue.id.slice(0, 8)}
        </span>
        {issue.assigneeAgentId && (
          <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px] ml-1 font-medium">
            Agent: {agentName(issue.assigneeAgentId)}
          </span>
        )}
        {(issue.priority as string) !== "none" && (
          <span className="capitalize">{issue.priority}</span>
        )}
      </div>
    </div>
  );
}

function KanbanColumnDroppable({ id, color, children }: { id: string, color?: string, children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({
    id,
    data: { type: "Column" },
  });

  return (
    <div 
      ref={setNodeRef}
      className={`flex-1 overflow-y-auto overflow-x-hidden flex flex-col gap-2 p-2 bg-muted/40 rounded-xl border border-border/50 min-h-[150px] border-t-[3px] ${color || "border-t-transparent"}`}
    >
      {children}
    </div>
  );
}

export function Kanban() {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);

  const { data: issues = [], isLoading: isLoadingIssues } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId ?? ""),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: agents = [], isLoading: isLoadingAgents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId ?? ""),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const agentById = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);
  const agentName = (id: string | null) => {
    if (!id) return "Unassigned";
    return agentById.get(id)?.name || id.slice(0, 8);
  };

  const updateIssueMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      issuesApi.update(id, { status }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.issues.list(selectedCompanyId!) });
      const previousIssues = queryClient.getQueryData<Issue[]>(queryKeys.issues.list(selectedCompanyId!));
      if (previousIssues) {
        queryClient.setQueryData(
          queryKeys.issues.list(selectedCompanyId!),
          previousIssues.map((issue) => (issue.id === id ? { ...issue, status } : issue))
        );
      }
      return { previousIssues };
    },
    onError: (_err, _newIssue, context) => {
      if (context?.previousIssues) {
        queryClient.setQueryData(queryKeys.issues.list(selectedCompanyId!), context.previousIssues);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.list(selectedCompanyId!) });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const issue = issues.find((i) => i.id === active.id);
    if (issue) setActiveIssue(issue);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveIssue(null);
    const { active, over } = event;
    if (!over) return;

    const activeIssueId = active.id as string;
    
    let newStatus = over.id as string;
    const isOverIssue = issues.some((i) => i.id === over.id);
    
    if (isOverIssue) {
      const targetIssue = issues.find((i) => i.id === over.id);
      if (targetIssue) newStatus = targetIssue.status;
    }

    const currentIssue = issues.find((i) => i.id === activeIssueId);
    if (currentIssue && currentIssue.status !== newStatus && KANBAN_COLUMNS.some(c => c.id === newStatus)) {
      updateIssueMutation.mutate({ id: activeIssueId, status: newStatus });
    }
  };

  if (isLoadingIssues || isLoadingAgents) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading Kanban...
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <div className="flex items-center gap-3 border-b border-border px-6 py-4 shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <CircleDot className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Kanban Board</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Drag and drop issues to update their status</p>
        </div>
      </div>
      
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 bg-accent/5">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex h-full items-start gap-4 pb-4">
            {KANBAN_COLUMNS.map((col) => {
              const columnIssues = issues.filter((i) => i.status === col.id);
              return (
                <div key={col.id} className="flex flex-col gap-3 min-w-[300px] w-[300px] h-full max-h-full">
                  <div className="flex items-center justify-between px-1 shrink-0">
                    <h3 className="font-medium text-xs text-foreground flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
                      {col.label}
                      <span className="bg-background border border-border text-foreground text-[10px] px-2 py-0.5 rounded-full font-mono">
                        {columnIssues.length}
                      </span>
                    </h3>
                  </div>
                  
                  <KanbanColumnDroppable id={col.id} color={col.color}>
                    <SortableContext items={columnIssues.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                      {columnIssues.map((issue) => (
                        <KanbanCard key={issue.id} issue={issue} agentName={agentName} />
                      ))}
                    </SortableContext>
                  </KanbanColumnDroppable>
                </div>
              );
            })}
          </div>
          
          <DragOverlay>
            {activeIssue ? <KanbanCard issue={activeIssue} agentName={agentName} /> : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}

import { useMutation, useQuery } from "@tanstack/react-query";
import { issuesApi } from "../api/issues";
import { instanceSettingsApi } from "../api/instanceSettings";
import { queryKeys } from "../lib/queryKeys";
import { MarkdownBody } from "./MarkdownBody";
import { FoldCurtain } from "./FoldCurtain";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Issue, IssueThreadInteraction, SuggestTasksInteraction, RequestConfirmationInteraction } from "@paperclipai/shared";
import { useState } from "react";
import { Check, X, FolderOpen } from "lucide-react";

type ActionableIssueThreadInteraction = SuggestTasksInteraction | RequestConfirmationInteraction;

interface IssueSddReviewTabProps {
  issue: Issue;
  interactions: IssueThreadInteraction[];
  onAcceptInteraction: (interaction: ActionableIssueThreadInteraction) => Promise<void>;
  onRejectInteraction: (interaction: ActionableIssueThreadInteraction, reason?: string) => Promise<void>;
}

// Removed SDD_DOCUMENTS strict list to allow any .md files

export function IssueSddReviewTab({
  issue,
  interactions,
  onAcceptInteraction,
  onRejectInteraction
}: IssueSddReviewTabProps) {
  const { data: documents, isLoading } = useQuery({
    queryKey: queryKeys.issues.documents(issue.id),
    queryFn: () => issuesApi.listDocuments(issue.id),
  });

  const { data: experimentalSettings, isLoading: isLoadingExperimental } = useQuery({
    queryKey: queryKeys.instance.experimentalSettings,
    queryFn: () => instanceSettingsApi.getExperimental(),
  });

  const openFolderMutation = useMutation({
    mutationFn: () => issuesApi.openDocumentFolder(issue.id),
  });

  const [rejectReason, setRejectReason] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  // Find if there is an active "request_confirmation" interaction
  const activeConfirmation = interactions.find(
    (i) => i.kind === "request_confirmation" && !i.resolvedAt
  ) as RequestConfirmationInteraction | undefined;

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-8 w-1/4" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const sddDocs = (documents || []).filter(doc => doc.key.toLowerCase().endsWith(".md") || !doc.key.includes("."));

  if (sddDocs.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No SDD documents found for this issue yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {experimentalSettings?.enableSddLocalSync && experimentalSettings?.sddLocalSyncPath && (
        <div className="flex justify-end">
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            disabled={openFolderMutation.isPending}
            onClick={() => openFolderMutation.mutate()}
          >
            <FolderOpen className="w-4 h-4" />
            {openFolderMutation.isPending ? "Opening..." : "Open Local Folder"}
          </Button>
        </div>
      )}

      {activeConfirmation && (
        <div className="rounded-lg border border-primary/50 bg-primary/5 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-primary">Architecture Approval Requested</h3>
              <p className="text-sm text-muted-foreground">{activeConfirmation.payload.prompt}</p>
            </div>
          </div>
          
          {rejectingId === activeConfirmation.id ? (
            <div className="space-y-2">
              <textarea
                className="w-full min-h-[80px] p-2 text-sm rounded-md border border-border bg-background"
                placeholder="Reason for rejection (e.g., 'Missing sequence diagram', 'Data model needs adjustments')..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setRejectingId(null)}>Cancel</Button>
                <Button 
                  variant="destructive" 
                  size="sm"
                  disabled={!rejectReason.trim()}
                  onClick={() => onRejectInteraction(activeConfirmation, rejectReason)}
                >
                  Confirm Rejection
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button 
                size="sm" 
                className="gap-1.5"
                onClick={() => onAcceptInteraction(activeConfirmation)}
              >
                <Check className="w-4 h-4" />
                Approve Architecture
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-1.5 text-destructive hover:text-destructive"
                onClick={() => setRejectingId(activeConfirmation.id)}
              >
                <X className="w-4 h-4" />
                Reject
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="space-y-8">
        {sddDocs.map(doc => (
          <div key={doc.key} className="space-y-2">
            <h2 className="text-lg font-bold border-b pb-1 capitalize">{doc.key}</h2>
            <div className="bg-accent/10 rounded-lg p-4 border border-border/50">
              <FoldCurtain collapsedHeight={600}>
                <MarkdownBody className="text-[15px] leading-7">{doc.body}</MarkdownBody>
              </FoldCurtain>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

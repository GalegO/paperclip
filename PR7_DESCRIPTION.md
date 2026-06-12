# PR 7: Issue Recovery Actions

## 🧠 Thinking Path

The issue subsystem manages agent assignments using lock columns (`checkoutRunId`, `executionRunId`). These locks gate checkout, ownership, and release. If an agent process dies unexpectedly (e.g., process killed, OOM error, terminal closed), the issue can become permanently stuck in an "In Progress" state with stale locks. To allow the system to self-heal and allow users to manually intervene without diving into the database, we need backend endpoints to clear dead checkouts and UI components to offer manual retry/recovery actions.

## 📝 What Changed

**Technical Changes:**
- **Core Recovery Service (`server/src/services/issues.ts`)**: Added lock recovery logic to release dead checkouts while preserving live execution ownership. The service includes a liveness check to accurately detect if the run ID attached to an issue is still actively processing.
- **API Bindings (`ui/src/api/issues.ts`)**: Added frontend bindings for the new recovery endpoints.
- **UI Components (`ui/src/components/IssueRecoveryActionCard.tsx`)**: Created a new UI component that displays an "Issue Recovery" banner when a stalled issue is detected.
- **UI Integration (`ui/src/pages/IssueDetail.tsx`)**: Injected the recovery card directly into the issue detail view.

**Functional Changes & User Experience:**
- **Automated Stagnation Detection**: The system now actively detects if an agent has crashed or stalled while working on an issue. 
- **Manual Recovery Operator Guide**: When an issue stalls, a bright Recovery Banner will appear at the top of the Issue page, offering the user (Board operator) 4 distinct tools:
  1. **Try Again**: Releases the stuck locks and returns the issue to the `Todo` column so another agent can pick it up.
  2. **Mark Issue Done**: Forces a successful completion status if the agent finished the work but crashed before reporting its final success payload.
  3. **Send for Review**: Moves the issue to the `In Review` stage so another agent or human can validate the partially finished code.
  4. **False Positive**: Allows Board Members to dismiss the liveness alert if it incorrectly flagged an active process.

## 🧪 Verification

- TypeScript compilation passes: `pnpm --filter @paperclipai/server typecheck`
- Automated Tests pass: `NODE_ENV=test pnpm exec vitest run src/__tests__/issue-recovery-actions.test.ts`
- **Validation coverage includes:**
  - Hard run terminations correctly clear the `checkoutRunId` when it points at the terminating run.
  - The sweeping system accurately detects issues where the `checkoutRunId` points to a failed process in the `runs` table.
  - Operator clicking "Try Again" successfully clears stale locks and requeues the issue in the database.

## ⚠️ Risks

- **Low**: All lock clears are strictly scoped by the `runId`, ensuring they only fire when the column unambiguously points at a terminated run. If a false positive does occur, a live agent might temporarily lose its lock, resulting in a harmless 409 conflict that self-heals on the next polling tick.

## 🤖 Model Used

Antigravity - Gemini 3.1 Pro (Low)

## ✅ Checklist

- [x] The code was tested locally via Vitest (Unit/E2E).
- [ ] The CI pipeline is green.
- [ ] All Greptile feedbacks were addressed.

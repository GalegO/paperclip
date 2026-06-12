# PR 9.1: SDD Review Tab

## 🧠 Thinking Path

The core loop of Paperclip relies on agents creating architecture specifications (Spec Driven Documents - SDD) before writing code. Previously, human operators had to manually download these generated Markdown documents or navigate to a separate repository view to review them. This PR introduces a seamless, in-context review tab directly inside the Issue view, enabling human operators to read, approve, or reject an agent's technical proposal without breaking their workflow.

## 📝 What Changed

**Technical Changes:**
- **UI Components (`ui/src/components/IssueSddReviewTab.tsx`)**: Added a new tab component dedicated to listing and rendering Markdown SDD documents attached to an active issue.
- **Approval Handling**: Built an interactive UI wrapper that ties into the `RequestConfirmationInteraction` event stream, allowing users to explicitly trigger "Approve" or "Reject" mutations back to the agent.
- **Data Fetching (`ui/src/lib/queryKeys.ts`)**: Added new query constants to correctly fetch attached issue documents and their revision histories.

**Functional Changes & User Experience:**
- **In-Context Document Review**: When an agent generates a technical proposal, a new "Review SDD" tab dynamically appears in the Issue view. Users can read the fully formatted Markdown document directly on the screen.
- **One-Click Approvals**: At the bottom of the document, users are presented with clear "Approve" and "Reject" buttons. This creates a hard governance gate where the agent will physically wait for human permission before it starts writing the code implementation.
- **Frictionless Workflow**: The human operator no longer needs to hunt for files; everything is centralized inside the ticket they are managing.

## 🧪 Verification

- Verified the component renders correctly when documents are present and hides gracefully when they are not.
- Ensured no local hardcoded file paths exist in the document fetching logic.
- UI builds successfully and typechecks locally.

## ⚠️ Risks

- **Low risk**. The UI is built to degrade safely; if there are no documents or interactions attached to the issue, the tab simply remains hidden or displays an empty state. It does not interfere with the core chat or issue tracking tabs.

## 🤖 Model Used

Antigravity - Gemini 3.1 Pro (Low)

## ✅ Checklist

- [x] The code was tested locally via Vitest (Unit/E2E).
- [ ] The CI pipeline is green.
- [ ] All Greptile feedbacks were addressed.

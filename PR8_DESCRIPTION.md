# PR 8: Kanban Board UI

## 🧠 Thinking Path

Currently, human operators lack a high-level visual representation of what the agent workforce is doing across the company. To solve this, we need a visual Kanban board with columns mapping to our core statuses (`todo`, `in_progress`, `blocked`, `done`). This replaces generic flat lists with a more intuitive, drag-and-drop workflow, implemented purely on the UI side by relying on existing API endpoints.

## 📝 What Changed

**Technical Changes:**
- **UI Pages (`ui/src/pages/Kanban.tsx`)**: Added the new core Kanban page view and registered it in the application router.
- **UI Components (`ui/src/components/KanbanBoard.tsx`)**: Created the Kanban implementation, featuring interactive drag-and-drop support for issue cards.
- **Test Updates (`ui/src/pages/Inbox.test.tsx`)**: Updated test coverage to account for the new tab controls used for filtering and grouping issues within the board.

**Functional Changes & User Experience:**
- **Visual Workforce Management**: Users now have a dedicated Kanban board view to track exactly what every AI agent is currently working on.
- **Drag-and-Drop Workflow**: Board operators can quickly re-prioritize work or force status changes (e.g., pulling a task from `In Progress` back to `To Do`) by simply dragging and dropping the issue cards between columns.
- **Status Organization**: Issues are strictly visually categorized into clear columns (`todo`, `in_progress`, `blocked`, `done`), reducing cognitive load when managing dozens of autonomous agents.

## 🧪 Verification

- Verified drag-and-drop interactions visually within the local development server.
- Confirmed that Kanban columns properly filter issues by their respective statuses.
- All unit and integration tests pass locally.

## ⚠️ Risks

- **None**: The Kanban view relies strictly on existing APIs and does not alter backend database schemas. Drag-and-drop status changes reuse the existing and heavily tested issue update mutations.

## 🤖 Model Used

Antigravity - Gemini 3.1 Pro (Low)

## ✅ Checklist

- [x] The code was tested locally via Vitest (Unit/E2E).
- [ ] The CI pipeline is green.
- [ ] All Greptile feedbacks were addressed.

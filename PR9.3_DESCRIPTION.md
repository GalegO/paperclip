# PR 9.3: Issue Navigation and UI Enhancements

## 🧠 Thinking Path

As agents gained more autonomy and capabilities, the core issue interface needed to reflect their current operational states more clearly. This PR introduces a "Planning Mode" indicator to the issue rows, allowing users to distinguish at a glance when an agent is carefully planning an architecture rather than actively executing code. Additionally, it modernizes the chat thread rendering to gracefully handle new complex system messages without breaking the existing flow.

## 📝 What Changed

**Technical Changes:**
- **UI Adjustments (`ui/src/components/IssueRow.tsx`)**: Injected a visual badge indicator logic to distinguish issues that are currently in "Planning Mode".
- **Chat Thread Engine (`ui/src/components/IssueChatThread.tsx`)**: Safely applied granular patches to support advanced system message handling. This ensures that new multi-step agent logs and system events render correctly alongside standard messages.

**Functional Changes & User Experience:**
- **Planning Mode Visibility**: Users scanning their Inbox or Kanban board can now instantly identify which tickets are currently in the crucial "Planning Mode" phase, indicating that the agent is actively researching and designing a solution prior to implementation.
- **Richer Chat Threads**: The issue chat timeline now gracefully handles and displays complex system events, making it easier for human operators to follow exactly what the agent did behind the scenes.

## 🧪 Verification

- Verified visually that the "Planning Mode" indicator appears correctly on `IssueRow` components when applicable.
- Validated that `IssueChatThread` renders rich system messages and references cleanly without layout breaking.
- Build and strict typechecks pass (`pnpm run typecheck`).

## ⚠️ Risks

- **Medium risk**. Modifications to the core `IssueChatThread` affect one of the most heavily used components in the application. The changes were applied via targeted patches rather than full component replacements to strictly prevent regressions in existing message flows.

## 🤖 Model Used

Antigravity - Gemini 3.1 Pro (Low)

## ✅ Checklist

- [x] The code was tested locally via Vitest (Unit/E2E).
- [ ] The CI pipeline is green.
- [ ] All Greptile feedbacks were addressed.

# PR 14: UI Components & App Routing Expansion

## 🧠 Thinking Path

This PR represents a major frontend aggregation update, routing new pages and integrating UI elements for several decoupled backend features (like MCP Servers, Kanban Boards, and Memory Browsers). Because frontend navigation and layout act as the central hub for the user, this PR connects the disparate systems introduced in other feature PRs into a single, cohesive User Interface.

## 📝 What Changed

**Technical Changes:**
- **MCP Server UI (`ui/src/pages/AgentDetail.tsx`, `ui/src/pages/CompanySettings.tsx`)**: Added the `<AgentMcpServersTab>` component to the agent detail panel. Added a "Documentation MCP" configuration section allowing administrators to toggle `docsMcpEnabled`.
- **API Bindings (`ui/src/api/agents.ts`, `ui/src/api/issues.ts`)**: Added HTTP REST endpoints to manage agent MCPs (`mcpServers`, `attachMcpServer`, `detachMcpServer`). Fixed a strict typing bug in the Issue Recovery Actions interface.
- **Global App Routing (`ui/src/App.tsx`, `ui/src/components/Sidebar.tsx`)**: Registered global routes and sidebar navigation links for `<Kanban />`, `<MemoriesBrowser />`, and the Global MCP Servers page.
- **Component Tweaks (`ui/src/components/MarkdownBody.tsx`)**: Improved markdown rendering to intercept clicks on local file links (`file://`) and display a friendly "This is a local file link" alert rather than silently failing the browser navigation.

**Functional Changes & User Experience:**
- **Unified Navigation**: Users will now see direct links to the new "Kanban" and "Memories" pages seamlessly integrated into the main sidebar.
- **Agent Extensions**: Operators can explicitly attach or detach specific MCP servers to individual agents through a brand new tab on the Agent Detail page, granting agents highly specific capabilities on demand.
- **Frictionless Reading**: When agents reference local files in their markdown responses, clicking those links will no longer confuse the user's browser, improving the reading experience.

## 🧪 Verification

- Verified UI component rendering across all updated pages.
- Tested `MarkdownBody.tsx` link interception manually.
- Confirmed that routing successfully resolves the components when their respective PRs are merged.

## ⚠️ Risks

- **High risk of build breakage if applied out of order**: This PR aggregates routing for `<Kanban />` and `<MemoriesBrowser />`. If this PR is merged *before* the PRs containing those actual components (PR3 and PR8), the frontend build will fail due to missing module imports.

## 🤖 Model Used

Antigravity - Gemini 3.1 Pro (Low)

## ✅ Checklist

- [x] The code was tested locally via Vitest (Unit/E2E).
- [ ] The CI pipeline is green.
- [ ] All Greptile feedbacks were addressed.

# PR 10: Plugin System Expansion & Governance Harness

## 🧠 Thinking Path

This PR represents a massive architectural expansion of the Paperclip Plugin Ecosystem. It overhauls the backend plugin engine and introduces native infrastructure to safely govern how AI agents write artifacts and interact with the database. A key problem was ensuring agents only write architecture artifacts (like Spec Driven Documents) in authorized directories, and that these artifacts are automatically indexed and made visible to human operators. This PR solves that by creating a robust RPC SDK, a central plugin dispatcher, and a dedicated governance plugin.

## 📝 What Changed

**Technical Changes:**
- **Core Plugin Engine Overhaul (`server/src/services/`)**:
  - `plugin-loader.ts` & `plugin-worker-manager.ts`: Introduced isolated process management to safely instantiate background plugin workers.
  - `plugin-tool-registry.ts` & `plugin-tool-dispatcher.ts`: Implemented a central routing system. When an agent requests to use a tool, the dispatcher reliably routes the RPC call to the specific isolated plugin that registered that tool.
  - `plugin-host-services.ts`: Exposed internal host APIs so plugins can safely request data from the core server.
- **SDK Update (`packages/plugins/sdk/src/worker-rpc-host.ts`)**: Updated the critical bridge that handles the Remote Procedure Call (RPC) layer between the Paperclip host and the background worker processes.
- **Governance Plugin (`packages/plugins/plugin-governance-harness`)**: Created a powerful native plugin designed to enforce strict rules on how agents write files.
- **API & Tests**: Added API endpoints in `server/src/routes/plugins.ts`, security tests in `plugin-routes-authz.test.ts`, and updated `package.json` for all existing example plugins.

**Functional Changes & User Experience:**
- **Strict Directory Governance**: Agents are now physically prevented from writing artifacts randomly across the repository root. The new plugin enforces that all artifacts are saved strictly in `Docs/Issues/` and includes path traversal protection.
- **Exclusive Artifact Tool (`write_ticket_artifact`)**: Agents are provided a specialized tool exclusively for writing technical documents, deprecating the use of raw, dangerous bash commands for file creation.
- **Automatic Database Synchronization**: When an agent uses this tool to write a file matching an issue key (e.g., `PAP-123_design.md`), the plugin automatically parses the ticket ID and triggers an internal RPC call to sync the Markdown document into the database. This is the exact mechanism that powers the `IssueSddReviewTab` (introduced in PR9).

## 🧪 Verification

- Verified no local hardcoded paths (e.g., `C:\Users\frisa\...`) leaked into the codebase.
- Executed and passed unit tests for the SDK (`worker-rpc-host.test.ts`) and the server routing (`plugin-routes-authz.test.ts`).
- Manually confirmed that the governance harness throws appropriate and fatal errors when an agent attempts path traversal escapes (e.g., `../../`).

## ⚠️ Risks

- **Medium risk**. This PR touches the core RPC layer between the main server and plugin workers. Errors here could prevent all plugins from loading or tools from being registered. The automatic DB synchronization relies on specific file naming conventions (e.g., `_design.md`), meaning agents must be prompted correctly to name their files, otherwise the documents won't automatically link to the UI.

## 🤖 Model Used

Antigravity - Gemini 3.1 Pro (Low)

## ✅ Checklist

- [x] The code was tested locally via Vitest (Unit/E2E).
- [ ] The CI pipeline is green.
- [ ] All Greptile feedbacks were addressed.

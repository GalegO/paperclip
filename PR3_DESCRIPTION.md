# PR 3: Memories System

## 🧠 Thinking Path

Paperclip agents generate persistent knowledge across sessions but had no mechanism to store or retrieve it between heartbeats. This PR adds a native memory system integrated directly into the heartbeat flow, without requiring a separate MCP server process.

The architecture follows two pillars:
1. **System Prompt Injection**: Memory files are loaded at the start of the heartbeat and injected into the system prompt, leveraging prefix caching for token efficiency.
2. **REST API Write Endpoints**: Agents write memories via `POST /api/memories` using their existing `PAPERCLIP_API_KEY`, meaning no new tool protocol is needed.

## 📝 What Changed

**Technical Changes:**
- **Core Memory Service (`server/src/services/memory.ts`)**: Added memory operations (`add`, `replace`, `remove`), a parser/serializer for the `§`-delimited format, `buildMemoryPromptBlock` for heartbeat injection, and file-based locking to ensure concurrent write safety.
- **REST Endpoints (`server/src/routes/memories.ts`)**: Added 4 endpoints (`GET`, `POST`, `POST /replace`, `POST /remove`) for access by both agents and the UI.
- **Heartbeat Integration (`server/src/services/heartbeat.diff`)**: Patched the heartbeat flow to load 4 memory levels (L4 Global → L3 Company → L2 Project → L1 Agent) and inject them directly into the system prompt.
- **Prompt Instructions (`server/src/services/memory-instructions.diff`)**: Added explicit instructions to the agent's system prompt on how and when to use each memory level.
- **Configuration Toggle**: Added an `enableMemories` experimental toggle in the instance shared types and validators.
- **UI Pages and API (`ui/src/pages/MemoriesBrowser.tsx`, `ui/src/api/memories.ts`)**: Added a 4-tab UI browser page for L1-L4 memories with project and agent selectors, alongside the corresponding API client.

**Functional Changes & User Experience:**
- **New Feature**: Users now have a dedicated "Memories" browser in the UI to view, edit, and audit everything the agents have learned.
- **Agent Autonomy**: Agents now possess a long-term memory across 4 specific scopes. They can remember facts globally (L4), per company (L3), per project (L2), or personal agent preferences (L1).
- **New Tools for Agents**: Agents are now instructed on how to use the REST API to permanently store important knowledge, decisions, or user preferences, preventing them from asking the same questions repeatedly in future sessions.

## 🧪 Verification

- 21 unit tests pass across 3 test files (memory service: 14, routes: 2, API client: 5).
- Parser/serializer round-trip preserves data integrity.
- File locking prevents concurrent write corruption (500ms timeout in test environment).
- All 4 REST endpoints successfully registered and validated.
- `buildMemoryPromptBlock` correctly aggregates all 4 memory levels.

## ⚠️ Risks

- **Low**: Memory files are stored on disk. Concurrent writes are protected by file locks, but stale `.lock` files from abruptly crashed processes may temporarily block writes.
- This feature has zero impact on other adapters and existing workflows as it is strictly additive.

## 🤖 Model Used

Antigravity - Gemini 3.1 Pro (Low)

## ✅ Checklist

- [x] The code was tested locally via Vitest (Unit/E2E).
- [ ] The CI pipeline is green.
- [ ] All Greptile feedbacks were addressed.

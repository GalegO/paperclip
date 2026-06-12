# PR 9.2: Issue Reference Parsing & Taxonomy

## 🧠 Thinking Path

This PR addresses the need for robust parsing of cross-issue references and categorical metadata (taxonomy) within the application. By centralizing the logic into dedicated utility libraries, we ensure consistency when identifying and rendering issue links, tags, and badges across the UI, particularly within the `IssueRow` components.

## 📝 What Changed

**Technical Changes:**
- **Taxonomy Parser (`ui/src/lib/taxonomy.ts`)**: Introduced core regex-based logic for parsing taxonomy tags directly from raw issue titles.
- **Reference Utilities (`ui/src/lib/issue-reference.ts`)**: Added robust utilities to detect and format issue references (e.g., `#123` or raw URLs) within markdown and text content.
- **Tests (`ui/src/lib/issue-reference.test.ts`)**: Added unit tests to ensure high accuracy in reference parsing without false positives.
- **UI Integration (`ui/src/components/IssueRow.tsx`)**: Injected the `parseTaxonomyTag` logic to render visual badges based on the parsed issue titles.

**Functional Changes & User Experience:**
- **Smart References**: When users or agents type `#123` (or full URLs) in issue descriptions or chats, the application will now dynamically parse these as clickable links pointing directly to the referenced issue.
- **Text-Driven Taxonomy**: The Taxonomy (Tags) system was designed to be **purely text-driven**, ensuring high-speed interactions and seamless compatibility with external third-party integrations (like GitHub).
  - *No Dropdowns*: There are no clunky dropdown menus or extra clicks to assign a category to a ticket.
  - *Reactive Formatting*: The human user (or an AI agent) assigns a tag simply by renaming the issue's title. For example, renaming a ticket to `[BUG] The system crashed` will cause the frontend to strip the literal `[BUG]` text and dynamically inject a colored visual badge in its place.
  - *Supported Tags*: Includes `[BUG]`, `[DEFECT]` (Red); `[FEAT]`, `[FEATURE]` (Emerald); `[ENH]`, `[ENHANCEMENT]` (Blue); `[SEC]`, `[SECURITY]` (Amber); `[DEBT]` (Purple); and `[TASK]` (Gray).

## 🧪 Verification

- Unit tests run and pass perfectly for `issue-reference.test.ts`.
- Validated that `taxonomy.ts` successfully extracts the defined tags without accidental false positives.
- Verified that colored taxonomy badges render gracefully and dynamically on `IssueRow` lists.

## ⚠️ Risks

- **Low**. These are pure library functions. However, if the regex or parsing logic were overly broad, it might misidentify standard text as issue references. Comprehensive test coverage heavily mitigates this risk.

## 🤖 Model Used

Antigravity - Gemini 3.1 Pro (Low)

## ✅ Checklist

- [x] The code was tested locally via Vitest (Unit/E2E).
- [ ] The CI pipeline is green.
- [ ] All Greptile feedbacks were addressed.

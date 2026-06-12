# PR 11: Skills Catalog & Company Skills

## 🧠 Thinking Path

This PR addresses the need to separate global, system-wide agent skills from custom, organization-specific skills. Previously, all skills were treated as global entities shipped with the product. By introducing the `company-skill` architecture, we allow individual organizations to define their own custom, proprietary agent capabilities without polluting the global shipped catalog. Additionally, the global catalog is now pre-compiled via a builder script to drastically improve runtime efficiency and type safety when the core server boots up.

## 📝 What Changed

**Technical Changes:**
- **Skills Catalog Builder (`packages/skills-catalog/src/catalog-builder.ts`)**: Introduced a build-time script that compiles all native agent skills from their raw Markdown definitions into a single, highly optimized `catalog.json` file.
- **Strict Typings**: Added explicit Zod validators and TypeScript interfaces (`company-skill.ts`) in `@paperclipai/shared` to enforce the structure of custom skills belonging to a specific `companyId`.
- **Backend Services**: 
  - Created `server/src/services/company-skills.ts` to provide full database CRUD operations for customized company-level skills.
  - Created `server/src/services/skills-catalog.ts` to serve the pre-compiled global native skills directly from memory to the application.
- **Code Cleanup**: Completely removed deprecated, unmaintained skills (like the `wireframe` bundled skill and the `last30days` research catalog) and obsolete tests to reduce repository bloat.

**Functional Changes & User Experience:**
- **Custom Proprietary Skills**: Users can now create, edit, and assign custom skills that are strictly isolated to their own company workspace. Agents can be taught proprietary workflows that are completely secure and invisible to other companies on the platform.
- **Unified Routine UI (`ui/src/components/RoutineList.tsx`)**: When humans are setting up recurring routines or assigning tasks, the dropdown menu now elegantly merges and displays both the global standard skills (e.g., standard code review) and their own custom company skills.
- **Faster Boot Times**: Because global skills are now pre-compiled into a JSON file during the build process, the server no longer wastes time parsing dozens of Markdown files every time it restarts.

## 🧪 Verification

- Verified the successful compilation of `catalog.json` by running the new catalog builder script.
- Tested and passed all `company-skill` Zod schema validators.
- Verified all backend service tests pass locally (`company-skills-catalog-service.test.ts` and `skills-catalog-service.test.ts`).
- Confirmed visually that the `RoutineList` UI gracefully handles and renders the merging of both global and company-specific skills without crashing.

## ⚠️ Risks

- **Low risk**. The backend changes are mostly additive (new services and types). The UI changes in `RoutineList.tsx` are designed to gracefully fallback if no custom company skills exist.

## 🤖 Model Used

Antigravity - Gemini 3.1 Pro (Low)

## ✅ Checklist

- [x] The code was tested locally via Vitest (Unit/E2E).
- [ ] The CI pipeline is green.
- [ ] All Greptile feedbacks were addressed.

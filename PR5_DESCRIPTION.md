# PR 5: Comprehensive Windows Compatibility Patches

## 🧠 Thinking Path

Windows compatibility across the Paperclip monorepo required two distinct fixes:
1. **Database Lifecycle**: The `embedded-postgres` module failed to shut down gracefully on Windows because it relied on Unix-style signal handling (SIGTERM), leaving "zombie" `postgres.exe` processes running and locking the port.
2. **Sandbox Testing**: The automated tests for the `fake-sandbox` plugin were failing strictly on Windows due to hardcoded invocations of `sh` (a Unix shell) within `plugin.test.ts`, leading to `spawn sh ENOENT` errors. 

To create a cohesive "Windows Support" update, both the database teardown script and the sandbox tests were patched.

## 📝 What Changed

**Technical Changes:**
- **`patches/embedded-postgres@18.1.0-beta.16.patch`**: Modified the teardown lifecycle to invoke `pg_ctl stop -D <datadir>` when `process.platform === 'win32'`, ensuring the database flushes and exits correctly.
- **`packages/plugins/paperclip-plugin-fake-sandbox/src/plugin.test.ts`**: Replaced all hardcoded `command: "sh"` instances with `command: process.execPath` and adapted the Unix shell arguments into equivalent JavaScript inline evaluations using `args: ["-e", "node code..."]`.
- **`scripts/dev-runner.ts`**: Re-implemented the explicit `stdin` event listener for the `Q` key. This allows Windows users to press `Q` in the terminal to trigger a safe programmatic `shutdown("SIGINT")`, avoiding zombie processes that happen when the terminal window is abruptly closed.
- **`scripts/*`**: Adjusted generic CLI commands to support `pnpm.cmd` fallback on Windows.

**Functional Changes & User Experience:**
- **Graceful Shutdown**: Windows users can now safely shut down the local development server by simply pressing the `Q` key in their terminal. This guarantees that no zombie background processes (like the database) are left running, which previously caused "port already in use" errors upon restarting.
- **Cross-platform Stability**: Developers on Windows can now successfully run the `fake-sandbox` automated test suite without encountering immediate "file not found" errors related to Unix shell commands.

## 🧪 Verification

Run the following commands locally on Windows:
`pnpm db:migrate`
`pnpm dev`
`pnpm --filter @paperclipai/plugin-fake-sandbox test`

Manual reproduction steps:
1. Boot the app on Windows using `pnpm dev`. Kill the terminal using `Q` keypress.
2. Run `Get-Process postgres` in PowerShell. All processes should be gracefully terminated.
3. Run the fake sandbox tests. All tests must pass successfully on Windows without `ENOENT` errors.

## ⚠️ Risks

- **Medium**: Modifies the core database lifecycle and sandbox testing parameters. Mitigated by isolating the sandbox changes strictly to the test files, and wrapping the `pg_ctl` teardown specifically within a `win32` platform check to ensure Unix systems remain unaffected.

## 🤖 Model Used

Antigravity - Gemini 3.1 Pro (Low)

## ✅ Checklist

- [x] The code was tested locally via Vitest (Unit/E2E).
- [ ] The CI pipeline is green.
- [ ] All Greptile feedbacks were addressed.

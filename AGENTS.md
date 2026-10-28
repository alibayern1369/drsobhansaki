\# Global Codex Instructions



\## Efficiency

\- Optimize for low latency, minimal tool calls, and minimal token consumption without compromising correctness.

\- Use the smallest relevant context for each task.

\- Search filenames and symbols before opening files.

\- Read only relevant file sections; avoid full-file dumps when possible.

\- Do not recursively inspect the whole repository unless targeted searches fail.

\- Exclude node\_modules, .next, dist, build, coverage, .git, generated assets, and large logs from searches unless directly relevant.

\- Never reread unchanged files without a reason.

\- Avoid unnecessary web searches, repeated tool calls, and verbose output.



\## Editing

\- Make the smallest safe change that satisfies the request.

\- Preserve existing behavior, APIs, database schema, styling, and unrelated code.

\- Do not refactor unrelated modules.

\- Do not add packages unless necessary.

\- Use existing project patterns and dependencies.



\## Validation

\- Run focused checks for changed functionality.

\- Do not run full builds or entire test suites for trivial changes unless necessary.

\- For authentication, payments, database migrations, and security-sensitive changes, perform appropriate validation.

\- Never skip required tests solely to save time.



\## Communication

\- Keep explanations brief.

\- Avoid lengthy plans for straightforward tasks.

\- Final response: what changed, affected files, validation result, and important warnings.

\- Ask questions only when an essential requirement is ambiguous.



\## Scope

\- Start with files explicitly mentioned by the user.

\- Expand the investigation only when dependencies or evidence require it.

\- Do not change unrelated functionality.

## Smart Testing & Performance Policy

Prioritize fast execution, minimal token consumption, and safe changes.

### 1. Trivial Changes
For text, CSS, spacing, colors, icons, and simple visual adjustments:
- Do not run full builds.
- Do not run the entire test suite.
- Do not run global lint or TypeScript checks unless necessary.
- Perform only minimal relevant verification.

### 2. Normal Code Changes
For React components, UI logic, and ordinary features:
- Run only directly relevant tests or targeted checks.
- Avoid redundant commands.
- Do not repeatedly run the same test without new changes.
- Skip full production builds unless required.

### 3. Critical Changes
For authentication, OTP, authorization, payments, booking, database migrations, and security:
- Perform necessary targeted functional and security checks.
- Validate affected integration points.
- Run broader tests when the impact or risk justifies them.
- Never sacrifice safety or correctness for speed.

### 4. General Rules
- Do not automatically run npm run build after every task.
- Do not run npm run lint globally for minor changes.
- Do not install testing tools without necessity.
- Do not create new test files for trivial changes unless specifically required.
- Avoid repeated validation with no code changes.
- Prefer the smallest reliable verification method.
- If a necessary test is skipped, mention it briefly in the final response.
- Never claim a change was tested unless it actually was.

### 5. Response
Keep final responses short:
- What changed
- Which files changed
- What was tested
- Any remaining risks

IMPORTANT:
Do not remove existing tests or disable project safety checks.
Apply risk-based testing rather than eliminating testing.

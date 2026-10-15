---
name: story-quality-check
description: "Audit a delivered story before sign-off: verify directory layout against CLAUDE.md, run tests and lint, check each SPEC.md acceptance criterion against implementation and tests, and output a PASS/FAIL sign-off table with a verdict of READY FOR APPROVAL or BLOCKED. Use at the end of /deliver-story or when asked to quality-check a story."
---

# Story Quality Check

Audit the story that was just implemented. Be evidence-based: every row cites a file, line, command output, or test name.

## Steps
1. **Layout**: verify the directory layout matches CLAUDE.md: `src/components/`, `src/hooks/`, `src/types/`, `src/lib/`, `tests/`. Check that tests are not colocated under `src/`, components are one per file in PascalCase, and hooks start with `use`. Directories not yet needed by the story may be absent; note that rather than failing.
2. **Tests and lint**: run `npm run test` and `npm run lint`; capture pass/fail counts and any failure output. If a script is missing, that check is FAIL.
3. **Acceptance criteria**: list each SPEC.md acceptance criterion relevant to the story. For each, find the implementing code and the test covering it. A criterion passes only if both exist and the test passes.
4. **Standards spot-check**: grep `src/` for `any`, and confirm exported functions have explicit return types.

## Output
A markdown table:

| Check | Result (PASS/FAIL) | Evidence |
|-------|--------------------|----------|

Include rows for: layout, tests, lint, no-`any`/return types, and one row per acceptance criterion.

End with exactly one verdict line:
- `Verdict: READY FOR APPROVAL`: only if every row is PASS
- `Verdict: BLOCKED`: otherwise, followed by a bullet list of what must be fixed

Do not edit files or commit.

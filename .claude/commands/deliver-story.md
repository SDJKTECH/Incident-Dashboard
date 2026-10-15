---
description: Deliver a story end-to-end via planner, builder, tester, and reviewer subagents, then quality-check and request approval to commit
argument-hint: <story description or SPEC.md feature, e.g. "metrics panel">
---

Deliver this story: $ARGUMENTS

You (the main session) are the orchestrator. Subagents cannot invoke other subagents, so YOU delegate each step below and pass results between them. Do not implement the story yourself.

Run independent work in parallel to save time: when several subagents can work at once, launch them all in a single message (multiple Agent tool calls in one response) and wait for all of them before moving on. Only serialize work that depends on earlier output or that touches the same file.

1. **Plan**: use the `orchestrator` subagent to produce a plan for: $ARGUMENTS. It returns sub-tasks, target files, agent assignments, mapped acceptance criteria, and a **Wave** for each sub-task (sub-tasks in the same wave touch disjoint files and do not depend on each other). Show the plan briefly.
2. **Build (parallel by wave)**: run the plan's waves in order. Within a wave, launch one `builder` subagent per sub-task, all in the same message, each given only its own plan rows, criteria, and file list. Wait for the whole wave to finish before starting the next wave. Never give two builders the same file; shared files (e.g. `package.json`, `src/App.tsx`, wiring) go in a later wave or to a single builder.
3. **Test + Review (parallel)**: once building is done, launch in the same message: one `tester` subagent per independent module or test file group (disjoint files under `tests/`), and one `reviewer` subagent for the diff (including untracked files) and `npm run lint`. If the tests were not written yet when the reviewer ran, give the reviewer a short second pass over the new `tests/` files after the testers finish. Only one tester should run the full `npm run test` at the end; the others run just their own test files.
4. **Iterate**: if tests fail or the reviewer reports blocking issues, group the exact findings by file, send each group to its own `builder` in parallel (disjoint files only), then repeat step 3. Maximum 3 iterations. If still failing after 3, stop and report the remaining failures; do not continue.
5. **Quality check**: run the `story-quality-check` skill.
6. **Approval gate**: present the sign-off table and a proposed commit message, then STOP and wait for my explicit approval before running `git commit`. Never run `git push`.

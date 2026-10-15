---
description: Deliver a story end-to-end via planner, builder, tester, and reviewer subagents, then quality-check and request approval to commit
argument-hint: <story description or SPEC.md feature, e.g. "metrics panel">
---

Deliver this story: $ARGUMENTS

You (the main session) are the orchestrator. Subagents cannot invoke other subagents, so YOU delegate each step below and pass results between them. Do not implement the story yourself.

1. **Plan**: use the `orchestrator` subagent to produce a plan for: $ARGUMENTS. It returns sub-tasks, target files, agent assignments, and mapped acceptance criteria. Show the plan briefly.
2. **Build**: delegate the implementation sub-tasks, in plan order, to the `builder` subagent. Give it the relevant plan rows and criteria.
3. **Test**: use the `tester` subagent to write tests in `tests/` and run `npm run test`.
4. **Review**: use the `reviewer` subagent to inspect the diff (including untracked files) and run `npm run lint`.
5. **Iterate**: if tests fail or the reviewer reports blocking issues, send the exact findings back to `builder` (fix `src/`), then repeat steps 3-4. Maximum 3 iterations. If still failing after 3, stop and report the remaining failures; do not continue.
6. **Quality check**: run the `story-quality-check` skill.
7. **Approval gate**: present the sign-off table and a proposed commit message, then STOP and wait for my explicit approval before running `git commit`. Never run `git push`.

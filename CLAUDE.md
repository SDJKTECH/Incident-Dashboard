# Incident & Task Management Dashboard

Single-page dashboard for tracking incidents and tasks. No backend. Product requirements live in `SPEC.md`.

## Stack

- React 18 + Vite
- TypeScript (`strict`)
- Tailwind CSS
- Vitest + React Testing Library
- SQLite in the browser (sql.js/WASM, persisted to IndexedDB) for incident/task persistence; LocalStorage for filter state

## Engineering standards

- `tsconfig` has `"strict": true`. No `any`. Exported functions have explicit return types.
- UI components live in `src/components/`, one component per file, PascalCase filenames.
- Custom hooks live in `src/hooks/`, prefixed `use` (e.g. `useIncidents`, `useLocalStorage`).
- Data models and types live in `src/types/`.
- Pure utilities (metrics calculations, filtering) live in `src/lib/` and have unit tests.
- Tests live in `tests/`, mirroring the `src/` structure, named `*.test.ts` / `*.test.tsx`. Do not colocate tests in `src/`.

## Commands

- `npm run dev` — start the Vite dev server
- `npm run build` — type-check and production build
- `npm run test` — run Vitest once. When the project is scaffolded, the `test` script MUST be `vitest run` (non-watch) so agents and CI never hang.
- `npm run lint` — run ESLint

## Workflow rules

- Read `SPEC.md` before implementing a feature.
- Run `npm run test` and `npm run lint` before declaring a task done.
- Keep changes small and focused.

## Agent workflow

Subagents live in `.claude/agents/`: `orchestrator` (planner only; Read/Grep/Glob), `builder` (implements in `src/`, no tests), `tester` (writes and runs tests, only under `tests/`), `reviewer` (read-only diff and lint review). Subagents cannot invoke other subagents, so the main session is the real orchestrator.

Run `/deliver-story <story>` (`.claude/commands/deliver-story.md`) to drive it: plan, build, test, review, loop on failures (max 3 iterations), run the `story-quality-check` skill (`.claude/skills/`), then present a sign-off table and proposed commit message. It stops for explicit approval before `git commit` and never pushes.

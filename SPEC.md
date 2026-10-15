# SPEC: Incident & Task Management Dashboard

## 1. Overview & Goals

A single-page dashboard for tracking incidents and tasks. It runs entirely in the browser with no backend; incident and task data is persisted in a browser-side SQLite database (sql.js/WASM, stored in IndexedDB). Filter state remains in LocalStorage.

Goals:
- Give a team an at-a-glance view of incident health (metrics panel).
- Make it fast to find incidents via filters, search, and sorting.
- Support full create/edit/delete of incidents and tasks, with tasks linkable to incidents.
- Survive reloads and corrupt storage without crashing.

## 2. Data Model

```ts
type Severity = 'low' | 'medium' | 'high' | 'critical';
type IncidentStatus = 'open' | 'investigating' | 'resolved' | 'closed';
type TaskStatus = 'todo' | 'in_progress' | 'done';

interface Incident {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  status: IncidentStatus;
  assignee: string;
  tags: string[];
  createdAt: string;   // ISO 8601
  updatedAt: string;   // ISO 8601
  resolvedAt?: string; // ISO 8601; set when status becomes resolved
}

interface Task {
  id: string;
  incidentId?: string; // optional link to an Incident
  title: string;
  status: TaskStatus;
  priority: Severity;  // low | medium | high | critical
  dueDate?: string;    // ISO 8601
  createdAt: string;   // ISO 8601
}
```

Notes:
- `priority` uses the same scale as `Severity` (low | medium | high | critical).
- `resolvedAt` is set when an incident transitions to `resolved` and cleared if it is reopened (`open` / `investigating`). Moving `resolved` → `closed` keeps the existing `resolvedAt`.

## 3. Features

### 3a. Metrics Panel (AC-01)

Displays:
- Open incidents by severity (count per severity; "open" = status `open` or `investigating`).
- MTTR: mean of (`resolvedAt` − `createdAt`) over incidents that have `resolvedAt`.
- Tasks completed vs. pending (`done` vs. `todo` + `in_progress`).
- Incidents created in the last 7 days (rolling window from now).

Acceptance criteria:
- Given incidents with mixed severities and statuses, the panel shows the correct count per severity for `open` and `investigating` incidents only.
- Given no resolved incidents, MTTR displays "N/A" rather than `NaN` or 0.
- Given resolved incidents, MTTR equals the arithmetic mean of resolution durations, formatted in hours/days.
- Completed count equals tasks with status `done`; pending equals all other tasks.
- An incident created 6 days ago is counted in "last 7 days"; one created 8 days ago is not.
- Metrics update immediately after any create, edit, or delete.
- Metric calculations are pure functions in `src/lib/` with unit tests.

### 3b. Filters & Search (AC-02)

Filters: status, severity, assignee, tag, and date range (on `createdAt`). Free-text search over title and description. Sort by date (newest/oldest) or severity (high→low/low→high).

Acceptance criteria:
- Selecting a status/severity/assignee/tag filter shows only matching incidents; multiple filters combine with AND.
- Date range filter includes incidents with `createdAt` on both boundary days.
- Search is case-insensitive and matches substrings in title or description.
- Sorting by severity orders critical > high > medium > low (and the reverse); sorting by date orders by `createdAt`.
- With no matches, an empty-state message is shown.
- A "clear filters" control resets all filters, search, and sort to defaults.
- Filter, search, and sort state persists across page reloads (stored in LocalStorage); corrupt persisted filter state falls back to defaults.
- Filtering and sorting logic are pure functions in `src/lib/` with unit tests.

### 3c. CRUD (AC-03)

Create, edit, and delete incidents and tasks. Tasks can be linked to an incident.

Acceptance criteria:
- Creating an incident requires a non-empty title; submitting an invalid form shows an inline error and does not save.
- New records get a unique `id` and `createdAt`; edits update `updatedAt` (incidents).
- Editing an incident persists changes and they are visible in the list and metrics.
- Changing an incident to `resolved` sets `resolvedAt`; reopening clears it.
- Deleting requires confirmation; after confirmation the record is removed from the list and storage.
- A task can be created with or without an `incidentId`; a linked task is shown under its incident and the incident is shown on the task.
- Deleting an incident does not delete its tasks; they become unlinked (`incidentId` removed).
- Task status can be changed among `todo`, `in_progress`, `done`.

### 3d. Local Persistence (AC-04)

Acceptance criteria:
- Incidents and tasks are stored in a browser-side SQLite database (sql.js/WASM). The exported database is persisted as a binary blob in IndexedDB. The schema is versioned via a `schema_version` value in a `meta` table.
- Loading is asynchronous; the UI shows a non-blocking loading state (live region) until data is hydrated.
- Reads validate the shape of every row; a corrupt database blob or invalid rows are treated as corrupt.
- If the database is missing, corrupt, or fails validation, the app loads with empty/default state, does not throw, and does not crash the UI.
- On corrupt data, the app shows a non-blocking notice and does not silently overwrite until the user's next change.
- If SQLite/WASM or IndexedDB is unavailable (e.g. disabled or quota exceeded), the app still works in-memory and shows a warning.
- Writes occur after every state change; reloading the page restores the same incidents and tasks.
- Legacy data in LocalStorage under `incident-dashboard:v1` is migrated once into SQLite when the database is new/empty and the legacy data validates. The legacy key is kept as a backup and never deleted. Migration is idempotent; invalid legacy data is not imported.
- The storage layer is covered by unit tests, including corrupt database, wrong shape, missing database, and legacy migration.

## 4. Non-Functional Requirements (AC-05)

- **Accessible**: full keyboard navigation; visible focus states; ARIA labels/roles on interactive controls, dialogs, and live regions for status messages; form fields have associated labels; sufficient color contrast (severity is never conveyed by color alone).
- **Responsive**: usable from 320px-wide mobile to desktop; layout reflows (e.g. metrics stack, filters collapse) without horizontal scrolling.
- **Type safety**: TypeScript strict; no runtime type errors from persisted or user-provided data.

Acceptance criteria:
- Every interactive element is reachable and operable via keyboard alone; modals trap focus and close on Escape.
- Interactive controls without visible text have an `aria-label`.
- At 320px viewport width there is no horizontal page scroll.
- `npm run build` completes with zero type errors; `npm run lint` reports zero errors.

## 5. Out of Scope

- Authentication / authorization
- Backend or any network API
- Real-time sync or multi-user collaboration
